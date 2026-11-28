import { Room } from "../models/room.model.js";
import { joinRoomInternal } from "../controllers/room.controller.js";

export const registerMatchmakingHandlers = (io, socket) => {
  socket.on("join-public-queue", async (payload, callback) => {
    try {
      // Find a public room that is waiting and has space.
      let room = await Room.findOne({
        isPublic: true,
        matchState: "waiting",
        $expr: { $lt: [{ $size: "$participants" }, "$settings.maxPlayers"] }
      });

      // Create a room if the queue has no open public room.
      if (!room) {
        const { nanoid } = await import("nanoid");
        room = await Room.create({
          name: `${socket.user.username}'s Public Match`,
          inviteCode: nanoid(6).toUpperCase(),
          hostId: socket.user._id,
          isPublic: true,
          participants: [{
            userId: socket.user._id,
            username: socket.user.username,
            isReady: true
          }],
          settings: { maxPlayers: 4, rounds: 3 }
        });
      } else {
        await joinRoomInternal({ inviteCode: room.inviteCode }, socket.user);
      }

      // Re-fetch to get the latest participants.
      room = await Room.findOne({ inviteCode: room.inviteCode });

      await socket.join(room.inviteCode);
      socket.currentRoom = room.inviteCode;

      io.to(room.inviteCode).emit("user-joined", {
        userId: socket.user._id,
        username: socket.user.username,
        systemMessage: `${socket.user.username} has joined the public match.`,
        participants: room.participants
      });

      // Automatically start as soon as the room reaches capacity.
      if (room.participants.length >= room.settings.maxPlayers) {
        room.participants.forEach((participant) => {
          participant.isReady = true;
        });

        room.matchState = "coding";
        room.currentTurnIndex = 0;
        room.currentRound = 1;
        room.activePlayerId = room.participants[0].userId;
        await room.save();

        io.to(room.inviteCode).emit("room-started", { inviteCode: room.inviteCode });
        console.log(`🚀 PUBLIC MATCH AUTO-STARTED: ${room.inviteCode}`);
      }

      callback?.({ success: true, room });
    } catch (err) {
      console.error("❌ Matchmaking error:", err.message);
      callback?.({ success: false, error: err.message });
    }
  });
};
