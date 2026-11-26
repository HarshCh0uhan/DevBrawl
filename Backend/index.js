import './src/config/env.js'
import { createServer } from "http";
import app from "./app.js";
import { initializeSocket } from "./src/utils/socket.js";
import { connectDB } from "./src/config/db.js";
import { env } from "./src/config/env.js";

const PORT = env.port;
const httpServer = createServer(app);

initializeSocket(httpServer);

connectDB()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`⚙️ Server is running at port : ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err);
  });
