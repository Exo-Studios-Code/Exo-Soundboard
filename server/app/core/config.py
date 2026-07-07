"""
Centrální konfigurace aplikace načítaná z prostředí (.env).

Změny oproti vývojové verzi:
- UPLOAD_DIR a LOG_DIR podporují absolutní cesty (pro produkci na Pi/VPS)
- ALLOWED_ORIGINS parsuje správně i stringy mimo AnyHttpUrl (app://, file://)
- BASE_URL umožňuje frontendu dynamicky sestavit URL souborů
"""
from pathlib import Path
from typing import Literal, Any

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── Obecné ──────────────────────────────────────────────────────────────
    APP_NAME: str = "CloudSoundboard"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: Literal["development", "production", "test"] = "development"
    DEBUG: bool = False

    # ── Server ───────────────────────────────────────────────────────────────
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # BASE_URL: veřejná adresa serveru – klient ji používá pro stavění URL
    # Pokud není nastavena, sestaví se automaticky z HOST+PORT
    # Příklad pro Pi s veřejnou IP: "http://89.123.45.67:8000"
    # Příklad pro doménu s HTTPS:   "https://soundboard.example.com"
    BASE_URL: str | None = None

    # CORS – přijímáme string (může obsahovat app://, file:// které AnyHttpUrl odmítne)
    ALLOWED_ORIGINS: list[str] = Field(
        default=["http://localhost:3000", "app://.", "file://", "http://localhost:5173"]
    )

    # ── Databáze ─────────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite+aiosqlite:///./cloudsoundboard.db"

    # ── JWT Auth ──────────────────────────────────────────────────────────────
    SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION_USE_openssl_rand_hex_32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 dní

    # ── Ukládání souborů ──────────────────────────────────────────────────────
    UPLOAD_DIR: Path = Path("uploads")
    MAX_FILE_SIZE_MB: int = 50
    ALLOWED_AUDIO_EXTENSIONS: frozenset[str] = frozenset({".mp3", ".wav", ".ogg", ".flac"})
    ALLOWED_AUDIO_MIME_TYPES: frozenset[str] = frozenset({
        "audio/mpeg", "audio/wav", "audio/wave", "audio/x-wav",
        "audio/ogg", "audio/flac", "audio/x-flac",
    })

    # ── S3 (volitelné – pro budoucí migraci) ─────────────────────────────────
    USE_S3: bool = False
    AWS_ACCESS_KEY_ID: str | None = None
    AWS_SECRET_ACCESS_KEY: str | None = None
    AWS_REGION: str = "eu-central-1"
    S3_BUCKET_NAME: str | None = None

    # ── Logování ─────────────────────────────────────────────────────────────
    LOG_LEVEL: str = "INFO"
    LOG_DIR: Path = Path("logs")

    # ── Validátory ────────────────────────────────────────────────────────────

    @field_validator("UPLOAD_DIR", "LOG_DIR", mode="before")
    @classmethod
    def ensure_dir_exists(cls, v: str | Path) -> Path:
        path = Path(v)
        path.mkdir(parents=True, exist_ok=True)
        return path

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_origins(cls, v: Any) -> list[str]:
        """
        Parsuje ALLOWED_ORIGINS z .env – může být JSON pole nebo čárkami oddělený string.
        Akceptuje i nestandardní schémata jako app://, file://.
        """
        if isinstance(v, list):
            return [str(o) for o in v]
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("["):
                import json
                return json.loads(v)
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    # ── Computed properties ───────────────────────────────────────────────────

    @property
    def max_file_size_bytes(self) -> int:
        return self.MAX_FILE_SIZE_MB * 1024 * 1024

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def effective_base_url(self) -> str:
        """
        Veřejná URL serveru – použita pro generování download URL souborů.
        Frontend ji přijme při loginu a ukládá do store.
        """
        if self.BASE_URL:
            return self.BASE_URL.rstrip("/")
        # Fallback pro lokální vývoj
        host = "localhost" if self.HOST == "0.0.0.0" else self.HOST
        return f"http://{host}:{self.PORT}"


settings = Settings()
