import { Server } from "socket.io";
import { socketAuthMiddleware } from "../middlewears/auth.socket.middlewear.js";
import { Room } from "../model/room.model.js";
import { Submission } from "../model/submission.model.js";
import { setIoInstance } from "../services/aiScoringQueue.js";
import { leaveRoomInternal } from "../controllers/room.controller.js";
import { compileAndBroadcastLeaderboard } from "../services/leaderboard.service.js";

import { registerRoomHandlers } from "../handlers/room.handler.js";
import { registerSyncHandlers } from "../handlers/canvasSync.handler.js";
import { registerQuestionHandlers } from "../handlers/question.handler.js";

let _io = null;
export const getIO = () => _io;

// ── Turn advancement logic (Flawless Event Routing + AI Safeguard Sync) ──
export const advanceTurn = async (roomCode) => {
  const io = _io;
  if (!io) return;

  const normalizedRoomCode = roomCode.toUpperCase();
  const room = await Room.findOne({ inviteCode: normalizedRoomCode });
  if (!room || !room.participants || room.participants.length === 0) return;

  room.currentTurnIndex = (room.currentTurnIndex || 0) + 1;
  const allDone = room.currentTurnIndex >= room.participants.length;

  if (allDone) {
    room.activePlayerId = null;
    room.gameStatus = "all_done";
    await room.save();

    io.to(normalizedRoomCode).emit("all-turns-complete", {
      message: "All players have completed their turns. Compiling standings...",
    });
    console.log(`✅ All turns complete in room ${normalizedRoomCode}. Triggering leaderboard safety check...`);

    const latestSubmission = await Submission.findOne({ 
      roomId: { $in: [normalizedRoomCode, roomCode] } 
    }).sort({ createdAt: -1 });
    
    if (!latestSubmission || latestSubmission.phase2Status === "completed" || latestSubmission.phase2Status === "failed") {
      console.log(`🚀 BACKEND [advanceTurn]: Target conditions met! Forcing immediate leaderboard compilation.`);
      await compileAndBroadcastLeaderboard(io, normalizedRoomCode);
    } else {
      console.log(`⏳ Last submission ${latestSubmission._id} is still scoring. Handing over broadcast control to AI queue service.`);
    }
  } else {
    const nextPlayer = room.participants[room.currentTurnIndex];
    room.gameStatus = "turn_active";
    room.activePlayerId = nextPlayer.userId ? nextPlayer.userId : nextPlayer._id;
    await room.save();

    io.to(normalizedRoomCode).emit("turn-started", {
      activePlayerId: room.activePlayerId.toString(),
      activeUsername: nextPlayer.username,
      turnIndex: room.currentTurnIndex,
      totalPlayers: room.participants.length,
    });
  }
};

export const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5500", "null"],
      credentials: true,
    }
  });

  _io = io;
  setIoInstance(io);
  io.use(socketAuthMiddleware);

  io.on("connection", (socket) => {
    console.log(`🔌 Authenticated Socket connected: ${socket.id} | User: ${socket.user.username}`);

    // Register Split Handlers, passing central io and individual socket scopes
    registerRoomHandlers(io, socket);
    registerSyncHandlers(io, socket);
    registerQuestionHandlers(io, socket);

    // ── Disconnect ──────────────────────────────────────────────────────
    socket.on("disconnect", async () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);
      if (!socket.currentRoom) return;

      const room = await leaveRoomInternal(socket.currentRoom, socket.user._id);
      if (!room) return;

      io.to(socket.currentRoom).emit("user-left", {
        userId: socket.user._id,
        username: socket.user.username,
        systemMessage: `${socket.user.username} has left the workspace.`
      });
    });
  });

  return io;
};