import test from "node:test";
import assert from "node:assert/strict";
import { recommendEvents } from "../services/eventRecommendations.js";
const events = [
  {
    id: "games",
    title: "Board games",
    category: "Games",
    description: "Small group for games",
    start: "2030-11-01T20:00:00Z",
    spots: 3,
  },
  { id: "full", title: "Full games", start: "2030-11-01T20:00:00Z", spots: 0 },
  { id: "past", title: "Old games", start: "2020-01-01T20:00:00Z", spots: 3 },
];
test("AI picks only actual upcoming available events and removes invented or duplicate IDs", async () => {
  const response = await recommendEvents(
    "games",
    events,
    async () =>
      JSON.stringify({
        recommendations: [
          { id: "fake", reason: "invented" },
          { id: "full", reason: "full" },
          { id: "games", reason: "A small games group." },
          { id: "games", reason: "duplicate" },
        ],
      }),
    Date.parse("2026-10-23"),
  );
  assert.equal(response.mode, "ai");
  assert.deepEqual(response.recommendations.map((item) => item.id), ["games"]);
  assert.match(response.recommendations[0].reason, /Board games/);
});
test("recommendation reasons stay anchored to the real event instead of mixing in unrelated text", async () => {
  const response = await recommendEvents(
    "soccer",
    [
      {
        id: "soccer",
        title: "Indoor Soccer",
        category: "Sports",
        description: "A small soccer game.",
        location: "BRIC",
        start: "2030-11-01T20:00:00-08:00",
        spots: 5,
      },
    ],
    async () =>
      JSON.stringify({
        recommendations: [
          {
            id: "soccer",
            reason:
              "Hike7v7 outdoor soccer game on 2026-10-24T03:00:00.000Z at Athletic Fields with 14 spots",
          },
        ],
      }),
    Date.parse("2026-10-23"),
  );
  assert.equal(response.mode, "ai");
  assert.match(response.recommendations[0].reason, /Indoor Soccer/);
  assert.doesNotMatch(
    response.recommendations[0].reason,
    /Hike7v7|Athletic Fields/,
  );
});

test("AI failure offers labeled keyword matches and never claims AI success", async () => {
  const response = await recommendEvents(
    "games",
    events,
    async () => {
      throw new Error("offline");
    },
    Date.parse("2026-10-23"),
  );
  assert.equal(response.mode, "keywords");
  assert.equal(response.recommendations.length, 1);
  assert.equal(response.recommendations[0].id, "games");
});
test("relay failures expose only a safe diagnostic code, never the private key", async () => {
  const response = await recommendEvents(
    "games",
    events,
    async () => {
      throw Object.assign(new Error("secret-key-value"), { code: "relay_key" });
    },
    Date.parse("2026-10-23"),
  );
  assert.equal(response.fallbackReason, "relay_key");
  assert.doesNotMatch(JSON.stringify(response), /secret-key-value/);
});
