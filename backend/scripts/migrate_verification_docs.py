"""
KaamSetu — Private Verification Document Provisioning, Migration & Rollback Utility.

Safely provisions the private Supabase Storage bucket (`verification-documents`),
migrates locally backed-up verification documents while preserving existing DB
`VerificationRecord.document_url` (`private://{subfolder}/{filename}`), verifies
plaintext SHA-256 round-trip integrity, and supports clean rollback.

Usage examples (after explicit approval):
  python -m scripts.migrate_verification_docs --check-bucket
  python -m scripts.migrate_verification_docs --create-bucket
  python -m scripts.migrate_verification_docs --migrate-file <path> --record-id <uuid> [--dry-run]
  python -m scripts.migrate_verification_docs --rollback --receipt <receipt.json>
"""
import argparse
import asyncio
import json
import mimetypes
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional
from uuid import UUID

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import select
from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.models import VerificationRecord
from app.services.private_storage_service import EXT_TO_MIME, PrivateDocumentStorage


def _detect_mime(file_path: Path, file_bytes: bytes) -> str:
    ext_mime = EXT_TO_MIME.get(file_path.suffix.lower())
    if ext_mime:
        return ext_mime
    if file_bytes.startswith(b"%PDF"):
        return "application/pdf"
    if file_bytes.startswith(b"\xff\xd8"):
        return "image/jpeg"
    if file_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if b"WEBP" in file_bytes[:16]:
        return "image/webp"
    guessed, _ = mimetypes.guess_type(str(file_path))
    return guessed or "application/octet-stream"


async def migrate_record_from_backup(
    db_session_factory,
    storage: PrivateDocumentStorage,
    record_id: UUID,
    source_file: Path,
    dry_run: bool = False,
    overwrite: bool = False,
) -> Dict[str, Any]:
    """
    Transfer a locally backed-up verification document into private storage at the
    record's existing `document_url`, verify plaintext SHA-256 round-trip, and leave
    database references completely intact.
    """
    if not source_file.is_file():
        raise FileNotFoundError(f"Backup file not found: {source_file}")

    file_bytes = source_file.read_bytes()
    content_type = _detect_mime(source_file, file_bytes)
    storage.validate_document(file_bytes, content_type)
    source_sha256 = storage.sha256_bytes(file_bytes)

    async with db_session_factory() as db:
        res = await db.execute(select(VerificationRecord).where(VerificationRecord.id == record_id))
        record = res.scalar_one_or_none()
        if not record:
            raise LookupError(f"VerificationRecord {record_id} not found in database.")
        if not record.document_url:
            raise ValueError(f"VerificationRecord {record_id} has no document_url.")
        doc_uri = record.document_url
        storage.parse_private_uri(doc_uri)

    receipt: Dict[str, Any] = {
        "record_id": str(record_id),
        "document_url": doc_uri,
        "source_file": str(source_file),
        "content_type": content_type,
        "size_bytes": len(file_bytes),
        "plaintext_sha256": source_sha256,
        "dry_run": dry_run,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
    }

    if dry_run:
        receipt["status"] = "dry_run_validated"
        return receipt

    storage.store_document_at_uri(doc_uri, file_bytes, content_type, upsert=overwrite)
    roundtrip_bytes, roundtrip_mime, roundtrip_name = storage.retrieve_document(doc_uri)
    roundtrip_sha256 = storage.sha256_bytes(roundtrip_bytes)
    if roundtrip_sha256 != source_sha256:
        storage.delete_document(doc_uri)
        raise RuntimeError(
            f"Checksum verification failed after upload ({roundtrip_sha256} != {source_sha256}); rolled back object."
        )

    receipt.update({
        "status": "migrated_and_verified",
        "roundtrip_sha256": roundtrip_sha256,
        "roundtrip_mime": roundtrip_mime,
        "roundtrip_filename": roundtrip_name,
    })
    return receipt


def rollback_migration(storage: PrivateDocumentStorage, document_uri: str) -> Dict[str, Any]:
    """Remove migrated object from private storage without touching DB record associations."""
    deleted = storage.delete_document(document_uri)
    return {
        "document_url": document_uri,
        "deleted_from_storage": deleted,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
    }


def _build_supabase_storage() -> PrivateDocumentStorage:
    return PrivateDocumentStorage(backend_mode="supabase")


def main() -> None:
    parser = argparse.ArgumentParser(description="KaamSetu private verification document migration tool")
    parser.add_argument("--check-bucket", action="store_true", help="Inspect configured private bucket metadata")
    parser.add_argument("--create-bucket", action="store_true", help="Create private bucket (public=false) if missing")
    parser.add_argument("--migrate-file", type=str, default=None, help="Path to local backed-up document file")
    parser.add_argument("--record-id", type=str, default=None, help="Target VerificationRecord UUID")
    parser.add_argument("--dry-run", action="store_true", help="Validate DB & checksum without uploading")
    parser.add_argument("--overwrite", action="store_true", help="Set x-upsert=true if object already exists")
    parser.add_argument("--receipt-out", type=str, default=None, help="Optional path to save sanitized migration receipt JSON")
    parser.add_argument("--rollback", action="store_true", help="Delete migrated object from private storage")
    parser.add_argument("--receipt", type=str, default=None, help="Migration receipt JSON path for --rollback")
    parser.add_argument("--uri", type=str, default=None, help="Explicit private:// URI for --rollback")
    args = parser.parse_args()

    storage = _build_supabase_storage()
    driver = storage._get_supabase_driver()

    if args.check_bucket:
        info = driver.get_bucket_info()
        print(json.dumps({"bucket": storage._get_bucket_name(), "exists": info is not None, "info": info}, indent=2))
        return

    if args.create_bucket:
        res = driver.ensure_private_bucket()
        print(json.dumps({"bucket": storage._get_bucket_name(), "created_or_verified": res}, indent=2))
        return

    if args.rollback:
        target_uri = args.uri
        if not target_uri and args.receipt:
            target_uri = json.loads(Path(args.receipt).read_text(encoding="utf-8")).get("document_url")
        if not target_uri:
            raise SystemExit("Provide --receipt or --uri for --rollback.")
        out = rollback_migration(storage, target_uri)
        print(json.dumps(out, indent=2))
        return

    if args.migrate_file and args.record_id:
        receipt = asyncio.run(
            migrate_record_from_backup(
                AsyncSessionLocal,
                storage,
                UUID(args.record_id),
                Path(args.migrate_file),
                dry_run=args.dry_run,
                overwrite=args.overwrite,
            )
        )
        if args.receipt_out:
            Path(args.receipt_out).write_text(json.dumps(receipt, indent=2), encoding="utf-8")
        print(json.dumps(receipt, indent=2))
        return

    parser.print_help()


if __name__ == "__main__":
    main()
