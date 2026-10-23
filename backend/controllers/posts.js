import Post from "../models/Post.js";
import Profile from "../models/Profile.js";
import { isObjectIdOrHexString } from "mongoose";

function populatePost(query) {
  return query.populate("author", "name handle bio major avatarUrl")
    .populate("comments.author", "name handle avatarUrl").populate("event.attendees", "name handle avatarUrl");
}

function postDetails(post, profile) {
  const result = post.toObject();
  result.isSaved = (profile.savedPosts || []).some(id => String(id) === String(post._id));
  result.isHost = String(result.author?._id || result.author) === String(profile._id);
  result.isFriend = (profile.friends || []).some(id => String(id) === String(result.author?._id || result.author));
  if (result.event) {
    const attendees = result.event.attendees || [];
    result.attendeeCount = attendees.length;
    result.spotsRemaining = result.event.capacity == null ? null : Math.max(0, result.event.capacity - attendees.length);
    result.isGoing = attendees.some(attendee => String(attendee?._id || attendee) === String(profile._id));
  }
  return result;
}

export async function getPosts(req, res) {
  const filter = req.query.mine === "true" ? { author: req.profile._id } : {};
  const view = req.query.view;
  if (view && !["discover", "hosting", "going", "saved", "friends"].includes(view)) {
    return res.status(400).json({ error: "Choose discover, hosting, going, saved, or friends." });
  }
  if (view) filter.event = { $ne: null };
  if (view === "hosting") filter.author = req.profile._id;
  if (view === "going") filter["event.attendees"] = req.profile._id;
  if (view === "saved") filter._id = { $in: req.profile.savedPosts || [] };
  if (view === "friends") filter.author = { $in: req.profile.friends || [] };
  if (req.query.author) {
    if (!isObjectIdOrHexString(req.query.author)) return res.status(400).json({ error: "Invalid author ID." });
    // Keep view restrictions when an author filter is also supplied.
    filter.$and = [{ author: req.query.author }];
  }
  if (req.query.category !== undefined) {
    if (typeof req.query.category !== "string" || req.query.category.length > 80) return res.status(400).json({ error: "Category must be at most 80 characters." });
    if (req.query.category && req.query.category !== "All") filter["event.category"] = req.query.category;
  }
  if (req.query.q !== undefined) {
    if (typeof req.query.q !== "string" || req.query.q.length > 200) return res.status(400).json({ error: "Search must be at most 200 characters." });
    const literal = req.query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = ["text", "event.title", "event.location", "event.category"].map(field => ({ [field]: { $regex: literal, $options: "i" } }));
  }
  const posts = await populatePost(Post.find(filter).sort({ createdAt: -1 }).limit(50));
  return res.json(posts.map(post => postDetails(post, req.profile)));
}

export async function getPost(req, res) {
  const post = await populatePost(Post.findById(req.params.id));
  if (!post) return res.status(404).json({ error: "Post not found." });
  return res.json(postDetails(post, req.profile));
}

export async function rsvp(req, res) {
  const cancelling = req.method === "DELETE";
  const filter = { _id: req.params.id, event: { $ne: null } };
  if (!cancelling) {
    filter.$or = [
      { "event.attendees": req.profile._id },
      { $expr: { $lt: [
        { $size: { $ifNull: ["$event.attendees", []] } },
        { $ifNull: ["$event.capacity", Number.MAX_SAFE_INTEGER] },
      ] } },
    ];
  }
  const change = { "event.attendees": req.profile._id };
  const post = await populatePost(Post.findOneAndUpdate(filter,
    cancelling ? { $pull: change } : { $addToSet: change }, { returnDocument: "after" }));
  if (!post) {
    const existing = await Post.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Post not found." });
    if (!existing.event) return res.status(400).json({ error: "This post is not an event." });
    return res.status(409).json({ error: "This event is full." });
  }
  return res.json(postDetails(post, req.profile));
}

export async function createPost(req, res) {
  const event = req.body?.event;
  const post = await Post.create({ author: req.profile._id, text: req.body?.text, imageUrl: req.body?.imageUrl,
    event: event == null ? undefined : {
      title: event.title, location: event.location, dateTime: event.dateTime,
      endTime: event.endTime, capacity: event.capacity, category: event.category, hostNote: event.hostNote,
      image: event.image, imageAlt: event.imageAlt, cost: event.cost,
      // Opt in to the website's "including you" behavior without changing older clients.
      attendees: event.includeHost === true ? [req.profile._id] : [],
    } });
  return res.status(201).json(post);
}

export async function savePost(req, res) {
  if (req.method === "PUT") {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found." });
    if (!post.event) return res.status(400).json({ error: "Only events can be saved." });
  }
  const change = { savedPosts: req.params.id };
  const profile = await Profile.findByIdAndUpdate(req.profile._id,
    req.method === "DELETE" ? { $pull: change } : { $addToSet: change }, { new: true });
  if (!profile) return res.status(404).json({ error: "Profile not found." });
  return res.json({ savedPosts: profile.savedPosts });
}

export async function addComment(req, res) {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found." });
  post.comments.push({ author: req.profile._id, text: req.body?.text });
  await post.save();
  return res.status(201).json(post.comments[post.comments.length - 1]);
}

export async function likePost(req, res) {
  const change = { likes: req.profile._id };
  const post = await Post.findByIdAndUpdate(req.params.id,
    req.method === "DELETE" ? { $pull: change } : { $addToSet: change }, { new: true });
  if (!post) return res.status(404).json({ error: "Post not found." });
  return res.json({ likes: post.likes });
}
