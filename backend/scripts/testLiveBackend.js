import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { deflateSync } from "node:zlib";
import { writeFile } from "node:fs/promises";
import { v2 as cloudinary } from "cloudinary";
import { connectDB, db } from "../db.js";
import { Types } from "mongoose";

const origin = `http://127.0.0.1:${process.env.PORT || 3000}`;
const run = `live-${randomUUID()}`;
const password = `Test-${randomUUID()}`;
const accounts = [], profiles = [], circles = [], posts = [], meetups = [];
const results = [];
let uploadedUrl;
let imageOwner;

async function check(name, action) {
  try { await action(); results.push({ name, passed: true }); console.log(`PASS: ${name}`); }
  catch (error) {
    results.push({ name, passed: false, error: error.message });
    console.error(`FAIL: ${name}: ${error.message}`);
    throw error;
  }
}

async function request(path, { method = "GET", token, body, status = 200 } = {}) {
  const response = await fetch(`${origin}/api${path}`, {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}) },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });
  const data = await response.json();
  assert.equal(response.status, status, `${method} ${path} returned ${response.status}; expected ${status}`);
  if (data.account) {
    for (const secret of ["passwordHash", "tokenHash", "tokenExpiresAt"]) assert.equal(data.account[secret], undefined);
  }
  return data;
}

// Generate a valid tiny PNG test fixture without external services or file access.
function png() {
  function chunk(type, data) {
    const payload = Buffer.concat([Buffer.from(type), data]);
    let crc = 0xffffffff;
    for (const byte of payload) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const size = Buffer.alloc(4), checksum = Buffer.alloc(4);
    size.writeUInt32BE(data.length); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([size, payload, checksum]);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(2); header.writeUInt32BE(2, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.from([0, 20, 100, 60, 240, 200, 20, 0, 240, 200, 20, 20, 100, 60]))), chunk("IEND", Buffer.alloc(0))]);
}

function multipart(bytes = png(), mime = "image/png", field = "image") {
  const form = new FormData();
  if (bytes) form.append(field, new Blob([bytes], { type: mime }), "test.png");
  return form;
}

