import { Router } from "express";
import { generateRoundQuestion, getRoundQuestion } from "../controllers/question.controller.js";
import { authenticateUser } from "../utils/auth.middlewear.js";
 
const router = Router();
 
// Auto-triggered after topic voting ends, or manually by host to regenerate
router.route("/generate").post(authenticateUser, generateRoundQuestion);
 
// Fetch existing question (e.g. on reconnect / late join)
router.route("/:roomId/:roundNumber").get(authenticateUser, getRoundQuestion);
 
export default router;
 