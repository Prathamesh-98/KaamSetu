"""
KaamSetu — Private Document Storage Service
Secure, persistent storage service for sensitive verification evidence (identity
documents, skill certificates, company registration documents).

Supports:
- Private Supabase Storage bucket (`verification-documents`) over REST API using
  backend-only service/secret keys (zero public URLs ever generated).
- Optional/recommended AES-256-GCM authenticated envelope encryption (`KSENC1`)
  before storage upload, preserving compatibility with legacy unencrypted blobs.
- Local filesystem driver (`backend/private_storage`) for isolated development/testing.
"""
import base64
import hashlib
import json
import logging
import mimetypes
import os
import re
import uuid
from pathlib import Path
from typing import Optional, Set, Tuple

import httpx
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from app.core.config import settings, validate_private_docs_encryption_secret

logger = logging.getLogger(__name__)

# Allowed MIME types and size
ALLOWED_DOCUMENT_MIMES: Set[str] = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
}

MAX_DOCUMENT_SIZE_BYTES: int = 5 * 1024 * 1024  # 5 MB
# Supabase free tier supports up to 50 MB/object; 6 MB cap allows 5 MB doc + KSENC1 overhead
BUCKET_FILE_SIZE_LIMIT_BYTES: int = 6 * 1024 * 1024

ALLOWED_SUBFOLDERS: Set[str] = {
    "identity",
    "skills",
    "company",
}

MIME_TO_EXT = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
}

EXT_TO_MIME = {v: k for k, v in MIME_TO_EXT.items()}
EXT_TO_MIME[".jpeg"] = "image/jpeg"

ENVELOPE_MAGIC = b"KSENC1"
ENVELOPE_NONCE_LEN = 12
_SAFE_FILENAME_RE = re.compile(r"^[A-Za-z0-9._-]+$")


def _derive_aes_key(secret: str) -> bytes:
    """
    Validate and derive a 32-byte AES-256 key from either a URL-safe/standard base64
    32-byte secret or a high-entropy passphrase (>=32 chars) via HKDF-SHA256.
    """
    raw = validate_private_docs_encryption_secret(secret)
    try:
        decoded = base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4))
        if len(decoded) == 32:
            return decoded
    except Exception:
        pass
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"kaamsetu-private-docs-v1",
        info=b"aes-256-gcm",
    )
    return hkdf.derive(raw.encode("utf-8"))


def _validate_backend_service_key(service_key: str) -> str:
    """
    Validate backend Supabase Storage key type. Rejects client publishable/anon keys
    to prevent misconfiguration.
    """
    key = service_key.strip()
    if not key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is missing.")
    if key.startswith("sb_publishable_"):
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY cannot be a client publishable key (sb_publishable_*).")
    if key.count(".") == 2:
        try:
            payload_b64 = key.split(".")[1]
            payload_raw = base64.urlsafe_b64decode(payload_b64 + "=" * (-len(payload_b64) % 4))
            claims = json.loads(payload_raw.decode("utf-8"))
            if isinstance(claims, dict) and claims.get("role") == "anon":
                raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY cannot be an anon JWT key.")
        except RuntimeError:
            raise
        except Exception:
            pass
    return key


