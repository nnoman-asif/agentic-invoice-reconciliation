"""Opaque guest tokens signed with itsdangerous (X-Guest-Token header)."""

from __future__ import annotations

import uuid
from functools import lru_cache

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.config import settings

_GUEST_SALT = "invoice-recon-guest-v1"
# Guests are short-lived; token max age aligns with the 24h cleanup window
# plus a small buffer so a token outliving its row still fails on lookup.
_GUEST_MAX_AGE_SECONDS = 60 * 60 * 48


@lru_cache(maxsize=1)
def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(
        secret_key=settings.secret_key,
        salt=_GUEST_SALT,
    )


def mint_guest_token(user_id: uuid.UUID) -> str:
    """Return a signed opaque token for the given guest user id."""
    return _serializer().dumps({"uid": str(user_id)})


def verify_guest_token(token: str) -> uuid.UUID:
    """Decode a guest token into a user UUID.

    Raises ``ValueError`` if the signature is bad or expired.
    """
    try:
        payload = _serializer().loads(token, max_age=_GUEST_MAX_AGE_SECONDS)
    except SignatureExpired as exc:
        raise ValueError("Guest token expired") from exc
    except BadSignature as exc:
        raise ValueError("Invalid guest token") from exc

    if not isinstance(payload, dict) or "uid" not in payload:
        raise ValueError("Malformed guest token")

    try:
        return uuid.UUID(str(payload["uid"]))
    except (ValueError, TypeError) as exc:
        raise ValueError("Malformed guest token uid") from exc
