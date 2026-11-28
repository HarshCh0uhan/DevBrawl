# AGENTS.md — Development Workflow for AI Assistants

> **This file is the source of truth for how AI assistants must work on this project.**
> Read this before EVERY task. No exceptions.

## 🎯 Core Mission
Build **DevBrawl** — a competitive, turn-based real-time multiplayer coding arena.
**Every decision must optimize for: competitive integrity, real-time responsiveness, and free-tier infrastructure.**

## 🔄 Git Workflow (MANDATORY)

```bash
# 1. ALWAYS start from main
git checkout main && git pull origin main

# 2. Create feature branch
git checkout -b feature/descriptive-name

# 3. Make changes
# ... implement ...

# 4. Update docs (README.md, AGENTS.md if workflow changes)

# 5. Test locally
npm test  # or manual verification

# 6. Commit
git add .
git commit -m "feat: clear description of what changed"

# 6. Push
git push origin feature/descriptive-name

# 7. Create PR
gh pr create --title "feat: clear title" --body "## Changes\n- ..."

# 8. Merge (after review/CI)
gh pr merge --merge --delete-branch

# 9. Clean up
git checkout main && git pull && git branch -d feature/descriptive-name
```

## 🧠 Agent Rules (NON-NEGOTIABLE)

### Before ANY code change:

| # | Rule | Check |
|-----|------|-------|
| 1 | **Read actual current code first** | `cat file.js` or `read tool` - verify what exists |
| 2 | **Check if fix already exists** | Search codebase - don't duplicate |
| 3 | **Verify with simple test** | Run test/manual check BEFORE claiming fixed |
| 4 | **Restart server after changes** | `taskkill /F /PID <pid> && npm run dev` |

### ❌ NEVER:
- Assume code is broken without reading it
- Add code that already exists
- Claim "fixed" without test proof
- Leave old server process running

### ✅ ALWAYS:
- Show test output proving fix works
- Update README.md if behavior changes
- Update AGENTS.md if workflow changes
- Use `gh pr create` and `gh pr merge`

## 🏗️ Project Architecture

```
Frontend (React + Vite)        Backend (Node.js + Express)
├── Monaco Editor              ├── Socket.io (Real-time state machine)
├── Excalidraw Canvas          ├── Mongoose (MongoDB Atlas)
├── Socket.io Client           ├── OneCompiler via RapidAPI (Code exec)
├── LiveKit Client (Voice)     ├── LiveKit Server (Voice rooms)
└── Zustand Store              └── AI Services (Groq/OpenRouter for commentary)
```

### The Game Loop (State Machine)
1. `waiting`: Lobby phase. Players ready up. Host configures settings.
2. `coding`: Active player writes code. Server locks room to new spectators.
3. `explaining`: Active player's mic auto-unmutes via LiveKit.
4. `judging`: Other players distribute 100 points from their Judging Pool.
5. `finished`: Points tallied, Brawl-Points awarded, leaderboard shown.

## 💰 Current Stack
| Service | Tier | Purpose |
|---------|------|---------|
| MongoDB Atlas | M0 (512MB) | Database |
| OneCompiler (RapidAPI) | Free: 1,000 req/month | Code execution |
| Groq / OpenRouter | Free | AI Match Commentary |
| LiveKit | 10K min/mo | Voice/Video |
| Render | Free | Backend Hosting |
| Vercel | Free | Frontend Hosting |

## 🔑 Key Files
| File | Purpose |
|------|---------|
| `Backend/src/handlers/game.handler.js` | Core game loop state machine (judging, scoring, turn advancement) |
| `Backend/src/handlers/matchmaking.handler.js` | Public matchmaking queue logic |
| `Backend/src/handlers/room.handler.js` | Lobby, ready checks, security locks |
| `Backend/src/utils/oneCompilerExecutor.js` | Code execution via RapidAPI |
| `Frontend/src/components/JudgingOverlay.jsx` | The 100-point judging pool UI |
| `Frontend/src/pages/GlobalLeaderboard.jsx` | Hall of Fame |
| `Frontend/src/pages/ShopPage.jsx` | Brawl-Points cosmetics store |
| `AGENTS.md` | This file |

## 🚨 Common Pitfalls
| Pitfall | Solution |
|---------|----------|
| Match gets stuck in "judging" | Check if all judges submitted scores. If a judge disconnects, their score is forfeited. |
| Private room password fails | Ensure `bcrypt.compare` is used. The `password` field has `select: false`, so `Room.findOne().select('+password')` is required. |
| Spectators joining active match | The `join-room` handler checks `matchState !== "waiting"` and blocks non-participants. |
| Brawl-Points double crediting | Leaderboard compilation uses an idempotent guard. Do not remove it. |
| LiveKit mic is muted | The `VoiceCall.jsx` relies on `isExplainingPhase` and `isActivePlayer` props to auto-mute/unmute. |

## 📝 Commit Message Format

```
feat: add new feature
fix: bug fix
docs: documentation update
refactor: code restructure
test: add tests
chore: maintenance
```

Example: `fix: OpenRouter topic normalization - pass topic/difficulty as fallback`

## 🎯 Remember
> **The best code is code that doesn't need to be written.**
> 
> Read first. Think second. Code third. Test always.
