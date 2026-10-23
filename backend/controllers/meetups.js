import Meetup from "../models/Meetup.js";
import Circle from "../models/Circle.js";

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
