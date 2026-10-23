import Post from "../models/Post.js";

function populatePost(query) {
  return query.populate("author", "name major avatarUrl")
    .populate("comments.author", "name avatarUrl").populate("event.attendees", "name avatarUrl");
}

function postDetails(post, profileId) {
  const result = post.toObject();
  if (result.event) {
    const attendees = result.event.attendees || [];
    result.attendeeCount = attendees.length;
    result.spotsRemaining = result.event.capacity == null ? null : Math.max(0, result.event.capacity - attendees.length);
    result.isGoing = attendees.some(profile => String(profile?._id || profile) === String(profileId));
  }
  return result;
}

export async function getPosts(req, res) {
  const filter = req.query.mine === "true" ? { author: req.profile._id } : {};
  const posts = await populatePost(Post.find(filter).sort({ createdAt: -1 }).limit(50));
  return res.json(posts.map(post => postDetails(post, req.profile._id)));
}

export async function getPost(req, res) {
  const post = await populatePost(Post.findById(req.params.id));
  if (!post) return res.status(404).json({ error: "Post not found." });
  return res.json(postDetails(post, req.profile._id));
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
  return res.json(postDetails(post, req.profile._id));
}

export async function createPost(req, res) {
  const event = req.body?.event;
  const post = await Post.create({ author: req.profile._id, text: req.body?.text, imageUrl: req.body?.imageUrl,
    event: event == null ? undefined : {
      title: event.title, location: event.location, dateTime: event.dateTime,
      endTime: event.endTime, capacity: event.capacity, category: event.category, hostNote: event.hostNote,
    } });
  return res.status(201).json(post);
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
