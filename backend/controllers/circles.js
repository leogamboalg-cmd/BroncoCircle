import Circle from "../models/Circle.js";
import Message from "../models/Message.js";

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
