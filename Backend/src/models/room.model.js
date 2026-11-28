import mongoose from "mongoose";
import { nanoid } from "nanoid";

const participantSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  username: { type: String, required: true },
  joinedAt: { type: Date, default: Date.now },
  isReady:  { type: Boolean, default: false },
  isConnected: { type: Boolean, default: true },
});

const roomSchema = new mongoose.Schema({
  name:            { type: String, required: true, trim: true },
  inviteCode:      { type: String, unique: true, index: true, default: () => nanoid(6).toUpperCase() },
  hostId:          { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  participants:    [participantSchema],

  // Match Settings
  settings: {
    rounds: { type: Number, default: 3 },
    codeTimeSec: { type: Number, default: 180 },
    explainTimeSec: { type: Number, default: 90 },
    topic: { type: String, default: 'Arrays' },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    maxPlayers: { type: Number, default: 4 }
  },

  matchState: { type: String, enum: ["waiting", "in_progress", "finished"], default: "waiting" },
  code:            { type: String, default: "" },
  isActive:        { type: Boolean, default: true },

  // Game state
  currentRound: { type: Number, default: 1 },
  gameStatus:        { type: String, enum: ["waiting", "turn_active", "all_done"], default: "waiting" },
  currentTurnIndex:  { type: Number, default: 0 },
  activePlayerId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  lastSummary:       { type: mongoose.Schema.Types.Mixed, default: null },

}, { timestamps: true });

export const Room = mongoose.model("Room", roomSchema);
