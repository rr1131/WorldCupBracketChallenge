"""SQLAlchemy persistence models for users, entries, and pools."""

from __future__ import annotations

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base, utcnow


class User(Base):
    """Persisted application user."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    entries: Mapped[list["Entry"]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    owned_pools: Mapped[list["Pool"]] = relationship(back_populates="owner", cascade="all, delete-orphan")


class Entry(Base):
    """Persisted bracket entry."""

    __tablename__ = "entries"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    entry_name: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(32), default="draft")
    predictions: Mapped[list[dict]] = mapped_column(JSON, default=list)
    advancing_third_place_groups: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    knockout_picks: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    knockout_preview: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    result_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    score_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_possible_points: Mapped[int | None] = mapped_column(Integer, nullable=True)
    match_points: Mapped[int | None] = mapped_column(Integer, nullable=True)
    standing_points: Mapped[int | None] = mapped_column(Integer, nullable=True)
    knockout_points: Mapped[int | None] = mapped_column(Integer, nullable=True)
    exact_order_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    top_two_bonus_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    owner: Mapped["User"] = relationship(back_populates="entries")
    pool_links: Mapped[list["PoolEntry"]] = relationship(
        back_populates="entry",
        cascade="all, delete-orphan",
    )


class Pool(Base):
    """Persisted pool container."""

    __tablename__ = "pools"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    invite_code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    owner: Mapped["User"] = relationship(back_populates="owned_pools")
    members: Mapped[list["PoolMember"]] = relationship(
        back_populates="pool",
        cascade="all, delete-orphan",
    )
    entry_links: Mapped[list["PoolEntry"]] = relationship(
        back_populates="pool",
        cascade="all, delete-orphan",
    )


class PoolMember(Base):
    """Membership row connecting a user to a pool."""

    __tablename__ = "pool_members"
    __table_args__ = (UniqueConstraint("pool_id", "user_id", name="uq_pool_member"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    pool_id: Mapped[str] = mapped_column(ForeignKey("pools.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=utcnow)

    pool: Mapped["Pool"] = relationship(back_populates="members")


class PoolEntry(Base):
    """Association row connecting an entry to a pool."""

    __tablename__ = "pool_entries"
    __table_args__ = (UniqueConstraint("pool_id", "entry_id", name="uq_pool_entry"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    pool_id: Mapped[str] = mapped_column(ForeignKey("pools.id", ondelete="CASCADE"), index=True)
    entry_id: Mapped[str] = mapped_column(ForeignKey("entries.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=utcnow)

    pool: Mapped["Pool"] = relationship(back_populates="entry_links")
    entry: Mapped["Entry"] = relationship(back_populates="pool_links")
