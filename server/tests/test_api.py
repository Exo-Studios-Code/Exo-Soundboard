"""
Integrační testy pro FastAPI backend.
Spustit: pytest tests/ -v
"""
import io
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.db.database import engine, Base, init_db


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    """Vytvoří a po každém testu smaže databázi."""
    await init_db()
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


@pytest_asyncio.fixture
async def auth_client(client):
    """Klient s platným JWT tokenem."""
    await client.post("/api/v1/auth/register", json={
        "username": "testuser",
        "email": "test@test.cz",
        "password": "Heslo123",
    })
    res = await client.post("/api/v1/auth/login", json={
        "username": "testuser",
        "password": "Heslo123",
    })
    token = res.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    return client


# ── Auth testy ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_register_success(client):
    res = await client.post("/api/v1/auth/register", json={
        "username": "novak",
        "email": "novak@test.cz",
        "password": "Heslo123",
    })
    assert res.status_code == 201
    data = res.json()
    assert data["username"] == "novak"
    assert "id" in data


@pytest.mark.asyncio
async def test_register_duplicate(client):
    payload = {"username": "dup", "email": "dup@test.cz", "password": "Heslo123"}
    await client.post("/api/v1/auth/register", json=payload)
    res = await client.post("/api/v1/auth/register", json=payload)
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_login_success(client):
    await client.post("/api/v1/auth/register", json={
        "username": "loginuser", "email": "login@test.cz", "password": "Heslo123"
    })
    res = await client.post("/api/v1/auth/login", json={
        "username": "loginuser", "password": "Heslo123"
    })
    assert res.status_code == 200
    assert "access_token" in res.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    await client.post("/api/v1/auth/register", json={
        "username": "u2", "email": "u2@test.cz", "password": "Heslo123"
    })
    res = await client.post("/api/v1/auth/login", json={
        "username": "u2", "password": "spatne"
    })
    assert res.status_code == 401


# ── Sound testy ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_sounds_empty(auth_client):
    res = await auth_client.get("/api/v1/sounds/")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 0
    assert data["items"] == []


@pytest.mark.asyncio
async def test_upload_and_list(auth_client, tmp_path):
    # Vytvoříme fake MP3 soubor
    fake_mp3 = b"\xff\xfb\x90\x00" + b"\x00" * 100
    res = await auth_client.post(
        "/api/v1/sounds/upload",
        data={"name": "Test Zvuk", "tags": "test,pytest"},
        files={"file": ("test.mp3", io.BytesIO(fake_mp3), "audio/mpeg")},
    )
    assert res.status_code == 201
    sound = res.json()
    assert sound["name"] == "Test Zvuk"
    assert "test" in sound["tags"]

    # Seznam obsahuje zvuk
    res2 = await auth_client.get("/api/v1/sounds/")
    assert res2.json()["total"] == 1


@pytest.mark.asyncio
async def test_delete_sound(auth_client):
    fake_mp3 = b"\xff\xfb\x90\x00" + b"\x00" * 100
    res = await auth_client.post(
        "/api/v1/sounds/upload",
        data={"name": "Smazat mě"},
        files={"file": ("del.mp3", io.BytesIO(fake_mp3), "audio/mpeg")},
    )
    sound_id = res.json()["id"]

    del_res = await auth_client.delete(f"/api/v1/sounds/{sound_id}")
    assert del_res.status_code == 204

    list_res = await auth_client.get("/api/v1/sounds/")
    assert list_res.json()["total"] == 0


@pytest.mark.asyncio
async def test_unauthenticated_access(client):
    res = await client.get("/api/v1/sounds/")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_health(client):
    res = await client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
