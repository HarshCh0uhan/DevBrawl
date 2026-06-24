import mongoose from "mongoose";
import { nanoid } from "nanoid";

const participantSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  username: { type: String, required: true },
  joinedAt: { type: Date, default: Date.now },
});

const roomSchema = new mongoose.Schema({
  name:            { type: String, required: true, trim: true },
  inviteCode:      { type: String, unique: true, index: true, default: () => nanoid(6).toUpperCase() },
  hostId:          { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  participants:    [participantSchema],
  code:            { type: String, default: "" },
  isActive:        { type: Boolean, default: true },
  maxParticipants: { type: Number, default: 8 },

  // ── Game state ──────────────────────────────────────────────
  gameStatus:        { type: String, enum: ["waiting", "turn_active", "all_done"], default: "waiting" },
  currentTurnIndex:  { type: Number, default: 0 },
  activePlayerId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

}, { timestamps: true });

export const Room = mongoose.model("Room", roomSchema);