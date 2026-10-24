import Profile from "../models/Profile.js";

function fields(body) {
  return Object.fromEntries(["name", "handle", "bio", "pronouns", "major", "interests", "availability", "matchingEnabled", "avatarUrl"]
    .filter(key => Object.hasOwn(body || {}, key)).map(key => [key, body[key]]));
}

export async function getProfiles(req, res) {
  const filter = {};
  if (req.query.q !== undefined) {
    if (typeof req.query.q !== "string" || req.query.q.length > 200) return res.status(400).json({ error: "Search must be at most 200 characters." });
    const literal = req.query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = ["name", "handle", "bio", "interests"].map(field => ({ [field]: { $regex: literal, $options: "i" } }));
  }
  return res.json(await Profile.find(filter).select("-account -savedPosts -friends").limit(100));
}

export async function getProfile(req, res) {
  const profile = await Profile.findById(req.params.id).select("-account -savedPosts -friends");
  if (!profile) return res.status(404).json({ error: "Profile not found." });
  return res.json(profile);
}

// Keep the legacy field/endpoint compatible while exposing follow semantics.
export async function setFriend(req, res) {
  if (String(req.profile._id).toLowerCase() === req.params.id.toLowerCase()) return res.status(400).json({ error: "You cannot follow yourself." });
  if (req.method === "PUT" && !await Profile.exists({ _id: req.params.id })) {
    return res.status(404).json({ error: "Profile not found." });
  }
  const change = { friends: req.params.id };
  const updated = await Profile.findByIdAndUpdate(req.profile._id,
    req.method === "DELETE" ? { $pull: change } : { $addToSet: change }, { new: true });
  if (!updated) return res.status(404).json({ error: "Profile not found." });
  return res.json({ friends: updated.friends, following: updated.friends,
    isFollowing: updated.friends.some(id => String(id).toLowerCase() === req.params.id.toLowerCase()) });
}

export async function getSocial(req, res) {
  const target = await Profile.findById(req.params.id).select('friends');
  if (!target) return res.status(404).json({ error: "Profile not found." });
  const followers = await Profile.countDocuments({ friends: target._id });
  return res.json({ followers, following: (target.friends || []).length,
    isFollowing: (req.profile.friends || []).some(id => String(id).toLowerCase() === req.params.id.toLowerCase()) });
}

export async function getMyProfile(req, res) {
  const profile = await Profile.findOne({ account: req.account._id });
  if (!profile) return res.status(404).json({ error: "Profile not found. Create one first." });
  return res.json(profile);
}

export async function createProfile(req, res) {
  await Profile.createIndexes();
  const profile = await Profile.create({ ...fields(req.body), account: req.account._id });
  return res.status(201).json(profile);
}

export async function updateMyProfile(req, res) {
  const profile = await Profile.findOne({ account: req.account._id });
  if (!profile) return res.status(404).json({ error: "Profile not found. Create one first." });
  profile.set(fields(req.body));
  await profile.save();
  return res.json(profile);
}
