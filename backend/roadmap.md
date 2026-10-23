# Backend roadmap: get one demo working

Prioritize this flow from `../project.md`: **choose/create a profile → find a circle → join → send a message → vote on a meetup**. Finish that before expanding the feed. Time estimates below are rough planning budgets, not measured completion times; stop adding features when rehearsal time starts.

## What exists today

| Area | Current state |
| --- | --- |
| Express | JSON parsing; root and `/api/health` endpoints. Health currently reports that the server is up, not database or AI readiness. |
| Database | `db.js` connects to `MiniHacks`; models share its MongoDB client. Missing URI skips connection; an invalid configured URI stops startup. |
| Profiles | `GET /api/profiles` returns two hardcoded profiles with numeric IDs. No create/update endpoint. |
| Feed | `GET /api/posts` returns two hardcoded posts. The Mongoose Post schema supports likes, comments, and optional events, but routes do not use it. |
| Circles, messages, meetups | Schemas exist; no routes or controllers yet. No matching implementation. |
| AI | `POST /api/ai/generate` accepts `{ "prompt": "..." }`, returns `{ "response": "..." }`, and calls local Ollama `llama3.2:1b`. Invalid prompts return 400; AI failures return 503. It receives no profile/database context automatically. |
| Documentation / checks | `services/README.md` still describes the old caption helper and route. No test script in `package.json`. |

## P0: unblock the demo (about 2–3 hours)

### 1. Confirm startup, database, and frontend contract (15–20 minutes)

- [ ] Start MongoDB and the backend; confirm a model can actually read and write through the shared client. Do not assume startup logs prove model operations work.
- [ ] Use MongoDB for the demo data; seed 6–8 profiles with overlapping availability and interests. Make rerunning the seed safe, without deleting unrelated data.
- [ ] Agree with the frontend on string `_id` values instead of the current numeric `id`/`authorId` samples. Seeded documents and references must use real ObjectIds.
- [ ] Use a frontend development proxy, or configure CORS for its actual origin if it calls the backend directly. Postman does not test browser CORS.
- [ ] For a time-limited local demo, select a seeded profile as the current user. Treat this as demo identity only; it does not provide authentication.

Done when: the frontend can load profiles from MongoDB and use one consistent profile ID in requests.

### 2. Make profiles usable (20–30 minutes)

- [ ] Replace the sample array in `controllers/profiles.js` with `Profile.find()`.
- [ ] Add `POST /api/profiles` for `{ name, major, interests, availability }`.
- [ ] Validate day/time inputs enough for matching: consistent day labels, `HH:mm` strings, and start before end. Keep availability within one day for this demo.
- [ ] Whitelist accepted fields and return 400 for invalid input. Check referenced records where needed; Mongoose `ref` does not enforce their existence.

Done when: a new profile persists after restarting the backend.

### 3. Find and join one circle (40–50 minutes)

- [ ] Add `GET /api/circles/suggestions?profileId=...`. Return candidate member IDs, shared interests, shared availability, and a short reason. Suggestions do not enroll anyone.
- [ ] Match with code: shared interests plus an actual common time interval. Convert times to minutes; a common interval exists when the latest start is earlier than the earliest end on the same day. Recheck the interval across the whole group, not only pairs.
- [ ] Aim for the brief's 4–6 members with seeded data. Return an empty list and a clear no-match state when a valid group is unavailable.
- [ ] Add `POST /api/circles` to save a chosen suggestion with the selecting profile as the initial joined member. Recompute shared fields on the server using the candidate profiles; do not trust client-computed overlaps. Keep suggested profiles separate from joined members.
- [ ] Add `POST /api/circles/:id/join` with `{ profileId }`; prevent duplicate membership with `$addToSet`. Add `GET /api/circles/:id` to display joined members.
- [ ] Keep suggestions deterministic. A short template such as “You share soccer and Thursday 12:00–13:00” is sufficient.

Done when: one user creates a circle from a suggestion, a second user joins it, and both see the saved membership. For the demo, use the existing profile selector to represent the second user.

