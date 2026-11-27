"""
KaamSetu — Database session and engine configuration
Uses SQLAlchemy 2.0 async engine with asyncpg.
"""
from sqlalchemy import event
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase, Session
from app.core.config import settings
from app.services.ws_manager import schedule_ws_flush

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


@event.listens_for(Session, "after_commit")
def _on_after_commit(session: Session) -> None:
    pending = session.info.pop("pending_ws_events", None)
    if pending:
        schedule_ws_flush(pending)


@event.listens_for(Session, "after_rollback")
def _on_after_rollback(session: Session) -> None:
    session.info.pop("pending_ws_events", None)


async def get_db() -> AsyncSession:
    """Dependency that provides a database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
