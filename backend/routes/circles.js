import { Router } from "express";
import { getMyCircles, getMessages, sendMessage, getSuggestions, acceptSuggestion, getInvitations, joinCircle } from "../controllers/circles.js";
import { requireAccount } from "../middleware/requireAccount.js";
import { requireProfile, requireCircleMember } from "../middleware/requireProfile.js";
import { apiHandler, requireId } from "../middleware/apiHandler.js";
import { createMeetup, getMeetups } from "../controllers/meetups.js";

const router = Router();
router.use(requireAccount, requireProfile);
router.get("/", apiHandler(getMyCircles));
router.get("/suggestions", apiHandler(getSuggestions));
router.get("/invitations", apiHandler(getInvitations));
router.post("/", apiHandler(acceptSuggestion));
router.post("/:id/join", requireId, apiHandler(joinCircle));
router.get("/:id/messages", requireId, requireCircleMember, apiHandler(getMessages));
router.post("/:id/messages", requireId, requireCircleMember, apiHandler(sendMessage));
router.post("/:id/meetups", requireId, requireCircleMember, apiHandler(createMeetup));
router.get("/:id/meetups", requireId, requireCircleMember, apiHandler(getMeetups));
export default router;
