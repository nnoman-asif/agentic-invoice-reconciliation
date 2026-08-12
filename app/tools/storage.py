"""Thin storage interface for invoice PDFs.

Local disk today; swap in an R2/S3 implementation later without touching
upload or cleanup call sites.
"""

from __future__ import annotations

import logging
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)


class LocalDiskStorage:
    """Store files under ``settings.upload_dir`` (or an absolute root)."""

    def __init__(self, root: str | Path | None = None) -> None:
        self.root = Path(root or settings.upload_dir)
        self.root.mkdir(parents=True, exist_ok=True)

    def path_for(self, name: str) -> Path:
        """Return absolute path for a relative name like ``{uuid}.pdf``."""
        candidate = (self.root / Path(name).name).resolve()
        try:
            candidate.relative_to(self.root.resolve())
        except ValueError as exc:
            raise ValueError("Invalid storage path") from exc
        return candidate

    def resolve_stored(self, stored: str | None) -> Path | None:
        """Map a DB ``raw_file_path`` to an absolute file path."""
        if not stored:
            return None
        p = Path(stored)
        if p.is_absolute():
            return p if p.exists() else None
        # Historical rows may store ``uploads/invoices/<uuid>.pdf``
        name = p.name
        candidate = self.path_for(name)
        if candidate.exists():
            return candidate
        # Fall back to path relative to CWD (legacy writes)
        legacy = Path(stored)
        return legacy if legacy.exists() else None

    def write_bytes(self, name: str, data: bytes) -> str:
        """Write bytes and return the relative path stored in the DB."""
        path = self.path_for(name)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return str(Path(settings.upload_dir) / path.name).replace("\\", "/")

    def delete(self, stored: str | None) -> bool:
        """Delete a stored file. Returns True if a file was removed."""
        path = self.resolve_stored(stored)
        if path is None or not path.exists():
            return False
        try:
            path.unlink()
            return True
        except OSError as exc:
            logger.warning("[Storage] Failed to delete %s: %s", path, exc)
            return False

    def exists(self, stored: str | None) -> bool:
        path = self.resolve_stored(stored)
        return path is not None and path.exists()


_storage: LocalDiskStorage | None = None


def get_storage() -> LocalDiskStorage:
    global _storage
    if _storage is None:
        _storage = LocalDiskStorage()
    return _storage
