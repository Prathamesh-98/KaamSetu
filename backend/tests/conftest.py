"""
KaamSetu Test Configuration
Ensures all tests run in an isolated test database (kaamsetu_test)
and never pollute the development database.
"""
import os
import asyncio
import pytest
from sqlalchemy.engine import make_url
raw_url = os.environ.get("TEST_DATABASE_URL")
if not raw_url:
    raise RuntimeError("Explicit TEST_DATABASE_URL required")
target = make_url(raw_url)
if target.host not in ("localhost", "127.0.0.1", "::1") or target.database != "kaamsetu_test":
    raise RuntimeError("Tests require a loopback kaamsetu_test database")
os.environ["DATABASE_URL"] = raw_url
from app.core.config import settings

# Force pytest to use dedicated test database: kaamsetu_test
TEST_DB_URL = os.getenv(
    "TEST_DATABASE_URL",
    raw_url
)
os.environ["DATABASE_URL"] = TEST_DB_URL
settings.DATABASE_URL = TEST_DB_URL

# Isolate external notification providers during automated test runs
settings.EMAIL_PROVIDER = None
settings.SMS_PROVIDER = None
settings.MOCK_OTP_MODE = True

# Rebind engine and AsyncSessionLocal in app.db.session to test database
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool
import app.db.session as session_mod
from app.db.session import Base
import app.models.models  # Ensure all models are registered

test_engine = create_async_engine(
    TEST_DB_URL,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)
test_AsyncSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

session_mod.engine = test_engine
session_mod.AsyncSessionLocal = test_AsyncSessionLocal

@pytest.fixture(scope="session", autouse=True)
def verify_test_db_isolation():
    assert "kaamsetu_test" in settings.DATABASE_URL, f"SAFETY ALERT: Tests MUST NOT run against production DB: {settings.DATABASE_URL}"
    # Synchronously ensure all defined models exist in test database
    async def _init_schema():
        bootstrap_engine = create_async_engine(TEST_DB_URL, poolclass=NullPool)
        async with bootstrap_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        from app.models.models import User, UserRole, WorkerProfile, EmployerProfile, Job, JobCategory, Skill, JobApplication, Conversation, WorkType, SalaryType
        from app.db.seed import CATEGORIES, SKILLS
        from app.core.security import hash_password
        from sqlalchemy import select
        from uuid import UUID
        async with async_sessionmaker(bootstrap_engine, expire_on_commit=False)() as db:
            for cat in CATEGORIES:
                if not await db.scalar(select(JobCategory).where(JobCategory.name == cat["name"])):
                    db.add(JobCategory(**cat))
            for name, category in SKILLS:
                if not await db.scalar(select(Skill).where(Skill.name == name)):
                    db.add(Skill(name=name, category=category))
            await db.flush()
            category = await db.scalar(select(JobCategory).where(JobCategory.name == "Construction"))
            ids = ["58427761-6768-4988-aead-b304fd2760a4", "da87f7a4-6cbf-419c-af92-5c1754ec6662", "10000000-0000-4000-8000-000000000001", "10000000-0000-4000-8000-000000000002"]
            roles = [UserRole.WORKER, UserRole.EMPLOYER, UserRole.WORKER, UserRole.EMPLOYER]
            for i, (uid, role) in enumerate(zip(ids, roles)):
                if not await db.get(User, UUID(uid)):
                    db.add(User(id=UUID(uid), email=f"fixture{i}@example.invalid", password_hash=hash_password("SyntheticFixture123!"), role=role, is_active=True, is_verified=True))
            await db.flush()
            profiles = []
            for i, (uid, role) in enumerate(zip(ids, roles)):
                model = WorkerProfile if role == UserRole.WORKER else EmployerProfile
                profile = await db.scalar(select(model).where(model.user_id == UUID(uid)))
                if profile is None:
                    kwargs = {"id": UUID("fb9eb69f-0a5d-4672-bf22-1bdb3a3c97b5")} if i == 0 else {}
                    profile = model(user_id=UUID(uid), full_name=f"Synthetic fixture {i}", city="Mumbai", state="Maharashtra", **kwargs)
                    db.add(profile)
                profiles.append(profile)
            await db.flush()
            for jid, owner in [("5caa5f5b-1b3d-49be-9d47-5fb1b75c0d33", profiles[1]), ("a1db6dbd-b329-4d16-849c-c675c56421e6", profiles[3])]:
                if not await db.get(Job, UUID(jid)):
                    db.add(Job(id=UUID(jid), employer_id=owner.id, category_id=category.id, title="Synthetic fixture job", description="Test only", city="Mumbai", state="Maharashtra", work_type=WorkType.FULL_TIME, salary_type=SalaryType.HOURLY))
            await db.flush()
            job_id = UUID("5caa5f5b-1b3d-49be-9d47-5fb1b75c0d33")
            application = await db.scalar(select(JobApplication).where(JobApplication.job_id == job_id, JobApplication.worker_id == profiles[0].id))
            if application is None:
                application = JobApplication(job_id=job_id, worker_id=profiles[0].id)
                db.add(application)
                await db.flush()
            if not await db.scalar(select(Conversation).where(Conversation.application_id == application.id)):
                db.add(Conversation(application_id=application.id, worker_id=profiles[0].id, employer_id=profiles[1].id))
            await db.commit()
        await bootstrap_engine.dispose()

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    if loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as executor:
            executor.submit(asyncio.run, _init_schema()).result()
    else:
        loop.run_until_complete(_init_schema())
    yield
