"""
test_jwt_validator.py
---------------------
Unit tests for the JWT validator.
Tests valid tokens, expired tokens, missing claims, and tampered tokens.
"""

import time
from pathlib import Path

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException

from src.auth.jwt_validator import JWTValidator, TokenClaims


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def rsa_key_pair(tmp_path_factory):
    """Generate a temporary RSA key pair for testing."""
    tmp_path = tmp_path_factory.mktemp("keys")
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    public_key = private_key.public_key()

    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )

    public_key_path = tmp_path / "public.pem"
    public_key_path.write_bytes(public_pem)

    return {
        "private_pem": private_pem,
        "public_key_path": str(public_key_path),
    }


@pytest.fixture
def validator(rsa_key_pair):
    return JWTValidator(
        public_key_path=rsa_key_pair["public_key_path"],
        algorithm="RS256",
        audience="aria-gateway",
    )


def make_token(private_pem: bytes, overrides: dict = None) -> str:
    payload = {
        "sub": "session-123",
        "aud": "aria-gateway",
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600,
        "child_id": "child-001",
        "device_id": "device-001",
        "parent_id": "parent-001",
        "session_id": "session-123",
    }
    if overrides:
        payload.update(overrides)
    return jwt.encode(payload, private_pem, algorithm="RS256")


# ─── Tests ────────────────────────────────────────────────────────────────────

class TestJWTValidator:

    def test_valid_token_returns_claims(self, validator, rsa_key_pair):
        token = make_token(rsa_key_pair["private_pem"])
        claims = validator.validate(token)
        assert isinstance(claims, TokenClaims)
        assert claims.child_id == "child-001"
        assert claims.device_id == "device-001"
        assert claims.parent_id == "parent-001"
        assert claims.session_id == "session-123"

    def test_expired_token_raises_401(self, validator, rsa_key_pair):
        token = make_token(rsa_key_pair["private_pem"], {"exp": int(time.time()) - 10})
        with pytest.raises(HTTPException) as exc_info:
            validator.validate(token)
        assert exc_info.value.status_code == 401
        assert "expired" in exc_info.value.detail.lower()

    def test_missing_claims_raises_401(self, validator, rsa_key_pair):
        token = make_token(rsa_key_pair["private_pem"], {"child_id": None})
        # Remove child_id from payload
        payload = {
            "sub": "session-123",
            "aud": "aria-gateway",
            "iat": int(time.time()),
            "exp": int(time.time()) + 3600,
            # child_id intentionally omitted
            "device_id": "device-001",
            "parent_id": "parent-001",
            "session_id": "session-123",
        }
        token = jwt.encode(payload, rsa_key_pair["private_pem"], algorithm="RS256")
        with pytest.raises(HTTPException) as exc_info:
            validator.validate(token)
        assert exc_info.value.status_code == 401

    def test_wrong_audience_raises_401(self, validator, rsa_key_pair):
        token = make_token(rsa_key_pair["private_pem"], {"aud": "wrong-audience"})
        with pytest.raises(HTTPException) as exc_info:
            validator.validate(token)
        assert exc_info.value.status_code == 401

    def test_tampered_token_raises_401(self, validator, rsa_key_pair):
        token = make_token(rsa_key_pair["private_pem"])
        # Tamper with the payload section
        parts = token.split(".")
        tampered = parts[0] + "." + "dGFtcGVyZWQ" + "." + parts[2]
        with pytest.raises(HTTPException) as exc_info:
            validator.validate(tampered)
        assert exc_info.value.status_code == 401
