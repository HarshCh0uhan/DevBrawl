# DevBrawl: System Architecture & Game Design Document

## 1. Core Concept & Game Loop
DevBrawl is a turn-based, competitive interview arena.
1. **Lobby Phase:** Players join, ready up, and the host configures the match.
2. **Coding Phase:** Active player solves a DSA problem (Monaco) or System Design (Excalidraw). Others watch.
3. **Evaluation Phase:** AI runs test cases (DSA) to generate a **Base Score**.
4. **Explanation Phase:** Active player's mic unmutes; they explain their logic to the room.
5. **Judging Phase:** Other players allocate points from a **Judging Pool** to evaluate the explanation.
6. **Result Phase:** Scores are combined. The turn passes to the next player.
7. **End Phase:** The match concludes, and total points are added to the player's global **Brawl-Points** account.

---

## 2. Database Schema Updates (MongoDB)

### A. User Model (`Backend/src/models/user.model.js`)
*   `brawlPoints` (Number): Global currency. Default: `0`.

### B. Room Model (`Backend/src/models/room.model.js`)
*   `matchState` (Enum): `waiting` | `in_progress` | `finished`.
*   `settings` (Object): `maxPlayers`, `totalRounds`, `codeTimeSec`, `explainTimeSec`, `topic`, `difficulty`.
*   `participants` (Array of Objects): `userId`, `username`, `isReady`, `isConnected`, `totalMatchScore`.

---

## 3. Security & Edge Case Architecture (The "No Randoms" Rule)

### Scenario 1: Joining a lobby
*   **Public Lobby:** Anyone can join via URL, *but only if* `matchState === 'waiting'` and `participants.length < settings.maxPlayers`.
*   **Private Lobby:** If `isPrivate` is true, a password modal appears. (Implemented in Phase 12)

### Scenario 2: Match Starts (The Lockdown)
*   When the host clicks "Start Match", `matchState` becomes `'in_progress'`.
*   **Blocking New Joins:** The Socket `join-room` handler checks if `socket.user._id` exists in the `participants` array. If **No**, reject the connection: `"Match in progress. Spectators are not allowed."` If **Yes**, allow them in (handles page refreshes).

---

## 4. Real-Time State Machine (Socket.io & LiveKit)

1.  **`round-starting`**: Server pulls a question. **No regeneration allowed.**
2.  **`coding-phase`**: Server starts `codeTimeSec` timer. Only Active Player's Monaco/Excalidraw is editable.
3.  **`explaining-phase`**: Timer hits zero. Server unmutes Active Player via LiveKit. Server starts `explainTimeSec` timer.
4.  **`judging-phase`**: Timer hits zero. Server emits `judging-open` to Judges. They have 30 seconds to submit scores.
5.  **`round-end`**: Server aggregates scores, updates `totalMatchScore`, advances `currentTurnIndex`.

---

## 5. The Brawl-Points Economy (Anti-Toxicity)
*   **The Pool:** Every player receives **100 temporary Judging Points** per match.
*   **The Constraint:** The UI forces players to distribute *all* 100 points across the other players.
*   **Global Currency:** Points earned (AI Base + Peer Review) are added to `User.brawlPoints` in MongoDB.
