# DevBrawl — Real-time Collaborative Coding Interview Platform

> **Built for free. Runs locally. No production deployment required.**

## 🎯 What is DevBrawl?

A real-time multiplayer coding interview platform where developers:
- Join rooms and take turns solving AI-generated challenges
- Code collaboratively with Monaco Editor (VS Code in browser)
- Whiteboard together with an Excalidraw canvas
- Get instant feedback via automated tests + AI code review
- Compete on leaderboards with gamified scoring

This is a **local-only project**. There is no production deployment and no
cloud VM infrastructure. Code execution runs through **OneCompiler via
RapidAPI** (free tier, hard cap of 1,000 requests/month). MongoDB is either
MongoDB Atlas M0 or a native local install. **No container runtime is
required.**

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (React + Vite)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │ Monaco Edit │  │  Excalidraw │  │  Socket.io  │  │     LiveKit      │   │
│  │    or       │  │  Canvas     │  │  Client     │  │   Voice/Video    │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                            HTTP / WSS (Socket.io)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LOCAL BACKEND (Node.js)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │   Express   │  │  Socket.io  │  │  MongoDB    │  │   AI Providers   │   │
│  │   REST API  │  │   Server    │  │ Atlas/local │  │ Gemini/Groq/OR   │   │
│  └──────┬──────┘  └─────────────┘  └─────────────┘  └──────────────────┘   │
│         │                                                                    │
│         ▼                                                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │            OneCompiler via RapidAPI (HTTPS, 1,000 req/mo)             │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 💰 Current Stack

| Service | Free Tier | Purpose |
|---------|-----------|---------|
| **MongoDB Atlas M0** | 512MB (or native local install) | Database |
| **OneCompiler via RapidAPI** | **1,000 requests/month, hard cap** | Code execution |
| **Google Gemini** | 1,500 req/day | AI questions + code scoring |
| **Groq** | 14,400 req/day | Fallback AI (ultra-fast) |
| **OpenRouter** | Free (Nemotron) | Backup AI |
| **LiveKit Cloud** | 10K participant min/mo | Voice/Video calls |
| **Cloudinary** | 25GB storage + bandwidth | Image uploads |
| **Node.js 20 LTS** | Free | Backend runtime |
| **React + Vite** | Free | Frontend |

