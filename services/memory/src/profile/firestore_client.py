"""
firestore_client.py
-------------------
Tier 2 Memory: Firestore-backed child profile store.
Stores persistent facts about the child that ARIA remembers across sessions.
Uses Firestore's native TTL policy for automatic data expiry (90 days).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta

from google.cloud import firestore

logger = logging.getLogger(__name__)

FACTS_TTL_DAYS = 90
COLLECTION_PROFILES = "child_profiles"
COLLECTION_FACTS = "profile_facts"


class FirestoreProfileClient:
    """Async Firestore client for persistent child profile management."""

    def __init__(self) -> None:
        self._db = firestore.AsyncClient()

    def _profile_ref(self, child_id: str) -> firestore.AsyncDocumentReference:
        return self._db.collection(COLLECTION_PROFILES).document(child_id)

    def _facts_collection(self, child_id: str) -> firestore.AsyncCollectionReference:
        return self._profile_ref(child_id).collection(COLLECTION_FACTS)

    async def get_profile(self, child_id: str) -> dict | None:
        """Fetch the child's profile document including recent facts."""
        doc = await self._profile_ref(child_id).get()
        if not doc.exists:
            return None

        profile = doc.to_dict() or {}

        # Fetch top facts (ordered by confidence, limited to 20)
        facts_query = (
            self._facts_collection(child_id)
            .order_by("confidence", direction=firestore.Query.DESCENDING)
            .limit(20)
        )
        facts_docs = await facts_query.get()
        profile["facts"] = [f.to_dict() for f in facts_docs]
        return profile

    async def upsert_fact(
        self,
        child_id: str,
        key: str,
        value: str,
        category: str,
        confidence: float = 0.9,
    ) -> None:
        """Insert or update a profile fact using the key as the document ID."""
        fact_ref = self._facts_collection(child_id).document(key)
        expiry_time = datetime.now(timezone.utc) + timedelta(days=FACTS_TTL_DAYS)

        await fact_ref.set(
            {
                "key": key,
                "value": value,
                "category": category,
                "confidence": confidence,
                "learned_at": firestore.SERVER_TIMESTAMP,
                "expires_at": expiry_time,  # Firestore TTL field
            },
            merge=True,
        )
        logger.info("Profile fact upserted: %s=%s for child %s", key, value, child_id)

    async def delete_child(self, child_id: str) -> None:
        """
        Cascade-delete all data for a child (COPPA right-to-erasure).
        Deletes all facts subcollection documents, then the profile document.
        """
        # Delete all facts
        facts_ref = self._facts_collection(child_id)
        async for batch in self._batch_delete(facts_ref):
            await batch.commit()

        # Delete profile document
        await self._profile_ref(child_id).delete()
        logger.info("Child profile fully deleted: %s", child_id)

    async def _batch_delete(
        self, collection_ref: firestore.AsyncCollectionReference
    ):
        """Yield Firestore write batches for deleting a collection."""
        batch = self._db.batch()
        count = 0
        async for doc in collection_ref.stream():
            batch.delete(doc.reference)
            count += 1
            if count >= 500:  # Firestore batch limit
                yield batch
                batch = self._db.batch()
                count = 0
        if count > 0:
            yield batch
