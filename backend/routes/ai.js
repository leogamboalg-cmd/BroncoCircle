import { Router } from "express";
import { generateAIResponse, findPlans, getAIStatus } from "../controllers/ai.js";
import { requireAccount } from '../middleware/requireAccount.js';
import { requireProfile } from '../middleware/requireProfile.js';
import { apiHandler } from '../middleware/apiHandler.js';

const router = Router();
router.get('/status',requireAccount,requireProfile,getAIStatus);

router.post("/generate", requireAccount, requireProfile, apiHandler(generateAIResponse));
router.post('/recommend-events',requireAccount,requireProfile,apiHandler(findPlans));

export default router;
