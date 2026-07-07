"""
ORM model pro oblíbené zvuky uživatele.
"""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Favorite(Base):
    __tablename__ = "favorites"

    # Composite PK: user_id + sound_id
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    sound_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("sounds.id", ondelete="CASCADE"), primary_key=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="favorites")  # noqa: F821
    sound: Mapped["Sound"] = relationship("Sound", back_populates="favorited_by")  # noqa: F821

    def __repr__(self) -> str:
        return f"<Favorite user={self.user_id!r} sound={self.sound_id!r}>"
