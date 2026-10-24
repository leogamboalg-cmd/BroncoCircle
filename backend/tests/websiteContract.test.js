import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { Types } from "mongoose";
import Account from "../models/Account.js";
import Profile from "../models/Profile.js";
import Post from "../models/Post.js";
import profiles from "../routes/profiles.js";
import posts from "../routes/posts.js";

test("website profile fields, event metadata, private saves and feed views", async t => {
  const viewer = new Profile({ account: new Types.ObjectId(), name: "Alex", major: "CS" });
  const other = new Types.ObjectId();
  t.mock.method(Account, "findOne", async () => ({ _id: viewer.account }));
  t.mock.method(Profile, "findOne", async () => viewer);
  viewer.save = async () => { await viewer.validate(); return viewer; };
  let post, capturedFilter;
  t.mock.method(Post, "create", async fields => { post = new Post(fields); await post.validate(); return post; });
  t.mock.method(Post, "findById", id => ({
    then: resolve => resolve(String(id) === String(post?._id) ? post : null),
    populate() { return this; },
  }));
  t.mock.method(Post, "find", filter => {
    capturedFilter = filter;
    return { sort() { return this; }, limit() { return this; }, populate() { return this; }, then(resolve) { resolve([post]); } };
  });
  t.mock.method(Profile, "findByIdAndUpdate", async (id, update) => {
    assert.equal(String(id), String(viewer._id));
    for (const [key, value] of Object.entries(update.$addToSet || {})) {
      if (!viewer[key].some(item => String(item) === String(value))) viewer[key].push(value);
    }
    for (const [key, value] of Object.entries(update.$pull || {})) viewer[key] = viewer[key].filter(item => String(item) !== String(value));
    return viewer;
  });
  t.mock.method(Profile, "exists", async ({ _id }) => String(_id) === String(other) ? { _id: other } : null);
  let profileFilter, publicSelection;
  const publicQuery = {
    select(selection) { publicSelection = selection; return this; },
    limit() { return this; },
    then(resolve) { resolve([{ _id: other, name: "Jordan" }]); },
  };
  t.mock.method(Profile, "find", filter => { profileFilter = filter; return publicQuery; });
  t.mock.method(Profile, "findById", () => ({
    select(selection) { publicSelection = selection; return Promise.resolve({ _id: other, name: "Jordan" }); },
  }));
  const app = express(); app.use(express.json());
  app.use("/profiles", profiles); app.use("/posts", posts);
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, method = "GET", body, authenticated = true) {
    const response = await fetch(`${base}${path}`, { method,
      headers: { "Content-Type": "application/json", ...(authenticated ? { Authorization: `Bearer ${"a".repeat(64)}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }
  const edited = await request("/profiles/me", "PATCH", { handle: "alex.on.campus", bio: "Games & coffee", pronouns: "they/them", savedPosts: [other], friends: [other], account: other });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.handle, "alex.on.campus");
  assert.equal(edited.body.bio, "Games & coffee");
  assert.deepEqual(edited.body.savedPosts, []);
  assert.deepEqual(edited.body.friends, []);
  assert.equal(edited.body.account, String(viewer.account));
  assert.equal((await request("/profiles?q=a%2Bb")).status, 200);
  assert.equal(profileFilter.$or[0].name.$regex, "a\\+b");
  assert.equal(publicSelection, "-account -savedPosts -friends");
  assert.equal((await request(`/profiles/${other}`)).status, 200);
  assert.equal(publicSelection, "-account -savedPosts -friends");
  assert.equal((await request("/profiles/not-an-id")).status, 400);
  const invalid = new Profile({ account: viewer.account, name: "Alex", major: "CS", handle: "bad handle", bio: "x".repeat(181) });
  await assert.rejects(invalid.validate());
  const event = { title: "Board games", location: "BSC", dateTime: "2026-11-01T16:00:00-08:00", endTime: "2026-11-01T18:00:00-08:00", capacity: 8, category: "Games", hostNote: "Bring your ID", image: "bowling", imageAlt: "Bowling lanes", cost: "Free", includeHost: true, attendees: [other] };
  const created = await request("/posts", "POST", { text: "Come play", event, author: other });
  assert.equal(created.status, 201);
  assert.equal(created.body.event.image, "bowling");
  assert.equal(created.body.event.cost, "Free");
  assert.deepEqual(created.body.event.attendees, [String(viewer._id)]);
  assert.equal((await request(`/posts/${post._id}/save`, "PUT", {}, false)).status, 401);
  for (let i = 0; i < 2; i++) assert.equal((await request(`/posts/${post._id}/save`, "PUT", { profileId: other })).status, 200);
  assert.equal(viewer.savedPosts.length, 1);
  const saved = await request("/posts?view=saved");
  assert.deepEqual(capturedFilter._id.$in.map(String), [String(post._id)]);
  assert.equal(saved.body[0].isSaved, true);
  assert.equal(saved.body[0].isHost, true);
  assert.equal(saved.body[0].isGoing, true);
  assert.equal(saved.body[0].attendeeCount, 1);
  assert.equal(saved.body[0].spotsRemaining, 7);
  await request("/posts?view=going");
  assert.equal(String(capturedFilter["event.attendees"]), String(viewer._id));
  await request("/posts?view=hosting");
  assert.equal(String(capturedFilter.author), String(viewer._id));
  await request(`/profiles/${other}/friend`, "PUT");
  await request(`/profiles/${other}/friend`, "PUT");
  assert.equal(viewer.friends.length, 1);
  await request("/posts?view=following&category=Games&q=a%2Bb");
  assert.deepEqual(capturedFilter.author.$in.map(String), [String(other)]);
  assert.equal(capturedFilter["event.category"], "Games");
  assert.equal(capturedFilter.$or[0].text.$regex, "a\\+b");
  assert.equal((await request(`/profiles/${viewer._id}/friend`, "PUT")).status, 400);
  assert.equal((await request(`/profiles/${new Types.ObjectId()}/friend`, "PUT")).status, 404);
  assert.equal((await request("/posts?view=invalid")).status, 400);
  assert.equal((await request("/posts?author=bad")).status, 400);
  assert.equal((await request("/posts?category=Games&category=Sports")).status, 400);
  assert.equal((await request("/posts?q=" + "a".repeat(201))).status, 400);
  assert.equal((await request(`/posts/${new Types.ObjectId()}/save`, "PUT")).status, 404);
  await request(`/posts/${post._id}/save`, "DELETE");
  await request(`/posts/${post._id}/save`, "DELETE");
  assert.equal(viewer.savedPosts.length, 0);
  await request(`/profiles/${other}/friend`, "DELETE");
  assert.equal(viewer.friends.length, 0);
  const plain = await request("/posts", "POST", { text: "Not an event" });
  assert.equal((await request(`/posts/${plain.body._id}/save`, "PUT")).status, 400);
  const withoutHost = await request("/posts", "POST", { text: "Legacy event", event: { ...event, includeHost: false } });
  assert.deepEqual(withoutHost.body.event.attendees, []);
  assert.equal((await request("/posts", "POST", { text: "Bad image", event: { ...event, image: "../../secret" } })).status, 400);
});
