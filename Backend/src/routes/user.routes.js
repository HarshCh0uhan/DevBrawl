import { Router } from "express";
import { registerUser, loginUser, getCurrentUser } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { userAuth } from "../middlewares/auth.middleware.js";
import { generateLiveKitToken } from "../controllers/room.controller.js";
import { env } from "../config/env.js";

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
  res.json({ token, url: env.livekitUrl })
})

export default router;