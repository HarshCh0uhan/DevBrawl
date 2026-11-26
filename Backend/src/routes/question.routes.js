import { Router } from "express";
import { generateRoundQuestion, getRoundQuestion } from "../controllers/question.controller.js";
import { userAuth } from "../middlewares/auth.middleware.js";
 
const router = Router();
 
// Auto-triggered after topic voting ends, or manually by host to regenerate
router.route("/generate").post(userAuth, generateRoundQuestion);
 
// Fetch existing question (e.g. on reconnect / late join)
router.route("/:roomId/:roundNumber").get(userAuth, getRoundQuestion);
 
export default router;
 