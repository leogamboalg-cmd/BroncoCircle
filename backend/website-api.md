# API support for broncocircle/

Express serves `../broncocircle/`. The website detects `/api/health` and uses
authenticated API calls for login/profile setup, event creation, RSVP, saves,
comments, and student/event search when served by Express. Refresh retrieves
updates from other users, as does returning to the tab. There is no background
polling or realtime connection. Tokens stay in sessionStorage for the tab.

Sign-in and signup use the teammate's existing `frontend/login/` page at
`/login/`. Its HTML, CSS, JavaScript, and assets are unchanged. The main app
reuses its `broncocircle-token` session and collects profile details after
signup. A same-origin return location takes users back to their selected plan
or Discover after authentication. There is no second login popup.

Direct-file previews, GitHub Pages, and servers without the API show a labeled
local demo. Demo plans and browser state are never copied into real accounts.
GitHub Pages alone cannot run Express or MongoDB; shared events require the
backend host. The current client uses same-origin `/api` requests.

All endpoints below require a bearer token from `/api/auth/login` or signup.
Post endpoints and friend-list changes also require the account's profile.
Never send the demo's event IDs to the API: use the MongoDB `_id` returned when
an event is created. API IDs are not the sample slugs such as `bowling-night`.

## Profile and student search

`POST /api/profiles` creates a profile; `PATCH /api/profiles/me` edits it.
Supported fields: `name`, `major`, `handle`, `bio`, `pronouns`, `interests`,
`availability`, `matchingEnabled`, and `avatarUrl`. Map the UI's hobbies to
`interests`. Profile creation still requires a major, which the demo edit form
does not collect. Handles accept letters, numbers, underscores, and periods
(up to 30 characters); handles are display names, not unique login identifiers.

`GET /api/profiles/me` returns your private saved event and friend ID lists.
`GET /api/profiles?q=coffee` searches name, handle, bio, and interests (up to 100
profiles). `GET /api/profiles/:id` loads another student's profile. Public list
and detail responses omit account IDs, saved events, and friend lists.

`PUT /api/profiles/:id/friend` adds a profile to your private Friends feed list;
`DELETE` removes it. This is a one-way list, not mutual friendship or a friend
request system. Both operations are idempotent. Lists cannot be overwritten
through profile create/edit requests.

## Create events

Use `POST /api/posts`. This preserves the existing post/event schema rather
than creating another event collection.

| Website field | API field |
| --- | --- |
| title | event.title |
| category/hobby | event.category |
| location | event.location |
| description/details | text |
| date + start | event.dateTime (ISO timestamp with explicit Pacific offset) |
| date + end | event.endTime (ISO timestamp with explicit Pacific offset) |
| capacity | event.capacity |
| note | event.hostNote |
| image (local asset basename) | event.image |
| imageAlt | event.imageAlt |
| cost | event.cost |

For example:

```json
{
  "text": "Bring your favorite board game.",
  "event": {
    "title": "Friday night games",
    "category": "Games",
    "location": "BSC Games Room",
    "dateTime": "2026-11-06T16:00:00-08:00",
    "endTime": "2026-11-06T18:00:00-08:00",
    "capacity": 8,
    "hostNote": "All levels welcome!",
    "image": "bowling",
    "cost": "Free to join",
    "includeHost": true
  }
}
```

Send `event.includeHost: true` for the form's "Total spots, including you"
behavior. The host is then included atomically when the post is created.
Omitting it preserves the older zero-attendee behavior. Clients cannot inject
other attendees or authors. Counts always come from stored RSVPs, not from the
demo's `count` field. End time must be after start time. Capacity is a positive
integer, or null for unlimited attendance.

Allowed local image names: bowling, billiards, indoorsoccer, hike, coffee, pool,
art, basketball, guitar, photography, picnic. Use the app's `imageSrc` helper to
resolve teammate assets and extensions; legacy bowling/coffee names map to
billiards.png. Uploaded cover photos use the
existing top-level `imageUrl` from `POST /api/uploads/image` instead.

The live create-event form includes an optional file picker with preview and
removal. It accepts JPEG/PNG/WebP up to 5 MB, uploads the selected file before
creating the event, and stores the returned URL on the post. An upload error
preserves the draft and prevents event creation. Retrying a failed event save
reuses the uploaded URL until the photo is changed/removed or the form closes.
Without a selected photo, the hobby image remains the default. Cloudinary must
be configured in `backend/.env`; provider secrets never go into the website.

## Tabs, event actions, and comments

`GET /api/posts?view=discover|hosting|going|saved|friends` loads the corresponding
event feed. With no `view`, existing text/photo posts remain included. `mine=true`
is still supported. Optional `author=PROFILE_ID`, `category=Games`, and `q=coffee`
filter results. Event search matches description, title, location, and category;
student search is separate. Search is literal and capped at 200 characters.
Feeds return the newest 50 matching posts; full pagination is not implemented.
The UI can sort these results by event time or remaining spots.

`GET /api/posts/:id` returns details. Feed/detail responses include `isHost`, `isSaved`, and
`isFriend`; events also include `isGoing`, `attendeeCount`, `spotsRemaining`,
populated author, attendees, and comment authors. Profile metadata now includes
handles, and the host includes a bio. Existing category, note, image URL, and
date fields remain available.

- RSVP/cancel: `PUT` / `DELETE /api/posts/:id/rsvp`.
- Save/unsave: `PUT` / `DELETE /api/posts/:id/save`. Only events can be saved.
- Comment: `POST /api/posts/:id/comments` with `{ "text": "See you there!" }`.
- Like/unlike: `PUT` / `DELETE /api/posts/:id/likes`.

RSVP, saves, and friend list updates are idempotent and operate on the logged-in
profile. RSVP capacity enforcement remains atomic. Calendar downloads and share
links are browser features and do not need new database models. The current UI
does not offer event editing/deletion, so no such endpoints were added.

## Checks

Run `node --test --test-isolation=none tests/*.test.js` from `backend/`.
The website contract tests use mocked persistence to verify model validation,
identity protection, event field retention, feed filters, saves, and friend
lists. API-client tests verify Pacific time and session handling; UI-script
tests exercise two sessions against an isolated API fixture with a minimal
DOM stand-in. These do not prove a live MongoDB deployment or browser layout.

`npm run test:website` exercises signup, profile setup, failed-draft recovery,
two-user events/RSVP/comments, saved plans, search, sign-in/out, mobile width,
and static preview mode in installed Chrome/Edge against an isolated API
fixture. It needs browser-process permission. `BROWSER_PATH` can select another
installed Chromium executable. It does not read `.env` or create database data.
