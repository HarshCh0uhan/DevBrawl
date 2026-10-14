// Canvas, Text, & Chat Synchronizer with snapshot resync support

// In-memory canvas snapshots per room (cleared on server restart)
const canvasSnapshots = new Map(); // roomId -> { records: { [id]: record }, timestamp: number }

// In-memory code snapshots per room (cleared on server restart)
const codeSnapshots = new Map(); // roomId -> { code: string, updatedAt: number }

export const registerSyncHandlers = (io, socket) => {

  socket.on("send-message", async (payload) => {
    try {
      const { roomId, message } = payload;
      socket.to(roomId).emit("receive-message", {
        userId: socket.user._id,
        username: socket.user.username,
        message,
        timestamp: new Date()
      });
    } catch (error) {
      socket.emit("send-message", { success: false, error: error.message });
    }
  });

  socket.on("canvas-change", (data) => {
    // Maintain snapshot
    const roomId = data.roomId;
    if (roomId) {
      const snapshot = canvasSnapshots.get(roomId) || { records: {}, timestamp: 0 };
      if (data.added) Object.assign(snapshot.records, data.added);
      if (data.updated) Object.assign(snapshot.records, data.updated);
      if (data.removed) {
        Object.keys(data.removed).forEach((id) => delete snapshot.records[id]);
      }
      snapshot.timestamp = Date.now();
      canvasSnapshots.set(roomId, snapshot);
    }
    socket.to(data.roomId).emit("receive-canvas-change", data);
  });

  // New joiner or reconnect asks for the full snapshot
  socket.on("canvas-state-request", (payload) => {
    const roomId = payload?.roomId;
    if (!roomId) return;
    const snapshot = canvasSnapshots.get(roomId);
    socket.emit("canvas-state-response", {
      roomId,
      records: snapshot?.records || {},
    });
  });

  socket.on("code-change", (data) => {
    if (data?.roomId && typeof data.code === "string") {
      codeSnapshots.set(data.roomId, { code: data.code, updatedAt: Date.now() });
    }
    socket.to(data.roomId).emit("receive-code-change", data);
  });

  // Reconnect / new joiner asks for current code
  socket.on("code-state-request", (payload) => {
    const roomId = payload?.roomId;
    if (!roomId) return;
    const snapshot = codeSnapshots.get(roomId);
    socket.emit("code-state-response", {
      roomId,
      code: snapshot?.code ?? "",
    });
  });

  socket.to(socket.id).emit("custom-init", { context: "sync-ready" });
};