import assert from "node:assert/strict";
import { DEMO_PASSWORD, matchingFixtures } from "./matchingFixtures.js";

const origin = `http://127.0.0.1:${process.env.PORT || 3000}`;

async function request(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${origin}/api${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  return { status: response.status, data };
}

async function login(key) {
  const response = await request("/auth/login", { method: "POST", body: {
    email: `${key}@matching-demo.example`, password: DEMO_PASSWORD,
  } });
  assert.equal(response.status, 200, `${key} login failed (${response.status})`);
  assert.ok(response.data.token, `${key} login did not return a token`);
  return response.data.token;
}

try {
  const alex = await login("alex");
  const jordan = await login("jordan");
  const casey = await login("casey");
  console.log("PASS: Alex, Jordan, and Casey can log in.");

  const fixtures = matchingFixtures();
  const candidateIds = fixtures.filter(f => ["alex", "jordan", "sam", "taylor"].includes(f.key)).map(f => String(f.profile._id));
  const accepted = await request("/circles", { method: "POST", token: alex, body: { candidateIds } });
  assert.equal(accepted.status, 200, `Accept circle failed (${accepted.status})`);
  const circleId = accepted.data._id;
  assert.ok(circleId);
  const joined = await request(`/circles/${circleId}/join`, { method: "POST", token: jordan });
  assert.equal(joined.status, 200, `Jordan join failed (${joined.status})`);
  console.log(`PASS: Alex and Jordan joined circle ${circleId}.`);

  const path = `/circles/${circleId}/messages`;
  const messageText = `[Chat smoke test ${new Date().toISOString()}] Hey! Anyone want to play soccer Thursday?`;
  const sent = await request(path, { method: "POST", token: alex, body: { text: messageText } });
  assert.equal(sent.status, 201, `Send message failed (${sent.status})`);
  const alexId = String(fixtures.find(f => f.key === "alex").profile._id);
  assert.equal(sent.data.author, alexId);
  console.log("PASS: Alex sends a message (201), attributed to Alex's profile.");

  const read = await request(path, { token: jordan });
  assert.equal(read.status, 200);
  const message = read.data.find(m => m._id === sent.data._id);
  assert.ok(message, "Jordan could not read Alex's new message");
  assert.equal(message.text, messageText);
  assert.equal(message.author._id, alexId);
  console.log("PASS: Jordan reads Alex's message (200) with populated author details.");

  assert.equal((await request(path, { token: casey })).status, 403);
  assert.equal((await request(path, { method: "POST", token: casey, body: { text: "Should be denied" } })).status, 403);
  console.log("PASS: Casey cannot read or send messages to this circle (403).");
  assert.equal((await request(path)).status, 401);
  assert.equal((await request(path, { method: "POST", token: alex, body: { text: "   " } })).status, 400);
  console.log("PASS: Missing token is rejected (401); blank message is rejected (400).");
  console.log(`Live chat test passed. Kept test message ${sent.data._id} in circle ${circleId}.`);
  console.log("Demo logins issued new tokens, replacing any previous tokens for Alex, Jordan, and Casey.");
} catch (error) {
  console.error(`Chat test failed: ${error.message}`);
  process.exitCode = 1;
}
