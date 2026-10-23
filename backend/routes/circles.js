import { Router } from "express";
import { getMyCircles, getMessages, sendMessage } from "../controllers/circles.js";
import { requireAccount } from "../middleware/requireAccount.js";
import { requireProfile, requireCircleMember } from "../middleware/requireProfile.js";
import { apiHandler, requireId } from "../middleware/apiHandler.js";

const router = Router();
router.use(requireAccount, requireProfile);
router.get("/", apiHandler(getMyCircles));
router.get("/:id/messages", requireId, requireCircleMember, apiHandler(getMessages));
router.post("/:id/messages", requireId, requireCircleMember, apiHandler(sendMessage));
export default router;
