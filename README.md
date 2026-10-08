# DevBrawl — Real-time Collaborative Coding Interview Platform

> **Built for free. Runs for free. Scales on Oracle Cloud Always Free.**

## 🎯 What is DevBrawl?

A real-time multiplayer coding interview platform where developers:
- Join rooms and take turns solving AI-generated challenges
- Code collaboratively with Monaco Editor (VS Code in browser)
- Whiteboard together with tldraw canvas
- Get instant feedback via automated tests + AI code review
- Compete on leaderboards with gamified scoring

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (React + Vite)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │ Monaco Edit │  │  tldraw     │  │  Socket.io  │  │  LiveKit/Daily   │   │
│  │    or       │  │  Canvas     │  │  Client     │  │  Voice/Video     │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                            HTTPS / WSS (Socket.io)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ORACLE CLOUD ALWAYS FREE VM                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │   Nginx     │  │  Backend    │  │  MongoDB    │  │     Piston       │   │
│  │  (SSL/TLS)  │◄─┤  (Node.js)  │◄─┤  (7.0)      │  │  Code Execution  │   │
│  └─────────────┘  └──────┬──────┘  └─────────────┘  └──────────────────┘   │
│                         │                                                    │
│              ┌──────────┴──────────┐                                        │
│              ▼                     ▼                                        │
│      ┌─────────────┐         ┌─────────────┐                               │
│      │   Gemini    │         │  LiveKit    │                               │
│      │   AI API    │         │  Cloud      │                               │
│      │  (Free)     │         │  (Free)     │                               │
│      └─────────────┘         └─────────────┘                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 💰 **100% Free Stack**

| Service | Free Tier | Purpose |
|---------|-----------|---------|
| **Oracle Cloud** | **Always Free**: 4 ARM CPUs, 24GB RAM, 200GB storage | Host everything |
| **MongoDB Atlas M0** | 512MB (or self-host on Oracle) | Database |
| **Google Gemini** | 1,500 req/day | AI questions + code scoring |
| **Groq** | 14,400 req/day | Fallback AI (ultra-fast) |
| **Piston** | Self-hosted (open source) | Code execution (JS, Python, Java, C++, Go, Rust) |
| **LiveKit Cloud** | 10K participant min/mo | Voice/Video calls |
| **Daily.co** | 10K min/mo | Video call alternative |
| **Cloudinary** | 25GB storage + bandwidth | Image uploads |
| **Vercel/Netlify** | Unlimited personal | Frontend hosting (optional) |
| **Let's Encrypt** | Free SSL | HTTPS certificates |

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- **Docker Desktop** (or Docker Engine + Compose)
- **Node.js 20+** (for non-Docker development)
- **Git**

### One-Command Start
```bash
# Clone and start everything
git clone <your-repo> devbrawl
cd devbrawl
docker compose up -d

# Check status
docker compose ps
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000
# Piston API: http://localhost:2000
```

### Manual Development (without Docker)
```bash
# Terminal 1: MongoDB (if not using Docker)
mongod --dbpath ./data/db

# Terminal 2: Piston (code execution)
docker run -d -p 2000:2000 ghcr.io/engineer-man/piston:latest

# Terminal 3: Backend
cd Backend
cp .env.example .env  # Fill in your keys
npm install
npm run dev

# Terminal 4: Frontend
cd Frontend
npm install
npm run dev
```

---

## ☁️ Oracle Cloud Always Free Deployment

