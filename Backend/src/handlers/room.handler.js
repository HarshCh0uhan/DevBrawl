import { createRoomInternal, joinRoomInternal } from "../controllers/room.controller.js";
import { Room } from "../models/room.model.js";
import { cancelPendingLeave, hasLiveSocket, removeUserFromRoom } from "../utils/presence.js";
import bcrypt from "bcryptjs";

const toClientRoom = (room) => {
  const obj = typeof room.toJSON === "function" ? room.toJSON() : { ...room };
  delete obj.lastSummary;
  delete obj.password;
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
        callback({ success: true, data: toClientRoom(newRoom) });
      } else {
        socket.emit("room-created", { success: true, data: toClientRoom(newRoom) });
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
      const room = await Room.findOne({ inviteCode: code }).select("+password");

      if (!room) return callback?.({ success: false, error: "Room not found" });

      // SECURITY LOCK: Prevent random joins once the match has left the lobby
      if (room.matchState !== "waiting") {
        const existingPlayer = room.participants.find(p => p.userId.toString() === socket.user._id.toString());
        if (!existingPlayer) {
          return callback?.({ success: false, error: "Match already in progress. Spectators are not allowed." });
        }
      }

      if (room.isPrivate) {
        if (!data.password) {
          return callback?.({ success: false, error: "ROOM_PASSWORD_REQUIRED" });
        }
        const isMatch = room.password && await bcrypt.compare(data.password, room.password);
        if (!isMatch) {
          return callback?.({ success: false, error: "Invalid room password" });
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
};
