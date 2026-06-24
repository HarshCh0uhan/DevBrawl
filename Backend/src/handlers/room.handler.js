//Match Lifecycle & Turn Management

import { createRoomInternal, joinRoomInternal } from "../controllers/room.controller.js";
import { Room } from "../model/room.model.js";
import { advanceTurn } from "../utils/socket.js";

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
      const updatedRoom = await joinRoomInternal(payload, socket.user);
      await socket.join(updatedRoom.inviteCode);
      socket.currentRoom = updatedRoom.inviteCode;

      socket.to(updatedRoom.inviteCode).emit("user-joined", {
        userId: socket.user._id,
        username: socket.user.username,
        systemMessage: `${socket.user.username} has joined the workspace.`,
        participants: updatedRoom.participants
      });

      if (typeof callback === "function") {
        callback({ success: true, data: updatedRoom });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({ success: false, error: error.message });
      }
    }
  });

  socket.on("start-room-session", (payload) => {
    const { inviteCode } = payload;
    if (!inviteCode) return;
    io.to(inviteCode.toUpperCase()).emit("room-started", {
      inviteCode: inviteCode.toUpperCase()
    });
    console.log(`🚀 Room session launched: ${inviteCode}`);
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