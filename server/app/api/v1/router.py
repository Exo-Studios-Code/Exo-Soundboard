"""Hlavní router pro API v1 – agreguje všechny sub-routery."""
from fastapi import APIRouter

from app.api.v1.endpoints import auth, sounds, websocket

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(sounds.router)
api_router.include_router(websocket.router)
