"""Database engine and session management."""

from __future__ import annotations

from datetime import datetime, timezone
from functools import lru_cache
from typing import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings


class Base(DeclarativeBase):
    """Base class for SQLAlchemy models."""


def utcnow() -> datetime:
    """Return a timezone-aware UTC timestamp."""
    return datetime.now(timezone.utc)


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    """Create and cache the SQLAlchemy engine."""
    settings = get_settings()
    connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
    return create_engine(settings.database_url, future=True, connect_args=connect_args)


@lru_cache(maxsize=1)
def get_session_factory() -> sessionmaker[Session]:
    """Create and cache the SQLAlchemy session factory."""
    return sessionmaker(bind=get_engine(), autoflush=False, autocommit=False, future=True)


def get_db() -> Generator[Session, None, None]:
    """Yield a request-scoped database session."""
    session = get_session_factory()()
    try:
        yield session
    finally:
        session.close()


def create_database() -> None:
    """Create all configured database tables."""
    from . import db_models  # noqa: F401

    engine = get_engine()
    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    if "pools" in inspector.get_table_names():
        columns = {column["name"] for column in inspector.get_columns("pools")}
        if "join_password_hash" not in columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE pools ADD COLUMN join_password_hash VARCHAR(255)"))
