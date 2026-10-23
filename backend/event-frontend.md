# Live event page

The backend-served app in `frontend/` now links event posts to `/event.html?id=POST_ID`. This page loads actual event details through the API and offers RSVP/cancel, attendance counts, remaining spots, attendee names/photos, a cover image, category, and host note. The separate `broncocircle/` visual mockup is unchanged.

Run `npm start`, open `http://localhost:3000/`, and log in. Event posts have a title link in the feed. Existing text posts, photo uploads, and matching keep their behavior. Create event posts with Postman using [events.md](./events.md); adding an event-creation form is separate work.

Opening an event link while logged out offers a login/profile link. After login/profile setup, the page returns to the event. Times display in the campus timezone, America/Los_Angeles. **Refresh details** retrieves attendance changes made by other users. Full events disable new RSVPs; existing attendees can still cancel. If another user takes the last spot while a page is open, a rejected RSVP refreshes availability and shows the error instead of pretending the user joined. No polling or WebSocket was added.

## Browser checks

Latest run: **11/11 browser checks passed**, using two temporary accounts against the live API and MongoDB on port 3101. All seven existing backend regression tests also passed. See [browser-test-report.json](./browser-test-report.json).

With the backend running and `.env` configured:

```sh
npm run test:browser
```

The script uses Playwright Core with an existing Chrome or Edge installation (no browser download). Override `BROWSER_PATH` if needed. It creates two temporary accounts/profiles and event/plain posts in MongoDB, then exercises login, navigation, real RSVP/cancel requests, two-user capacity conflicts, refresh persistence, mobile width, safe text rendering, and invalid links. Test records are removed afterward. Results are written to `browser-test-report.json`. It does not modify or rotate existing user/demo accounts.

Backend regression tests remain separate. This browser test covers interaction behavior and a mobile viewport check, not a full visual/accessibility audit or every possible browser.
