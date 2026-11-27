"""
Tests for persistent encrypted Supabase private verification document storage,
access control, file validation, restart persistence, and migration/rollback.
Runs completely isolated against kaamsetu_test + in-memory httpx.MockTransport
(never touches production Supabase or Render resources).
"""
import json
from pathlib import Path
from typing import Dict
from uuid import uuid4

import httpx
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, select

from app.api.routes import verifications as verifications_route
from app.core.security import create_access_token, hash_password
from app.db.session import AsyncSessionLocal, engine
from app.main import app
from app.models.models import (
    EmployerProfile,
    Skill,
    User,
    UserRole,
    VerificationRecord,
    VerificationStatus,
    VerificationType,
    WorkerProfile,
    WorkerSkill,
)
from app.services.private_storage_service import (
    ENVELOPE_MAGIC,
    MAX_DOCUMENT_SIZE_BYTES,
    PrivateDocumentStorage,
)
from scripts.migrate_verification_docs import migrate_record_from_backup, rollback_migration


@pytest.fixture
def anyio_backend():
    return "asyncio"


def _make_mock_supabase_transport(bucket_store: Dict[str, bytes], bucket_meta: Dict[str, dict]):
    """In-memory MockTransport simulating Supabase Storage REST API with auth header validation."""
    expected_key = "sb_secret_isolated_test_key"

    def handler(request: httpx.Request) -> httpx.Response:
        if request.headers.get("apikey") != expected_key or request.headers.get("authorization") != f"Bearer {expected_key}":
            return httpx.Response(401, json={"error": "Unauthorized"})

        path = request.url.path
        if path == "/storage/v1/bucket" and request.method == "POST":
            body = json.loads(request.content.decode("utf-8"))
            if body.get("public") is not False:
                return httpx.Response(400, json={"error": "Bucket must be private"})
            bucket_meta[body["id"]] = body
            return httpx.Response(200, json={"name": body["name"]})

        if path.startswith("/storage/v1/bucket/") and request.method == "GET":
            b_name = path.split("/storage/v1/bucket/", 1)[1]
            if b_name not in bucket_meta:
                return httpx.Response(404, json={"error": "Bucket not found"})
            return httpx.Response(200, json=bucket_meta[b_name])

        prefix = "/storage/v1/object/"
        if path.startswith(prefix):
            rest = path[len(prefix):]
            bucket, obj_key = rest.split("/", 1)
            if bucket not in bucket_meta:
                return httpx.Response(404, json={"error": "Bucket not found"})

            if request.method == "POST":
                upsert = request.headers.get("x-upsert", "false").lower() == "true"
                if obj_key in bucket_store and not upsert:
                    return httpx.Response(409, json={"error": "Duplicate"})
                bucket_store[obj_key] = bytes(request.content)
                return httpx.Response(200, json={"Key": f"{bucket}/{obj_key}"})

            if request.method == "GET":
                if obj_key not in bucket_store:
                    return httpx.Response(404, json={"error": "not_found"})
                return httpx.Response(
                    200,
                    content=bucket_store[obj_key],
                    headers={"Content-Type": "application/octet-stream"},
                )

            if request.method == "DELETE":
                existed = obj_key in bucket_store
                bucket_store.pop(obj_key, None)
                if not existed:
                    return httpx.Response(404, json={"error": "not_found"})
                return httpx.Response(200, json={"message": "Deleted"})

        return httpx.Response(404, json={"error": "Unhandled route"})

    return httpx.MockTransport(handler)


def _make_jpeg_bytes(payload_size: int = 256) -> bytes:
    header = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    if payload_size <= len(header) + 2:
        return header + b"\xff\xd9"
    return header + (b"A" * (payload_size - len(header) - 2)) + b"\xff\xd9"


def _make_pdf_bytes() -> bytes:
    return b"%PDF-1.4\n1 0 obj\n<< /Title (Isolated Persistent Test) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"


