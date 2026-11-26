import './src/config/env.js'
import { createServer } from "http";
import app from "./app.js";
import { initializeSocket } from "./src/utils/socket.js";
import { connectDB } from "./src/config/db.js";
import { env } from "./src/config/env.js";
import mongoose from "mongoose";

const PORT = env.port;
const server = createServer(app);

const io = initializeSocket(server);

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`⚙️ Server is running at port : ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err);
  });

let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received — starting graceful shutdown`);

  const force = setTimeout(() => {
    console.error("Forced exit after 10s");
    process.exit(1);
  }, 10_000);
  force.unref();

  server.close(async (err) => {
    if (err) console.error("HTTP server close error:", err.message);
    try {
      await mongoose.connection.close();
      if (io?.close) io.close();
    } catch (e) {
      console.error("Shutdown cleanup error:", e.message);
    }
    clearTimeout(force);
    console.log("Shutdown complete");
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