class SupabasePrivateBucketDriver:
    """Thin REST client for Supabase Storage private buckets (backend-only)."""

    def __init__(
        self,
        supabase_url: str,
        service_key: str,
        bucket: str = "verification-documents",
        timeout: float = 20.0,
        transport: Optional[httpx.BaseTransport] = None,
    ):
        self.base_url = supabase_url.strip().rstrip("/")
        self.service_key = _validate_backend_service_key(service_key)
        self.bucket = bucket.strip()
        self.timeout = timeout
        self.transport = transport

    def _headers(self, extra: Optional[dict] = None) -> dict:
        headers = {"apikey": self.service_key}
        # Per Supabase docs: modern opaque `sb_secret_*` keys are NOT JWTs and must
        # only be sent in `apikey` (never as `Authorization: Bearer <non-JWT>`).
        # Legacy `service_role` JWTs (3 dot-separated segments) require `Authorization: Bearer`.
        if not self.service_key.startswith("sb_secret_") and self.service_key.count(".") == 2:
            headers["Authorization"] = f"Bearer {self.service_key}"
        if extra:
            headers.update(extra)
        return headers

    def _client(self) -> httpx.Client:
        kwargs = {"timeout": self.timeout}
        if self.transport is not None:
            kwargs["transport"] = self.transport
        return httpx.Client(**kwargs)

    @staticmethod
    def _is_missing_resource(resp: httpx.Response, *, allow_object_missing: bool = False) -> bool:
        """
        Detect Supabase Storage missing bucket/object responses without suppressing genuine
        auth (401/403), permission, or unrelated HTTP 400 validation errors.
        Supabase Storage commonly returns HTTP 400 with embedded {"statusCode": "404", ...}.
        """
        if resp.status_code == 404:
            return True
        if resp.status_code != 400:
            return False
        try:
            body = resp.json()
        except Exception:
            return False
        if not isinstance(body, dict):
            return False

        embedded_status = str(body.get("statusCode") or "")
        code = str(body.get("code") or "")
        err = str(body.get("error") or "").lower()
        msg = str(body.get("message") or "").lower()

        if embedded_status == "404":
            if code == "NoSuchBucket" or "bucket not found" in err or "bucket not found" in msg:
                return True
            if allow_object_missing and (
                code == "NoSuchKey"
                or err in ("not_found", "nosuchkey")
                or "not found" in msg
            ):
                return True
        if allow_object_missing and err == "not_found":
            return True
        return False

    def get_bucket_info(self) -> Optional[dict]:
        url = f"{self.base_url}/storage/v1/bucket/{self.bucket}"
        with self._client() as client:
            resp = client.get(url, headers=self._headers())
        if self._is_missing_resource(resp, allow_object_missing=False):
            return None
        if resp.status_code >= 400:
            raise RuntimeError(f"Supabase bucket lookup failed ({resp.status_code}): {resp.text[:200]}")
        return resp.json()

    def ensure_private_bucket(self) -> dict:
        """
        Ensure the private bucket exists and is NEVER public.
        Intended only for explicit provisioning/migration CLI invocation.
        """
        existing = self.get_bucket_info()
        if existing is not None:
            if existing.get("public") is True:
                raise RuntimeError(
                    f"SECURITY ABORT: Bucket '{self.bucket}' already exists as PUBLIC."
                )
            return existing

        url = f"{self.base_url}/storage/v1/bucket"
        payload = {
            "id": self.bucket,
            "name": self.bucket,
            "public": False,
            "file_size_limit": BUCKET_FILE_SIZE_LIMIT_BYTES,
            "allowed_mime_types": [
                "image/jpeg",
                "image/png",
                "image/webp",
                "application/pdf",
                "application/octet-stream",
            ],
        }
        with self._client() as client:
            resp = client.post(
                url,
                headers=self._headers({"Content-Type": "application/json"}),
                json=payload,
            )
        if resp.status_code >= 400:
            raise RuntimeError(f"Failed creating private bucket '{self.bucket}' ({resp.status_code}): {resp.text[:200]}")
        return resp.json()

    def upload(self, object_path: str, data: bytes, content_type: str, upsert: bool = False) -> None:
        url = f"{self.base_url}/storage/v1/object/{self.bucket}/{object_path.lstrip('/')}"
        headers = self._headers({
            "Content-Type": content_type,
            "x-upsert": "true" if upsert else "false",
        })
        with self._client() as client:
            resp = client.post(url, headers=headers, content=data)
        if resp.status_code >= 400:
            raise RuntimeError(f"Supabase Storage upload failed ({resp.status_code}): {resp.text[:200]}")

    def download(self, object_path: str) -> bytes:
        url = f"{self.base_url}/storage/v1/object/{self.bucket}/{object_path.lstrip('/')}"
        with self._client() as client:
            resp = client.get(url, headers=self._headers())
        if self._is_missing_resource(resp, allow_object_missing=True):
            raise FileNotFoundError("Requested document file does not exist in private storage.")
        if resp.status_code >= 400:
            raise RuntimeError(f"Supabase Storage download failed ({resp.status_code}): {resp.text[:200]}")
        return resp.content

    def delete(self, object_path: str) -> bool:
        url = f"{self.base_url}/storage/v1/object/{self.bucket}/{object_path.lstrip('/')}"
        with self._client() as client:
            resp = client.delete(url, headers=self._headers())
        if self._is_missing_resource(resp, allow_object_missing=True):
            return False
        if resp.status_code >= 400:
            raise RuntimeError(f"Supabase Storage delete failed ({resp.status_code}): {resp.text[:200]}")
        return True


