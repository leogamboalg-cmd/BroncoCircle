import { Router } from "express";
import { vote } from "../controllers/meetups.js";
import { requireAccount } from "../middleware/requireAccount.js";
import { requireProfile } from "../middleware/requireProfile.js";
import { apiHandler, requireId } from "../middleware/apiHandler.js";

const router = Router();
router.use(requireAccount, requireProfile);
router.put("/:id/vote", requireId, apiHandler(vote));
export default router;
