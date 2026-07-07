"""
Abstrakce pro ukládání souborů.
Aktuálně: lokální disk.
Připraveno na: AWS S3 (stačí implementovat S3StorageBackend a přepnout v config).
"""
import hashlib
import uuid
from abc import ABC, abstractmethod
from pathlib import Path

import aiofiles
import aiofiles.os
from fastapi import UploadFile

from app.core.config import settings
from app.core.exceptions import FileTooLargeError, InvalidFileTypeError
from app.core.logging import get_logger

logger = get_logger(__name__)


# ── Abstraktní backend ────────────────────────────────────────────────────────

class StorageBackend(ABC):
    @abstractmethod
    async def save(self, file: UploadFile, unique_name: str) -> tuple[str, int]:
        """Uloží soubor, vrátí (url/path, file_size_bytes)."""

    @abstractmethod
    async def delete(self, filename: str) -> None:
        """Smaže soubor podle jeho uloženého jména."""

    @abstractmethod
    def get_url(self, filename: str) -> str:
        """Vrátí veřejně přístupnou URL souboru."""


# ── Lokální backend ───────────────────────────────────────────────────────────

class LocalStorageBackend(StorageBackend):
    def __init__(self, upload_dir: Path) -> None:
        self._dir = upload_dir
        self._dir.mkdir(parents=True, exist_ok=True)

    async def save(self, file: UploadFile, unique_name: str) -> tuple[str, int]:
        dest = self._dir / unique_name
        total_size = 0
        chunk_size = 64 * 1024  # 64 KB chunks

        async with aiofiles.open(dest, "wb") as out:
            while chunk := await file.read(chunk_size):
                total_size += len(chunk)
                if total_size > settings.max_file_size_bytes:
                    await out.close()
                    await aiofiles.os.remove(dest)
                    raise FileTooLargeError(settings.MAX_FILE_SIZE_MB)
                await out.write(chunk)

        logger.info("file_saved", filename=unique_name, size_bytes=total_size)
        return self.get_url(unique_name), total_size

    async def delete(self, filename: str) -> None:
        path = self._dir / filename
        try:
            await aiofiles.os.remove(path)
            logger.info("file_deleted", filename=filename)
        except FileNotFoundError:
            logger.warning("file_not_found_on_delete", filename=filename)

    def get_url(self, filename: str) -> str:
        # OPRAVA: Vrací cestu k veřejnému statickému endpointu /files/
        # bez nutnosti autentizace – přehrávač <audio> nemůže posílat JWT hlavičky.
        # Dřívější cesta /api/v1/sounds/files/{filename} vyžadovala auth → CORS chyba.
        return f"/files/{filename}"


# ── S3 backend (stub pro budoucí migraci) ────────────────────────────────────

class S3StorageBackend(StorageBackend):
    """
    Implementace pro AWS S3.
    Vyžaduje: pip install aiobotocore
    """

    def __init__(self) -> None:
        raise NotImplementedError(
            "S3StorageBackend není implementován. Nastavte USE_S3=false."
        )

    async def save(self, file: UploadFile, unique_name: str) -> tuple[str, int]:  # pragma: no cover
        raise NotImplementedError

    async def delete(self, filename: str) -> None:  # pragma: no cover
        raise NotImplementedError

    def get_url(self, filename: str) -> str:  # pragma: no cover
        raise NotImplementedError


# ── Továrna ───────────────────────────────────────────────────────────────────

def get_storage() -> StorageBackend:
    if settings.USE_S3:
        return S3StorageBackend()
    return LocalStorageBackend(settings.UPLOAD_DIR)


storage = get_storage()


# ── Pomocné funkce ────────────────────────────────────────────────────────────

def generate_unique_filename(original_filename: str) -> str:
    """
    Vytvoří unikátní název souboru zachovávající příponu.
    Formát: <uuid4_hex>_<hash_original[:8]><ext>
    Příklad: a3f1c2d4e5b6...._memes_fu.mp3
    """
    stem = Path(original_filename).stem[:32]
    suffix = Path(original_filename).suffix.lower()
    unique = uuid.uuid4().hex[:16]
    safe_stem = "".join(c if c.isalnum() or c in "-_" else "_" for c in stem)
    return f"{unique}_{safe_stem}{suffix}"


async def validate_audio_file(file: UploadFile) -> str:
    """
    Ověří, že jde o skutečný audio soubor (přípona + MIME type).
    Vrátí MIME type.
    Raises: InvalidFileTypeError
    """
    ext = Path(file.filename or "").suffix.lower()
    if ext not in settings.ALLOWED_AUDIO_EXTENSIONS:
        raise InvalidFileTypeError(settings.ALLOWED_AUDIO_EXTENSIONS)

    # Ověření MIME typu z Content-Type hlavičky
    content_type = file.content_type or ""
    base_mime = content_type.split(";")[0].strip()

    if base_mime not in settings.ALLOWED_AUDIO_MIME_TYPES:
        # Fallback: akceptujeme pokud přípona sedí a MIME je obecné
        if base_mime not in ("application/octet-stream", ""):
            raise InvalidFileTypeError(settings.ALLOWED_AUDIO_EXTENSIONS)

    return base_mime or "audio/mpeg"