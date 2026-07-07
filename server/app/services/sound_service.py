"""
Servisní vrstva pro zvuky – orchestruje DB, storage a WS notifikace.
"""
import math

from fastapi import UploadFile
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import AuthorizationError, NotFoundError
from app.core.logging import get_logger
from app.models.sound import Sound
from app.models.user import User
from app.schemas.sound import (
    SoundCreate,
    SoundListResponse,
    SoundPublic,
    SoundUpdate,
    WSEventType,
)
from app.services.file_storage import (
    generate_unique_filename,
    storage,
    validate_audio_file,
)
from app.services.websocket_manager import ws_manager

logger = get_logger(__name__)


class SoundService:

    # ── Upload ────────────────────────────────────────────────────────────────

    @staticmethod
    async def upload(
        db: AsyncSession,
        file: UploadFile,
        metadata: SoundCreate,
        current_user: User,
    ) -> SoundPublic:
        # Validace souboru
        mime_type = await validate_audio_file(file)
        unique_name = generate_unique_filename(file.filename or "sound.mp3")

        # Uložení na disk
        file_url, file_size = await storage.save(file, unique_name)

        # Uložení do DB
        sound = Sound(
            name=metadata.name,
            description=metadata.description,
            tags=",".join(metadata.tags) if metadata.tags else None,
            filename=unique_name,
            original_filename=file.filename or unique_name,
            file_size=file_size,
            mime_type=mime_type,
            file_url=file_url,
            author_id=current_user.id,
        )
        db.add(sound)
        await db.flush()

        # Načteme autora pro odpověď
        await db.refresh(sound, ["author"])

        sound_data = SoundPublic.from_orm_with_tags(sound)

        # Broadcast WebSocket notifikace všem ostatním klientům
        await ws_manager.broadcast(
            WSEventType.SOUND_ADDED,
            data=sound_data.model_dump(mode="json"),
        )

        logger.info(
            "sound_uploaded",
            sound_id=sound.id,
            name=sound.name,
            author=current_user.username,
            size_bytes=file_size,
        )
        return sound_data

    # ── Čtení ─────────────────────────────────────────────────────────────────

    @staticmethod
    async def get_list(
        db: AsyncSession,
        page: int = 1,
        per_page: int = 50,
        search: str | None = None,
        tag: str | None = None,
        favorite_ids: set[str] | None = None,
    ) -> SoundListResponse:
        query = select(Sound).options(selectinload(Sound.author))

        if search:
            term = f"%{search.lower()}%"
            query = query.where(
                or_(
                    func.lower(Sound.name).like(term),
                    func.lower(Sound.description).like(term),
                )
            )
        if tag:
            query = query.where(Sound.tags.like(f"%{tag}%"))

        # Celkový počet
        count_q = select(func.count()).select_from(query.subquery())
        total = (await db.execute(count_q)).scalar_one()

        # Stránkování
        offset = (page - 1) * per_page
        query = query.order_by(Sound.created_at.desc()).offset(offset).limit(per_page)
        sounds = (await db.execute(query)).scalars().all()

        return SoundListResponse(
            items=[SoundPublic.from_orm_with_tags(s, favorite_ids) for s in sounds],
            total=total,
            page=page,
            per_page=per_page,
            pages=max(1, math.ceil(total / per_page)),
        )

    @staticmethod
    async def get_by_id(db: AsyncSession, sound_id: str) -> Sound:
        result = await db.execute(
            select(Sound)
            .options(selectinload(Sound.author))
            .where(Sound.id == sound_id)
        )
        sound = result.scalar_one_or_none()
        if not sound:
            raise NotFoundError("Sound", sound_id)
        return sound

    # ── Update ────────────────────────────────────────────────────────────────

    @staticmethod
    async def update(
        db: AsyncSession,
        sound_id: str,
        data: SoundUpdate,
        current_user: User,
    ) -> SoundPublic:
        sound = await SoundService.get_by_id(db, sound_id)

        if sound.author_id != current_user.id and not current_user.is_admin:
            raise AuthorizationError()

        if data.name is not None:
            sound.name = data.name
        if data.description is not None:
            sound.description = data.description
        if data.tags is not None:
            sound.tags = ",".join(data.tags)

        await db.flush()
        await db.refresh(sound, ["author"])

        sound_data = SoundPublic.from_orm_with_tags(sound)
        await ws_manager.broadcast(
            WSEventType.SOUND_UPDATED,
            data=sound_data.model_dump(mode="json"),
        )

        logger.info("sound_updated", sound_id=sound_id, by=current_user.username)
        return sound_data

    # ── Smazání ───────────────────────────────────────────────────────────────

    @staticmethod
    async def delete(db: AsyncSession, sound_id: str, current_user: User) -> None:
        sound = await SoundService.get_by_id(db, sound_id)

        if sound.author_id != current_user.id and not current_user.is_admin:
            raise AuthorizationError()

        filename = sound.filename
        await db.delete(sound)
        await db.flush()

        # Smazání souboru
        await storage.delete(filename)

        # Notifikace
        await ws_manager.broadcast(
            WSEventType.SOUND_DELETED,
            data={"id": sound_id},
        )

        logger.info("sound_deleted", sound_id=sound_id, by=current_user.username)

    # ── Statistiky ────────────────────────────────────────────────────────────

    @staticmethod
    async def increment_play_count(db: AsyncSession, sound_id: str) -> None:
        await db.execute(
            update(Sound)
            .where(Sound.id == sound_id)
            .values(play_count=Sound.play_count + 1)
        )
