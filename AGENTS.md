# AGENTS.md — Development Workflow for AI Assistants

> **This file is the source of truth for how AI assistants must work on this project.**
> Read this before EVERY task. No exceptions.

---

## 🎯 Core Mission

Build DevBrawl — a free, real-time collaborative coding interview platform.
**Every decision must optimize for: FREE tier, simplicity, reliability.**

This is a **local-only project**. There is no production deployment and no
Oracle Cloud infrastructure. Code execution runs through **OneCompiler via
RapidAPI** (free tier, hard cap of 1,000 requests/month). MongoDB is either
MongoDB Atlas M0 or a native local install. No container runtime is required.

---

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

---

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

---

## 🏗️ Project Architecture

```
Frontend (React + Vite)        Backend (Node.js + Express)
├── Monaco Editor              ├── Socket.io (real-time)
├── Excalidraw Canvas          ├── Mongoose (MongoDB Atlas/local)
├── Socket.io Client           ├── OneCompiler via RapidAPI (code exec)
└── Zustand Store              └── AI Services (Gemini/Groq/OpenRouter)
```

Code execution is **OneCompiler via RapidAPI** only. There is no local
container execution and no self-hosted execution engine. Every test case in a
submission costs one RapidAPI request.

---

## 💰 Current Stack

| Service | Tier | Purpose |
|---------|------|---------|
| MongoDB Atlas | M0 (512MB) or native local | Database |
| OneCompiler (RapidAPI) | Free: 1,000 req/month (hard cap) | Code execution |
| Gemini | 1,500 req/day | Primary AI |
| Groq | 14,400 req/day | Fallback AI |
| OpenRouter | Free (Nemotron) | Backup AI |
| LiveKit | 10K min/mo | Voice/Video |
| Cloudinary | 25GB storage | Image uploads |
| Node.js 20 LTS | Free | Backend runtime |
| React + Vite | Free | Frontend |

---

## 🔑 Key Files

| File | Purpose |
|------|---------|
| `Backend/src/services/aiQuestionGenerator.js` | AI question generation (3 providers) |
| `Backend/src/services/aiScoringService.js` | AI code scoring (3 providers) |
| `Backend/src/utils/oneCompilerExecutor.js` | Code execution via RapidAPI (LIVE) |
| `Backend/src/controllers/codeWrapper.js` | Java/C++ boilerplate wrapper |
| `Backend/src/controllers/code.controller.js` | Run Code endpoint |
| `Backend/src/controllers/submission.controller.js` | Submit/judge endpoint |
| `Backend/src/utils/groq.js` | Groq client (fallback models) |
| `Backend/src/utils/openrouter.js` | OpenRouter client (Nemotron) |
| `Frontend/src/store/authStore.js` | JWT auth + auto-refresh |
| `README.md` | Project docs |
| `AGENTS.md` | This file |

---

## 🧪 Testing Commands

```bash
# OneCompiler live executor regression test
cd Backend && npm run test:executor

# Frontend build
cd Frontend && npm run build

# Backend AI smoke test
cd Backend && node -e "
require('dotenv').config();
process.env.AI_PROVIDER='openrouter';
import('./src/services/aiQuestionGenerator.js').then(m =>
  m.generateQuestion('arrays', 'easy').then(console.log).catch(console.error)
);"
```

---

## 🚨 Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| RAPIDAPI quota exhausted (1,000/mo) | Free tier is hard-capped — switch to paid tier or reduce test cases per submission |
| RAPIDAPI_KEY / RAPIDAPI_HOST missing | Check `Backend/.env`; the health endpoint will report degraded |
| OneCompiler returns empty | `.env` keys stale; re-issue at https://rapidapi.com/onecompiler |
| OneCompiler execution times out | The sandbox has an approximately 5-second runtime limit; optimize submitted code or reduce work per test case |
| Mongo validation error | Check required fields in returned object |
| Server runs old code | `taskkill /F /PID <pid>` then `npm run dev` |
| AI returns empty | Model doesn't support JSON mode → fallback to non-JSON |

---

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

---

## 🎯 Remember

> **The best code is code that doesn't need to be written.**
> 
> Read first. Think second. Code third. Test always.

---

*Last updated: 2026-11-25*
*Workflow established after repeated hallucination failures - learn from history.*
