# Live backend checks

Latest run: **66/66 checks passed** against a fresh backend instance on port 3101, actual MongoDB, and actual Cloudinary upload/delivery. The temporary backend instance was used so the user's existing server did not need to be stopped. See [live-test-report.json](./live-test-report.json) for per-check results. Restart the normal backend to load newly added routes.

Start the backend with `npm start`, then in a second terminal run:

```sh
npm run test:live
```

Uses `PORT` (default 3000), MongoDB, and Cloudinary credentials from backend `.env`. The script creates three uniquely named temporary accounts/profiles, exercises requests with their own tokens, and verifies database records directly. It does not log credentials or tokens or rotate your existing demo account sessions.

Checks cover signup/login, hashed passwords/tokens, profile ownership, duplicate accounts/profiles, invalid schedules, matching, invitation/join behavior, repeated concurrent joins, membership access, message persistence, shared/personal feed access, comments, concurrent likes, events, upload auth/type/size errors, real Cloudinary upload, public image download, saved image URL retrieval, invalid/unauthorized votes, concurrent vote updates, and frontend asset serving without the configured secret.

Event checks also cover detail retrieval, optional fields, ignored client-supplied attendees, RSVP identity, concurrent duplicate requests, full events, cancellation, a race for one seat, unlimited legacy events, and profile avatar persistence/population. See [events.md](./events.md).

Meetups are created through `POST /api/circles/:id/meetups` and verified directly in MongoDB. Checks include creation/listing permissions, invalid inputs, empty lists, circle isolation, time normalization, injected-field rejection, and vote totals for two members. An additional empty circle fixture is inserted directly to check list isolation. Image validation uses a generated two-pixel PNG and malformed/oversize fixtures; this is not an exhaustive image format test. Browser interactions, responsiveness, Ollama responses, production load, and persistence across an actual server restart are not tested by this script.

At the end, the script removes only the IDs it created, including test circle messages, and deletes its own Cloudinary asset. Cleanup status is recorded separately. Existing user/demo records remain intact. Interrupting the process can prevent cleanup. The report is overwritten on each run, and the script stops at the first failure rather than claiming that later checks ran.
