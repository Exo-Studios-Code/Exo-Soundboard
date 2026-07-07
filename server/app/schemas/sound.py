"""Schémata pro zvuky."""
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field

from app.schemas.user import UserPublic


class SoundCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    description: str | None = Field(None, max_length=512)
    tags: list[str] = Field(default_factory=list, max_length=20)


class SoundUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=128)
    description: str | None = Field(None, max_length=512)
    tags: list[str] | None = None


class SoundPublic(BaseModel):
    id: str
    name: str
    description: str | None
    tags: list[str]
    filename: str
    original_filename: str
    file_size: int
    mime_type: str
    duration_seconds: float | None
    file_url: str
    author_id: str
    uploader_id: str
    author: UserPublic
    created_at: datetime
    updated_at: datetime
    play_count: int
    is_favorite: bool = False

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_with_tags(cls, sound: "Sound", favorite_ids: set[str] | None = None) -> "SoundPublic":  # noqa: F821
        data = {
            "id": sound.id,
            "name": sound.name,
            "description": sound.description,
            "tags": sound.tags_list,
            "filename": sound.filename,
            "original_filename": sound.original_filename,
            "file_size": sound.file_size,
            "mime_type": sound.mime_type,
            "duration_seconds": sound.duration_seconds,
            "file_url": sound.file_url,
            "author_id": sound.author_id,
            "uploader_id": sound.author_id,
            "author": sound.author,
            "created_at": sound.created_at,
            "updated_at": sound.updated_at,
            "play_count": sound.play_count,
            "is_favorite": sound.id in favorite_ids if favorite_ids is not None else False,
        }
        return cls.model_validate(data)


class SoundListResponse(BaseModel):
    items: list[SoundPublic]
    total: int
    page: int
    per_page: int
    pages: int


# ── WebSocket zprávy ──────────────────────────────────────────────────────────

class WSEventType(str):
    SOUND_ADDED = "sound_added"
    SOUND_DELETED = "sound_deleted"
    SOUND_UPDATED = "sound_updated"
    PING = "ping"
    PONG = "pong"


class WSMessage(BaseModel):
    event: str
    data: dict | None = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
