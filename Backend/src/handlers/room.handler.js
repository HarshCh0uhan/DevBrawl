import { createRoomInternal, joinRoomInternal } from "../controllers/room.controller.js";
import { Room } from "../models/room.model.js";
import { advanceTurn } from "../utils/socket.js";
import { cancelPendingLeave, hasLiveSocket, removeUserFromRoom } from "../utils/presence.js";

const toClientRoom = (room) => {
  const obj = typeof room.toJSON === "function" ? room.toJSON() : { ...room };
  delete obj.lastSummary;
  return obj;
};

export const registerRoomHandlers = (io, socket) => {

  socket.on("create-room", async (payload, callback) => {
    const data = typeof payload === "string" ? JSON.parse(payload) : payload;
    try {
      const newRoom = await createRoomInternal(data, socket.user);
      await socket.join(newRoom.inviteCode);
      socket.currentRoom = newRoom.inviteCode;
      if (typeof callback === "function") {
        callback({ success: true, data: newRoom });
      } else {
        socket.emit("room-created", { success: true, data: newRoom });
      }
    } catch (error) {
      console.error("❌ create-room error:", error.message);
      if (typeof callback === "function") {
        callback({ success: false, error: error.message });
      } else {
        socket.emit("room-created", { success: false, error: error.message });
      }
    }
  });

  socket.on("join-room", async (payload, callback) => {
    const data = typeof payload === "string" ? JSON.parse(payload) : payload;
    try {
      const code = data.inviteCode?.toUpperCase();
      const room = await Room.findOne({ inviteCode: code });

      if (!room) return callback?.({ success: false, error: "Room not found" });

      // SECURITY LOCK: Prevent random joins once the match has left the lobby
      if (room.matchState !== "waiting") {
        const existingPlayer = room.participants.find(p => p.userId.toString() === socket.user._id.toString());
        if (!existingPlayer) {
          return callback?.({ success: false, error: "Match already in progress. Spectators are not allowed." });
        }
      }

      const updatedRoom = await joinRoomInternal(data, socket.user);
      cancelPendingLeave(updatedRoom.inviteCode, socket.user._id);
      await socket.join(updatedRoom.inviteCode);
      socket.currentRoom = updatedRoom.inviteCode;

      socket.to(updatedRoom.inviteCode).emit("user-joined", {
        userId: socket.user._id,
        username: socket.user.username,
        systemMessage: `${socket.user.username} has joined the workspace.`,
        participants: updatedRoom.participants
      });

      if (updatedRoom.matchState === "finished" && updatedRoom.lastSummary) {
        socket.emit("match-summary-ready", updatedRoom.lastSummary);
      }

      if (typeof callback === "function") {
        callback({ success: true, data: toClientRoom(updatedRoom) });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({ success: false, error: error.message });
      }
    }
  });

  socket.on("leave-room", async (payload, callback) => {
    try {
      const data = typeof payload === "string" ? JSON.parse(payload) : payload;
      const code = (data?.inviteCode || socket.currentRoom || "").toUpperCase();
      if (!code) return callback?.({ success: false, error: "inviteCode is required" });

      cancelPendingLeave(code, socket.user._id);
      await socket.leave(code);
      if (socket.currentRoom === code) socket.currentRoom = null;

      if (!(await hasLiveSocket(io, code, socket.user._id))) {
        await removeUserFromRoom(io, code, socket.user);
      }
      callback?.({ success: true });
    } catch (error) {
      console.error("❌ leave-room error:", error.message);
      callback?.({ success: false, error: error.message });
    }
  });

  // NEW: Toggle Ready State
  socket.on("toggle-ready", async (payload, callback) => {
    try {
      const code = (payload.inviteCode || socket.currentRoom || "").toUpperCase();
      const room = await Room.findOne({ inviteCode: code });
      if (!room) return callback?.({ success: false, error: "Room not found" });

      const participant = room.participants.find(p => p.userId.toString() === socket.user._id.toString());
      if (!participant) return callback?.({ success: false, error: "Player not in room" });

      participant.isReady = !participant.isReady;
      await room.save();

      io.to(code).emit("room-updated", { participants: room.participants });
      callback?.({ success: true, isReady: participant.isReady });
    } catch (err) {
      callback?.({ success: false, error: err.message });
    }
  });

  // UPDATED: Enforce Ready State and Lock Room
  socket.on("start-room-session", async (payload, callback) => {
    try {
      const inviteCode = payload.inviteCode.toUpperCase();
      const room = await Room.findOne({ inviteCode });

      if (!room) return callback?.({ success: false, error: "Room not found" });
      if (room.hostId.toString() !== socket.user._id.toString()) {
        return callback?.({ success: false, error: "Only the host can start the match" });
      }
      if (room.participants.length < 2) {
        return callback?.({ success: false, error: "Need at least 2 players to start" });
      }

      const allReady = room.participants.every(p => p.isReady);
      if (!allReady) {
        return callback?.({ success: false, error: "Not all players are ready!" });
      }

      // Lock the room and start
      room.matchState = "coding";
      room.currentTurnIndex = 0;
      room.currentRound = 1;
      room.activePlayerId = room.participants[0].userId;
      await room.save();

      io.to(inviteCode).emit("room-started", { inviteCode });
      console.log(`🚀 Room session launched and LOCKED: ${inviteCode}`);
    } catch (err) {
      callback?.({ success: false, error: err.message });
    }
  });

  socket.on("start-turn", async (payload, callback) => {
    try {
      if (!payload || !payload.inviteCode) {
        return callback?.({ success: false, error: "Missing inviteCode parameters" });
      }

      const code = payload.inviteCode.toUpperCase();
      const room = await Room.findOne({ inviteCode: code });
      if (!room) return callback?.({ success: false, error: "Room not found" });

      if (!room.hostId || !socket.user || room.hostId.toString() !== socket.user._id.toString()) {
        return callback?.({ success: false, error: "Only the host can start turns" });
      }

      if (!room.participants || room.participants.length === 0) {
        return callback?.({ success: false, error: "No participants have entered this brawl arena yet" });
      }

      const turnIdx = room.currentTurnIndex || 0;
      if (turnIdx >= room.participants.length) {
        return callback?.({ success: false, error: "All players have already gone this round" });
      }

      const activePart = room.participants[turnIdx];
      if (!activePart || (!activePart.userId && !activePart._id)) {
        return callback?.({ success: false, error: "Active coder metadata slot is corrupt or missing" });
      }

      const targetUserId = activePart.userId ? activePart.userId : activePart._id;

      room.gameStatus = "turn_active";
      room.activePlayerId = targetUserId;
      await room.save();

      io.to(code).emit("turn-started", {
        activePlayerId: targetUserId.toString(),
        activeUsername: activePart.username || "Anonymous Brawler",
        turnIndex: turnIdx,
        totalPlayers: room.participants.length,
      });

      console.log(`🎯 Turn started: ${activePart.username} in room ${code}`);
      callback?.({ success: true });
    } catch (err) {
      console.error("❌ start-turn error:", err.message);
      callback?.({ success: false, error: err.message });
    }
  });

  socket.on("skip-turn", async (payload, callback) => {
    try {
      const code = payload.inviteCode.toUpperCase();
      const room = await Room.findOne({ inviteCode: code });

      if (!room) return callback?.({ success: false, error: "Room not found" });
      if (room.hostId.toString() !== socket.user._id.toString()) {
        return callback?.({ success: false, error: "Only the host can skip turns" });
      }

      const skippedPlayer = room.participants[room.currentTurnIndex];
      io.to(code).emit("turn-skipped", {
        skippedPlayerId: skippedPlayer?.userId.toString(),
        skippedUsername: skippedPlayer?.username,
      });

      await advanceTurn(code);
      callback?.({ success: true });
    } catch (err) {
      console.error("❌ skip-turn error:", err.message);
      callback?.({ success: false, error: err.message });
    }
  });
};
