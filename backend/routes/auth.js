import { Router } from "express";
import { signup, login, getMe } from "../controllers/auth.js";
import { requireAccount } from "../middleware/requireAccount.js";

const router = Router();
router.post("/signup", signup);
router.post("/login", login);
router.get("/me", requireAccount, getMe);

export default router;
