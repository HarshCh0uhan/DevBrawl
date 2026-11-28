import { Server } from "socket.io";
import { env } from "../config/env.js";
import { socketAuthMiddleware } from "../middlewares/auth.socket.middleware.js";
import { setIoInstance } from "../services/aiScoringQueue.js";
import { scheduleLeave } from "./presence.js";

import { registerRoomHandlers } from "../handlers/room.handler.js";
import { registerSyncHandlers } from "../handlers/canvasSync.handler.js";
import { registerQuestionHandlers } from "../handlers/question.handler.js";
import { registerGameHandlers } from "../handlers/game.handler.js";
import { registerMatchmakingHandlers } from "../handlers/matchmaking.handler.js";

let _io = null;
export const getIO = () => _io;

export const initializeSocket = (httpServer) => {
  const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5500",
    "null",
    env.frontendUrl,
  ].filter(Boolean);

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true)
        if (allowedOrigins.includes(origin)) return callback(null, true)
        if (origin.endsWith('.vercel.app')) return callback(null, true)
        return callback(new Error(`Socket CORS blocked: ${origin}`))
      },
      credentials: true,
    }
  });

  _io = io;
  setIoInstance(io);
  io.use(socketAuthMiddleware);

  io.on("connection", (socket) => {
    console.log(`🔌 Authenticated Socket connected: ${socket.id} | User: ${socket.user.username}`);

    // Needed by presence.js: RemoteSocket (io.in(room).fetchSockets()) only exposes socket.data.
    socket.data.userId = socket.user._id.toString();

    // Register Split Handlers, passing central io and individual socket scopes
    registerRoomHandlers(io, socket);
    registerSyncHandlers(io, socket);
    registerQuestionHandlers(io, socket);
    registerGameHandlers(io, socket);
    registerMatchmakingHandlers(io, socket);

    // ── Disconnect ──────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);
      if (!socket.currentRoom) return;

      // Delayed: a refresh/reconnect re-joins within the grace period and cancels this.
      scheduleLeave(io, socket.currentRoom, socket.user);
    });
  });

  return io;
};
