
# 🎙️ CloudSoundboard (Beta v0.1.0)
Developed by **Ex0 Studios**

A shared cloud soundboard desktop app for Windows. Users share a library of sounds in real time - uploading a new sound instantly shows it to everyone else via WebSocket. Sounds can be played to a virtual audio cable (for Discord) using global keyboard shortcuts.

---

## 🌍 Active Beta Live Server

To participate in our open beta and access the shared remote audio database, you do not need to host the backend locally. You just need to configure your client application to connect to our live production endpoint.

When setting up or selecting the host address within the application settings, change `localhost` to our official active bridge:

🔗 **Beta Server URL:** `https://earthling-coliseum-blurb-ngrok-free.dev`

> ⚠️ **Important:** Ensure you include the full `https://` prefix so the desktop app can establish a secure handshake with the database and WebSockets.

---

## Architecture


```

cloudsoundboard/
├── server/ # Python FastAPI backend
│ ├── app/
│ │ ├── api/v1/
│ │ │ ├── endpoints/
│ │ │ ├── auth.py # POST /register, /login
│ │ │ │ ├── sounds.py # CRUD + file serving
│ │ │ │ └── websocket.py # WS /ws/connect
│ │ │ ├── deps.py # FastAPI dependencies (auth)
│ │ │ └── router.py # Router aggregation
│ │ ├── core/
│ │ │ ├── config.py # Pydantic Settings (.env)
│ │ │ ├── exceptions.py # Domain exceptions
│ │ │ ├── logging.py # structlog setup
│ │ │ └── security.py # JWT + bcrypt
│ │ ├── db/
│ │ └── database.py # SQLAlchemy async engine
│ │ ├── models/
│ │ │ ├── user.py # ORM user model
│ │ │ └── sound.py # ORM sound model
│ │ ├── schemas/
│ │ │ ├── user.py # Pydantic I/O schemas
│ │ └── sound.py # + WS message types
│ │ ├── services/
│ │ │ ├── user_service.py # User business logic
│ │ │ ├── sound_service.py # Sound business logic + WS broadcast
│ │ │ ├── file_storage.py # Storage abstraction (Local/S3)
│ │ └── websocket_manager.py # WS connection pool + broadcast
│ │ └── main.py # FastAPI app + lifecycle
│ ├── tests/
│ │ └── test_api.py # Integration tests
│ ├── requirements.txt
│ ├── pytest.ini
│ └── .env.example
│
└── client/ # Electron + React/TypeScript
├── src/
│ ├── main/ # Electron main process (Node.js)
│ │ ├── main.ts # App lifecycle, IPC, tray
│ │ ├── preload.ts # Safe IPC bridge (contextBridge)
│ │ ├── audioPlayer.ts # Audio playback → renderer
│ │ ├── hotkeyManager.ts # globalShortcut management
│ │ ├── storeManager.ts # electron-store (persistent settings)
│ │ └── logger.ts # Main process logging
│ └── renderer/ # React UI (browser context)
│ ├── App.tsx # Root component
│ ├── styles.css # Complete dark-mode design
│ ├── types/index.ts # TypeScript types
│ ├── services/
│ ├── api.ts # Axios API client
│ │ ├── websocket.ts # WS client (auto-reconnect)
│ └── audioService.ts # Web Audio API + device routing
│ ├── stores/
│ │ └── appStore.ts # Zustand global state
│ └── components/
│ ├── layout/
│ │ ├── LoginPage.tsx
│ ├── MainLayout.tsx
│ └── TitleBar.tsx / TopBar.tsx
│ ├── soundboard/
│ │ ├── SoundGrid.tsx # Responsive tile grid
│ │ ├── SoundTile.tsx # Sound tile + hotkey
│ │ ├── UploadDialog.tsx # Upload with Drag & Drop
│ │ └── AudioBridge.tsx # IPC bridge for audio
│ └── settings/
│ └── SettingsPanel.tsx # Audio devices, server, stats
├── index.html
├── vite.config.ts
├── tsconfig.json / tsconfig.main.json
└── package.json

```

---

## Data Model

### `users`
| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary Key |
| `username` | VARCHAR(64) | Unique, indexed |
| `email` | VARCHAR(255) | Unique, indexed |
| `hashed_password` | VARCHAR(255) | bcrypt hash |
| `is_active` | BOOLEAN | Active account |
| `is_admin` | BOOLEAN | Admin permissions |
| `created_at` | TIMESTAMPTZ | Registration time |

