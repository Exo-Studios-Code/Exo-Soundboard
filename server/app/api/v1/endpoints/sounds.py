"""
REST API pro správu zvuků: upload, seznam, mazání, stahování souborů.
"""
from pathlib import Path
import httpx
from bs4 import BeautifulSoup

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.core.config import settings
from app.core.exceptions import AppError, NotFoundError, to_http_exception
from app.db.database import get_db
from app.models.user import User
from app.schemas.sound import SoundCreate, SoundListResponse, SoundPublic, SoundUpdate
from app.services.sound_service import SoundService
from app.services.favorite_service import FavoriteService

router = APIRouter(prefix="/sounds", tags=["sounds"])

@router.post(
    "/upload",
    response_model=SoundPublic,
    status_code=status.HTTP_201_CREATED,
    summary="Nahrání nového zvuku (multipart/form-data)",
)
async def upload_sound(
    file: UploadFile = File(..., description="Audio soubor .mp3 nebo .wav"),
    name: str = Form(..., min_length=1, max_length=128),
    description: str | None = Form(None),
    tags: str = Form("", description="Tagy oddělené čárkou: 'meme,reaction,funny'"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SoundPublic:
    tags_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
    metadata = SoundCreate(name=name, description=description, tags=tags_list)
    try:
        return await SoundService.upload(db, file, metadata, current_user)
    except AppError as exc:
        raise to_http_exception(exc)

@router.get(
    "/",
    response_model=SoundListResponse,
    summary="Seznam všech zvuků (stránkovaný)",
)
async def list_sounds(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    search: str | None = Query(None, max_length=128),
    tag: str | None = Query(None, max_length=64),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SoundListResponse:
    favorite_ids = await FavoriteService.get_favorite_ids(db, current_user.id)
    return await SoundService.get_list(
        db, page=page, per_page=per_page, search=search, tag=tag, favorite_ids=favorite_ids
    )

@router.get("/search-online")
async def search_online(query: str, limit: int = 10):
    """
    Prohledá databázi Myinstants a vrátí výsledky připravené ke stažení.
    """
    url = f"https://www.myinstants.com/en/search/?name={query}"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    }
    
    async with httpx.AsyncClient(headers=headers) as client:
        response = await client.get(url)

    if response.status_code != 200:
        raise HTTPException(status_code=500, detail=f"Myinstants vrátil chybu {response.status_code}")

    soup = BeautifulSoup(response.text, "html.parser")
    results = []

    # Agresivní metoda: Prohledáme úplně všechny odkazy <a> na stránce
    for link in soup.find_all("a", href=True):
        onclick = link.get("onclick", "")
        
        # Hledáme odkazy, které mají v sobě funkci play(...)
        if "play('" in onclick:
            name = link.text.strip()
            
            # Pokud je název prázdný, zkusíme najít název v nadřazené kartě
            if not name:
                parent = link.find_parent(class_="instant-card")
                if parent:
                    name_elem = parent.select_one(".instant-link")
                    if name_elem:
                        name = name_elem.text.strip()
            
            if name:
                # Extrakce cesty k MP3
                try:
                    mp3_path = onclick.split("play('")[1].split("'")[0]
                    full_mp3_url = f"https://www.myinstants.com{mp3_path}"
                    
                    results.append({
                        "name": name,
                        "preview_url": full_mp3_url
                    })
                except Exception:
                    continue
        
        if len(results) >= limit:
            break

    return {"results": results}
@router.get(
    "/{sound_id}",
    response_model=SoundPublic,
    summary="Detail jednoho zvuku",
)
async def get_sound(
    sound_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SoundPublic:
    try:
        sound = await SoundService.get_by_id(db, sound_id)
        return SoundPublic.from_orm_with_tags(sound)
    except AppError as exc:
        raise to_http_exception(exc)

@router.patch(
    "/{sound_id}",
    response_model=SoundPublic,
    summary="Úprava metadat zvuku",
)
async def update_sound(
    sound_id: str,
    data: SoundUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SoundPublic:
    try:
        return await SoundService.update(db, sound_id, data, current_user)
    except AppError as exc:
        raise to_http_exception(exc)

@router.delete(
    "/{sound_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Smazání zvuku",
)
async def delete_sound(
    sound_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    try:
        await SoundService.delete(db, sound_id, current_user)
    except AppError as exc:
        raise to_http_exception(exc)

@router.post(
    "/{sound_id}/play",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Inkrementuje počítadlo přehrání",
)
async def track_play(
    sound_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    await SoundService.increment_play_count(db, sound_id)

@router.post(
    "/{sound_id}/favorite",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Přidá zvuk do oblíbených",
)
async def add_favorite(
    sound_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    await FavoriteService.add(db, user_id=current_user.id, sound_id=sound_id)


@router.delete(
    "/{sound_id}/favorite",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Odebere zvuk z oblíbených",
)
async def remove_favorite(
    sound_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    await FavoriteService.remove(db, user_id=current_user.id, sound_id=sound_id)


@router.get(
    "/favorites",
    response_model=list[SoundPublic],
    summary="Seznam oblíbených zvuků aktuálního uživatele",
)
async def list_favorites(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[SoundPublic]:
    return await FavoriteService.get_favorites(db, user_id=current_user.id)


@router.get(
    "/files/{filename}",
    summary="Stažení/streamování audio souboru",
    include_in_schema=False,
)
async def serve_file(
    filename: str,
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    safe_name = Path(filename).name
    file_path = settings.UPLOAD_DIR / safe_name

    if not file_path.exists() or not file_path.is_file():
        raise to_http_exception(NotFoundError("File", filename))

    return FileResponse(
        path=file_path,
        media_type="audio/mpeg",
        filename=safe_name,
    )