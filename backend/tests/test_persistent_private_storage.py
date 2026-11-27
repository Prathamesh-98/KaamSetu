"""
Tests for persistent encrypted Supabase private verification document storage,
mandatory production encryption validation, modern vs legacy Supabase REST auth
headers, idempotent migration & non-destructive rollback, restart persistence,
and Cloudinary public image isolation.
Runs completely isolated against kaamsetu_test + in-memory httpx.MockTransport.
"""
import base64
import json
from pathlib import Path
from typing import Dict, List
from uuid import uuid4

import httpx
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, select

from app.api.routes import verifications as verifications_route
from app.core.config import Settings, settings
from app.core.security import create_access_token, hash_password
from app.db.session import AsyncSessionLocal, engine
from app.main import app
from app.models.models import (
    EmployerProfile,
    User,
    UserRole,
    VerificationRecord,
    VerificationStatus,
    VerificationType,
    WorkerProfile,
)
from app.services import cloudinary_service
from app.services.private_storage_service import (
    ENVELOPE_MAGIC,
    MAX_DOCUMENT_SIZE_BYTES,
    PrivateDocumentStorage,
    SupabasePrivateBucketDriver,
)
from scripts.migrate_verification_docs import migrate_record_from_backup, rollback_migration


@pytest.fixture
def anyio_backend():
    return "asyncio"


def _make_jwt_shaped_key(role: str) -> str:
    hdr = base64.urlsafe_b64encode(b'{"alg":"HS256","typ":"JWT"}').decode().rstrip("=")
    pld = base64.urlsafe_b64encode(json.dumps({"role": role}).encode()).decode().rstrip("=")
    return f"{hdr}.{pld}.sig_placeholder"


def _make_mock_supabase_transport(
    bucket_store: Dict[str, bytes],
    bucket_meta: Dict[str, dict],
    expected_key: str = "sb_secret_isolated_test_key",
    seen_headers: List[dict] | None = None,
):
    """In-memory MockTransport simulating Supabase Storage REST API with strict auth checks."""
    is_modern_secret = expected_key.startswith("sb_secret_")

    def handler(request: httpx.Request) -> httpx.Response:
        if seen_headers is not None:
            seen_headers.append(dict(request.headers))

        if request.headers.get("apikey") != expected_key:
            return httpx.Response(401, json={"error": "Missing or invalid apikey"})
        if is_modern_secret:
            # Modern sb_secret_* keys are NOT JWTs and must NOT be passed in Authorization: Bearer
            if "authorization" in request.headers:
                return httpx.Response(400, json={"error": "sb_secret key must not be sent as Bearer JWT"})
        else:
            if request.headers.get("authorization") != f"Bearer {expected_key}":
                return httpx.Response(401, json={"error": "Missing Bearer JWT"})

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