### 1. Create Oracle Cloud Account
- Sign up at [cloud.oracle.com](https://cloud.oracle.com) (requires credit card for verification, **no charge**)
- Choose **Always Free** tier

### 2. Create VM Instance
```
Shape: VM.Standard.A1.Flex (ARM)
OCPUs: 4 (max for Always Free)
Memory: 24 GB (max for Always Free)
OS: Ubuntu 22.04 or 24.04 (ARM)
Boot Volume: 200 GB (max for Always Free)
```

### 3. Configure Networking
- **VCN**: Create new or use default
- **Subnet**: Public subnet
- **Security List/NSG**: Allow ports **22 (SSH), 80 (HTTP), 443 (HTTPS)**
- **Public IP**: Assign ephemeral public IP

### 4. SSH & Run Setup Script
```bash
# SSH into your instance
ssh ubuntu@<your-vm-ip>

# Run the automated setup script
curl -fsSL https://raw.githubusercontent.com/<your-repo>/main/deploy/oracle-cloud-setup.sh | bash

# Or copy the script and run manually
```

### 5. Deploy Your Application
```bash
# Clone your repo
cd /var/www/devbrawl
git clone https://github.com/<your-username>/devbrawl.git .

# Configure environment
cp Backend/.env.example Backend/.env
# Edit .env with your API keys

# Deploy
./deploy.sh
```

### 6. Setup SSL (HTTPS)
```bash
# Replace with your domain
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal is configured via certbot container
```

### 7. Configure DNS
```
A Record: @     → <your-vm-public-ip>
A Record: www   → <your-vm-public-ip>
```

---

## 🔑 Required API Keys (All Free)

### Google Gemini (Primary AI)
1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Create API key
3. Add to `.env`: `GEMINI_API_KEY=your-key`

### Groq (Fallback AI - Optional but Recommended)
1. Go to [console.groq.com/keys](https://console.groq.com/keys)
2. Create API key
3. Add to `.env`: `GROQ_API_KEY=your-key`

### AI Provider Configuration
Control which AI provider is used via `AI_PROVIDER` in `.env`:

| Value | Behavior |
|-------|----------|
| `gemini` | Use only Google Gemini |
| `groq` | Use only Groq (Llama 3.1 70B) |
| `auto` | **Default** - Try Gemini first, fallback to Groq on failure |

```bash
# .env example
AI_PROVIDER=auto  # Recommended: best of both worlds
# AI_PROVIDER=groq  # Use only Groq (faster, higher rate limits)
# AI_PROVIDER=gemini  # Use only Gemini
```

**Why use both?**
- **Gemini**: Better structured JSON output, generous free tier (1,500/day)
- **Groq**: Ultra-fast inference (~300 tokens/sec), massive free tier (14,400/day)
- **Auto mode**: Best reliability - if one fails, the other takes over seamlessly

### MongoDB Atlas (or self-host)
1. Go to [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create M0 Free cluster
3. Get connection string
4. Add to `.env`: `MONGODB_URI=mongodb+srv://...`

### Cloudinary (Images)
1. Go to [cloudinary.com/console](https://cloudinary.com/console)
2. Get Cloud Name, API Key, API Secret
3. Add to `.env`

### LiveKit Cloud (Voice/Video)
1. Go to [cloud.livekit.io](https://cloud.livekit.io)
2. Create project
3. Get API Key, Secret, URL
4. Add to `.env`

### Daily.co (Alternative Video)
1. Go to [dashboard.daily.co](https://dashboard.daily.co)
2. Create API key
3. Add to `.env`: `DAILY_API_KEY=your-key`

---

## 🛠️ Development Tools (Free)

### IDEs
| Tool | Cost | Best For |
|------|------|----------|
| **VS Code** | Free | Primary editor |
| **Windsurf (Codeium)** | Free | **AI-powered VS Code fork, unlimited completions** |
| **Cursor** | Free tier (2K completions/mo) | AI-first editor |
| **GitHub Codespaces** | 60 hrs/mo | Cloud dev environment |
| **Zed** | Free | Fast, native, collaborative |

### Recommended: VS Code + Windsurf Extension
```bash
# Install Windsurf (free AI completions)
# Or use Continue.dev extension with Groq/Ollama
```

### AI Coding Assistants (Free)
- **Groq + Continue.dev** — Ultra-fast, free
- **Ollama (local)** — Run Llama 3.1, CodeLlama locally
- **GitHub Copilot** — Free for students/educators/OSS maintainers

---

## 📁 Project Structure

```
DevBrawl/
├── Backend/                    # Node.js + Express + Socket.io
│   ├── src/
│   │   ├── controllers/        # Route handlers
│   │   ├── handlers/           # Socket.io event handlers
│   │   ├── middlewears/        # Auth, error, multer
│   │   ├── models/             # Mongoose schemas
│   │   ├── routes/             # API routes
│   │   ├── services/           # Business logic (AI, scoring, leaderboard)
│   │   ├── utils/              # Helpers (Piston, socket, auth)
│   │   ├── db/                 # MongoDB connection
│   │   └── index.js            # Entry point
│   ├── Dockerfile              # Production
│   ├── Dockerfile.dev          # Development
│   └── package.json
├── Frontend/                   # React 19 + Vite + Tailwind
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── pages/              # Page components
│   │   ├── store/              # Zustand state
│   │   ├── utils/              # Socket, axios, tldraw
│   │   └── main.jsx
│   ├── Dockerfile              # Production (nginx)
│   ├── Dockerfile.dev          # Development
│   ├── nginx.conf              # Nginx config
│   └── package.json
├── deploy/                     # Deployment scripts
│   └── oracle-cloud-setup.sh   # Oracle Cloud automation
├── docker-compose.yml          # Local dev (with Piston)
├── docker-compose.prod.yml     # Production (Oracle Cloud)
└── README.md
```

---

## 🔧 Key Features Implementation

### 1. Code Execution (Piston API)
```javascript
// Backend/src/utils/pistonExecutor.js
// Supports: JS, Python, Java, C++, Go, Rust + 20 more
// Rate limited, concurrent request queue
```

### 2. AI Question Generation
```javascript
// Backend/src/services/aiQuestionGenerator.js
// Uses Gemini 2.5 Flash with structured JSON output
// Generates: title, prompt, constraints, test cases (2 visible, 3 hidden)
```

### 3. Two-Phase Scoring
```javascript
// Phase 1: Instant (test execution)
// Phase 2: Async AI review (code quality + approach)
// Backend/src/services/aiScoringService.js + aiScoringQueue.js
```

### 4. Real-time Collaboration
```javascript
// Socket.io for: code sync, canvas sync, chat, turn management
// Backend/src/handlers/ + Backend/src/utils/socket.js
```

### 5. Turn-Based Gameplay
```javascript
// Room host starts turns → active player codes → submit → auto-advance
// All turns complete → AI scoring → leaderboard compilation
```

### 6. Flexible Avatar System (NEW)
```javascript
// Registration: Optional avatar upload OR choose from 12 emoji/default avatars
// Backend: Accepts avatarSelection field for default avatars (no Cloudinary needed)
// Frontend: AvatarSelector component with emoji + personalized initials options
// Files: Frontend/src/components/AvatarSelector.jsx, Registration.jsx
```

### 7. Dual AI Provider Support (NEW)
```javascript
// Both Gemini and Groq supported for question generation + code scoring
// Configurable via AI_PROVIDER env: 'gemini' | 'groq' | 'auto' (fallback)
// Files: Backend/src/utils/groq.js, aiScoringService.js, aiQuestionGenerator.js
// Gemini: 1,500 req/day free | Groq: 14,400 req/day free (Llama 3.1 70B)
```

### 8. JWT Token Auto-Refresh (NEW)
```javascript
// Automatic token refresh before socket connection
// Stores refresh token, checks expiry on app init, refreshes if needed
// Files: Frontend/src/store/authStore.js, Backend/src/routes/user.routes.js
// Endpoint: POST /api/v1/users/refresh-token
```

---

## 🧪 Testing

```bash
# Backend tests
cd Backend && npm test

# Frontend tests
cd Frontend && npm test

# E2E (Playwright)
npx playwright test
```

---

## 📊 Monitoring & Maintenance

```bash
# Health check
curl https://your-domain.com/health

# Monitor resources
/var/www/devbrawl/monitor.sh

# View logs
sudo journalctl -u devbrawl-backend -f
sudo docker logs devbrawl-piston -f

# Backup MongoDB
mongodump --uri="mongodb://localhost:27017/devbrawl" --out=/backup/$(date +%F)

# Update deployment
cd /var/www/devbrawl && ./deploy.sh
```

---

## 🤝 Contributing

1. Fork the repo
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push branch: `git push origin feature/amazing-feature`
5. Open Pull Request

---

## 📄 License

MIT License — free for personal and commercial use.

---

## 🙏 Acknowledgments

- **Piston** — Open source code execution engine
- **Monaco Editor** — VS Code editor in browser
- **tldraw** — Infinite canvas library
- **LiveKit** — WebRTC infrastructure
- **Google Gemini** — Generous free AI tier
- **Oracle Cloud** — Incredible Always Free tier

---

## 💡 Pro Tips for Free Tier Optimization

1. **Use ARM images** — All our Docker images support ARM64 natively
2. **Enable swap** — `sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`
3. **Log rotation** — Configured via logrotate (prevents disk fill)
4. **Piston warming** — Pre-pull runtimes: `curl -X POST http://localhost:2000/api/v2/piston/runtimes`
5. **MongoDB indexes** — Already defined in models for performance
6. **Nginx caching** — Static assets cached for 1 year
7. **Rate limiting** — Protects against abuse on free tier

---

**Built with ❤️ for developers who believe great tools should be free.**