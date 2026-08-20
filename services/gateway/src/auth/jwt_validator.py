"""
jwt_validator.py
----------------
Validates short-lived JWT session tokens issued by the Auth service.
Uses RS256 (asymmetric) signing — the Gateway only holds the PUBLIC key.
This prevents token forgery even if the Gateway is compromised.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

import jwt
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class TokenClaims:
    """Validated and parsed claims from a session JWT."""

    child_id: str
    device_id: str
    parent_id: str
    session_id: str


class JWTValidator:
    """Validates RS256-signed JWTs for WebSocket session authentication."""

    def __init__(self, public_key_path: str, algorithm: str, audience: str) -> None:
        key_path = Path(public_key_path)
        if not key_path.exists():
            raise FileNotFoundError(f"JWT public key not found at: {public_key_path}")
        self._public_key = key_path.read_text(encoding="utf-8")
        self._algorithm = algorithm
        self._audience = audience

    def validate(self, token: str) -> TokenClaims:
        """
        Validate a JWT and return its claims.

        Raises:
            HTTPException 401: If the token is invalid, expired, or malformed.
        """
        try:
            payload = jwt.decode(
                token,
                self._public_key,
                algorithms=[self._algorithm],
                audience=self._audience,
                options={"require": ["exp", "iat", "sub", "aud"]},
            )
        except jwt.ExpiredSignatureError:
            logger.warning("Rejected expired JWT token")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session token has expired",
            ) from None
        except jwt.InvalidTokenError as exc:
            logger.warning("Rejected invalid JWT token: %s", str(exc))
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid session token",
            ) from None

        # Validate required custom claims
        required_claims = {"child_id", "device_id", "parent_id", "session_id"}
        missing = required_claims - set(payload.keys())
        if missing:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Token missing required claims: {missing}",
            )

        return TokenClaims(
            child_id=payload["child_id"],
            device_id=payload["device_id"],
            parent_id=payload["parent_id"],
            session_id=payload["session_id"],
        )
