# 🎙️ CloudSoundboard

Sdílená cloudová soundboard desktopová aplikace pro Windows. Uživatelé sdílí knihovnu zvuků v reálném čase – nahrání nového zvuku okamžitě zobrazí všem ostatním přes WebSocket. Zvuky lze přehrávat do virtuálního audio kabelu (pro Discord) pomocí globálních klávesových zkratek.

---

## Architektura

```
cloudsoundboard/
├── server/                          # Python FastAPI backend
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── endpoints/
│   │   │   │   ├── auth.py          # POST /register, /login
│   │   │   │   ├── sounds.py        # CRUD + file serving
│   │   │   │   └── websocket.py     # WS /ws/connect
│   │   │   ├── deps.py              # FastAPI dependencies (auth)
│   │   │   └── router.py            # Agregace routerů
│   │   ├── core/
│   │   │   ├── config.py            # Pydantic Settings (.env)
│   │   │   ├── exceptions.py        # Doménové výjimky
│   │   │   ├── logging.py           # structlog setup
│   │   │   └── security.py          # JWT + bcrypt
│   │   ├── db/
│   │   │   └── database.py          # SQLAlchemy async engine
│   │   ├── models/
│   │   │   ├── user.py              # ORM model uživatele
│   │   │   └── sound.py             # ORM model zvuku
│   │   ├── schemas/
│   │   │   ├── user.py              # Pydantic I/O schémata
│   │   │   └── sound.py             # + WS message typy
│   │   ├── services/
│   │   │   ├── user_service.py      # Business logika uživatelů
│   │   │   ├── sound_service.py     # Business logika zvuků + WS broadcast
│   │   │   ├── file_storage.py      # Abstrakce ukládání (Local/S3)
│   │   │   └── websocket_manager.py # WS connection pool + broadcast
│   │   └── main.py                  # FastAPI app + lifecycle
│   ├── tests/
│   │   └── test_api.py              # Integrační testy
│   ├── requirements.txt
│   ├── pytest.ini
│   └── .env.example
│
└── client/                          # Electron + React/TypeScript
    ├── src/
    │   ├── main/                    # Electron main process (Node.js)
    │   │   ├── main.ts              # App lifecycle, IPC, tray
    │   │   ├── preload.ts           # Bezpečný IPC bridge (contextBridge)
    │   │   ├── audioPlayer.ts       # Audio přehrávání → renderer
    │   │   ├── hotkeyManager.ts     # globalShortcut správa
    │   │   ├── storeManager.ts      # electron-store (persistentní nastavení)
    │   │   └── logger.ts            # Main process logging
    │   └── renderer/                # React UI (browser context)
    │       ├── App.tsx              # Root komponenta
    │       ├── styles.css           # Kompletní dark-mode design
    │       ├── types/index.ts       # TypeScript typy
    │       ├── services/
    │       │   ├── api.ts           # Axios API klient
    │       │   ├── websocket.ts     # WS klient (auto-reconnect)
    │       │   └── audioService.ts  # Web Audio API + device routing
    │       ├── stores/
    │       │   └── appStore.ts      # Zustand globální stav
    │       └── components/
    │           ├── layout/
    │           │   ├── LoginPage.tsx
    │           │   ├── MainLayout.tsx
    │           │   └── TitleBar.tsx / TopBar.tsx
    │           ├── soundboard/
    │           │   ├── SoundGrid.tsx    # Responsivní mřížka dlaždic
    │           │   ├── SoundTile.tsx    # Dlaždice se zvukem + hotkey
    │           │   ├── UploadDialog.tsx # Upload s Drag & Drop
    │           │   └── AudioBridge.tsx  # IPC bridge pro audio
    │           └── settings/
    │               └── SettingsPanel.tsx # Audio zařízení, server, stats
    ├── index.html
    ├── vite.config.ts
    ├── tsconfig.json / tsconfig.main.json
    └── package.json
```

---

## Datový model

### `users`
| Sloupec | Typ | Popis |
|---|---|---|
| `id` | UUID | Primární klíč |
| `username` | VARCHAR(64) | Unikátní, indexováno |
| `email` | VARCHAR(255) | Unikátní, indexováno |
| `hashed_password` | VARCHAR(255) | bcrypt hash |
| `is_active` | BOOLEAN | Aktivní účet |
| `is_admin` | BOOLEAN | Admin oprávnění |
| `created_at` | TIMESTAMPTZ | Čas registrace |

