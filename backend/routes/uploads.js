import { Router } from "express";
import { requireAccount } from "../middleware/requireAccount.js";
import { requireProfile } from "../middleware/requireProfile.js";
import { imageUpload } from "../middleware/imageUpload.js";
import { uploadPostImage } from "../controllers/uploads.js";

const router = Router();
router.post("/image", requireAccount, requireProfile, imageUpload, uploadPostImage);
export default router;
