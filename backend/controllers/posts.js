import Post from "../models/Post.js";

export async function getPosts(req, res) {
  const filter = req.query.mine === "true" ? { author: req.profile._id } : {};
  return res.json(await Post.find(filter).sort({ createdAt: -1 }).limit(50)
    .populate("author", "name major").populate("comments.author", "name"));
}

export async function createPost(req, res) {
  const event = req.body?.event;
  const post = await Post.create({ author: req.profile._id, text: req.body?.text, imageUrl: req.body?.imageUrl,
    event: event == null ? undefined : { title: event.title, location: event.location, dateTime: event.dateTime } });
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