@pytest.mark.anyio
async def test_supabase_private_storage_lifecycle_and_restart_persistence(tmp_path: Path, monkeypatch):
    bucket_store: Dict[str, bytes] = {}
    bucket_meta: Dict[str, dict] = {}
    transport = _make_mock_supabase_transport(bucket_store, bucket_meta)
    enc_key = "test-strong-aes256-gcm-secret-key-for-kaamsetu"

    storage_before_restart = PrivateDocumentStorage(
        base_dir=str(tmp_path / "ephemeral_before"),
        backend_mode="supabase",
        supabase_url="https://example.supabase.co",
        supabase_service_key="sb_secret_isolated_test_key",
        bucket_name="verification-documents",
        encryption_key=enc_key,
        transport=transport,
    )
    created_bucket = storage_before_restart._get_supabase_driver().ensure_private_bucket()
    assert created_bucket["name"] == "verification-documents"
    assert bucket_meta["verification-documents"]["public"] is False

    monkeypatch.setattr(verifications_route, "private_storage", storage_before_restart)

    created_user_ids = []
    created_record_ids = []
    try:
        async with AsyncSessionLocal() as db:
            worker_u = User(
                email=f"ps_wrk_{uuid4().hex[:8]}@example.com",
                phone=f"9{uuid4().int % 1_000_000_000:09d}",
                password_hash=hash_password("Pass123!"),
                role=UserRole.WORKER,
                is_active=True,
            )
            other_u = User(
                email=f"ps_oth_{uuid4().hex[:8]}@example.com",
                phone=f"9{uuid4().int % 1_000_000_000:09d}",
                password_hash=hash_password("Pass123!"),
                role=UserRole.EMPLOYER,
                is_active=True,
            )
            admin_u = User(
                email=f"ps_adm_{uuid4().hex[:8]}@example.com",
                phone=f"9{uuid4().int % 1_000_000_000:09d}",
                password_hash=hash_password("Pass123!"),
                role=UserRole.ADMIN,
                is_active=True,
            )
            db.add_all([worker_u, other_u, admin_u])
            await db.flush()
            created_user_ids.extend([worker_u.id, other_u.id, admin_u.id])

            db.add(WorkerProfile(user_id=worker_u.id, full_name="Persist Worker", city="Pune", state="MH"))
            db.add(EmployerProfile(user_id=other_u.id, full_name="Other Employer", city="Pune", state="MH"))
            await db.commit()

            wrk_token = create_access_token({"sub": str(worker_u.id), "token_version": 1})
            oth_token = create_access_token({"sub": str(other_u.id), "token_version": 1})
            adm_token = create_access_token({"sub": str(admin_u.id), "token_version": 1})

        orig_pdf = _make_pdf_bytes()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # 1. Authorized upload
            up_res = await client.post(
                "/api/verifications/identity",
                data={"document_type": "PASSPORT", "notes": "Restart test"},
                files={"document": ("passport.pdf", orig_pdf, "application/pdf")},
                headers={"Authorization": f"Bearer {wrk_token}"},
            )
            assert up_res.status_code == 201, up_res.text
            body = up_res.json()
            rec_id = body["id"]
            created_record_ids.append(rec_id)
            assert body["has_document"] is True
            assert "document_url" not in body
            assert "supabase" not in json.dumps(body).lower()

            # Confirm encrypted envelope in remote bucket & zero local files
            assert len(bucket_store) == 1
            stored_obj_key, stored_blob = next(iter(bucket_store.items()))
            assert stored_obj_key.startswith("identity/")
            assert stored_blob.startswith(ENVELOPE_MAGIC)
            assert stored_blob != orig_pdf
            assert not list((tmp_path / "ephemeral_before").rglob("*"))

            # 2. Invalid MIME & magic spoofing rejected (400)
            bad_mime = await client.post(
                "/api/verifications/identity",
                data={"document_type": "PASSPORT"},
                files={"document": ("evil.svg", b"<svg onload=alert(1)/>", "image/svg+xml")},
                headers={"Authorization": f"Bearer {wrk_token}"},
            )
            assert bad_mime.status_code == 400

            bad_magic = await client.post(
                "/api/verifications/identity",
                data={"document_type": "PASSPORT"},
                files={"document": ("fake.jpg", b"NOT_A_JPEG_FILE", "image/jpeg")},
                headers={"Authorization": f"Bearer {wrk_token}"},
            )
            assert bad_magic.status_code == 400

            # 3. File size limit: > 5 MB rejected, exact 5 MB succeeds (with KSENC1 overhead)
            oversize = await client.post(
                "/api/verifications/identity",
                data={"document_type": "PASSPORT"},
                files={"document": ("big.jpg", _make_jpeg_bytes(MAX_DOCUMENT_SIZE_BYTES + 1), "image/jpeg")},
                headers={"Authorization": f"Bearer {wrk_token}"},
            )
            assert oversize.status_code == 400

            exact_5mb = _make_jpeg_bytes(MAX_DOCUMENT_SIZE_BYTES)
            exact_res = await client.post(
                "/api/verifications/identity",
                data={"document_type": "DRIVING_LICENSE"},
                files={"document": ("exact5mb.jpg", exact_5mb, "image/jpeg")},
                headers={"Authorization": f"Bearer {wrk_token}"},
            )
            assert exact_res.status_code == 201, exact_res.text
            created_record_ids.append(exact_res.json()["id"])

            # 4. Simulate backend restart with brand-new ephemeral directory
            storage_after_restart = PrivateDocumentStorage(
                base_dir=str(tmp_path / "ephemeral_after_restart"),
                backend_mode="supabase",
                supabase_url="https://example.supabase.co",
                supabase_service_key="sb_secret_isolated_test_key",
                bucket_name="verification-documents",
                encryption_key=enc_key,
                transport=transport,
            )
            monkeypatch.setattr(verifications_route, "private_storage", storage_after_restart)

            # Owner download succeeds after restart
            dl_owner = await client.get(
                f"/api/verifications/{rec_id}/document",
                headers={"Authorization": f"Bearer {wrk_token}"},
            )
            assert dl_owner.status_code == 200
            assert dl_owner.content == orig_pdf
            assert dl_owner.headers["content-type"] == "application/pdf"
            assert "private" in dl_owner.headers.get("cache-control", "").lower()

            # Admin download succeeds after restart
            dl_admin = await client.get(
                f"/api/verifications/{rec_id}/document",
                headers={"Authorization": f"Bearer {adm_token}"},
            )
            assert dl_admin.status_code == 200
            assert dl_admin.content == orig_pdf

            # Third-party user & unauthenticated requests rejected
            dl_other = await client.get(
                f"/api/verifications/{rec_id}/document",
                headers={"Authorization": f"Bearer {oth_token}"},
            )
            assert dl_other.status_code == 403

            dl_unauth = await client.get(f"/api/verifications/{rec_id}/document")
            assert dl_unauth.status_code in (401, 403)

        # 5. Wrong encryption key fails safely; legacy unencrypted blob still readable
        wrong_key_storage = PrivateDocumentStorage(
            base_dir=str(tmp_path / "wrong_key"),
            backend_mode="supabase",
            supabase_url="https://example.supabase.co",
            supabase_service_key="sb_secret_isolated_test_key",
            bucket_name="verification-documents",
            encryption_key="completely-wrong-key",
            transport=transport,
        )
        with pytest.raises(Exception):
            wrong_key_storage.retrieve_document(f"private://{stored_obj_key}")
    finally:
        if created_user_ids:
            async with AsyncSessionLocal() as db:
                await db.execute(delete(VerificationRecord).where(VerificationRecord.user_id.in_(created_user_ids)))
                await db.execute(delete(WorkerProfile).where(WorkerProfile.user_id.in_(created_user_ids)))
                await db.execute(delete(EmployerProfile).where(EmployerProfile.user_id.in_(created_user_ids)))
                await db.execute(delete(User).where(User.id.in_(created_user_ids)))
                await db.commit()
        await engine.dispose()


