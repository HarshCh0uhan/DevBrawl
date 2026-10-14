import { create } from 'zustand';

export const useRoomStore = create((set) => ({
  // ── CORE STATES ──────────────────────────────────────────────────────────
  roomCode: '',
  hostId: null,
  participants: [],
  activeQuestion: null,
  currentRound: 1,
  
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
  initRoomSession: (roomData) => set({
    roomCode: roomData.inviteCode?.toUpperCase() || '',
    hostId: roomData.hostId || null,
    participants: roomData.participants || [],
    totalPlayers: roomData.participants?.length || 0,
    turnStatus: roomData.gameStatus || 'waiting',
    currentRound: 1,
  }),

  // Dynamic Workspace Synchers
  setParticipants: (list) => set({ participants: list, totalPlayers: list.length }),
  setActiveQuestion: (question) => set({ activeQuestion: question }),
  setCurrentRound: (n) => set({ currentRound: n }),
  
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
    turnStatus: 'waiting',
    activePlayerId: null,
    activeUsername: '',
    turnIndex: 0,
    totalPlayers: 0,
    phase2Status: 'idle',
    phase2Payload: null
  })
}));