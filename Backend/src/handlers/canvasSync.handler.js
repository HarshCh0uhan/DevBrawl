//Canvas, Text, & Chat Synchronizer


export const registerSyncHandlers = (io, socket) => {
  
  socket.on("send-message", async (payload) => {
    try {
      const { roomId, message } = payload;
      socket.to(roomId).emit("receive-message", {
        userId: socket.user._id,
        username: socket.user.username,
        message: message,
        timestamp: new Date()
      });
    } catch (error) {
      socket.emit("send-message", { success: false, error: error.message });
    }
  });

  socket.on("canvas-change", (data) => {
    socket.to(data.roomId).emit("receive-canvas-change", data);
  });

  socket.to(socket.id).emit("custom-init", { context: "sync-ready" });

  socket.on("code-change", (data) => {
    socket.to(data.roomId).emit("receive-code-change", data);
  });
};