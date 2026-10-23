import { isObjectIdOrHexString } from "mongoose";

export function apiHandler(handler) {
  return async (req, res, next) => {
    try { return await handler(req, res, next); }
    catch (error) {
      if (error.code === 11000) return res.status(409).json({ error: "A profile already exists for this account." });
      if (["ValidationError", "CastError"].includes(error.name)) return res.status(400).json({ error: "Invalid request fields." });
      console.error("API request failed:", error);
      return res.status(503).json({ error: "Could not complete request. Check the database connection." });
    }
  };
}

export function requireId(req, res, next) {
  if (!isObjectIdOrHexString(req.params.id)) return res.status(400).json({ error: "Invalid ID." });
  return next();
}