### `sounds`
| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | VARCHAR(128) | Sound name, indexed |
| `description` | TEXT | Optional description |
| `tags` | VARCHAR(512) | Comma separated tags |
| `filename` | VARCHAR(256) | Unique file name on disk |
| `original_filename` | VARCHAR(256) | Original name |
| `file_size` | INTEGER | Size in bytes |
| `mime_type` | VARCHAR(64) | MIME file type |
| `duration_seconds` | FLOAT | Duration in seconds |
| `file_url` | VARCHAR(512) | Relative download URL |
| `author_id` | UUID FK | Link to `users.id` |
| `play_count` | INTEGER | Number of plays |
| `created_at` | TIMESTAMPTZ | Upload time, indexed |

---

## Quickstart (For Developers)

### Backend Local Hosting

```bash
cd server

# Install dependencies
python -m venv venv
venv\Scripts\activate # Windows
pip install -r requirements.txt

# Configure
copy .env.example .env
# Edit .env – especially SECRET_KEY

# Run (SQLite, development)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Tests
pytest tests/ -v

```

Server runs at `http://localhost:8000`, API documentation at `http://localhost:8000/docs`.

### Client Local Hosting

```bash
cd client

npm install

# Development (runs Vite + Electron)
npm run dev

# Production build
npm run dist

```

---

## REST API overview

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | User registration |
| POST | `/api/v1/auth/login` | Login, returns JWT |
| GET | `/api/v1/sounds/` | List of sounds (paginated, full-text search) |
| POST | `/api/v1/sounds/upload` | Upload sound (multipart/form-data) |
| GET | `/api/v1/sounds/{id}` | Sound details |
| PATCH | `/api/v1/sounds/{id}` | Edit metadata |
| DELETE | `/api/v1/sounds/{id}` | Delete sound |
| POST | `/api/v1/sounds/{id}/play` | Increment play count |
| GET | `/api/v1/sounds/files/{filename}` | Download/stream file |
| WS | `/api/v1/ws/connect?token=<JWT>` | WebSocket connection |

### WebSocket messages (server → client)

```json
{ "event": "sound_added", "data": { ...SoundPublic }, "timestamp": "..." }
{ "event": "sound_deleted", "data": { "id": "uuid" }, "timestamp": "..." }
{ "event": "sound_updated", "data": { ...SoundPublic }, "timestamp": "..." }
{ "event": "ping", "data": {}, "timestamp": "..." }
{ "event": "connected", "data": { "user_id": "..." }, "timestamp": "..." }

```

---

## Production configuration

1. **Database:** Change `DATABASE_URL` to PostgreSQL in `.env`
2. **SECRET_KEY:** Generate: `openssl rand -hex 32`
3. **HTTPS:** Deploy behind nginx or Caddy with TLS certificate
4. **S3:** Set `USE_S3=true` and AWS credentials – then implement `S3StorageBackend` in `file_storage.py`
5. **ALLOWED_ORIGINS:** Adjust for production domain

---

## Virtual Audio Cable (Discord)

1. Install **VB-Audio Virtual Cable** (free): https://vb-audio.com/Cable/
2. In CloudSoundboard settings → Audio output → select **CABLE Input (VB-Audio Virtual Cable)**
3. In Discord → Voice & Video → Input Devices → **CABLE Output (VB-Audio Virtual Cable)**
4. Sounds played in CloudSoundboard will be transmitted as your microphone to Discord.

---

## Keyboard shortcuts

* On each tile, click **⋮** → "Assign shortcut"
* Press any key combination (e.g. `F1`, `Ctrl+Shift+1`, `Alt+F5`)
* The shortcut works **globally** – even when the application is minimized or in the game
* Shortcuts are saved between application restarts

---

## Technology

| Layer | Technology |
| --- | --- |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0 async, aiosqlite/asyncpg |
| Auth | JWT (python-jose), bcrypt (passlib) |
| Real-time | WebSockets (FastAPI native) |
| Logging | structlog (JSON in production) |
| Desktop | Electron 31, Node.js |
| UI | React 18, TypeScript, Zustand, Framer Motion |
| Audio | Web Audio API, HTMLAudioElement.setSinkId() |
| Hotkeys | Electron globalShortcut |
| Build | Vite 5, electron-builder |

---

## 💬 Community & Feedback

Want to share sounds, report technical issues, or coordinate with the beta group? Join us:
👉 **[Join the Official Ex0 Studios Discord Server](https://www.google.com/search?q=https://discord.gg/YOUR_DISCORD_INVITE_CODE)**

---

## License

This project is maintained as an open beta under the **MIT License** by **Ex0 Studios**. See the project files for full licensing terms.

```

```
