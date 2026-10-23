import { Router } from "express";
import { generateAIResponse } from "../controllers/ai.js";

const router = Router();

router.post("/generate", generateAIResponse);

export default router;
