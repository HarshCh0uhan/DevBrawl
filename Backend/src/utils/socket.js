import { Server } from "socket.io";
import { socketAuthMiddleware } from "../middlewears/auth.socket.middlewear.js";
import { createRoomInternal , joinRoomInternal ,leaveRoomInternal } from "../controllers/room.controller.js";
import { Room } from "../model/room.model.js";

export const initializeSocket = (httpServer) => {
    const io = new Server(httpServer, {
        cors: {
            origin: ["http://localhost:5173", "http://localhost:3000" ,"http://127.0.0.1:5500" ,"null"],
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
        socket.currentRoom = newRoom.inviteCode;
        
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
            const data = typeof payload === "string" ? JSON.parse(payload) : payload;
            try {
                const updatedRoom = await joinRoomInternal(payload, socket.user);
                
                await socket.join(updatedRoom.inviteCode);
                socket.currentRoom = updatedRoom.inviteCode;

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
socket.on("disconnect", async () => {
    console.log(`❌ Socket disconnected: ${socket.id}`);
    console.log(`📍 currentRoom: ${socket.currentRoom}`); // ← add this
    
    if (!socket.currentRoom) return;
    
    const room = await leaveRoomInternal(socket.currentRoom, socket.user._id);
    console.log(`🏠 room after leave:`, room); // ← add this

    if (!room) return;

    console.log(`📢 emitting user-left to room: ${socket.currentRoom}`); // ← add this
    io.to(socket.currentRoom).emit("user-left", {
        userId: socket.user._id,
        username: socket.user.username,
        systemMessage: `${socket.user.username} has left the workspace.`
    });
});

        socket.on("send-message" ,async (payload)=>{
            try {
                const {roomId , message} = payload;

                socket.to(roomId).emit("recieve-message",{
                    userId:socket.user._id,
                    username:socket.user.username,
                    message:message,
                    timestamp:new Date()
                })
            } catch (error) {
                socket.emit("send-message" ,{success:false ,error:error.message})
            }
        })
    });

    return io;
};