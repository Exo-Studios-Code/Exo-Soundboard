"""
Servisní vrstva pro uživatele – čistá business logika bez HTTP závislostí.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError, ConflictError, NotFoundError
from app.core.logging import get_logger
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.user import TokenResponse, UserCreate, UserLogin, UserPublic

logger = get_logger(__name__)


class UserService:

    @staticmethod
    async def register(db: AsyncSession, data: UserCreate) -> UserPublic:
        # Kontrola duplicit
        existing = await db.execute(
            select(User).where(
                (User.username == data.username) | (User.email == data.email)
            )
        )
        if existing.scalar_one_or_none():
            raise ConflictError("Uživatelské jméno nebo email již existuje.")

        user = User(
            username=data.username,
            email=data.email,
            hashed_password=hash_password(data.password),
        )
        db.add(user)
        await db.flush()  # získáme ID před commitem

        logger.info("user_registered", user_id=user.id, username=user.username)
        return UserPublic.model_validate(user)

    @staticmethod
    async def login(db: AsyncSession, data: UserLogin) -> TokenResponse:
        result = await db.execute(select(User).where(User.username == data.username))
        user = result.scalar_one_or_none()

        if not user or not verify_password(data.password, user.hashed_password):
            raise AuthenticationError()

        if not user.is_active:
            raise AuthenticationError("Účet je deaktivován.")

        token = create_access_token(user.id)
        logger.info("user_logged_in", user_id=user.id)
        return TokenResponse(
            access_token=token,
            user=UserPublic.model_validate(user),
        )

    @staticmethod
    async def get_by_id(db: AsyncSession, user_id: str) -> User:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise NotFoundError("User", user_id)
        return user
