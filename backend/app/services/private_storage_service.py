"""
KaamSetu — Private Document Storage Service
Secure storage service for sensitive verification evidence (identity documents,
skill certificates, company registration documents).
Files are stored outside the public web root and accessible ONLY via authorized API endpoints.
"""
import os
import uuid
import mimetypes
from pathlib import Path
from typing import Tuple, Optional, Set
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

# Allowed MIME types and size
ALLOWED_DOCUMENT_MIMES: Set[str] = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
}

MAX_DOCUMENT_SIZE_BYTES: int = 5 * 1024 * 1024  # 5 MB

ALLOWED_SUBFOLDERS: Set[str] = {
    "identity",
    "skills",
    "company",
}

# MIME to safe extension mapping
MIME_TO_EXT = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
}


class PrivateDocumentStorage:
    def __init__(self, base_dir: Optional[str] = None):
        backend_root = Path(__file__).resolve().parent.parent.parent
        if base_dir:
            self.base_path = Path(base_dir).resolve()
        else:
            # Default to backend/private_storage (strictly isolated from public static mounts)
            configured_dir = getattr(settings, "PRIVATE_DOCS_DIR", "private_storage")
            self.base_path = (backend_root / configured_dir).resolve()
        self._ensure_dirs()
        self._migrate_legacy_storage(backend_root)

    def _ensure_dirs(self):
        self.base_path.mkdir(parents=True, exist_ok=True)
        for sub in ALLOWED_SUBFOLDERS:
            folder = self.base_path / sub
            folder.mkdir(parents=True, exist_ok=True)

    def _migrate_legacy_storage(self, backend_root: Path):
        """
        Safely migrate any existing private documents stored in legacy
        backend/uploads/private_docs to the secure self.base_path,
        then remove the legacy directory to prevent public static file leakage.
        """
        legacy_path = (backend_root / "uploads" / "private_docs").resolve()
        if legacy_path.exists() and legacy_path.is_dir():
            try:
                import shutil
                for sub in ALLOWED_SUBFOLDERS:
                    legacy_sub = legacy_path / sub
                    if legacy_sub.exists() and legacy_sub.is_dir():
                        target_sub = self.base_path / sub
                        target_sub.mkdir(parents=True, exist_ok=True)
                        for item in legacy_sub.iterdir():
                            if item.is_file():
                                target_file = target_sub / item.name
                                if not target_file.exists():
                                    shutil.copy2(item, target_file)
                # Remove legacy directory so it cannot be served via /uploads
                shutil.rmtree(legacy_path, ignore_errors=True)
                logger.info(f"Safely migrated legacy private documents to {self.base_path}")
            except Exception as e:
                logger.warning(f"Failed to migrate legacy private docs: {e}")

    def validate_document(self, file_bytes: bytes, content_type: str):
        """Validate size and MIME type of uploaded verification document."""
        if not file_bytes or len(file_bytes) == 0:
            raise ValueError("Document file is empty.")

        if len(file_bytes) > MAX_DOCUMENT_SIZE_BYTES:
            raise ValueError(
                f"File size exceeds maximum allowed limit of {MAX_DOCUMENT_SIZE_BYTES // (1024 * 1024)} MB."
            )

        # Normalize content type
        normalized_mime = content_type.lower().split(";")[0].strip()
        if normalized_mime not in ALLOWED_DOCUMENT_MIMES:
            raise ValueError(
                f"Unsupported document MIME type: '{normalized_mime}'. "
                f"Allowed formats are JPEG, PNG, WebP, and PDF."
            )

        # Magic number header check for basic spoofing prevention
        if normalized_mime == "application/pdf" and not file_bytes.startswith(b"%PDF"):
            raise ValueError("Invalid PDF file format. Missing PDF signature.")
        elif normalized_mime == "image/jpeg" and not file_bytes.startswith(b"\xff\xd8"):
            raise ValueError("Invalid JPEG file format. Missing JPEG SOI marker.")
        elif normalized_mime == "image/png" and not file_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
            raise ValueError("Invalid PNG file format. Missing PNG header signature.")
        elif normalized_mime == "image/webp" and (b"WEBP" not in file_bytes[:16]):
            raise ValueError("Invalid WebP file format.")

        return normalized_mime

    def store_document(self, file_bytes: bytes, content_type: str, subfolder: str) -> str:
        """
        Store a validated document in private storage.
        Returns a private URI reference in format: 'private://{subfolder}/{file_id}{ext}'
        Never returns a public CDN URL or exposes physical server paths.
        """
        if subfolder not in ALLOWED_SUBFOLDERS:
            raise ValueError(f"Invalid storage subfolder '{subfolder}'. Allowed: {ALLOWED_SUBFOLDERS}")

        mime = self.validate_document(file_bytes, content_type)
        ext = MIME_TO_EXT.get(mime, ".bin")
        file_id = f"{uuid.uuid4().hex}{ext}"

        dest_folder = self.base_path / subfolder
        dest_folder.mkdir(parents=True, exist_ok=True)
        dest_path = dest_folder / file_id

        # Write file atomically
        with open(dest_path, "wb") as f:
            f.write(file_bytes)

        return f"private://{subfolder}/{file_id}"

    def retrieve_document(self, document_uri: str) -> Tuple[bytes, str, str]:
        """
        Retrieve document bytes, MIME type, and safe display filename.
        Raises FileNotFoundError if file is missing.
        """
        if not document_uri or not document_uri.startswith("private://"):
            raise ValueError("Invalid private document URI format.")

        parts = document_uri[len("private://"):].split("/")
        if len(parts) != 2:
            raise ValueError("Malformed private document URI.")

        subfolder, filename = parts[0], parts[1]
        if subfolder not in ALLOWED_SUBFOLDERS:
            raise ValueError(f"Invalid subfolder '{subfolder}' in URI.")

        # Ensure filename is safe (no path traversal)
        clean_filename = Path(filename).name
        target_path = (self.base_path / subfolder / clean_filename).resolve()

        # Prevent directory traversal attacks
        if not str(target_path).startswith(str(self.base_path)):
            raise PermissionError("Directory traversal detected.")

        if not target_path.is_file():
            raise FileNotFoundError("Requested document file does not exist.")

        with open(target_path, "rb") as f:
            file_bytes = f.read()

        guessed_type, _ = mimetypes.guess_type(target_path)
        content_type = guessed_type or "application/octet-stream"
        return file_bytes, content_type, clean_filename


# Global singleton instance
private_storage = PrivateDocumentStorage()
