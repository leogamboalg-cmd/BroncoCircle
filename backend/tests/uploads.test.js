import test from "node:test";
import assert from "node:assert/strict";
import { Writable } from "node:stream";
import express from "express";
import { Types } from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import Account from "../models/Account.js";
import Profile from "../models/Profile.js";
import Post from "../models/Post.js";
import uploads from "../routes/uploads.js";
import posts from "../routes/posts.js";

test("authenticated image upload and optional image posts", async t => {
  for (const [key, value] of Object.entries({ CLOUDINARY_CLOUD_NAME: "test-cloud", CLOUDINARY_API_KEY: "test-key", CLOUDINARY_API_SECRET: "test-secret" })) {
    const original = process.env[key]; process.env[key] = value;
    t.after(() => { if (original === undefined) delete process.env[key]; else process.env[key] = original; });
  }
  const id = new Types.ObjectId();
  t.mock.method(Account, "findOne", async () => ({ _id: id }));
  t.mock.method(Profile, "findOne", async () => ({ _id: id }));
  let uploadCalls = 0, failure = false;
  const imageUrl = "https://res.cloudinary.com/test-cloud/image/upload/v1/broncocircle/photo.png";
  t.mock.method(cloudinary.uploader, "upload_stream", (options, callback) => {
    uploadCalls++;
    assert.equal(options.resource_type, "image");
    assert.match(options.folder, /broncocircle\/posts\//);
    return new Writable({ write(chunk, encoding, done) { done(); }, final(done) {
      callback(failure ? new Error("private provider details") : null, { secure_url: imageUrl }); done();
    } });
  });
  t.mock.method(Post, "create", async fields => {
    const post = new Post(fields); await post.validate(); return post;
  });
  const app = express(); app.use(express.json());
  app.use("/uploads", uploads); app.use("/posts", posts);
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const auth = { Authorization: `Bearer ${"a".repeat(64)}` };
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM1kAAAAASUVORK5CYII=", "base64");
  async function upload(bytes = png, type = "image/png", headers = auth, field = "image") {
    const body = new FormData(); if (bytes) body.append(field, new Blob([bytes], { type }), "photo.png");
    return fetch(`${origin}/uploads/image`, { method: "POST", headers, body });
  }
  assert.equal((await upload(png, "image/png", {})).status, 401);
  assert.equal(uploadCalls, 0);
  assert.equal((await upload(null)).status, 400);
  assert.equal((await upload(Buffer.from("fake"), "text/plain")).status, 400);
  assert.equal((await upload(Buffer.from("fake"))).status, 400);
  assert.equal((await upload(png, "image/png", auth, "wrong")).status, 400);
  assert.equal((await upload(Buffer.alloc(5 * 1024 * 1024 + 1))).status, 413);
  const success = await upload();
  assert.equal(success.status, 201); assert.deepEqual(await success.json(), { imageUrl });
  failure = true;
  const failed = await upload(); assert.equal(failed.status, 502);
  assert.doesNotMatch(JSON.stringify(await failed.json()), /private provider details|test-secret/);
  delete process.env.CLOUDINARY_API_SECRET;
  assert.equal((await upload()).status, 503);
  async function create(body) {
    return fetch(`${origin}/posts`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }
  const textOnly = await create({ text: "Text only" });
  assert.equal(textOnly.status, 201); assert.equal((await textOnly.json()).imageUrl, undefined);
  const imagePost = await create({ text: "With photo", imageUrl });
  assert.equal(imagePost.status, 201); assert.equal((await imagePost.json()).imageUrl, imageUrl);
  assert.equal((await create({ text: "Unsafe", imageUrl: "javascript:alert(1)" })).status, 400);
  assert.equal((await create({ text: "Other cloud", imageUrl: "https://res.cloudinary.com/other/image/upload/photo.jpg" })).status, 400);
});