async function main() {
  await check("API health", () => request("/health"));
  await connectDB();
  assert.ok(db, "MongoDB must be configured");
  await check("Direct MongoDB ping", () => db.command({ ping: 1 }));
  const users = [];
  for (const name of ["One", "Two", "Outsider"]) {
    const email = `${run}-${name.toLowerCase()}@live-test.example`;
    let session;
    await check(`Signup ${name} and safe account response`, async () => {
      session = await request("/auth/signup", { method: "POST", body: { name: `Live Test ${name}`, email, password }, status: 201 });
      accounts.push(new Types.ObjectId(session.account._id));
    });
    const user = { email, token: session.token, accountId: session.account._id };
    users.push(user);
    await check(`Password stored as hash for ${name}`, async () => {
      const stored = await db.collection("accounts").findOne({ _id: accounts.at(-1) });
      assert.ok(stored.passwordHash && stored.passwordHash !== password);
      assert.ok(stored.tokenHash && stored.tokenHash !== user.token);
    });
    await check(`Login ${name} and reject previous token`, async () => {
      const login = await request("/auth/login", { method: "POST", body: { email, password } });
      await request("/auth/me", { token: user.token, status: 401 });
      user.token = login.token;
      await request("/auth/me", { token: user.token });
    });
    await check(`Missing profile blocks posting for ${name}`, () => request("/posts", {
      method: "POST", token: user.token, body: { text: "Not allowed yet" }, status: 403,
    }));
    await check(`Create account-owned profile for ${name}`, async () => {
      const profile = await request("/profiles", { method: "POST", token: user.token, body: {
        name: `Live Test ${name}`, major: "Test Engineering", interests: [run],
        matchingEnabled: true, availability: [{ day: "Thursday", start: name === "Outsider" ? "18:00" : "12:00", end: name === "Outsider" ? "19:00" : "13:00" }],
        account: new Types.ObjectId().toString(),
      }, status: 201 });
      user.profileId = profile._id; profiles.push(new Types.ObjectId(profile._id));
      assert.equal(profile.account, user.accountId);
    });
  }
  const [a, b, outsider] = users;
  await check("Duplicate email rejected", () => request("/auth/signup", { method: "POST", body: { name: "Duplicate", email: a.email, password }, status: 409 }));
  await check("Wrong password rejected", () => request("/auth/login", { method: "POST", body: { email: a.email, password: "wrong-password" }, status: 401 }));
  await check("Missing and forged tokens rejected", async () => {
    await request("/profiles/me", { status: 401 });
    await request("/profiles/me", { token: "0".repeat(64), status: 401 });
  });
  await check("Duplicate profile rejected", () => request("/profiles", { method: "POST", token: a.token, body: { name: "Duplicate", major: "CS" }, status: 409 }));
  await check("Profile edits cannot transfer ownership", async () => {
    const edited = await request("/profiles/me", { method: "PATCH", token: a.token, body: { name: "Live Test Edited", account: b.accountId } });
    assert.equal(edited.account, a.accountId);
    assert.equal((await request("/profiles/me", { token: b.token })).name, "Live Test Two");
    assert.equal((await db.collection("profiles").findOne({ _id: profiles[0] })).name, "Live Test Edited");
  });
  await check("Invalid schedule rejected", () => request("/profiles/me", { method: "PATCH", token: a.token,
    body: { availability: [{ day: "Thursday", start: "14:00", end: "12:00" }] }, status: 400 }));

  let circleId;
  await check("Real matching finds compatible user and excludes nonoverlap", async () => {
    const match = await request("/circles/suggestions", { token: a.token });
    assert.ok(match.suggestions.some(g => g.candidateIds.includes(b.profileId)));
    assert.ok(match.suggestions.every(g => !g.candidateIds.includes(outsider.profileId)));
  });
  await check("Accept match and keep other candidates unjoined", async () => {
    const circle = await request("/circles", { method: "POST", token: a.token, body: { candidateIds: [a.profileId, b.profileId] } });
    circleId = circle._id; circles.push(new Types.ObjectId(circleId));
    assert.deepEqual(circle.members, [a.profileId]);
  });
  await check("Invitation visible and outsider denied joining", async () => {
    assert.ok((await request("/circles/invitations", { token: b.token })).some(c => c._id === circleId));
    await request(`/circles/${circleId}/join`, { method: "POST", token: outsider.token, status: 403 });
  });
  await check("Concurrent joins do not duplicate members", async () => {
    await Promise.all(Array.from({ length: 5 }, () => request(`/circles/${circleId}/join`, { method: "POST", token: b.token })));
    const stored = await db.collection("circles").findOne({ _id: circles[0] });
    assert.equal(stored.members.length, 2);
  });
  await check("Circle list is scoped to current user", async () => {
    assert.ok((await request("/circles", { token: a.token })).some(c => c._id === circleId));
    assert.ok(!(await request("/circles", { token: outsider.token })).some(c => c._id === circleId));
  });
  await check("Message author cannot be impersonated; persisted message is readable", async () => {
    const message = await request(`/circles/${circleId}/messages`, { method: "POST", token: a.token,
      body: { text: `${run} chat`, author: outsider.profileId }, status: 201 });
    assert.equal(message.author, a.profileId);
    assert.ok(await db.collection("messages").findOne({ _id: new Types.ObjectId(message._id) }));
    assert.ok((await request(`/circles/${circleId}/messages`, { token: b.token })).some(m => m._id === message._id));
  });
  await check("Outsider denied reading and writing chat", async () => {
    await request(`/circles/${circleId}/messages`, { token: outsider.token, status: 403 });
    await request(`/circles/${circleId}/messages`, { method: "POST", token: outsider.token, body: { text: "No" }, status: 403 });
  });
  await check("Blank message and malformed circle ID rejected", async () => {
    await request(`/circles/${circleId}/messages`, { method: "POST", token: a.token, body: { text: "   " }, status: 400 });
    await request("/circles/not-an-id/messages", { token: a.token, status: 400 });
  });

  let postId;
  await check("Text-only post persists with authenticated author", async () => {
    const post = await request("/posts", { method: "POST", token: a.token, body: { text: `${run} post`, author: b.profileId }, status: 201 });
    postId = post._id; posts.push(new Types.ObjectId(postId));
    assert.equal(post.author, a.profileId); assert.equal(post.imageUrl, undefined);
    assert.ok(await db.collection("posts").findOne({ _id: posts[0] }));
  });
  await check("Shared feed readable, my posts isolated", async () => {
    assert.ok((await request("/posts", { token: b.token })).some(p => p._id === postId));
    assert.ok((await request("/posts?mine=true", { token: a.token })).some(p => p._id === postId));
    assert.ok(!(await request("/posts?mine=true", { token: b.token })).some(p => p._id === postId));
  });
  await check("Concurrent repeated likes are idempotent", async () => {
    await Promise.all(Array.from({ length: 5 }, () => request(`/posts/${postId}/likes`, { method: "PUT", token: b.token })));
    assert.equal((await db.collection("posts").findOne({ _id: posts[0] })).likes.length, 1);
    await request(`/posts/${postId}/likes`, { method: "DELETE", token: b.token });
    assert.equal((await db.collection("posts").findOne({ _id: posts[0] })).likes.length, 0);
  });
  await check("Comment identity, persistence, and populated retrieval", async () => {
    await request(`/posts/${postId}/comments`, { method: "POST", token: b.token, body: { text: "Test comment", author: a.profileId }, status: 201 });
    const post = (await request("/posts", { token: a.token })).find(p => p._id === postId);
    assert.equal(post.comments[0].author._id, b.profileId);
    assert.equal((await db.collection("posts").findOne({ _id: posts[0] })).comments.length, 1);
  });
  await check("Unsafe image URL and incomplete event rejected", async () => {
    await request("/posts", { method: "POST", token: a.token, body: { text: "Bad", imageUrl: "javascript:alert(1)" }, status: 400 });
    await request("/posts", { method: "POST", token: a.token, body: { text: "Bad", event: { title: "Missing fields" } }, status: 400 });
  });
  await check("Event post stores title, location, and date", async () => {
    const post = await request("/posts", { method: "POST", token: a.token, body: { text: `${run} event`, event: {
      title: "Test meetup", location: "BSC", dateTime: "2026-11-01T20:00:00Z",
    } }, status: 201 });
    posts.push(new Types.ObjectId(post._id)); assert.equal(post.event.location, "BSC");
  });

  let eventId;
  await check("Event creation saves simple details but ignores injected attendees", async () => {
    const post = await request("/posts", { method: "POST", token: a.token, body: {
      text: `${run} RSVP event`, event: { title: "Coffee and catch-ups", location: "BSC café patio",
        dateTime: "2026-11-01T20:00:00Z", endTime: "2026-11-01T21:00:00Z", capacity: 2,
        category: "Coffee & Connection", hostNote: "Look for the green notebook.", attendees: [outsider.profileId] },
    }, status: 201 });
    eventId = post._id; posts.push(new Types.ObjectId(eventId));
    assert.deepEqual(post.event.attendees, []); assert.equal(post.event.capacity, 2);
    assert.equal(post.event.category, "Coffee & Connection");
    assert.equal(post.event.hostNote, "Look for the green notebook.");
  });
  await check("Event details include host, spots remaining, and my RSVP state", async () => {
    const detail = await request(`/posts/${eventId}`, { token: a.token });
    assert.equal(detail.author._id, a.profileId); assert.equal(detail.attendeeCount, 0);
    assert.equal(detail.spotsRemaining, 2); assert.equal(detail.isGoing, false);
  });
  await check("Invalid capacity and end time rejected", async () => {
    for (const fields of [{ capacity: 0 }, { capacity: -1 }, { capacity: 1.5 }, { endTime: "2026-11-01T19:00:00Z" }, { endTime: "invalid" }]) {
      await request("/posts", { method: "POST", token: a.token, body: { text: "Invalid event",
        event: { title: "Invalid", location: "BSC", dateTime: "2026-11-01T20:00:00Z", ...fields } }, status: 400 });
    }
  });
  await check("RSVP uses own profile and repeated concurrent requests add only once", async () => {
    const responses = await Promise.all(Array.from({ length: 5 }, () => request(`/posts/${eventId}/rsvp`, {
      method: "PUT", token: a.token, body: { profileId: outsider.profileId },
    })));
    assert.ok(responses.every(post => post.isGoing && post.attendeeCount === 1));
    const stored = await db.collection("posts").findOne({ _id: new Types.ObjectId(eventId) });
    assert.deepEqual(stored.event.attendees.map(String), [a.profileId]);
  });
  await check("Full event denies new attendee but allows existing attendee to retry", async () => {
    const joined = await request(`/posts/${eventId}/rsvp`, { method: "PUT", token: b.token });
    assert.equal(joined.spotsRemaining, 0); assert.equal(joined.attendeeCount, 2);
    await request(`/posts/${eventId}/rsvp`, { method: "PUT", token: outsider.token, status: 409 });
    await request(`/posts/${eventId}/rsvp`, { method: "PUT", token: a.token });
    const detail = await request(`/posts/${eventId}`, { token: outsider.token });
    assert.equal(detail.isGoing, false); assert.equal(detail.event.attendees.length, 2);
    assert.ok(detail.event.attendees.every(p => p.name && p._id));
  });
  await check("Cancel is repeatable and another user can take the released spot", async () => {
    const cancelled = await request(`/posts/${eventId}/rsvp`, { method: "DELETE", token: a.token });
    assert.equal(cancelled.isGoing, false); assert.equal(cancelled.spotsRemaining, 1);
    await request(`/posts/${eventId}/rsvp`, { method: "DELETE", token: a.token });
    const joined = await request(`/posts/${eventId}/rsvp`, { method: "PUT", token: outsider.token });
    assert.equal(joined.attendeeCount, 2); assert.equal(joined.isGoing, true);
  });
  await check("Two users racing for one seat cannot overbook", async () => {
    const post = await request("/posts", { method: "POST", token: a.token, body: { text: `${run} last seat`,
      event: { title: "One seat", location: "BSC", dateTime: "2026-11-01T20:00:00Z", capacity: 1 } }, status: 201 });
    posts.push(new Types.ObjectId(post._id));
    const outcomes = await Promise.all([a, b].map(user => fetch(`${origin}/api/posts/${post._id}/rsvp`, {
      method: "PUT", headers: { Authorization: `Bearer ${user.token}` }, signal: AbortSignal.timeout(15000),
    }).then(async response => { await response.json(); return response.status; })));
    assert.deepEqual(outcomes.sort(), [200, 409]);
    assert.equal((await db.collection("posts").findOne({ _id: posts.at(-1) })).event.attendees.length, 1);
  });
  await check("Legacy events without capacity allow RSVP", async () => {
    const legacy = posts[1];
    const detail = await request(`/posts/${legacy}/rsvp`, { method: "PUT", token: a.token });
    assert.equal(detail.spotsRemaining, null); assert.equal(detail.isGoing, true);
  });
  await check("RSVP rejects normal posts, missing posts, invalid IDs, and missing auth", async () => {
    for (const method of ["PUT", "DELETE"]) {
      await request(`/posts/${postId}/rsvp`, { method, token: a.token, status: 400 });
      await request(`/posts/${new Types.ObjectId()}/rsvp`, { method, token: a.token, status: 404 });
      await request("/posts/invalid/rsvp", { method, token: a.token, status: 400 });
      await request(`/posts/${eventId}/rsvp`, { method, status: 401 });
    }
    await request(`/posts/${new Types.ObjectId()}`, { token: a.token, status: 404 });
    await request("/posts/invalid", { token: a.token, status: 400 });
  });

  await check("Upload requires login", () => request("/uploads/image", { method: "POST", body: multipart(), status: 401 }));
  await check("Upload rejects missing file and wrong field", async () => {
    await request("/uploads/image", { method: "POST", token: a.token, body: multipart(null), status: 400 });
    await request("/uploads/image", { method: "POST", token: a.token, body: multipart(png(), "image/png", "wrong"), status: 400 });
  });
  await check("Upload rejects MIME spoofing and unsupported files", async () => {
    await request("/uploads/image", { method: "POST", token: a.token, body: multipart(Buffer.from("fake")), status: 400 });
    await request("/uploads/image", { method: "POST", token: a.token, body: multipart(Buffer.from("<svg/>"), "image/svg+xml"), status: 400 });
  });
  await check("Upload rejects file larger than 5 MB", () => request("/uploads/image", { method: "POST", token: a.token,
    body: multipart(Buffer.alloc(5 * 1024 * 1024 + 1)), status: 413 }));
  await check("Real Cloudinary upload returns secure URL", async () => {
    const upload = await request("/uploads/image", { method: "POST", token: a.token, body: multipart(), status: 201 });
    uploadedUrl = upload.imageUrl; imageOwner = a.accountId;
    assert.ok(uploadedUrl.startsWith(`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/`));
  });
  await check("Uploaded image is publicly accessible as image bytes", async () => {
    const response = await fetch(uploadedUrl, { signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200); assert.match(response.headers.get("content-type"), /^image\//);
    assert.ok((await response.arrayBuffer()).byteLength > 0);
  });
  await check("Image URL saved in MongoDB and returned through feed", async () => {
    const post = await request("/posts", { method: "POST", token: a.token, body: { text: `${run} photo`, imageUrl: uploadedUrl }, status: 201 });
    posts.push(new Types.ObjectId(post._id));
    assert.equal((await db.collection("posts").findOne({ _id: posts.at(-1) })).imageUrl, uploadedUrl);
    assert.equal((await request("/posts", { token: b.token })).find(p => p._id === post._id).imageUrl, uploadedUrl);
  });
  await check("Profile avatar saves and appears with event attendees", async () => {
    await request("/profiles/me", { method: "PATCH", token: b.token, body: { avatarUrl: uploadedUrl } });
    const detail = await request(`/posts/${eventId}`, { token: a.token });
    assert.equal(detail.event.attendees.find(p => p._id === b.profileId).avatarUrl, uploadedUrl);
    assert.equal((await db.collection("profiles").findOne({ _id: profiles[1] })).avatarUrl, uploadedUrl);
    await request("/profiles/me", { method: "PATCH", token: b.token, body: { avatarUrl: "javascript:alert(1)" }, status: 400 });
  });

  let meetupId;
  const times = [new Date("2026-11-01T20:00:00Z"), new Date("2026-11-01T21:00:00Z")];
  const meetupPath = `/circles/${circleId}/meetups`;
  await check("Empty meetup list for a new circle", async () => {
    assert.deepEqual(await request(meetupPath, { token: a.token }), []);
  });
  await check("Meetup creation and listing require login and membership", async () => {
    await request(meetupPath, { status: 401 });
    await request(meetupPath, { method: "POST", body: {}, status: 401 });
    await request(meetupPath, { token: outsider.token, status: 403 });
    await request(meetupPath, { method: "POST", token: outsider.token, body: { location: "BSC", proposedTimes: [times[0].toISOString()] }, status: 403 });
  });
  await check("Invalid meetup circle IDs and missing circles rejected", async () => {
    await request("/circles/bad/meetups", { token: a.token, status: 400 });
    await request(`/circles/${new Types.ObjectId()}/meetups`, { token: a.token, status: 404 });
  });
  await check("Invalid meetup fields rejected without writes", async () => {
    for (const body of [
      {}, { location: "  ", proposedTimes: [times[0].toISOString()] },
      { location: "BSC", proposedTimes: [] }, { location: "BSC", proposedTimes: ["invalid"] },
      { location: "BSC", proposedTimes: ["2026-11-01T12:00:00"] },
      { location: "BSC", proposedTimes: ["2026-02-30T12:00:00Z"] },
      { location: "BSC", proposedTimes: [times[0].toISOString(), "2026-11-01T12:00:00-08:00"] },
      { location: "BSC", proposedTimes: Array(4).fill(times[0].toISOString()) },
      { location: "x".repeat(201), proposedTimes: [times[0].toISOString()] },
    ]) await request(meetupPath, { method: "POST", token: a.token, body, status: 400 });
    assert.equal(await db.collection("meetups").countDocuments({ circle: circles[0] }), 0);
  });
  await check("Create meetup through API, ignore injected circle/votes, verify persistence", async () => {
    const created = await request(meetupPath, { method: "POST", token: a.token, body: {
      location: "  Live Test BSC  ", proposedTimes: [times[1].toISOString(), "2026-11-01T12:00:00-08:00"],
      circle: new Types.ObjectId().toString(), votes: [{ profile: outsider.profileId, time: times[0].toISOString() }],
    }, status: 201 });
    meetupId = new Types.ObjectId(created._id); meetups.push(meetupId);
    assert.equal(created.circle, circleId); assert.equal(created.location, "Live Test BSC");
    assert.deepEqual(created.votes, []);
    assert.deepEqual(created.proposedTimes, times.map(time => time.toISOString()));
    const stored = await db.collection("meetups").findOne({ _id: meetupId });
    assert.equal(String(stored.circle), circleId);
    assert.equal(stored.location, "Live Test BSC");
    assert.ok(stored.proposedTimes[0] instanceof Date);
  });
  await check("Second member lists newly created meetup and zero vote counts", async () => {
    const listed = await request(meetupPath, { token: b.token });
    assert.equal(listed.length, 1); assert.equal(listed[0]._id, String(meetupId));
    assert.deepEqual(listed[0].voteCounts.map(v => v.count), [0, 0]);
  });
  await check("Outsider and invalid proposed-time votes denied", async () => {
    await request(`/meetups/${meetupId}/vote`, { method: "PUT", token: outsider.token, body: { time: times[0].toISOString() }, status: 403 });
    await request(`/meetups/${meetupId}/vote`, { method: "PUT", token: a.token, body: { time: "bad" }, status: 400 });
  });
  await check("Real MongoDB vote pipeline prevents duplicate concurrent votes", async () => {
    await Promise.all(Array.from({ length: 5 }, () => request(`/meetups/${meetupId}/vote`, { method: "PUT", token: a.token, body: { time: times[0].toISOString() } })));
    assert.equal((await db.collection("meetups").findOne({ _id: meetupId })).votes.length, 1);
    await request(`/meetups/${meetupId}/vote`, { method: "PUT", token: a.token, body: { time: times[1].toISOString(), profileId: b.profileId } });
    const stored = await db.collection("meetups").findOne({ _id: meetupId });
    assert.equal(stored.votes.length, 1); assert.equal(String(stored.votes[0].profile), a.profileId);
    assert.equal(stored.votes[0].time.toISOString(), times[1].toISOString());
  });
  await check("Two members vote and meetup listing reflects current totals", async () => {
    await request(`/meetups/${meetupId}/vote`, { method: "PUT", token: b.token, body: { time: times[0].toISOString() } });
    const listed = await request(meetupPath, { token: a.token });
    assert.equal(listed[0].votes.length, 2);
    assert.deepEqual(listed[0].voteCounts.map(v => v.count), [1, 1]);
  });
  await check("Meetup lists are scoped to the requested circle", async () => {
    const id = new Types.ObjectId(); circles.push(id);
    await db.collection("circles").insertOne({ _id: id, name: "Live Test Other Circle", members: [profiles[0]], candidateMembers: [], sharedInterests: [], sharedAvailability: [] });
    assert.deepEqual(await request(`/circles/${id}/meetups`, { token: a.token }), []);
  });
  await check("Frontend assets accessible without embedded Cloudinary secrets", async () => {
    for (const path of ["/", "/feed.js", "/matching.js"]) {
      const response = await fetch(`${origin}${path}`); assert.equal(response.status, 200);
      const source = await response.text();
      if (process.env.CLOUDINARY_API_SECRET) assert.ok(!source.includes(process.env.CLOUDINARY_API_SECRET));
    }
  });
}

async function cleanup() {
  if (db) {
    // IDs are captured only from this run's newly created records.
    await db.collection("messages").deleteMany({ circle: { $in: circles } });
    await db.collection("meetups").deleteMany({ _id: { $in: meetups } });
    await db.collection("circles").deleteMany({ _id: { $in: circles } });
    await db.collection("posts").deleteMany({ _id: { $in: posts } });
    await db.collection("profiles").deleteMany({ _id: { $in: profiles } });
    await db.collection("accounts").deleteMany({ _id: { $in: accounts }, email: { $regex: `^${run}-` } });
  }
  if (uploadedUrl) {
    const path = decodeURIComponent(new URL(uploadedUrl).pathname);
    const publicId = path.split("/image/upload/")[1]?.replace(/^v\d+\//, "").replace(/\.[^.]+$/, "");
    assert.ok(publicId?.startsWith(`broncocircle/posts/${imageOwner}/`), "Refusing to delete an unexpected Cloudinary asset");
    cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
    const deletion = await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true, timeout: 30000 });
    assert.ok(["ok", "not found"].includes(deletion.result));
  }
}

try { await main(); }
catch (error) {
  if (!results.some(result => !result.passed)) {
    results.push({ name: "Live test setup/execution", passed: false, error: error.name });
    console.error(`Live test stopped (${error.name}). Check server availability and backend configuration.`);
  }
  process.exitCode = 1;
}
finally {
  try { await check("Clean up only this run's records and uploaded image", cleanup); }
  catch { process.exitCode = 1; }
  if (db) await db.client.close();
  await writeFile(new URL("../live-test-report.json", import.meta.url), JSON.stringify({ run, timestamp: new Date().toISOString(), results }, null, 2));
  console.log(`${results.filter(r => r.passed).length}/${results.length} checks passed. Report: live-test-report.json`);
}
