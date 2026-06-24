import { create } from 'zustand';

export const useRoomStore = create((set) => ({
  // ── CORE STATES ──────────────────────────────────────────────────────────
  roomCode: '',
  hostId: null,
  participants: [],
  activeQuestion: null,
  
  // Turn State Sync
  turnStatus: 'waiting', // 'waiting' | 'turn_active' | 'all_done'
  activePlayerId: null,
  activeUsername: '',
  turnIndex: 0,
  totalPlayers: 0,

  // ── MUTATORS / ACTIONS ───────────────────────────────────────────────────
  // Initial Room Setup when joining
  initRoomSession: (roomData) => set({
    roomCode: roomData.inviteCode?.toUpperCase() || '',
    hostId: roomData.hostId || null,
    participants: roomData.participants || [],
    totalPlayers: roomData.participants?.length || 0,
    turnStatus: roomData.gameStatus || 'waiting',
  }),

  // Dynamic Workspace Synchers
  setParticipants: (list) => set({ participants: list, totalPlayers: list.length }),
  setActiveQuestion: (question) => set({ activeQuestion: question }),
  
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
    turnStatus: 'waiting',
    activePlayerId: null,
    activeUsername: '',
    turnIndex: 0,
    totalPlayers: 0
  })
}));