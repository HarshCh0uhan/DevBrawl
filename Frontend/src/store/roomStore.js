import { create } from 'zustand';

const turnStatusFor = (matchState) => {
  if (matchState === 'coding') return 'turn_active';
  if (matchState === 'finished') return 'all_done';
  return 'waiting';
};

export const useRoomStore = create((set) => ({
  // ── CORE STATES ──────────────────────────────────────────────────────────
  roomCode: '',
  hostId: null,
  participants: [],
  activeQuestion: null,
  currentRound: 1,

  // Match State Machine (mirrors the server's room.matchState)
  matchState: 'waiting', // 'waiting' | 'coding' | 'explaining' | 'judging' | 'finished'

  // Turn State Sync
  turnStatus: 'waiting', // 'waiting' | 'turn_active' | 'all_done'
  activePlayerId: null,
  activeUsername: '',
  turnIndex: 0,
  totalPlayers: 0,

  // Phase-2 AI Scoring Status
  phase2Status: 'idle',   // 'idle' | 'reviewing' | 'completed' | 'failed'
  phase2Payload: null,

  // ── MUTATORS / ACTIONS ───────────────────────────────────────────────────
  // Initial Room Setup when joining
  // Also restores the live turn (who is coding, which turn) from the server's room
  // document, so a refresh/reconnect mid-turn doesn't leave everyone read-only
  // with no Submit button.
  initRoomSession: (roomData) => {
    const participants = roomData.participants || [];
    const matchState = roomData.matchState || 'waiting';
    const activePlayerId = roomData.activePlayerId ? String(roomData.activePlayerId) : null;
    const activePlayer = participants.find((p) => String(p.userId) === activePlayerId);

    set({
      roomCode: roomData.inviteCode?.toUpperCase() || '',
      hostId: roomData.hostId || null,
      participants,
      totalPlayers: participants.length,
      matchState,
      turnStatus: turnStatusFor(matchState),
      activePlayerId,
      activeUsername: activePlayer?.username || '',
      turnIndex: roomData.currentTurnIndex || 0,
      currentRound: roomData.currentRound || 1,
    });
  },

  // Dynamic Workspace Synchers
  setParticipants: (list) => set({ participants: list, totalPlayers: list.length }),
  setActiveQuestion: (question) => set({ activeQuestion: question }),
  setCurrentRound: (n) => set({ currentRound: n }),

  // Phase transition sync (phase-changed / turn-results from the judging engine)
  syncPhase: (data) => set((state) => {
    const matchState = data.matchState || state.matchState;
    const activePlayerId = data.activePlayerId
      ? String(data.activePlayerId)
      : (matchState === 'finished' ? null : state.activePlayerId);
    const activePlayer = state.participants.find((p) => String(p.userId) === activePlayerId);

    return {
      matchState,
      activePlayerId,
      activeUsername: activePlayer?.username || '',
      turnStatus: turnStatusFor(matchState),
    };
  }),

  // Phase-2 AI Scoring Status
  setPhase2Reviewing: (data) => set({ phase2Status: 'reviewing', phase2Payload: data }),
  setPhase2Complete: (data) => set({ phase2Status: 'completed', phase2Payload: data }),
  setPhase2Failed: (data) => set({ phase2Status: 'failed', phase2Payload: data }),
  resetPhase2: () => set({ phase2Status: 'idle', phase2Payload: null }),

  // Real-time Turn Mechanics Sync
  syncTurnStart: (data) => set({
    activePlayerId: data.activePlayerId,
    activeUsername: data.activeUsername,
    turnIndex: data.turnIndex,
    totalPlayers: data.totalPlayers,
    turnStatus: 'turn_active'
  }),

  syncTurnEnd: (data) => set({
    activePlayerId: null,
    activeUsername: '',
    turnStatus: 'turn_active', // Keep active so next coder stays mounted
    turnIndex: data.turnIndex
  }),

  setAllTurnsComplete: () => set({
    activePlayerId: null,
    activeUsername: '',
    turnStatus: 'all_done'
  }),

  // Reset Store on Leaving Lobby
  clearRoomStore: () => set({
    roomCode: '',
    hostId: null,
    participants: [],
    activeQuestion: null,
    currentRound: 1,
    matchState: 'waiting',
    turnStatus: 'waiting',
    activePlayerId: null,
    activeUsername: '',
    turnIndex: 0,
    totalPlayers: 0,
    phase2Status: 'idle',
    phase2Payload: null
  })
}));
