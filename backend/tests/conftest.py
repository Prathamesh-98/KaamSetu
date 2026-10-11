"""
KaamSetu Test Configuration
Ensures all tests run in an isolated test database (kaamsetu_test)
and never pollute the development database.
"""
import os
import pytest
from app.core.config import settings

# Force pytest to use dedicated test database: kaamsetu_test
TEST_DB_URL = os.getenv(
    "TEST_DATABASE_URL",
    settings.DATABASE_URL.replace("/kaamsetu", "/kaamsetu_test")
)
os.environ["DATABASE_URL"] = TEST_DB_URL
settings.DATABASE_URL = TEST_DB_URL

# Rebind engine and AsyncSessionLocal in app.db.session to test database
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
import app.db.session as session_mod

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
    yield
