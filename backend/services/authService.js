import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(":");
  const expected = Buffer.from(hash, "hex");
  const actual = await scrypt(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function issueToken(account) {
  const token = randomBytes(32).toString("hex");
  account.tokenHash = hashToken(token);
  account.tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return token;
}

export function publicAccount(account) {
  return { _id: account._id, name: account.name, email: account.email, createdAt: account.createdAt };
}
