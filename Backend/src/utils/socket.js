
import { Server } from "socket.io";
import { socketAuthMiddleware } from "../middlewears/auth.socket.middlewear.js";
import { createRoomInternal, joinRoomInternal, leaveRoomInternal } from "../controllers/room.controller.js";
import { Room } from "../model/room.model.js";
import { generateQuestion } from "../services/aiQuestionGenerator.js";
import { Question } from "../model/question.model.js";
import { setIoInstance } from "../services/aiScoringQueue.js";

// ─── Helper: strip hidden test cases before sending to clients ─────────────
const sanitizeQuestion = (question) => ({
  _id: question._id,
  roomId: question.roomId,
  roundNumber: question.roundNumber,
  topic: question.topic,
  difficulty: question.difficulty,
  title: question.title,
  prompt: question.prompt,
  constraints: question.constraints,
  timeLimitMs: question.timeLimitMs,
  sampleTestCases: question.testCases
    .filter((tc) => !tc.isHidden)
    .map((tc) => ({ input: tc.input, expectedOutput: tc.expectedOutput })),
});

// ─── Shared question generation logic (used by both start-round and regen) ─
const generateAndBroadcastQuestion = async (io, roomId, roundNumber, topic, difficulty) => {
  try {
    const generated = await generateQuestion(topic, difficulty || "medium");

    // Replace any existing question for this room/round (handles regeneration)
    await Question.deleteOne({ roomId, roundNumber });
    const question = await Question.create({ roomId, roundNumber, ...generated });

    io.to(roomId).emit("round-question-ready", sanitizeQuestion(question));

    console.log(`✅ Question generated for room ${roomId} round ${roundNumber}: "${question.title}"`);
  } catch (err) {
    console.error(`❌ Question generation failed for room ${roomId}:`, err.message);

    io.to(roomId).emit("round-question-failed", {
      roomId,
      roundNumber,
      error: "Failed to generate question. Host can try regenerating.",
    });
  }
};

export const initializeSocket = (httpServer) => {
    const io = new Server(httpServer, {
        cors: {
            origin: ["http://localhost:5173", "http://localhost:3000" ,"http://127.0.0.1:5500" ,"null"],
            credentials: true,
        }
    });

    io.use(socketAuthMiddleware);

    // ─── Give the Phase 2 scoring queue a reference to broadcast through ────
    // This lets queuePhase2Scoring() emit events to rooms without needing
    // socket.js to import the queue's broadcasting logic directly, avoiding
    // a circular import (queue \u2192 controller \u2192 socket.js \u2192 queue).
    setIoInstance(io);

    io.on("connection", (socket) => {
        console.log(`🔌 Authenticated Socket connected: ${socket.id} | User: ${socket.user.username}`);

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
            
            console.log(`🚀 Workspace session explicitly launched by host for room node: ${inviteCode}`);
        });

        // ─── NEW: Host picks a topic, triggers AI question generation ──────────
        socket.on("start-round", async (payload) => {
            const { inviteCode, roundNumber, topic, difficulty } = payload;

            if (!inviteCode || !roundNumber || !topic) {
                socket.emit("round-question-failed", {
                    error: "inviteCode, roundNumber and topic are required",
                });
                return;
            }

            const roomId = inviteCode.toUpperCase();

            // Let everyone in the room see the loading state immediately
            io.to(roomId).emit("round-question-generating", {
                roomId,
                roundNumber,
                topic,
                difficulty: difficulty || "medium",
            });

            await generateAndBroadcastQuestion(io, roomId, roundNumber, topic, difficulty);
        });

        // ─── NEW: Host regenerates question if unhappy with current one ────────
        socket.on("regenerate-round-question", async (payload) => {
            const { inviteCode, roundNumber, topic, difficulty } = payload;

            if (!inviteCode || !roundNumber || !topic) {
                socket.emit("round-question-failed", {
                    error: "inviteCode, roundNumber and topic are required",
                });
                return;
            }

            const roomId = inviteCode.toUpperCase();

            io.to(roomId).emit("round-question-regenerating", {
                roomId,
                roundNumber,
                topic,
                difficulty: difficulty || "medium",
            });

            await generateAndBroadcastQuestion(io, roomId, roundNumber, topic, difficulty);
        });

        socket.on("disconnect", async () => {
            console.log(`❌ Socket disconnected: ${socket.id}`);
            console.log(`📍 currentRoom: ${socket.currentRoom}`);
            
            if (!socket.currentRoom) return;
            
            const room = await leaveRoomInternal(socket.currentRoom, socket.user._id);
            console.log(`🏠 room after leave:`, room);

            if (!room) return;

            console.log(`📢 emitting user-left to room: ${socket.currentRoom}`);
            io.to(socket.currentRoom).emit("user-left", {
                userId: socket.user._id,
                username: socket.user.username,
                systemMessage: `${socket.user.username} has left the workspace.`
            });
        });

        socket.on("send-message" ,async (payload)=>{
            try {
                const {roomId , message} = payload;

                socket.to(roomId).emit("receive-message",{
                    userId:socket.user._id,
                    username:socket.user.username,
                    message:message,
                    timestamp:new Date()
                })
            } catch (error) {
                socket.emit("send-message" ,{success:false ,error:error.message})
            }
        })
        socket.on("canvas-change", (data) => {
        socket.to(data.roomId).emit("receive-canvas-change", data);
       });
       socket.on("code-change", (data) => {
       socket.to(data.roomId).emit("receive-code-change", data)
    })
    });

    return io;
};