def test_mandatory_encryption_and_supabase_header_enforcement(tmp_path: Path, monkeypatch):
    valid_b64_key = base64.urlsafe_b64encode(bytes(range(32))).decode()

    # 1. Production + Supabase enabled without encryption key MUST fail even when STRICT_CONFIG_VALIDATION=False
    with pytest.raises(ValueError, match="PRIVATE_DOCS_ENCRYPTION_KEY"):
        Settings(
            _env_file=None,
            ENVIRONMENT="production",
            STRICT_CONFIG_VALIDATION=False,
            JWT_SECRET_KEY="a" * 32,
            PRIVATE_DOCS_STORAGE_BACKEND="supabase",
            SUPABASE_URL="https://demo.supabase.co",
            SUPABASE_SERVICE_ROLE_KEY="sb_secret_valid_demo_key_1234567890",
            PRIVATE_DOCS_ENCRYPTION_KEY=None,
        )

    # 2. Placeholder or weak key rejected
    for bad_key in ("your-32-byte-secret", "too-short", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"):
        with pytest.raises(ValueError):
            Settings(
                _env_file=None,
                ENVIRONMENT="production",
                STRICT_CONFIG_VALIDATION=False,
                JWT_SECRET_KEY="a" * 32,
                PRIVATE_DOCS_STORAGE_BACKEND="supabase",
                SUPABASE_URL="https://demo.supabase.co",
                SUPABASE_SERVICE_ROLE_KEY="sb_secret_valid_demo_key_1234567890",
                PRIVATE_DOCS_ENCRYPTION_KEY=bad_key,
            )

    # 3. Valid production Supabase storage config passes with 32-byte base64 key
    ok = Settings(
        _env_file=None,
        ENVIRONMENT="production",
        STRICT_CONFIG_VALIDATION=False,
        JWT_SECRET_KEY="a" * 32,
        PRIVATE_DOCS_STORAGE_BACKEND="supabase",
        SUPABASE_URL="https://demo.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY="sb_secret_valid_demo_key_1234567890",
        PRIVATE_DOCS_ENCRYPTION_KEY=valid_b64_key,
    )
    assert ok.PRIVATE_DOCS_ENCRYPTION_KEY == valid_b64_key

    # 4. Runtime storage also fails closed in production Supabase mode if key is missing
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    bucket_store: Dict[str, bytes] = {}
    bucket_meta: Dict[str, dict] = {"verification-documents": {"id": "verification-documents", "public": False}}
    no_key_storage = PrivateDocumentStorage(
        base_dir=str(tmp_path / "prod_nokey"),
        backend_mode="supabase",
        supabase_url="https://demo.supabase.co",
        supabase_service_key="sb_secret_isolated_test_key",
        bucket_name="verification-documents",
        encryption_key="",
        transport=_make_mock_supabase_transport(bucket_store, bucket_meta),
    )
    with pytest.raises(RuntimeError, match="PRIVATE_DOCS_ENCRYPTION_KEY is mandatory"):
        no_key_storage.store_document(_make_pdf_bytes(), "application/pdf", "identity")

    # 5. Client publishable & anon keys rejected as backend storage keys
    with pytest.raises(RuntimeError, match="sb_publishable_"):
        SupabasePrivateBucketDriver("https://demo.supabase.co", "sb_publishable_oops")
    with pytest.raises(RuntimeError, match="anon JWT"):
        SupabasePrivateBucketDriver("https://demo.supabase.co", _make_jwt_shaped_key("anon"))

    # 6. Legacy service_role JWT sends both apikey + Authorization: Bearer, while sb_secret_ sends apikey only
    legacy_jwt = _make_jwt_shaped_key("service_role")
    legacy_headers: List[dict] = []
    legacy_drv = SupabasePrivateBucketDriver(
        "https://demo.supabase.co",
        legacy_jwt,
        transport=_make_mock_supabase_transport({}, dict(bucket_meta), expected_key=legacy_jwt, seen_headers=legacy_headers),
    )
    legacy_drv.upload("identity/legacy.pdf", b"KSENC1...", "application/octet-stream")
    assert legacy_headers[0]["apikey"] == legacy_jwt
    assert legacy_headers[0]["authorization"] == f"Bearer {legacy_jwt}"


def test_supabase_400_embedded_404_missing_bucket_and_object_vs_real_errors(tmp_path: Path):
    """
    Regression test for actual Supabase Storage behavior where missing bucket/object
    returns HTTP 400 with embedded statusCode='404' & NoSuchBucket/NoSuchKey,
    while genuine 401/403/unrelated-400 errors are never suppressed.
    """
    bucket_store: Dict[str, bytes] = {}
    bucket_meta: Dict[str, dict] = {}

    def supabase_quirk_handler(request: httpx.Request) -> httpx.Response:
        if request.headers.get("apikey") != "sb_secret_isolated_test_key":
            return httpx.Response(401, json={"statusCode": "401", "error": "Unauthorized", "message": "Invalid API key"})
        path = request.url.path
        if path == "/storage/v1/bucket/verification-documents" and request.method == "GET":
            if "verification-documents" not in bucket_meta:
                return httpx.Response(
                    400,
                    json={"statusCode": "404", "error": "Bucket not found", "message": "Bucket not found", "code": "NoSuchBucket"},
                )
            return httpx.Response(200, json=bucket_meta["verification-documents"])
        if path == "/storage/v1/bucket/unrelated-400" and request.method == "GET":
            return httpx.Response(
                400,
                json={"statusCode": "400", "error": "InvalidRequest", "message": "Malformed bucket parameter"},
            )
        if path == "/storage/v1/bucket/forbidden-403" and request.method == "GET":
            return httpx.Response(403, json={"statusCode": "403", "error": "Forbidden", "message": "Access denied"})
        if path == "/storage/v1/bucket" and request.method == "POST":
            body = json.loads(request.content.decode("utf-8"))
            bucket_meta[body["id"]] = body
            return httpx.Response(200, json={"name": body["name"]})
        if path == "/storage/v1/object/verification-documents/identity/missing.jpg" and request.method in ("GET", "DELETE"):
            return httpx.Response(
                400,
                json={"statusCode": "404", "error": "not_found", "message": "Object not found", "code": "NoSuchKey"},
            )
        return httpx.Response(500, json={"error": "unexpected"})

    transport = httpx.MockTransport(supabase_quirk_handler)
    drv = SupabasePrivateBucketDriver(
        "https://example.supabase.co",
        "sb_secret_isolated_test_key",
        bucket="verification-documents",
        transport=transport,
    )

    # 1. HTTP 400 + embedded 404 NoSuchBucket treated cleanly as missing -> proceeds to create private 6 MB bucket
    assert drv.get_bucket_info() is None
    created = drv.ensure_private_bucket()
    assert created["name"] == "verification-documents"
    info = drv.get_bucket_info()
    assert info is not None and info["public"] is False and info["file_size_limit"] == 6 * 1024 * 1024

    # 2. HTTP 400 + embedded 404 NoSuchKey treated cleanly as missing object
    with pytest.raises(FileNotFoundError):
        drv.download("identity/missing.jpg")
    assert drv.delete("identity/missing.jpg") is False

    # 3. Genuine 401, 403, and unrelated HTTP 400 errors are NEVER suppressed
    bad_auth_drv = SupabasePrivateBucketDriver("https://example.supabase.co", "sb_secret_wrong", transport=transport)
    with pytest.raises(RuntimeError, match="401"):
        bad_auth_drv.get_bucket_info()

    forbidden_drv = SupabasePrivateBucketDriver("https://example.supabase.co", "sb_secret_isolated_test_key", bucket="forbidden-403", transport=transport)
    with pytest.raises(RuntimeError, match="403"):
        forbidden_drv.get_bucket_info()

    bad_400_drv = SupabasePrivateBucketDriver("https://example.supabase.co", "sb_secret_isolated_test_key", bucket="unrelated-400", transport=transport)
    with pytest.raises(RuntimeError, match="400"):
        bad_400_drv.get_bucket_info()


@pytest.mark.anyio
async def test_supabase_private_storage_lifecycle_and_restart_persistence(tmp_path: Path, monkeypatch):
    bucket_store: Dict[str, bytes] = {}
    bucket_meta: Dict[str, dict] = {}
    seen_headers: List[dict] = []
    transport = _make_mock_supabase_transport(bucket_store, bucket_meta, seen_headers=seen_headers)
    enc_key = base64.urlsafe_b64encode(bytes(range(32))).decode()

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
    # Confirm modern sb_secret_* did NOT pass Authorization Bearer header
    assert all("authorization" not in h for h in seen_headers)

    monkeypatch.setattr(verifications_route, "private_storage", storage_before_restart)

    created_user_ids = []
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

        # 5. Wrong encryption key fails safely
        wrong_key_storage = PrivateDocumentStorage(
            base_dir=str(tmp_path / "wrong_key"),
            backend_mode="supabase",
            supabase_url="https://example.supabase.co",
            supabase_service_key="sb_secret_isolated_test_key",
            bucket_name="verification-documents",
            encryption_key="completely-wrong-encryption-passphrase-12345",
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
async def test_verification_document_idempotent_migration_and_safe_rollback(tmp_path: Path):
    bucket_store: Dict[str, bytes] = {}
    bucket_meta: Dict[str, dict] = {
        "verification-documents": {"id": "verification-documents", "name": "verification-documents", "public": False}
    }
    post_count = 0

    def counting_transport(request: httpx.Request) -> httpx.Response:
        nonlocal post_count
        if request.method == "POST" and "/storage/v1/object/" in request.url.path:
            post_count += 1
        return _make_mock_supabase_transport(bucket_store, bucket_meta).handle_request(request)

    storage = PrivateDocumentStorage(
        base_dir=str(tmp_path / "unused_local"),
        backend_mode="supabase",
        supabase_url="https://example.supabase.co",
        supabase_service_key="sb_secret_isolated_test_key",
        bucket_name="verification-documents",
        encryption_key="migration-test-aes-key-with-strong-32chars!",
        transport=httpx.MockTransport(counting_transport),
    )

    legacy_uri = "private://identity/2909ddcf3f7244ab984f3ba24582fde9.jpg"
    backup_img = _make_jpeg_bytes(1024)
    backup_file = tmp_path / "2909ddcf3f7244ab984f3ba24582fde9.jpg"
    backup_file.write_bytes(backup_img)

    different_backup = tmp_path / "different.jpg"
    different_backup.write_bytes(_make_jpeg_bytes(2048))

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

        # 2. First migration uploads and verifies SHA-256 roundtrip + preserves DB URI
        receipt = await migrate_record_from_backup(AsyncSessionLocal, storage, rec_id, backup_file, dry_run=False)
        assert receipt["status"] == "migrated_and_verified"
        assert receipt["plaintext_sha256"] == receipt["roundtrip_sha256"]
        assert post_count == 1
        assert "identity/2909ddcf3f7244ab984f3ba24582fde9.jpg" in bucket_store
        assert bucket_store["identity/2909ddcf3f7244ab984f3ba24582fde9.jpg"].startswith(ENVELOPE_MAGIC)

        # 3. Re-running migration is 100% idempotent (0 extra uploads)
        rerun = await migrate_record_from_backup(AsyncSessionLocal, storage, rec_id, backup_file, dry_run=False)
        assert rerun["status"] == "already_migrated_verified"
        assert rerun["roundtrip_sha256"] == receipt["plaintext_sha256"]
        assert post_count == 1

        # 4. Accidental overwrite with mismatched content is blocked by default
        with pytest.raises(FileExistsError, match="Refusing accidental overwrite"):
            await migrate_record_from_backup(AsyncSessionLocal, storage, rec_id, different_backup, dry_run=False)

        async with AsyncSessionLocal() as db:
            db_rec = (await db.execute(select(VerificationRecord).where(VerificationRecord.id == rec_id))).scalar_one()
            assert db_rec.document_url == legacy_uri

        # 5. Non-destructive rollback preserves persistent Supabase copy & populates local fallback if requested
        local_fallback = PrivateDocumentStorage(base_dir=str(tmp_path / "ephemeral_restored"), backend_mode="local")
        rb = rollback_migration(storage, legacy_uri, restore_local_storage=local_fallback, allow_purge=False)
        assert rb["persistent_copy_preserved"] is True
        assert rb["deleted_from_storage"] is False
        assert rb["restored_to_local_fallback"] is True
        assert "identity/2909ddcf3f7244ab984f3ba24582fde9.jpg" in bucket_store
        restored_bytes, _, _ = local_fallback.retrieve_document(legacy_uri)
        assert restored_bytes == backup_img

        # 6. Safety abort if purge attempted without a matching verified local backup
        with pytest.raises(RuntimeError, match="SAFETY ABORT"):
            rollback_migration(storage, legacy_uri, verified_backup_file=different_backup, allow_purge=True)
        assert "identity/2909ddcf3f7244ab984f3ba24582fde9.jpg" in bucket_store
    finally:
        if created_uid:
            async with AsyncSessionLocal() as db:
                await db.execute(delete(VerificationRecord).where(VerificationRecord.user_id.in_([created_uid])))
                await db.execute(delete(User).where(User.id.in_([created_uid])))
                await db.commit()
        await engine.dispose()


@pytest.mark.anyio
async def test_cloudinary_public_image_upload_isolation(monkeypatch):
    """Verify public photo/logo/job image uploads use Cloudinary cleanly without touching private storage."""
    created_uid = None
    try:
        async with AsyncSessionLocal() as db:
            u = User(
                email=f"cld_usr_{uuid4().hex[:8]}@example.com",
                phone=f"9{uuid4().int % 1_000_000_000:09d}",
                password_hash=hash_password("Pass123!"),
                role=UserRole.WORKER,
                is_active=True,
            )
            db.add(u)
            await db.commit()
            created_uid = u.id
            token = create_access_token({"sub": str(u.id), "token_version": 1})

        monkeypatch.setattr(cloudinary_service, "is_configured", True)
        seen_folders = []

        def fake_cloudinary_upload(file_bytes: bytes, folder: str):
            seen_folders.append(folder)
            return {"url": f"https://res.cloudinary.com/demo/image/upload/{folder}/img.jpg", "public_id": f"{folder}/img"}

        monkeypatch.setattr(cloudinary_service, "upload_image", fake_cloudinary_upload)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Valid public upload
            res_ok = await client.post(
                "/api/upload/image",
                data={"folder": "kaamsetu/workers"},
                files={"file": ("avatar.jpg", _make_jpeg_bytes(128), "image/jpeg")},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert res_ok.status_code == 201, res_ok.text
            assert res_ok.json()["url"].startswith("https://res.cloudinary.com/")
            assert seen_folders == ["kaamsetu/workers"]

            # Reject private/unauthorized folder paths
            res_bad_folder = await client.post(
                "/api/upload/image",
                data={"folder": "verification-documents"},
                files={"file": ("id.jpg", _make_jpeg_bytes(128), "image/jpeg")},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert res_bad_folder.status_code == 400

            # Reject unauthenticated uploads
            res_unauth = await client.post(
                "/api/upload/image",
                data={"folder": "kaamsetu/jobs"},
                files={"file": ("job.jpg", _make_jpeg_bytes(128), "image/jpeg")},
            )
            assert res_unauth.status_code in (401, 403)
    finally:
        if created_uid:
            async with AsyncSessionLocal() as db:
                await db.execute(delete(User).where(User.id == created_uid))
                await db.commit()
        await engine.dispose()
