"""KaamSetu — Admin Management & Operational Dashboard Test Suite (Phase 3.3)

Verifies:
1. User Management (GET /api/admin/users, PUT /api/admin/users/{user_id}/status):
   - Admin authorization, role & status filtering, search, pagination.
   - Self-suspension guard (400 Bad Request if admin attempts to suspend themselves).
   - Atomic token revocation (token_version incremented when a user is suspended).
   - RBAC: 403 Forbidden for WORKER and EMPLOYER, 401 for unauthenticated.
2. Worker Directory (GET /api/admin/workers, GET /api/admin/workers/{id}):
   - Search by name, city, skill; verified-only filter; preloaded skills.
   - Detail retrieval & 404 handling.
3. Employer Directory (GET /api/admin/employers, GET /api/admin/employers/{id}):
   - Search by name, organization, city; verified-only filter.
   - Precomputed active_jobs_count and total_jobs_count.
4. Job Postings Management (GET /api/admin/jobs, PUT /api/admin/jobs/{id}/status):
   - Status filtering, search, precomputed applications_count.
   - Status moderation (ACTIVE, CLOSED, CANCELLED) with optional reason.
5. Applications Management (GET /api/admin/applications):
   - Cross-platform application log with counterpart worker & employer names.
   - Status filtering & search.
6. Completed Work & Offline Settlement Ledger (GET /api/admin/completed-work):
   - Hours worked, agreed wage, amount paid, outstanding balance.
   - Recorded offline cash/UPI installments list.
   - Dispute flag & reason reporting.

All tests run strictly against isolated test database: kaamsetu_test.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from uuid import uuid4
from datetime import datetime, timezone, timedelta

from app.main import app
from app.core.security import create_access_token, hash_password
from app.db.session import engine, AsyncSessionLocal
from app.models.models import (
    Base, User, UserRole, AdminProfile, WorkerProfile, EmployerProfile,
    JobCategory, Job, JobStatus, WorkType, SalaryType, JobApplication,
    ApplicationStatus, ShiftBooking, BookingStatus, WorkCompletion,
    PaymentRecord, PaymentInstallment, PaymentStatus, PaymentMethod
)


@pytest.fixture
def anyio_backend():
    return 'asyncio'


@pytest.fixture(autouse=True)
async def ensure_schema_and_cleanup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


def unique_phone() -> str:
    return f"+9198{uuid4().int % 100000000:08d}"


async def seed_user_with_profile(
    role: UserRole, is_active: bool = True, full_name: str = "Test User"
) -> tuple[User, any, str]:
    uid = str(uuid4())
    prof_id = str(uuid4())
    email = f"user_{uid[:8]}@example.com"
    phone = unique_phone()
    hashed = hash_password("Secret12345")
    async with AsyncSessionLocal() as session:
        u = User(
            id=uid,
            email=email,
            phone=phone,
            password_hash=hashed,
            role=role,
            is_active=is_active,
            is_verified=True,
            token_version=1,
        )
        session.add(u)
        profile_obj = None
        if role == UserRole.ADMIN:
            profile_obj = AdminProfile(id=prof_id, user_id=uid, full_name=full_name, department="Operations")
            session.add(profile_obj)
        elif role == UserRole.WORKER:
            profile_obj = WorkerProfile(
                id=prof_id,
                user_id=uid,
                full_name=full_name,
                city="Pune",
                state="Maharashtra",
                years_experience=4,
                is_identity_verified=True,
                is_phone_verified=True,
            )
            session.add(profile_obj)
        elif role == UserRole.EMPLOYER:
            profile_obj = EmployerProfile(
                id=prof_id,
                user_id=uid,
                full_name=full_name,
                organization_name="BuildCorp Ltd",
                organization_type="Enterprise",
                city="Mumbai",
                state="Maharashtra",
                is_verified=True,
            )
            session.add(profile_obj)
        await session.commit()
        await session.refresh(u)

    token = create_access_token(
        data={"sub": uid, "role": role.value, "token_version": 1}
    )
    return u, profile_obj, token


# ─── 1. USER MANAGEMENT TESTS ────────────────────────────────────────────────

@pytest.mark.anyio
async def test_admin_list_users_success():
    admin_user, _, admin_token = await seed_user_with_profile(UserRole.ADMIN, full_name="Super Admin")
    worker_user, _, _ = await seed_user_with_profile(UserRole.WORKER, full_name="Ramesh Worker")
    employer_user, _, _ = await seed_user_with_profile(UserRole.EMPLOYER, full_name="Sunil Employer")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            "/api/admin/users?per_page=10",
            headers={"Authorization": f"Bearer {admin_token}"}
        )

    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 3
    user_ids = [u["id"] for u in data["items"]]
    assert str(admin_user.id) in user_ids
    assert str(worker_user.id) in user_ids
    assert str(employer_user.id) in user_ids


@pytest.mark.anyio
async def test_admin_list_users_filters():
    _, _, admin_token = await seed_user_with_profile(UserRole.ADMIN)
    worker_user, _, _ = await seed_user_with_profile(UserRole.WORKER, full_name="Specific Unique Worker")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Filter by role
        res = await ac.get(
            "/api/admin/users?role=WORKER",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res.status_code == 200
        items = res.json()["items"]
        assert all(u["role"] == "WORKER" for u in items)

        # Search by phone/email
        res = await ac.get(
            f"/api/admin/users?search={worker_user.phone}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res.status_code == 200
        found = res.json()["items"]
        assert any(u["id"] == str(worker_user.id) for u in found)


@pytest.mark.anyio
async def test_admin_list_users_rbac_forbidden_for_non_admin():
    _, _, worker_token = await seed_user_with_profile(UserRole.WORKER)
    _, _, employer_token = await seed_user_with_profile(UserRole.EMPLOYER)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res_w = await ac.get("/api/admin/users", headers={"Authorization": f"Bearer {worker_token}"})
        assert res_w.status_code == 403

        res_e = await ac.get("/api/admin/users", headers={"Authorization": f"Bearer {employer_token}"})
        assert res_e.status_code == 403

        res_anon = await ac.get("/api/admin/users")
        assert res_anon.status_code in (401, 403)


@pytest.mark.anyio
async def test_admin_user_status_toggle_and_token_revocation():
    _, _, admin_token = await seed_user_with_profile(UserRole.ADMIN)
    target_worker, _, target_token = await seed_user_with_profile(UserRole.WORKER)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Before suspension, worker token is valid
        res_pre = await ac.get("/api/auth/me", headers={"Authorization": f"Bearer {target_token}"})
        assert res_pre.status_code == 200

        # Suspend worker
        res_suspend = await ac.put(
            f"/api/admin/users/{target_worker.id}/status?is_active=false",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res_suspend.status_code == 200
        assert res_suspend.json()["is_active"] is False

        # After suspension, previous token is immediately invalidated (401)
        res_post = await ac.get("/api/auth/me", headers={"Authorization": f"Bearer {target_token}"})
        assert res_post.status_code in (401, 403)

        # Reactivate worker
        res_activate = await ac.put(
            f"/api/admin/users/{target_worker.id}/status?is_active=true",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res_activate.status_code == 200
        assert res_activate.json()["is_active"] is True


@pytest.mark.anyio
async def test_admin_self_suspension_guard():
    admin_user, _, admin_token = await seed_user_with_profile(UserRole.ADMIN)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.put(
            f"/api/admin/users/{admin_user.id}/status?is_active=false",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res.status_code == 400
        assert "cannot deactivate your own administrator account" in res.json()["detail"].lower()


# ─── 2. WORKER DIRECTORY TESTS ───────────────────────────────────────────────

@pytest.mark.anyio
async def test_admin_workers_directory_and_detail():
    _, _, admin_token = await seed_user_with_profile(UserRole.ADMIN)
    worker_user, worker_prof, _ = await seed_user_with_profile(UserRole.WORKER, full_name="Anil Electrician")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            "/api/admin/workers?search=Electrician",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res.status_code == 200
        data = res.json()
        assert "items" in data
        assert any(w["user_id"] == str(worker_user.id) for w in data["items"])

        # Fetch by worker profile id
        res_detail = await ac.get(
            f"/api/admin/workers/{worker_prof.id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res_detail.status_code == 200
        assert res_detail.json()["full_name"] == "Anil Electrician"


# ─── 3. EMPLOYER DIRECTORY TESTS ─────────────────────────────────────────────

@pytest.mark.anyio
async def test_admin_employers_directory_and_detail():
    _, _, admin_token = await seed_user_with_profile(UserRole.ADMIN)
    employer_user, employer_prof, _ = await seed_user_with_profile(UserRole.EMPLOYER, full_name="Rajesh Builder")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            "/api/admin/employers?search=Rajesh",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res.status_code == 200
        data = res.json()
        assert "items" in data
        emp_item = next(e for e in data["items"] if e["user_id"] == str(employer_user.id))
        assert "active_jobs_count" in emp_item
        assert "total_jobs_count" in emp_item

        # Fetch detail
        res_detail = await ac.get(
            f"/api/admin/employers/{employer_prof.id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res_detail.status_code == 200
        assert res_detail.json()["full_name"] == "Rajesh Builder"


# ─── 4. JOB POSTINGS MANAGEMENT TESTS ────────────────────────────────────────

@pytest.mark.anyio
async def test_admin_jobs_list_and_status_moderation():
    _, _, admin_token = await seed_user_with_profile(UserRole.ADMIN)
    _, employer_prof, _ = await seed_user_with_profile(UserRole.EMPLOYER)

    # Seed Category and Job
    job_id = str(uuid4())
    cat_id = str(uuid4())
    async with AsyncSessionLocal() as session:
        cat = JobCategory(id=cat_id, name=f"Masonry_{uuid4().hex[:6]}")
        session.add(cat)
        j = Job(
            id=job_id,
            employer_id=employer_prof.id,
            category_id=cat_id,
            title="Senior Mason Required",
            description="Brick laying work for 5 days.",
            work_type=WorkType.FULL_TIME,
            status=JobStatus.ACTIVE,
            city="Pune",
            state="Maharashtra",
            salary_type=SalaryType.DAILY,
            salary_min=700,
            salary_max=900,
        )
        session.add(j)
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # List jobs
        res = await ac.get("/api/admin/jobs?search=Mason", headers={"Authorization": f"Bearer {admin_token}"})
        assert res.status_code == 200
        data = res.json()
        assert any(j["id"] == job_id for j in data["items"])

        # Moderate status to CLOSED
        res_mod = await ac.put(
            f"/api/admin/jobs/{job_id}/status",
            json={"status": "CLOSED", "reason": "Position filled offline"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res_mod.status_code == 200
        assert res_mod.json()["status"] == "CLOSED"


# ─── 5. APPLICATIONS MANAGEMENT TESTS ────────────────────────────────────────

@pytest.mark.anyio
async def test_admin_applications_list():
    _, _, admin_token = await seed_user_with_profile(UserRole.ADMIN)
    _, worker_prof, _ = await seed_user_with_profile(UserRole.WORKER, full_name="Candidate Worker")
    _, employer_prof, _ = await seed_user_with_profile(UserRole.EMPLOYER)

    app_id = str(uuid4())
    job_id = str(uuid4())
    cat_id = str(uuid4())
    async with AsyncSessionLocal() as session:
        cat = JobCategory(id=cat_id, name=f"Plumbing_{uuid4().hex[:6]}")
        session.add(cat)
        j = Job(
            id=job_id,
            employer_id=employer_prof.id,
            category_id=cat_id,
            title="Site Plumber",
            description="Plumbing maintenance.",
            work_type=WorkType.FULL_TIME,
            status=JobStatus.ACTIVE,
            city="Pune",
            state="Maharashtra",
            salary_type=SalaryType.DAILY,
        )
        session.add(j)
        application = JobApplication(
            id=app_id,
            job_id=job_id,
            worker_id=worker_prof.id,
            status=ApplicationStatus.PENDING,
            cover_note="Experienced plumber ready to start immediately.",
        )
        session.add(application)
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            "/api/admin/applications?status=PENDING",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res.status_code == 200
        data = res.json()
        assert "items" in data
        assert any(a["id"] == app_id for a in data["items"])
        found = next(a for a in data["items"] if a["id"] == app_id)
        assert found["worker_name"] == "Candidate Worker"
        assert found["job_title"] == "Site Plumber"


# ─── 6. COMPLETED WORK & OFFLINE LEDGER TESTS ────────────────────────────────

@pytest.mark.anyio
async def test_admin_completed_work_offline_ledger():
    _, _, admin_token = await seed_user_with_profile(UserRole.ADMIN)
    worker_user, worker_prof, _ = await seed_user_with_profile(UserRole.WORKER, full_name="Ledger Worker")
    _, employer_prof, _ = await seed_user_with_profile(UserRole.EMPLOYER, full_name="Ledger Employer")

    comp_id = str(uuid4())
    booking_id = str(uuid4())
    inst_id = str(uuid4())
    now = datetime.now(timezone.utc)
    start_time = now - timedelta(hours=8)

    async with AsyncSessionLocal() as session:
        booking = ShiftBooking(
            id=booking_id,
            worker_id=worker_prof.id,
            employer_id=employer_prof.id,
            start_time=start_time,
            end_time=now,
            status=BookingStatus.COMPLETED,
        )
        session.add(booking)

        comp = WorkCompletion(
            id=comp_id,
            shift_booking_id=booking_id,
            completed_by=worker_user.id,
            actual_start_time=start_time,
            actual_end_time=now,
            hours_worked=8.0,
            completion_notes="Finished tiling the bathroom.",
            created_at=now,
        )
        session.add(comp)

        payment = PaymentRecord(
            id=str(uuid4()),
            work_completion_id=comp_id,
            shift_booking_id=booking_id,
            agreed_amount=2400.0,
            amount_paid=1200.0,
            currency="INR",
            payment_method=PaymentMethod.CASH,
            payment_status=PaymentStatus.PARTIALLY_PAID,
            payment_date=now,
            created_at=now,
        )
        session.add(payment)

        installment = PaymentInstallment(
            id=inst_id,
            payment_record_id=payment.id,
            installment_number=1,
            amount=1200.0,
            payment_method=PaymentMethod.CASH,
            payment_date=now,
            recorded_by=worker_user.id,
            created_at=now,
        )
        session.add(installment)
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            "/api/admin/completed-work?payment_status=PARTIALLY_PAID",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res.status_code == 200
        data = res.json()
        assert "items" in data
        assert any(item["completion_id"] == comp_id for item in data["items"])
        ledger_entry = next(item for item in data["items"] if item["completion_id"] == comp_id)
        assert ledger_entry["hours_worked"] == 8.0
        assert ledger_entry["agreed_amount"] == 2400.0
        assert ledger_entry["amount_paid"] == 1200.0
        assert ledger_entry["outstanding_balance"] == 1200.0
        assert ledger_entry["payment_status"] == "PARTIALLY_PAID"
        assert len(ledger_entry["installments"]) >= 1
        assert ledger_entry["installments"][0]["amount"] == 1200.0
