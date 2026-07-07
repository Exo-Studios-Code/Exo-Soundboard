"""
Endpointy pro autentizaci: registrace a přihlášení.
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppError, to_http_exception
from app.db.database import get_db
from app.schemas.user import TokenResponse, UserCreate, UserLogin, UserPublic
from app.services.user_service import UserService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=UserPublic,
    status_code=status.HTTP_201_CREATED,
    summary="Registrace nového uživatele",
)
async def register(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
) -> UserPublic:
    try:
        return await UserService.register(db, data)
    except AppError as exc:
        raise to_http_exception(exc)


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Přihlášení a získání JWT tokenu",
)
async def login(
    data: UserLogin,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    try:
        return await UserService.login(db, data)
    except AppError as exc:
        raise to_http_exception(exc)
