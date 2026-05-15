import dotenv from "dotenv";
import { connectDB } from "./db/index.js";
import { createServer } from "http";
import { Server } from "socket.io";
import app from "./app.js";
dotenv.config();

const PORT = process.env.PORT || 8000;

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  }
});

io.on("connection", (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`❌ Socket disconnected: ${socket.id}`);
  });
});

connectDB()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`⚙️ Server is running at port : ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err);
  });