class PrivateDocumentStorage:
    def __init__(
        self,
        base_dir: Optional[str] = None,
        backend_mode: Optional[str] = None,
        supabase_url: Optional[str] = None,
        supabase_service_key: Optional[str] = None,
        bucket_name: Optional[str] = None,
        encryption_key: Optional[str] = None,
        transport: Optional[httpx.BaseTransport] = None,
    ):
        backend_root = Path(__file__).resolve().parent.parent.parent
        if base_dir:
            self.base_path = Path(base_dir).resolve()
        else:
            configured_dir = getattr(settings, "PRIVATE_DOCS_DIR", "private_storage")
            self.base_path = (backend_root / configured_dir).resolve()

        self._override_backend = backend_mode
        self._override_supabase_url = supabase_url
        self._override_service_key = supabase_service_key
        self._override_bucket = bucket_name
        self._override_encryption_key = encryption_key
        self._transport = transport

        if self._resolve_backend_mode() == "local":
            self._ensure_dirs()
            self._migrate_legacy_storage(backend_root)

    def _resolve_backend_mode(self) -> str:
        mode = (
            self._override_backend
            if self._override_backend is not None
            else getattr(settings, "PRIVATE_DOCS_STORAGE_BACKEND", "auto")
        ).strip().lower()

        supa_url = self._get_supabase_url()
        supa_key = self._get_service_key()

        if mode == "local":
            return "local"
        if mode == "supabase":
            if not supa_url or not supa_key:
                raise RuntimeError(
                    "Supabase private storage selected, but SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing."
                )
            return "supabase"
        if supa_url and supa_key:
            return "supabase"
        return "local"

    def _get_supabase_url(self) -> str:
        val = (
            self._override_supabase_url
            if self._override_supabase_url is not None
            else (getattr(settings, "SUPABASE_URL", None) or "")
        )
        return val.strip().rstrip("/")

    def _get_service_key(self) -> str:
        val = (
            self._override_service_key
            if self._override_service_key is not None
            else (getattr(settings, "SUPABASE_SERVICE_ROLE_KEY", None) or "")
        )
        return val.strip()

    def _get_bucket_name(self) -> str:
        val = (
            self._override_bucket
            if self._override_bucket is not None
            else (getattr(settings, "SUPABASE_STORAGE_BUCKET", None) or "verification-documents")
        )
        return val.strip()

    def _get_encryption_secret(self) -> Optional[str]:
        val = (
            self._override_encryption_key
            if self._override_encryption_key is not None
            else getattr(settings, "PRIVATE_DOCS_ENCRYPTION_KEY", None)
        )
        if val and val.strip():
            return val.strip()
        return None

    def _get_supabase_driver(self) -> SupabasePrivateBucketDriver:
        return SupabasePrivateBucketDriver(
            supabase_url=self._get_supabase_url(),
            service_key=self._get_service_key(),
            bucket=self._get_bucket_name(),
            transport=self._transport,
        )

    def _ensure_dirs(self):
        self.base_path.mkdir(parents=True, exist_ok=True)
        for sub in ALLOWED_SUBFOLDERS:
            (self.base_path / sub).mkdir(parents=True, exist_ok=True)

    def _migrate_legacy_storage(self, backend_root: Path):
        """
        Safely migrate any existing private documents stored in legacy
        backend/uploads/private_docs to the isolated self.base_path,
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
                shutil.rmtree(legacy_path, ignore_errors=True)
                logger.info(f"Safely migrated legacy private documents to {self.base_path}")
            except Exception as e:
                logger.warning(f"Failed to migrate legacy private docs: {e}")

    def validate_document(self, file_bytes: bytes, content_type: str) -> str:
        """Validate size and MIME type of uploaded verification document."""
        if not file_bytes or len(file_bytes) == 0:
            raise ValueError("Document file is empty.")

        if len(file_bytes) > MAX_DOCUMENT_SIZE_BYTES:
            raise ValueError(
                f"File size exceeds maximum allowed limit of {MAX_DOCUMENT_SIZE_BYTES // (1024 * 1024)} MB."
            )

        normalized_mime = content_type.lower().split(";")[0].strip()
        if normalized_mime not in ALLOWED_DOCUMENT_MIMES:
            raise ValueError(
                f"Unsupported document MIME type: '{normalized_mime}'. "
                f"Allowed formats are JPEG, PNG, WebP, and PDF."
            )

        if normalized_mime == "application/pdf" and not file_bytes.startswith(b"%PDF"):
            raise ValueError("Invalid PDF file format. Missing PDF signature.")
        elif normalized_mime == "image/jpeg" and not file_bytes.startswith(b"\xff\xd8"):
            raise ValueError("Invalid JPEG file format. Missing JPEG SOI marker.")
        elif normalized_mime == "image/png" and not file_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
            raise ValueError("Invalid PNG file format. Missing PNG header signature.")
        elif normalized_mime == "image/webp" and (b"WEBP" not in file_bytes[:16]):
            raise ValueError("Invalid WebP file format.")

        return normalized_mime

    def _is_production_env(self) -> bool:
        return (getattr(settings, "ENVIRONMENT", "") or "").strip().lower() in ("production", "prod")

    def _encrypt_if_configured(self, plaintext: bytes, aad: bytes) -> Tuple[bytes, bool]:
        secret = self._get_encryption_secret()
        if not secret:
            if self._is_production_env() and self._resolve_backend_mode() == "supabase":
                raise RuntimeError(
                    "PRIVATE_DOCS_ENCRYPTION_KEY is mandatory when production Supabase private storage is enabled."
                )
            return plaintext, False
        key = _derive_aes_key(secret)
        nonce = os.urandom(ENVELOPE_NONCE_LEN)
        ct = AESGCM(key).encrypt(nonce, plaintext, aad)
        return ENVELOPE_MAGIC + nonce + ct, True

    def _decrypt_if_needed(self, stored_bytes: bytes, aad: bytes) -> bytes:
        if not stored_bytes.startswith(ENVELOPE_MAGIC):
            return stored_bytes
        secret = self._get_encryption_secret()
        if not secret:
            raise RuntimeError(
                "Document is encrypted (KSENC1), but PRIVATE_DOCS_ENCRYPTION_KEY is not configured."
            )
        payload = stored_bytes[len(ENVELOPE_MAGIC):]
        if len(payload) <= ENVELOPE_NONCE_LEN:
            raise ValueError("Corrupted encrypted document envelope.")
        nonce = payload[:ENVELOPE_NONCE_LEN]
        ciphertext = payload[ENVELOPE_NONCE_LEN:]
        key = _derive_aes_key(secret)
        return AESGCM(key).decrypt(nonce, ciphertext, aad)

    @staticmethod
    def parse_private_uri(document_uri: str) -> Tuple[str, str]:
        """Validate and split `private://{subfolder}/{filename}` without path traversal."""
        if not document_uri or not document_uri.startswith("private://"):
            raise ValueError("Invalid private document URI format.")
        parts = document_uri[len("private://"):].split("/")
        if len(parts) != 2:
            raise ValueError("Malformed private document URI.")
        subfolder, filename = parts[0], parts[1]
        if subfolder not in ALLOWED_SUBFOLDERS:
            raise ValueError(f"Invalid subfolder '{subfolder}' in URI.")
        clean_filename = Path(filename).name
        if (
            not clean_filename
            or clean_filename != filename
            or ".." in clean_filename
            or not _SAFE_FILENAME_RE.match(clean_filename)
        ):
            raise PermissionError("Invalid or unsafe document filename.")
        return subfolder, clean_filename

    def store_document(self, file_bytes: bytes, content_type: str, subfolder: str) -> str:
        """
        Validate, optionally envelope-encrypt, and store a verification document.
        Returns canonical URI `private://{subfolder}/{file_id}{ext}`.
        Never returns a public URL.
        """
        if subfolder not in ALLOWED_SUBFOLDERS:
            raise ValueError(f"Invalid storage subfolder '{subfolder}'. Allowed: {ALLOWED_SUBFOLDERS}")
        mime = self.validate_document(file_bytes, content_type)
        ext = MIME_TO_EXT.get(mime, ".bin")
        file_id = f"{uuid.uuid4().hex}{ext}"
        uri = f"private://{subfolder}/{file_id}"
        self.store_document_at_uri(uri, file_bytes, mime, upsert=False)
        return uri

    def store_document_at_uri(
        self,
        document_uri: str,
        file_bytes: bytes,
        content_type: str,
        upsert: bool = False,
    ) -> str:
        """
        Persist validated document bytes at an explicit `private://{subfolder}/{filename}` URI.
        Used for migrating existing records while preserving their DB `document_url`.
        """
        subfolder, clean_filename = self.parse_private_uri(document_uri)
        mime = self.validate_document(file_bytes, content_type)
        object_path = f"{subfolder}/{clean_filename}"
        aad = object_path.encode("utf-8")
        stored_bytes, is_encrypted = self._encrypt_if_configured(file_bytes, aad)
        upload_mime = "application/octet-stream" if is_encrypted else mime

        if self._resolve_backend_mode() == "supabase":
            self._get_supabase_driver().upload(object_path, stored_bytes, upload_mime, upsert=upsert)
            return document_uri

        self._ensure_dirs()
        target_path = (self.base_path / subfolder / clean_filename).resolve()
        if not str(target_path).startswith(str(self.base_path)):
            raise PermissionError("Directory traversal detected.")
        with open(target_path, "wb") as f:
            f.write(stored_bytes)
        return document_uri

    def retrieve_document(self, document_uri: str) -> Tuple[bytes, str, str]:
        """
        Retrieve and decrypt document bytes, MIME type, and safe display filename.
        Raises FileNotFoundError if missing.
        """
        subfolder, clean_filename = self.parse_private_uri(document_uri)
        object_path = f"{subfolder}/{clean_filename}"
        aad = object_path.encode("utf-8")

        if self._resolve_backend_mode() == "supabase":
            raw_bytes = self._get_supabase_driver().download(object_path)
        else:
            target_path = (self.base_path / subfolder / clean_filename).resolve()
            if not str(target_path).startswith(str(self.base_path)):
                raise PermissionError("Directory traversal detected.")
            if not target_path.is_file():
                raise FileNotFoundError("Requested document file does not exist.")
            with open(target_path, "rb") as f:
                raw_bytes = f.read()

        plaintext = self._decrypt_if_needed(raw_bytes, aad)
        ext = Path(clean_filename).suffix.lower()
        content_type = EXT_TO_MIME.get(ext) or mimetypes.guess_type(clean_filename)[0] or "application/octet-stream"
        return plaintext, content_type, clean_filename

    def delete_document(self, document_uri: str) -> bool:
        """Delete an object by private URI (used for migration rollback and test cleanup)."""
        subfolder, clean_filename = self.parse_private_uri(document_uri)
        object_path = f"{subfolder}/{clean_filename}"
        if self._resolve_backend_mode() == "supabase":
            return self._get_supabase_driver().delete(object_path)
        target_path = (self.base_path / subfolder / clean_filename).resolve()
        if not str(target_path).startswith(str(self.base_path)):
            raise PermissionError("Directory traversal detected.")
        if target_path.is_file():
            target_path.unlink()
            return True
        return False

    @staticmethod
    def sha256_bytes(data: bytes) -> str:
        return hashlib.sha256(data).hexdigest()


# Global singleton instance
private_storage = PrivateDocumentStorage()
