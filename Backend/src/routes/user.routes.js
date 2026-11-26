import { Router } from "express";
import { registerUser, loginUser, getCurrentUser } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { userAuth } from "../middlewares/auth.middleware.js";
import { generateLiveKitToken } from "../controllers/room.controller.js";

const router = Router();

router.route("/register").post(
    upload.single("avatar"),
    registerUser
);

router.route("/login").post(loginUser);
router.route("/me").get(userAuth, getCurrentUser);

router.get('/voice-token', userAuth, async (req, res) => {
  const { roomName } = req.query
  const token = await generateLiveKitToken(roomName, req.user.username)
  res.json({ token, url: process.env.LIVEKIT_URL })
})

export default router;