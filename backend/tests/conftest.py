"""
KaamSetu Test Configuration
Ensures all tests run in an isolated test database (kaamsetu_test)
and never pollute the development database.
"""
import os
import asyncio
import pytest
from app.core.config import settings

# Force pytest to use dedicated test database: kaamsetu_test
TEST_DB_URL = os.getenv(
    "TEST_DATABASE_URL",
    settings.DATABASE_URL.replace("/kaamsetu", "/kaamsetu_test")
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
