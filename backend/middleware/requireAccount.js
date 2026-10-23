import Account from "../models/Account.js";
import { hashToken, publicAccount } from "../services/authService.js";

export async function requireAccount(req, res, next) {
  const match = /^Bearer ([a-f0-9]{64})$/i.exec(req.get("Authorization") || "");
  if (!match) return res.status(401).json({ error: "A valid bearer token is required." });

  try {
    const account = await Account.findOne({
      tokenHash: hashToken(match[1]),
      tokenExpiresAt: { $gt: new Date() },
    });
    if (!account) return res.status(401).json({ error: "Invalid or expired token. Please log in again." });
    req.account = publicAccount(account);
    return next();
  } catch (error) {
    console.error("Account validation failed:", error);
    return res.status(503).json({ error: "Could not validate account. Check the database connection." });
  }
}
