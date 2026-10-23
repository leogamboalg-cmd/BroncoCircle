import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { Types } from "mongoose";
import Account from "../models/Account.js";
import Profile from "../models/Profile.js";
import Circle from "../models/Circle.js";
import Meetup from "../models/Meetup.js";
import circles from "../routes/circles.js";
import { hashToken } from "../services/authService.js";

test("meetup creation/listing validate input, membership, identity, and vote totals", async t => {
  const member = new Types.ObjectId(), outsider = new Types.ObjectId(), noProfile = new Types.ObjectId();
  const circleId = new Types.ObjectId(), otherCircle = new Types.ObjectId();
  const tokens = new Map([[hashToken("a".repeat(64)), member], [hashToken("b".repeat(64)), outsider], [hashToken("c".repeat(64)), noProfile]]);
  const stored = [];
  t.mock.method(Account, "findOne", async query => tokens.has(query.tokenHash) ? { _id: tokens.get(query.tokenHash) } : null);
  t.mock.method(Profile, "findOne", async query => query.account.equals(noProfile) ? null : { _id: query.account });
  t.mock.method(Circle, "findById", async id => [String(circleId), String(otherCircle)].includes(String(id)) ? { _id: new Types.ObjectId(id), members: [member] } : null);
  t.mock.method(Meetup, "create", async fields => {
    const meetup = new Meetup(fields); await meetup.validate(); stored.push(meetup); return meetup;
  });
  let lastFilter, lastSort, lastLimit;
  t.mock.method(Meetup, "find", filter => {
    lastFilter = filter;
    return {
      sort(value) { lastSort = value; return this; },
      limit(value) { lastLimit = value; return this; },
      async lean() { return stored.filter(m => m.circle.equals(filter.circle)).map(m => m.toObject()); },
    };
  });
  const app = express(); app.use(express.json()); app.use("/circles", circles);
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  async function request(method = "GET", body, token = "a".repeat(64), id = circleId) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/circles/${id}/meetups`, {
      method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }
  assert.equal((await request("GET", undefined, null)).status, 401);
  assert.equal((await request("POST", {}, null)).status, 401);
  assert.equal((await request("GET", undefined, "c".repeat(64))).status, 403);
  assert.equal((await request("GET", undefined, "b".repeat(64))).status, 403);
  assert.equal((await request("POST", {}, "b".repeat(64))).status, 403);
  assert.equal((await request("GET", undefined, undefined, "bad")).status, 400);
  assert.equal((await request("GET", undefined, undefined, new Types.ObjectId())).status, 404);
  assert.deepEqual((await request()).body, []);
  const time = "2026-11-01T20:00:00Z";
  for (const body of [
    {}, { location: "", proposedTimes: [time] }, { location: 42, proposedTimes: [time] },
    { location: "BSC", proposedTimes: [] }, { location: "BSC", proposedTimes: time },
    { location: "BSC", proposedTimes: [null] }, { location: "BSC", proposedTimes: [42] },
    { location: "BSC", proposedTimes: ["tomorrow"] },
    { location: "BSC", proposedTimes: ["2026-11-01T12:00:00"] },
    { location: "BSC", proposedTimes: ["2026-02-30T12:00:00Z"] },
    { location: "BSC", proposedTimes: [time, "2026-11-01T12:00:00-08:00"] },
    { location: "BSC", proposedTimes: Array(4).fill(time) },
    { location: "x".repeat(201), proposedTimes: [time] },
  ]) assert.equal((await request("POST", body)).status, 400, JSON.stringify(body));
  assert.equal(stored.length, 0);
  const created = await request("POST", { location: " BSC ",
    proposedTimes: ["2026-11-01T21:00:00Z", "2026-11-01T12:00:00-08:00"],
    circle: otherCircle, votes: [{ profile: outsider, time }] });
  assert.equal(created.status, 201); assert.equal(created.body.circle, String(circleId));
  assert.equal(created.body.location, "BSC"); assert.deepEqual(created.body.votes, []);
  assert.deepEqual(created.body.proposedTimes, ["2026-11-01T20:00:00.000Z", "2026-11-01T21:00:00.000Z"]);
  stored[0].votes.push({ profile: member, time: stored[0].proposedTimes[1] });
  const listed = await request();
  assert.equal(listed.status, 200); assert.equal(listed.body.length, 1);
  assert.deepEqual(listed.body[0].voteCounts.map(v => v.count), [0, 1]);
  assert.ok(lastFilter.circle.equals(circleId)); assert.deepEqual(lastSort, { _id: -1 }); assert.equal(lastLimit, 50);
  assert.deepEqual((await request("GET", undefined, undefined, otherCircle)).body, []);
  t.mock.method(console, "error", () => {});
  t.mock.method(Meetup, "create", async () => { throw new Error("Database unavailable"); });
  assert.equal((await request("POST", { location: "BSC", proposedTimes: [time] })).status, 503);
  t.mock.method(Meetup, "find", () => { throw new Error("Database unavailable"); });
  assert.equal((await request()).status, 503);
});
