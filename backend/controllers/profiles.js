import Profile from "../models/Profile.js";

function fields(body) {
  return Object.fromEntries(["name", "major", "interests", "availability", "matchingEnabled", "avatarUrl"]
    .filter(key => Object.hasOwn(body || {}, key)).map(key => [key, body[key]]));
}

export async function getProfiles(req, res) {
  return res.json(await Profile.find().select("-account").limit(100));
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
