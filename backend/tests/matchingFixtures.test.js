import test from "node:test";
import assert from "node:assert/strict";
import { matchingFixtures, matchingPostFixtures } from "../scripts/matchingFixtures.js";
import { suggestGroups } from "../services/matchingService.js";
import { Account, Profile, Post } from "../models/index.js";

test("seed data validates and demonstrates positive and negative matching cases", async () => {
  const fixtures = matchingFixtures();
  assert.equal(fixtures.length, 11);
  assert.equal(new Set(fixtures.map(f => String(f.account._id))).size, 11);
  for (const { account, profile } of fixtures) {
    await new Account({ ...account, passwordHash: "placeholder" }).validate();
    await new Profile(profile).validate();
    assert.equal(String(profile.account), String(account._id));
  }
  for (const post of matchingPostFixtures()) {
    await new Post(post).validate();
    assert.ok(fixtures.some(f => String(f.profile._id) === String(post.author)));
  }
  const profiles = fixtures.map(f => f.profile);
  const eligible = profiles.filter(p => p.matchingEnabled);
  const groups = key => suggestGroups(fixtures.find(f => f.key === key).profile, eligible);
  assert.deepEqual(groups("alex")[0].members.map(p => p.name).sort(), ["Alex", "Jordan", "Sam", "Taylor"]);
  assert.deepEqual(groups("alex")[0].sharedAvailability, [{ day: "Thursday", start: "12:30", end: "13:00" }]);
  assert.deepEqual(groups("casey")[0].members.map(p => p.name).sort(), ["Casey", "Morgan"]);
  assert.equal(groups("casey")[0].smallGroup, true);
  for (const key of ["avery", "riley", "quinn", "drew"]) assert.equal(groups(key).length, 0, key);
  assert.ok(groups("alex").every(g => !g.members.some(p => p.name === "Jamie")));
  assert.deepEqual(matchingFixtures(), fixtures);
});