> **Quota note:** every test case in a submission costs one OneCompiler API
> call. A submission with 5 test cases costs 5 calls. At 1,000 calls/month,
> that is roughly 200 submissions/month.

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- **Node.js 20+** and **npm**
- **MongoDB Atlas M0** connection string (or a native local MongoDB)
- **RapidAPI OneCompiler** subscription — free tier at
  [rapidapi.com/onecompiler](https://rapidapi.com/onecompiler)
- Optional: Gemini, Groq, OpenRouter, LiveKit, Cloudinary keys

### 1. Backend

```bash
cd Backend
npm install
cp .env.example .env    # Windows: copy .env.example .env
# Fill in RAPIDAPI_KEY, RAPIDAPI_HOST, MONGODB_URI, ACCESS_TOKEN_SECRET, AI keys
npm run dev
```

Backend runs at `http://localhost:8000`.

### 2. Frontend

```bash
cd Frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

### 3. Verify the live executor

```bash
cd Backend
npm run test:executor
```

This calls OneCompiler for JavaScript and Python and asserts the output is `2`.
It consumes a small number of API requests.

> **No container runtime is required. Code execution happens over HTTPS through
> RapidAPI. There is no self-hosted execution engine.**

---

## 🔑 Environment Variables

Copy `Backend/.env.example` to `Backend/.env` and fill in the values.

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | No (default 8000) | Backend HTTP port |
| `NODE_ENV` | No | `development` or `production` |
| `MONGODB_URI` | **Yes** | MongoDB Atlas or native connection string |
| `DB_NAME` | No (default `devbrawl`) | Database name |
| `ACCESS_TOKEN_SECRET` | **Yes** | JWT signing secret (64+ chars) |
| `ACCESS_TOKEN_EXPIRY` | No (default `15m`) | JWT lifetime |
| `RAPIDAPI_KEY` | **Yes** | OneCompiler RapidAPI key |
| `RAPIDAPI_HOST` | **Yes** | `onecompiler-apis.p.rapidapi.com` |
| `GEMINI_API_KEY` | Recommended | Gemini AI |
| `GROQ_API_KEY` | Recommended | Groq AI fallback |
| `OPENROUTER_API_KEY` | Optional | OpenRouter AI fallback |
| `AI_PROVIDER` | No (default `auto`) | `gemini`, `groq`, `openrouter`, or `auto` |
| `CLOUDINARY_CLOUD_NAME` | Optional | Avatar uploads |
| `CLOUDINARY_API_KEY` | Optional | Avatar uploads |
| `CLOUDINARY_API_SECRET` | Optional | Avatar uploads |
| `LIVEKIT_API_KEY` | Optional | Voice/Video |
| `LIVEKIT_API_SECRET` | Optional | Voice/Video |
| `LIVEKIT_URL` | Optional | Voice/Video WebSocket URL |
| `FRONTEND_URL` | **Yes** | CORS origin, e.g. `http://localhost:5173` |

---

## 📁 Project Structure

```
DevBrawl/
├── Backend/                    # Node.js + Express + Socket.io
│   ├── src/
│   │   ├── controllers/        # Route handlers (code, submission, question, user)
│   │   ├── handlers/           # Socket.io event handlers
│   │   ├── middlewears/        # Auth, error, multer
│   │   ├── model/              # Mongoose schemas
│   │   ├── routes/             # API routes
│   │   ├── services/           # Business logic (AI, scoring, leaderboard)
│   │   ├── utils/              # Helpers (OneCompiler, socket, auth, AI clients)
│   │   └── db/                 # MongoDB connection
│   ├── test-onecompiler.js     # Live executor regression test
│   ├── index.js                # Entry point
│   └── package.json
├── Frontend/                   # React 19 + Vite + Tailwind
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── pages/              # Page components
│   │   ├── store/              # Zustand state
│   │   ├── utils/              # Socket, axios, Excalidraw canvas
│   │   └── main.jsx
│   └── package.json
├── AGENTS.md                   # AI assistant workflow rules
└── README.md
```

---

## 🔧 Key Features Implementation

### 1. Code Execution (OneCompiler via RapidAPI)
```javascript
// Backend/src/utils/oneCompilerExecutor.js
// Supports: JavaScript, Python, Java, C++, Go, Rust
// Per-user rate limiting (10 requests/min), 100KB source cap
// Run Code validation returns HTTP 400; execution results keep a flat status/output response
// OneCompiler's ~5s sandbox runtime limit is reported as "Time Limit Exceeded"
// Every test case costs one RapidAPI request
```

### 2. AI Question Generation
```javascript
// Backend/src/services/aiQuestionGenerator.js
// Uses Gemini/Groq/OpenRouter with structured JSON output
// Generates: title, prompt, constraints, test cases (2 visible, 3 hidden)
```

### 3. Two-Phase Scoring
```javascript
// Phase 1: Instant (test execution via OneCompiler)
// Phase 2: Async AI review (code quality + approach)
// Backend/src/services/aiScoringService.js + aiScoringQueue.js
```

### 4. Real-time Collaboration
```javascript
// Socket.io for: code sync, canvas sync, chat, turn management
// Backend/src/handlers/ + Backend/src/utils/socket.js
// Canvas: Excalidraw (MIT) with element-level sync through the existing Socket.IO room.
// Frontend/src/utils/ExcalidrawCanvas.jsx sends only changed elements + tombstones.
```

### 5. Turn-Based Gameplay
```javascript
// Room host starts turns → active player codes → submit → auto-advance
// All turns complete → AI scoring → leaderboard compilation
```

### 6. Flexible Avatar System
```javascript
// Registration: optional avatar upload OR choose from 12 emoji/default avatars
// Backend: accepts avatarSelection for default avatars (no Cloudinary needed)
// Frontend: AvatarSelector component with emoji + personalized initials options
```

### 7. Multi-Provider AI Support
```javascript
// Gemini, Groq, and OpenRouter supported for question generation + scoring
// Configurable via AI_PROVIDER env: 'gemini' | 'groq' | 'openrouter' | 'auto'
// Files: Backend/src/utils/groq.js, openrouter.js, aiScoringService.js
```

### 8. JWT Token Auto-Refresh
```javascript
// Access tokens live in Zustand memory; only the user profile is persisted.
// An HttpOnly refresh cookie restores sessions and rotates on refresh.
// Axios serializes concurrent 401 refreshes and retries queued requests.
// Files: Frontend/src/store/authStore.js, Frontend/src/utils/axios.js
```

---

## 🔌 API Endpoints

Protected `/api/v1/*` routes require a Bearer access token. Auth login,
refresh, logout, and registration endpoints are cookie/session entry points.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/` | Server health (`{ status: "ok" }`) |
| `POST` | `/api/v1/users/register` | Register (multipart avatar optional) |
| `POST` | `/api/v1/users/login` | Login, returns JWT |
| `GET` | `/api/v1/users/me` | Current user (auth) |
| `POST` | `/api/v1/auth/login` | Login and set HttpOnly refresh cookie |
| `POST` | `/api/v1/auth/refresh` | Rotate refresh cookie and return access token |
| `POST` | `/api/v1/auth/logout` | Revoke refresh session |
| `GET` | `/api/v1/auth/me` | Current user (auth) |
| `GET` | `/api/v1/users/voice-token?roomName=...` | LiveKit token (auth) |
| `POST` | `/api/v1/compiler/run-code` | Run code without test cases (auth) |
| `GET` | `/api/v1/compiler/health` | OneCompiler configuration health |
| `POST` | `/api/v1/submissions/submit` | Submit against test cases (auth) |
| `POST` | `/api/v1/questions/generate` | Generate a round question (auth) |
| `GET` | `/api/v1/questions/:roomId/:roundNumber` | Fetch an existing question (auth) |

---

## 🧪 Testing

```bash
# OneCompiler live executor regression test (consumes API quota)
cd Backend && npm run test:executor

# Frontend production build
cd Frontend && npm run build

# Frontend lint
cd Frontend && npm run lint
```

The Backend has no `npm test` script. Use `npm run test:executor` for the live
path and the AI smoke command in `AGENTS.md` for the AI providers.

---

## 🩺 Troubleshooting

| Problem | Cause / Fix |
|---|---|
| `RAPIDAPI_KEY / RAPIDAPI_HOST not configured` | `Backend/.env` is missing keys. Add both from RapidAPI. |
| OneCompiler API error (4xx) | Key invalid or monthly quota exhausted. Re-issue the key or wait for reset. |
| `compiler/health` shows `degraded` | `RAPIDAPI_KEY` or `RAPIDAPI_HOST` is unset in the running process. |
| OneCompiler returns empty output | Stale keys or unsupported language ID. Re-check `.env` and the language map. |
| MongoDB connection fails | `MONGODB_URI` is wrong, or the Atlas IP allowlist does not include your machine. |
| Frontend cannot reach backend | Check `FRONTEND_URL` and that the backend is running on port 8000. |
| CORS blocked | `FRONTEND_URL` must match the browser origin exactly (`http://localhost:5173`). |

---

## 🤝 Contributing

1. Fork the repo
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

Follow the git workflow and agent rules in `AGENTS.md`.

---

## 📄 License

MIT License — free for personal and commercial use.

---

## 🙏 Acknowledgments

- **OneCompiler / RapidAPI** — Code execution API
- **Monaco Editor** — VS Code editor in the browser
- **Excalidraw** — MIT-licensed infinite canvas
- **LiveKit** — WebRTC voice/video infrastructure
- **Google Gemini** — Generous free AI tier
- **Groq** — Ultra-fast free AI inference
- **OpenRouter** — Free Nemotron fallback
- **Cloudinary** — Free image storage
- **MongoDB** — Atlas M0 free database

---

**Built with ❤️ for developers who believe great tools should be free.**
