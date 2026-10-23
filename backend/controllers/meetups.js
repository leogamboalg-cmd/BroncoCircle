import Meetup from "../models/Meetup.js";
import Circle from "../models/Circle.js";

function parseTime(value) {
  // Require an explicit timezone; avoid silently using the server's local zone.
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/.test(value)) return null;
  const calendarDay = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  const time = new Date(value);
  if (!Number.isFinite(time.getTime()) || !Number.isFinite(calendarDay.getTime())
    || calendarDay.toISOString().slice(0, 10) !== value.slice(0, 10)) return null;
  return time;
}

// Circle membership is validated by the route before either handler runs.
export async function createMeetup(req, res) {
  const location = typeof req.body?.location === "string" ? req.body.location.trim() : "";
  const input = req.body?.proposedTimes;
  if (!location || location.length > 200 || !Array.isArray(input) || input.length < 1 || input.length > 3) {
    return res.status(400).json({ error: "Provide a location (1–200 characters) and 1–3 proposedTimes." });
  }
  const times = input.map(parseTime);
  if (times.some(time => !time) || new Set(times.map(time => time.getTime())).size !== times.length) {
    return res.status(400).json({ error: "Use distinct ISO date/time strings with a timezone, such as 2026-11-01T12:00:00-08:00." });
  }
  const meetup = await Meetup.create({
    circle: req.circle._id, location, proposedTimes: times.sort((a, b) => a - b),
    // Client-supplied circle, author, and votes are deliberately not copied.
  });
  return res.status(201).json(meetup);
}

export async function getMeetups(req, res) {
  const meetups = await Meetup.find({ circle: req.circle._id }).sort({ _id: -1 }).limit(50).lean();
  return res.json(meetups.map(meetup => ({
    ...meetup,
    voteCounts: meetup.proposedTimes.map(time => ({
      time, count: (meetup.votes || []).filter(vote => vote.time.getTime() === time.getTime()).length,
    })),
  })));
}

export async function vote(req, res) {
  const meetup = await Meetup.findById(req.params.id);
  if (!meetup) return res.status(404).json({ error: "Meetup not found." });
  const circle = await Circle.findOne({ _id: meetup.circle, members: req.profile._id });
  if (!circle) return res.status(403).json({ error: "You must belong to this circle." });
  const time = typeof req.body?.time === "string" ? new Date(req.body.time) : new Date(NaN);
  if (!meetup.proposedTimes.some(proposed => proposed.getTime() === time.getTime())) {
    return res.status(400).json({ error: "Choose one of the proposed times." });
  }
  // Atomically replace this profile's vote, including concurrent retries.
  const updated = await Meetup.findByIdAndUpdate(meetup._id, [{ $set: {
    votes: { $concatArrays: [
      { $filter: { input: { $ifNull: ["$votes", []] }, as: "vote", cond: { $ne: ["$$vote.profile", req.profile._id] } } },
      [{ profile: req.profile._id, time }],
    ] },
  } }], { new: true, updatePipeline: true });
  if (!updated) return res.status(404).json({ error: "Meetup not found." });
  return res.json(updated);
}
