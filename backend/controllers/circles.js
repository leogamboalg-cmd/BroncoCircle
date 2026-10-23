import Circle from "../models/Circle.js";
import Message from "../models/Message.js";
import Profile from "../models/Profile.js";
import { isObjectIdOrHexString, Types } from "mongoose";
import { suggestGroups, summarizeGroup } from "../services/matchingService.js";

export async function getSuggestions(req, res) {
  if (!req.profile.matchingEnabled) return res.status(400).json({ error: "Enable matching in your profile first." });
  const candidates = await Profile.find({ _id: { $ne: req.profile._id }, account: { $type: "objectId" }, matchingEnabled: true })
    .select("name major interests availability").sort({ _id: 1 }).limit(100);
  const suggestions = suggestGroups(req.profile, candidates);
  return res.json({ suggestions, message: suggestions.length ? "" : "No match yet. Add interests and availability, or invite more students to opt in." });
}

export async function acceptSuggestion(req, res) {
  const input = req.body?.candidateIds;
  if (!Array.isArray(input) || input.length < 2 || input.length > 6 || !input.every(isObjectIdOrHexString)) {
    return res.status(400).json({ error: "Provide 2–6 distinct candidateIds including your own profile." });
  }
  const ids = input.map(id => new Types.ObjectId(id).toHexString());
  if (new Set(ids).size !== ids.length || !ids.includes(String(req.profile._id))) {
    return res.status(400).json({ error: "Provide 2–6 distinct candidateIds including your own profile." });
  }
  const candidates = await Profile.find({ _id: { $in: ids }, account: { $type: "objectId" }, matchingEnabled: true });
  if (candidates.length !== ids.length) return res.status(409).json({ error: "A candidate is no longer available for matching. Refresh suggestions." });
  const summary = summarizeGroup(candidates);
  if (!summary.sharedInterests.length || !summary.sharedAvailability.length) {
    return res.status(409).json({ error: "This group no longer shares an interest and 30-minute time slot." });
  }
  const matchKey = ids.map(String).sort().join(":");
  await Circle.createIndexes();
  const update = { $setOnInsert: {
    name: `${summary.sharedInterests[0]} circle`, candidateMembers: ids, matchKey,
    sharedInterests: summary.sharedInterests, sharedAvailability: summary.sharedAvailability,
  }, $addToSet: { members: req.profile._id } };
  let circle;
  try { circle = await Circle.findOneAndUpdate({ matchKey }, update, { upsert: true, new: true, setDefaultsOnInsert: false }); }
  catch (error) {
    if (error.code !== 11000) throw error;
    circle = await Circle.findOneAndUpdate({ matchKey }, { $addToSet: { members: req.profile._id } }, { new: true });
  }
  return res.json(circle);
}

export async function getInvitations(req, res) {
  return res.json(await Circle.find({ candidateMembers: req.profile._id, members: { $ne: req.profile._id } })
    .select("name sharedInterests sharedAvailability members").limit(50));
}

export async function joinCircle(req, res) {
  const circle = await Circle.findById(req.params.id);
  if (!circle) return res.status(404).json({ error: "Circle not found." });
  if (!circle.candidateMembers.some(id => String(id) === String(req.profile._id))) {
    return res.status(403).json({ error: "This circle was not suggested for your profile." });
  }
  if (!req.profile.matchingEnabled) return res.status(400).json({ error: "Enable matching before joining." });
  const candidates = await Profile.find({ _id: { $in: circle.candidateMembers }, matchingEnabled: true });
  const summary = summarizeGroup(candidates);
  if (candidates.length !== circle.candidateMembers.length || !summary.sharedInterests.length || !summary.sharedAvailability.length) {
    return res.status(409).json({ error: "This match has changed. Refresh suggestions before joining." });
  }
  return res.json(await Circle.findByIdAndUpdate(circle._id, {
    $addToSet: { members: req.profile._id },
    $set: { sharedInterests: summary.sharedInterests, sharedAvailability: summary.sharedAvailability },
  }, { new: true }));
}

export async function getMyCircles(req, res) {
  return res.json(await Circle.find({ members: req.profile._id }).populate("members", "name major interests").limit(50));
}

export async function getMessages(req, res) {
  const messages = await Message.find({ circle: req.circle._id }).sort({ createdAt: -1 }).limit(50).populate("author", "name");
  return res.json(messages.reverse());
}

export async function sendMessage(req, res) {
  return res.status(201).json(await Message.create({ circle: req.circle._id, author: req.profile._id, text: req.body?.text }));
}