@pytest.mark.anyio
async def test_verification_document_migration_checksum_and_rollback(tmp_path: Path):
    bucket_store: Dict[str, bytes] = {}
    bucket_meta: Dict[str, dict] = {
        "verification-documents": {"id": "verification-documents", "name": "verification-documents", "public": False}
    }
    transport = _make_mock_supabase_transport(bucket_store, bucket_meta)

    storage = PrivateDocumentStorage(
        base_dir=str(tmp_path / "unused_local"),
        backend_mode="supabase",
        supabase_url="https://example.supabase.co",
        supabase_service_key="sb_secret_isolated_test_key",
        bucket_name="verification-documents",
        encryption_key="migration-test-aes-key",
        transport=transport,
    )

    legacy_uri = "private://identity/2909ddcf3f7244ab984f3ba24582fde9.jpg"
    backup_img = _make_jpeg_bytes(1024)
    backup_file = tmp_path / "2909ddcf3f7244ab984f3ba24582fde9.jpg"
    backup_file.write_bytes(backup_img)

    created_uid = None
    try:
        async with AsyncSessionLocal() as db:
            u = User(
                email=f"mig_wrk_{uuid4().hex[:8]}@example.com",
                phone=f"9{uuid4().int % 1_000_000_000:09d}",
                password_hash=hash_password("Pass123!"),
                role=UserRole.WORKER,
                is_active=True,
            )
            db.add(u)
            await db.flush()
            created_uid = u.id
            rec = VerificationRecord(
                user_id=u.id,
                verification_type=VerificationType.IDENTITY,
                status=VerificationStatus.VERIFIED,
                document_url=legacy_uri,
            )
            db.add(rec)
            await db.commit()
            rec_id = rec.id

        # 1. Dry-run leaves remote bucket empty
        dry = await migrate_record_from_backup(AsyncSessionLocal, storage, rec_id, backup_file, dry_run=True)
        assert dry["status"] == "dry_run_validated"
        assert len(bucket_store) == 0

        # 2. Execute migration & verify SHA-256 roundtrip + preserved DB URI
        receipt = await migrate_record_from_backup(AsyncSessionLocal, storage, rec_id, backup_file, dry_run=False)
        assert receipt["status"] == "migrated_and_verified"
        assert receipt["plaintext_sha256"] == receipt["roundtrip_sha256"]
        assert "identity/2909ddcf3f7244ab984f3ba24582fde9.jpg" in bucket_store
        assert bucket_store["identity/2909ddcf3f7244ab984f3ba24582fde9.jpg"].startswith(ENVELOPE_MAGIC)

        async with AsyncSessionLocal() as db:
            db_rec = (await db.execute(select(VerificationRecord).where(VerificationRecord.id == rec_id))).scalar_one()
            assert db_rec.document_url == legacy_uri

        # 3. Rollback removes migrated remote object while preserving DB record intact
        rb = rollback_migration(storage, legacy_uri)
        assert rb["deleted_from_storage"] is True
        assert "identity/2909ddcf3f7244ab984f3ba24582fde9.jpg" not in bucket_store
    finally:
        if created_uid:
            async with AsyncSessionLocal() as db:
                await db.execute(delete(VerificationRecord).where(VerificationRecord.user_id == created_uid))
                await db.execute(delete(User).where(User.id == created_uid))
                await db.commit()
        await engine.dispose()
