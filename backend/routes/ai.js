import { Router } from "express";
import { generateAIResponse, findPlans } from "../controllers/ai.js";
import { requireAccount } from '../middleware/requireAccount.js';
import { requireProfile } from '../middleware/requireProfile.js';
import { apiHandler } from '../middleware/apiHandler.js';

const router = Router();

router.post("/generate", generateAIResponse);
router.post('/recommend-events',requireAccount,requireProfile,apiHandler(findPlans));

export default router;
