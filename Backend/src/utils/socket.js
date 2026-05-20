import { Server } from "socket.io";
import { socketAuthMiddleware } from "../middlewears/auth.socket.middlewear.js";
import { createRoomInternal , joinRoomInternal } from "../controllers/room.controller.js";


export const initializeSocket = (httpServer) => {
    const io = new Server(httpServer, {
        cors: {
            origin: ["http://localhost:5173", "http://localhost:3000" ,"http://127.0.0.1:5500"],
            credentials: true,
        }
    });

    io.use(socketAuthMiddleware);

    io.on("connection", (socket) => {
        console.log(`🔌 Authenticated Socket connected: ${socket.id} | User: ${socket.user.username}`);

        socket.on("create-room", async (payload, callback) => {
    // Parse payload if it came as a string
    const data = typeof payload === "string" ? JSON.parse(payload) : payload;
    
    try {
        const newRoom = await createRoomInternal(data, socket.user);
        await socket.join(newRoom.inviteCode);
        
        if (typeof callback === "function") {
            callback({ success: true, data: newRoom });
        } else {
            // No callback (Postman issue) — emit directly back to sender
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
            try {
                const updatedRoom = await joinRoomInternal(payload, socket.user);
                await socket.join(updatedRoom.inviteCode);

                socket.to(updatedRoom.inviteCode).emit("user-joined", {
                    userId: socket.user._id,
                    username: socket.user.username,
                    systemMessage: `${socket.user.username} has joined the workspace.`
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

        socket.on("disconnect", () => {
            console.log(`❌ Socket disconnected: ${socket.id}`);
        });
    });

    return io;
};