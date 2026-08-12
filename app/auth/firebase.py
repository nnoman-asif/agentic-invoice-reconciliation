"""Firebase Admin SDK helpers for verifying ID tokens."""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from functools import lru_cache

import firebase_admin
from firebase_admin import auth, credentials

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class FirebaseIdentity:
    uid: str
    email: str | None
    display_name: str | None


@lru_cache(maxsize=1)
def init_firebase() -> bool:
    """Initialise the Admin SDK once. Returns True if ready to verify tokens."""
    if firebase_admin._apps:  # noqa: SLF001 - public check used by firebase-admin
        return True

    project_id = settings.firebase_project_id or None
    cred = None

    raw_json = (settings.firebase_credentials_json or "").strip()
    if raw_json:
        try:
            cred = credentials.Certificate(json.loads(raw_json))
        except (json.JSONDecodeError, ValueError) as exc:
            logger.error("[Auth] Invalid firebase_credentials_json: %s", exc)
            return False
    elif os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        try:
            cred = credentials.ApplicationDefault()
        except Exception as exc:  # pragma: no cover - env misconfig
            logger.error("[Auth] GOOGLE_APPLICATION_CREDENTIALS failed: %s", exc)
            return False

    # Emulator mode: Admin SDK honours FIREBASE_AUTH_EMULATOR_HOST and
    # accepts unsigned tokens without a service-account credential.
    emulator = os.environ.get("FIREBASE_AUTH_EMULATOR_HOST")
    options = {"projectId": project_id} if project_id else None

    try:
        if cred is not None:
            firebase_admin.initialize_app(cred, options)
        elif emulator and project_id:
            firebase_admin.initialize_app(options=options)
        elif project_id:
            # Application Default Credentials via ADC / metadata
            firebase_admin.initialize_app(options=options)
        else:
            logger.warning(
                "[Auth] Firebase not configured "
                "(set FIREBASE_PROJECT_ID and credentials, or the emulator)"
            )
            return False
    except Exception as exc:
        logger.error("[Auth] Firebase init failed: %s", exc)
        return False

    logger.info(
        "[Auth] Firebase Admin initialised (project=%s, emulator=%s)",
        project_id,
        bool(emulator),
    )
    return True


def verify_id_token(token: str) -> FirebaseIdentity:
    """Verify a Firebase ID token and return the decoded identity.

    Raises ``ValueError`` on any verification failure so callers can map
    to HTTP 401 without leaking SDK details.
    """
    if not init_firebase():
        raise ValueError("Firebase is not configured")

    try:
        decoded = auth.verify_id_token(token)
    except Exception as exc:
        raise ValueError(f"Invalid Firebase ID token: {exc}") from exc

    uid = decoded.get("uid") or decoded.get("user_id")
    if not uid:
        raise ValueError("Firebase token missing uid")

    return FirebaseIdentity(
        uid=str(uid),
        email=decoded.get("email"),
        display_name=decoded.get("name"),
    )
