# DevBrawl ⚔️

> **A competitive, turn-based multiplayer coding arena.**

DevBrawl is a real-time multiplayer game where developers compete in DSA and System Design challenges. Inspired by games like Skribbl.io, players take turns acting as the "Active Player" while others act as "Judges", evaluating explanations and distributing points.

## 🎮 How it Works
1. **Matchmaking:** Join a public queue or create a private lobby with friends.
2. **The Coding Phase:** The active player solves a problem in Monaco Editor.
3. **The Explanation Phase:** The active player's mic unmutes. They explain their logic.
4. **The Judging Phase:** Other players distribute 100 points based on clarity and confidence.
5. **The Economy:** Win matches to earn **Brawl-Points**, used to buy avatars in the Shop and climb the Global Leaderboard.

## 🏗️ Architecture
- **Frontend:** React, Vite, Zustand, Monaco, Excalidraw, LiveKit.
- **Backend:** Node.js, Express, Socket.io, Mongoose.
- **Code Execution:** OneCompiler via RapidAPI.
- **AI:** Groq / OpenRouter (for match commentary).

## 🚀 Running Locally

### 1. Backend
```bash
cd Backend
npm install
cp .env.example .env
# Fill in your MONGODB_URI, RAPIDAPI_KEY, JWT_SECRETS, and LIVEKIT keys.
npm run dev
```

### 2. Frontend
```bash
cd Frontend
npm install
npm run dev
```

## 🛡️ Security
- JWT access tokens (15m) + refresh tokens (7d) with rotation and reuse detection.
- Room passwords are bcrypt-hashed.
- Active matches are locked to prevent random joins via URL.
