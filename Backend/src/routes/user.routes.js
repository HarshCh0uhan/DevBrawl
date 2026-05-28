import { Router } from "express";
import { 
    registerUser, 
    loginUser, 
} from "../controllers/user.controller.js";
import { upload } from "../middlewears/multer.middlewear.js";
import { authenticateUser } from "../utils/auth.middlewear.js";
import { generateLiveKitToken } from "../controllers/room.controller.js";

const router = Router();

router.route("/register").post(
    upload.single("avatar"), 
    registerUser
);

router.route("/login").post(loginUser);

router.get('/voice-token', authenticateUser, async (req, res) => {
  const { roomName } = req.query
  const token = await generateLiveKitToken(roomName, req.user.username)
  res.json({ token, url: process.env.LIVEKIT_URL })
})



export default router;