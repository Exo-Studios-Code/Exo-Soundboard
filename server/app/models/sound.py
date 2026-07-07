"""
ORM model pro zvuk – jádro celé aplikace.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Sound(Base):
    __tablename__ = "sounds"

    # ── Identifikace ─────────────────────────────────────────────────────────
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # ── Metadata ──────────────────────────────────────────────────────────────
    name: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Tagy jsou uloženy jako čárkami oddělený string (jednoduché řešení bez join tabulky)
    # Příklad: "memes,reaction,funny"
    tags: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # ── Soubor ────────────────────────────────────────────────────────────────
    filename: Mapped[str] = mapped_column(String(256), nullable=False, unique=True)
    original_filename: Mapped[str] = mapped_column(String(256), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)  # bytes
    mime_type: Mapped[str] = mapped_column(String(64), nullable=False)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)

    # URL pro stažení – při S3 migraci se přepíše na CDN URL
    file_url: Mapped[str] = mapped_column(String(512), nullable=False)

    # ── Vztahy ────────────────────────────────────────────────────────────────
    # uploader_id je alias pro author_id (community platform naming)
    author_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author: Mapped["User"] = relationship("User", back_populates="sounds")  # noqa: F821

    favorited_by: Mapped[list["Favorite"]] = relationship(  # noqa: F821
        "Favorite", back_populates="sound", cascade="all, delete-orphan"
    )

    @property
    def uploader_id(self) -> str:
        """Alias pro author_id – community platform naming."""
        return self.author_id

    # ── Časy ──────────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # ── Statistiky ────────────────────────────────────────────────────────────
    play_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    @property
    def tags_list(self) -> list[str]:
        if not self.tags:
            return []
        return [t.strip() for t in self.tags.split(",") if t.strip()]

    def __repr__(self) -> str:
        return f"<Sound id={self.id!r} name={self.name!r}>"