### 4. Add basic group chat (20–30 minutes)

- [ ] Add `GET /api/circles/:id/messages` and `POST /api/circles/:id/messages` with `{ author, text }`.
- [ ] Verify the circle and author exist and the author is a member before accepting a message.
- [ ] Poll from the frontend every few seconds. Return a bounded recent history sorted chronologically; skip WebSockets for now.

Done when: a message sent on one browser/device appears on the other.

### 5. Save a meetup and vote (25–35 minutes)

- [ ] Add `POST /api/circles/:id/meetups` with `{ location, proposedTimes }` and `GET /api/circles/:id/meetups`.
- [ ] Use a small fixed list of CPP locations and 1–3 proposed times. Send ISO timestamps with a timezone offset.
- [ ] Add `PUT /api/meetups/:id/vote` with `{ profileId, time }`. Allow only circle members and proposed times; replace that profile's existing vote rather than appending duplicates. Make the update atomic so retries cannot add duplicate votes.
- [ ] Display vote totals; a manually chosen winning time is enough for the demo. Skip calendar integrations.

Done when: two members can vote and see the same totals after refreshing.

## P1: finish only after the core flow works

| Order | Task | Budget / completion target |
| --- | --- | --- |
| 1 | Connect one useful AI action | 15–20 min. Use the existing generate endpoint for an icebreaker or a short explanation of a match already verified by code. Keep matching/joining usable if Ollama is unavailable. |
| 2 | Fix AI documentation and bound requests | 10–15 min. Update `services/README.md` to `/api/ai/generate`, `prompt`, `response`, and `askAI`. Add a prompt length limit and request cancellation/timeout so the UI does not wait indefinitely. Warm the model before presenting. |
| 3 | Wire the feed if it is visible in the demo | 30–45 min. Replace `GET /api/posts` samples with database reads; add `POST /api/posts` accepting `{ author, text, event? }`. Return author display data and newest posts first with a small result limit. |
| 4 | Add likes and comments | 20–30 min. Suggested routes: `PUT /api/posts/:id/likes` and `DELETE /api/posts/:id/likes` with `{ profileId }`, plus `POST /api/posts/:id/comments` with `{ author, text }`. Use `$addToSet`/`$pull` for likes and validate referenced profiles. |

If the team has committed to a **feed-first demo**, promote the two feed tasks above circle matching and defer chat/meetup work. Keep the same rule: complete one visible flow before starting another.

## Reserve the final 30–45 minutes for rehearsal

- [ ] Save a Postman collection with profile creation, suggestions, circle creation/joining, messaging, meetup creation/voting, and AI generation.
- [ ] Run the entire flow after restarting the backend. Confirm persisted data and valid references.
- [ ] Check malformed IDs and invalid bodies return JSON 400 responses; missing records return 404; unavailable database/AI services produce useful errors rather than hanging requests. Make malformed JSON errors consistent too.
- [ ] Try joining twice and voting twice; verify no duplicate member or vote is created.
- [ ] Test from the real frontend and a second browser/device. On another device, `localhost` refers to that device; use the backend computer's reachable address and confirm network access.
- [ ] Start Ollama, pull `llama3.2:1b` ahead of time, and rehearse one real AI call. Keep a visible “AI unavailable” state so the rest of the demo remains usable.
- [ ] Freeze features and prepare seeded data for a repeatable presentation.

## Defer under the current time limit

Full authentication, real-time sockets, notifications, communities, class chats, sophisticated recommendation models, automatic scheduling, and a large test suite. Authentication, authorization, privacy controls, moderation, and abuse protection become required work before opening this beyond a controlled demo. Avoid database migrations or a connection-layer rewrite unless the first model read/write check exposes a blocker.

**If less than an hour remains:** use seeded profiles and one pre-seeded circle/meetup; implement persistent messages and voting, connect the UI, then rehearse. Label matching as a preview if it is not implemented. Leave the feed read-only and keep AI as an optional action.
