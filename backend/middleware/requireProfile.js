import Profile from "../models/Profile.js";
import Circle from "../models/Circle.js";
import { apiHandler } from "./apiHandler.js";

export const requireProfile = apiHandler(async (req, res, next) => {
  req.profile = await Profile.findOne({ account: req.account._id });
  if (!req.profile) return res.status(403).json({ error: "Create your profile first." });
  return next();
});

// Use after requireAccount, requireProfile, and requireId (:id is a circle ID).
export const requireCircleMember = apiHandler(async (req, res, next) => {
  req.circle = await Circle.findById(req.params.id);
  if (!req.circle) return res.status(404).json({ error: "Circle not found." });
  if (!req.circle.members.some(id => id.toString() === req.profile._id.toString())) {
    return res.status(403).json({ error: "You must belong to this circle." });
  }
  return next();
});
