import Account from "../models/Account.js";
import { hashPassword, verifyPassword, issueToken, publicAccount } from "../services/authService.js";

function credentials(body) {
  if (typeof body?.email !== "string" || typeof body?.password !== "string") return null;
  const email = body.email.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  if (body.password.length < 8 || body.password.length > 128) return null;
  return { email, password: body.password };
}

export async function signup(req, res) {
  const input = credentials(req.body);
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!input || !name || name.length > 100) {
    return res.status(400).json({ error: "Provide a name (1–100 characters), valid email, and password (8–128 characters)." });
  }

  try {
    // autoIndex is disabled globally; ensure email uniqueness before inserting.
    await Account.createIndexes();
    const account = new Account({ name, email: input.email, passwordHash: await hashPassword(input.password) });
    const token = issueToken(account);
    await account.save();
    return res.status(201).json({ account: publicAccount(account), token, expiresAt: account.tokenExpiresAt });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: "Email is already registered." });
    console.error("Signup failed:", error);
    return res.status(503).json({ error: "Could not create account. Check the database connection." });
  }
}

export async function login(req, res) {
  const input = credentials(req.body);
  if (!input) return res.status(400).json({ error: "Provide a valid email and password (8–128 characters)." });

  try {
    const account = await Account.findOne({ email: input.email }).select("+passwordHash");
    if (!account || !await verifyPassword(input.password, account.passwordHash)) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    const token = issueToken(account);
    await account.save();
    return res.json({ account: publicAccount(account), token, expiresAt: account.tokenExpiresAt });
  } catch (error) {
    console.error("Login failed:", error);
    return res.status(503).json({ error: "Could not log in. Check the database connection." });
  }
}

export function getMe(req, res) {
  return res.json({ account: req.account });
}
