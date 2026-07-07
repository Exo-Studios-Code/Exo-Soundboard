"""
Servisní vrstva pro správu oblíbených zvuků.
"""
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.favorite import Favorite
from app.models.sound import Sound
from app.schemas.sound import SoundPublic


class FavoriteService:

    @staticmethod
    async def add(db: AsyncSession, user_id: str, sound_id: str) -> None:
        """Přidá zvuk do oblíbených. Ignoruje duplicity."""
        existing = await db.execute(
            select(Favorite).where(
                Favorite.user_id == user_id,
                Favorite.sound_id == sound_id,
            )
        )
        if existing.scalar_one_or_none() is None:
            favorite = Favorite(user_id=user_id, sound_id=sound_id)
            db.add(favorite)
            await db.flush()

    @staticmethod
    async def remove(db: AsyncSession, user_id: str, sound_id: str) -> None:
        """Odebere zvuk z oblíbených."""
        await db.execute(
            delete(Favorite).where(
                Favorite.user_id == user_id,
                Favorite.sound_id == sound_id,
            )
        )
        await db.flush()

    @staticmethod
    async def get_favorites(db: AsyncSession, user_id: str) -> list[SoundPublic]:
        """Vrátí seznam oblíbených zvuků uživatele."""
        result = await db.execute(
            select(Sound)
            .join(Favorite, Sound.id == Favorite.sound_id)
            .options(selectinload(Sound.author))
            .where(Favorite.user_id == user_id)
            .order_by(Favorite.created_at.desc())
        )
        sounds = result.scalars().all()
        return [SoundPublic.from_orm_with_tags(s) for s in sounds]

    @staticmethod
    async def is_favorite(db: AsyncSession, user_id: str, sound_id: str) -> bool:
        """Zkontroluje, zda je zvuk v oblíbených."""
        result = await db.execute(
            select(Favorite).where(
                Favorite.user_id == user_id,
                Favorite.sound_id == sound_id,
            )
        )
        return result.scalar_one_or_none() is not None

    @staticmethod
    async def get_favorite_ids(db: AsyncSession, user_id: str) -> set[str]:
        """Vrátí set ID oblíbených zvuků uživatele (pro bulk check)."""
        result = await db.execute(
            select(Favorite.sound_id).where(Favorite.user_id == user_id)
        )
        return set(result.scalars().all())
