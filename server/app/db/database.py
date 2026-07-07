"""
Asynchronní databázové připojení (SQLAlchemy 2.0 + aiosqlite/asyncpg).
Přechod na PostgreSQL vyžaduje pouze změnu DATABASE_URL v .env.
"""
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# ── Engine ────────────────────────────────────────────────────────────────────

def _create_engine() -> AsyncEngine:
    connect_args: dict = {}
    if "sqlite" in settings.DATABASE_URL:
        # SQLite vyžaduje check_same_thread=False pro async
        connect_args["check_same_thread"] = False

    return create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        connect_args=connect_args,
        pool_pre_ping=True,
    )


engine: AsyncEngine = _create_engine()

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


# ── Base model ────────────────────────────────────────────────────────────────

class Base(DeclarativeBase):
    pass


# ── Dependency ────────────────────────────────────────────────────────────────

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency pro injektování DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ── Lifecycle ─────────────────────────────────────────────────────────────────

async def init_db() -> None:
    """Vytvoří tabulky (pouze pro vývoj/SQLite; v produkci použij Alembic)."""
    from app.models import sound, user, favorite  # noqa: F401 – registruje modely

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("database_initialized", url=settings.DATABASE_URL)


async def close_db() -> None:
    await engine.dispose()
    logger.info("database_connection_closed")