### `sounds`
| Sloupec | Typ | Popis |
|---|---|---|
| `id` | UUID | Primární klíč |
| `name` | VARCHAR(128) | Název zvuku, indexováno |
| `description` | TEXT | Volitelný popis |
| `tags` | VARCHAR(512) | Tagy oddělené čárkou |
| `filename` | VARCHAR(256) | Unikátní název souboru na disku |
| `original_filename` | VARCHAR(256) | Původní název |
| `file_size` | INTEGER | Velikost v bytech |
| `mime_type` | VARCHAR(64) | MIME typ souboru |
| `duration_seconds` | FLOAT | Délka v sekundách |
| `file_url` | VARCHAR(512) | Relativní URL pro stažení |
| `author_id` | UUID FK | Odkaz na `users.id` |
| `play_count` | INTEGER | Počet přehrání |
| `created_at` | TIMESTAMPTZ | Čas nahrání, indexováno |

---

## Rychlý start

### Backend

```bash
cd server

# Instalace závislostí
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt

# Konfigurace
copy .env.example .env
# Edituj .env – zejména SECRET_KEY

# Spuštění (SQLite, vývoj)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Testy
pytest tests/ -v
```

Server běží na `http://localhost:8000`, API dokumentace na `http://localhost:8000/docs`.

### Klient

```bash
cd client

npm install

# Vývoj (spustí Vite + Electron)
npm run dev

# Produkční build
npm run dist
```

---

## REST API přehled

| Metoda | Endpoint | Popis |
|---|---|---|
| POST | `/api/v1/auth/register` | Registrace uživatele |
| POST | `/api/v1/auth/login` | Přihlášení, vrátí JWT |
| GET | `/api/v1/sounds/` | Seznam zvuků (stránkovaný, fulltextové hledání) |
| POST | `/api/v1/sounds/upload` | Nahrání zvuku (multipart/form-data) |
| GET | `/api/v1/sounds/{id}` | Detail zvuku |
| PATCH | `/api/v1/sounds/{id}` | Úprava metadat |
| DELETE | `/api/v1/sounds/{id}` | Smazání zvuku |
| POST | `/api/v1/sounds/{id}/play` | Inkrementuje play count |
| GET | `/api/v1/sounds/files/{filename}` | Stažení/stream souboru |
| WS | `/api/v1/ws/connect?token=<JWT>` | WebSocket připojení |

### WebSocket zprávy (server → klient)

```json
{ "event": "sound_added",   "data": { ...SoundPublic },  "timestamp": "..." }
{ "event": "sound_deleted", "data": { "id": "uuid" },     "timestamp": "..." }
{ "event": "sound_updated", "data": { ...SoundPublic },  "timestamp": "..." }
{ "event": "ping",          "data": {},                   "timestamp": "..." }
{ "event": "connected",     "data": { "user_id": "..." }, "timestamp": "..." }
```

---

## Konfigurace pro produkci

1. **Databáze:** Změň `DATABASE_URL` na PostgreSQL v `.env`
2. **SECRET_KEY:** Vygeneruj: `openssl rand -hex 32`
3. **HTTPS:** Nasaď za nginx nebo Caddy s TLS certifikátem
4. **S3:** Nastav `USE_S3=true` a AWS přihlašovací údaje – pak implementuj `S3StorageBackend` v `file_storage.py`
5. **ALLOWED_ORIGINS:** Uprav pro produkční doménu

---

## Virtuální audio kabel (Discord)

1. Nainstaluj **VB-Audio Virtual Cable** (zdarma): https://vb-audio.com/Cable/
2. V nastavení CloudSoundboard → Audio výstup → vyber **CABLE Input (VB-Audio Virtual Cable)**
3. V Discordu → Hlas a video → Vstupní zařízení → **CABLE Output (VB-Audio Virtual Cable)**
4. Zvuky přehrané ve CloudSoundboard se budou přenášet jako tvůj mikrofon do Discordu.

---

## Klávesové zkratky

- Na každé dlaždici klikni na **⋮** → „Přiřadit zkratku"
- Stiskni libovolnou kombinaci kláves (např. `F1`, `Ctrl+Shift+1`, `Alt+F5`)
- Zkratka funguje **globálně** – i při minimalizované aplikaci nebo ve hře
- Zkratky se ukládají mezi restarty aplikace

---

## Technologie

| Vrstva | Technologie |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0 async, aiosqlite/asyncpg |
| Auth | JWT (python-jose), bcrypt (passlib) |
| Real-time | WebSockets (FastAPI native) |
| Logování | structlog (JSON v produkci) |
| Desktop | Electron 31, Node.js |
| UI | React 18, TypeScript, Zustand, Framer Motion |
| Audio | Web Audio API, HTMLAudioElement.setSinkId() |
| Hotkeys | Electron globalShortcut |
| Build | Vite 5, electron-builder |
