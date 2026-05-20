import dotenv from "dotenv";
import { createServer } from "http";
import app from "./app.js";
import { initializeSocket } from "./src/utils/socket.js";
import { connectDB } from "./src/db/index.js";

dotenv.config();

const PORT = process.env.PORT || 8000;
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