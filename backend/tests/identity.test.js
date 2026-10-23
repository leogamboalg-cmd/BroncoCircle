import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { Types } from "mongoose";
import Account from "../models/Account.js";
import Profile from "../models/Profile.js";
import Post from "../models/Post.js";
import Circle from "../models/Circle.js";
import Message from "../models/Message.js";
import Meetup from "../models/Meetup.js";
import profiles from "../routes/profiles.js";
import posts from "../routes/posts.js";
import circles from "../routes/circles.js";
import meetups from "../routes/meetups.js";
import { hashToken } from "../services/authService.js";

test("identity is derived from bearer account and circle access is checked", async t => {
  const accountA = new Types.ObjectId(), accountB = new Types.ObjectId();
  const tokenA = "a".repeat(64), tokenB = "b".repeat(64);
  const stored = [];
  t.mock.method(Account, "findOne", async query => {
    if (query.tokenHash === hashToken(tokenA)) return { _id: accountA };
    if (query.tokenHash === hashToken(tokenB)) return { _id: accountB };
    return null;
  });
  t.mock.method(Profile, "createIndexes", async () => {});
  t.mock.method(Profile, "findOne", async query => stored.find(p => p.account.equals(query.account)));
  t.mock.method(Profile, "create", async fields => {
    if (stored.some(p => p.account.equals(fields.account))) throw Object.assign(new Error(), { code: 11000 });
    const profile = new Profile(fields);
    await profile.validate();
    profile.save = async () => { await profile.validate(); return profile; };
    stored.push(profile);
    return profile;
  });
  let capturedPost, capturedMessage, capturedLike;
  t.mock.method(Post, "create", async fields => { capturedPost = new Post(fields); await capturedPost.validate(); return capturedPost; });
  t.mock.method(Post, "findById", async () => capturedPost);
  t.mock.method(Post, "findByIdAndUpdate", async (id, update) => { capturedLike = update; return { likes: [stored[0]._id] }; });
  t.mock.method(Message, "create", async fields => { capturedMessage = fields; return fields; });
  const circleId = new Types.ObjectId();
  t.mock.method(Circle, "findById", async () => ({ _id: circleId, members: [stored[0]._id] }));
  t.mock.method(Circle, "findOne", async query => query.members.equals(stored[0]._id) ? { _id: circleId } : null);
  const meetupId = new Types.ObjectId(), time = new Date("2026-11-01T20:00:00Z");
  t.mock.method(Meetup, "findById", async () => ({ _id: meetupId, circle: circleId, proposedTimes: [time] }));
  let voteUpdate;
  t.mock.method(Meetup, "findByIdAndUpdate", async (id, update) => { voteUpdate = update; return { _id: id }; });
  const app = express();
  app.use(express.json());
  app.use("/profiles", profiles); app.use("/posts", posts);
  app.use("/circles", circles); app.use("/meetups", meetups);
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  async function request(path, method = "GET", body, token = tokenA) {
    const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  }
  assert.equal((await request("/profiles/me", "GET", undefined, null)).status, 401);
  assert.equal((await request("/profiles/me")).status, 404);
  assert.equal((await request("/posts", "POST", { text: "No profile yet" })).status, 403);
  assert.equal((await request("/profiles", "POST", { name: "Alex", major: "CS", account: accountB })).status, 201);
  assert.ok(stored[0].account.equals(accountA));
  assert.equal((await request("/profiles", "POST", { name: "Again", major: "CS" })).status, 409);
  assert.equal((await request("/profiles", "POST", { name: "Jordan", major: "ME" }, tokenB)).status, 201);
  await request("/profiles/me", "PATCH", { name: "Changed", account: accountB });
  assert.ok(stored[0].account.equals(accountA));
  assert.equal((await request("/profiles/me", "GET", undefined, tokenB)).body.name, "Jordan");
  assert.equal((await request("/posts", "POST", { text: "Hi", author: stored[1]._id })).status, 201);
  assert.ok(capturedPost.author.equals(stored[0]._id));
  capturedPost.save = async () => capturedPost;
  const comment = await request(`/posts/${capturedPost._id}/comments`, "POST", { text: "Hey", author: stored[1]._id });
  assert.equal(comment.body.author, stored[0]._id.toString());
  await request(`/posts/${capturedPost._id}/likes`, "PUT", { profileId: stored[1]._id });
  assert.ok(capturedLike.$addToSet.likes.equals(stored[0]._id));
  assert.equal((await request("/posts/bad/comments", "POST", { text: "Hi" })).status, 400);
  assert.equal((await request(`/circles/${circleId}/messages`, "POST", { text: "Hello" }, tokenB)).status, 403);
  assert.equal((await request(`/circles/${circleId}/messages`, "POST", { text: "Hello", author: stored[1]._id })).status, 201);
  assert.ok(capturedMessage.author.equals(stored[0]._id));
  assert.equal((await request(`/meetups/${meetupId}/vote`, "PUT", { time: time.toISOString() }, tokenB)).status, 403);
  assert.equal((await request(`/meetups/${meetupId}/vote`, "PUT", { time: "invalid" })).status, 400);
  assert.equal((await request(`/meetups/${meetupId}/vote`, "PUT", { time: time.toISOString(), profileId: stored[1]._id })).status, 200);
  assert.ok(voteUpdate[0].$set.votes.$concatArrays[1][0].profile.equals(stored[0]._id));
});
