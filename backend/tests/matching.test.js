import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { Types } from "mongoose";
import { suggestGroups, summarizeGroup } from "../services/matchingService.js";
import Profile from "../models/Profile.js";
import Account from "../models/Account.js";
import Circle from "../models/Circle.js";
import circles from "../routes/circles.js";

function person(n, start = "12:00", end = "13:00", interests = ["Soccer"]) {
  return { _id: new Types.ObjectId(n.toString(16).padStart(24, "0")), name: `Student ${n}`, major: "CS",
    account: new Types.ObjectId(), matchingEnabled: true, interests,
    availability: [{ day: "Thursday", start, end }] };
}

test("matching requires group-wide interests and 30-minute overlap", async () => {
  const current = person(1);
  assert.equal(suggestGroups(current, [person(2, "14:00", "15:00")]).length, 0);
  assert.equal(suggestGroups(current, [person(2, "12:31", "14:00")]).length, 0);
  assert.equal(suggestGroups(current, [person(2, "12:30", "14:00")])[0].overlapMinutes, 30);
  assert.equal(suggestGroups(current, [person(2, "12:00", "13:00", ["gaming"])]).length, 0);
  const first = person(2, "12:00", "12:45"), second = person(3, "12:30", "13:00");
  assert.equal(summarizeGroup([current, first, second]).overlapMinutes, 0);
  const all = [2, 3, 4, 5, 6, 7, 8].map(n => person(n));
  const groups = suggestGroups(current, all);
  assert.ok(groups.length <= 5);
  assert.equal(groups[0].members.length, 6);
  assert.equal(groups[0].smallGroup, false);
  assert.deepEqual(groups, suggestGroups(current, [...all].reverse()));
  assert.equal(new Set(groups.map(g => [...g.candidateIds].sort().join(":"))).size, groups.length);
  assert.equal(suggestGroups(current, [person(2)])[0].smallGroup, true);
  const duplicates = person(9, "12:00", "13:00", [" Soccer ", "soccer"]);
  duplicates.availability.push({ day: "thursday", start: "12:15", end: "13:30" });
  assert.deepEqual(summarizeGroup([current, duplicates]), {
    sharedInterests: ["soccer"], sharedAvailability: [{ day: "Thursday", start: "12:00", end: "13:00" }], overlapMinutes: 60,
  });
  assert.equal(summarizeGroup([current, person(2, "bad", "13:00")]).overlapMinutes, 0);
  const profile = new Profile({ ...person(10), availability: [{ day: "Thursday", start: "13:00", end: "12:00" }] });
  await assert.rejects(profile.validate(), /End must be after start/);
});

test("suggestions, acceptance, and joining use authenticated identity and explicit consent", async t => {
  const people = [person(1), person(2), person(3), person(4)];
  let current = people[0], saved, lastQuery;
  t.mock.method(Account, "findOne", async () => ({ _id: current.account }));
  t.mock.method(Profile, "findOne", async () => current);
  t.mock.method(Profile, "find", query => {
    lastQuery = query;
    const values = people.filter(p => p.matchingEnabled && (query._id.$in
      ? query._id.$in.some(id => String(id) === String(p._id)) : String(p._id) !== String(current._id)));
    return { select() { return this; }, sort() { return this; }, limit: async () => values,
      then: resolve => Promise.resolve(values).then(resolve) };
  });
  t.mock.method(Circle, "createIndexes", async () => {});
  t.mock.method(Circle, "findOneAndUpdate", async (query, update) => {
    if (!saved) saved = { _id: new Types.ObjectId(), ...update.$setOnInsert, members: [] };
    if (!saved.members.some(id => String(id) === String(update.$addToSet.members))) saved.members.push(update.$addToSet.members);
    return saved;
  });
  t.mock.method(Circle, "findById", async () => saved);
  t.mock.method(Circle, "findByIdAndUpdate", async (id, update) => {
    if (!saved.members.some(member => String(member) === String(update.$addToSet.members))) saved.members.push(update.$addToSet.members);
    return saved;
  });
  const app = express(); app.use(express.json()); app.use("/circles", circles);
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  async function request(path, body, token = "a".repeat(64)) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/circles${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }
  assert.equal((await request("/suggestions", undefined, null)).status, 401);
  const result = await request("/suggestions");
  assert.equal(result.status, 200);
  assert.equal(lastQuery.matchingEnabled, true);
  assert.equal(result.body.suggestions[0].members[0].account, undefined);
  assert.equal((await request("", { candidateIds: ["bad"] })).status, 400);
  const candidateIds = people.map(p => String(p._id));
  assert.equal((await request("", { candidateIds, members: candidateIds })).status, 200);
  assert.equal(saved.members.length, 1);
  assert.equal(String(saved.members[0]), String(people[0]._id));
  await request("", { candidateIds });
  assert.equal(saved.members.length, 1);
  current = person(8);
  assert.equal((await request(`/${saved._id}/join`, {})).status, 403);
  current = people[1]; current.matchingEnabled = false;
  assert.equal((await request("/suggestions")).status, 400);
  assert.equal((await request(`/${saved._id}/join`, {})).status, 400);
  assert.equal((await request("", { candidateIds })).status, 409);
  current.matchingEnabled = true;
  assert.equal((await request(`/${saved._id}/join`, { profileId: people[2]._id })).status, 200);
  assert.equal(saved.members.length, 2);
  assert.ok(saved.members.some(id => String(id) === String(current._id)));
  people[2].availability = [];
  assert.equal((await request(`/${saved._id}/join`, {})).status, 409);
});
