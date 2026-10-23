# Event posts and RSVPs

Restart the backend to load the new routes. All requests require your bearer token and a linked profile. Events use the existing Post model; no separate event collection is needed.

## Create an event

**POST** `http://localhost:3000/api/posts`, **Body → raw → JSON**:

```json
{
  "text": "Grab a coffee and meet other Broncos.",
  "event": {
    "title": "Coffee, campus & catch-ups",
    "location": "BSC café patio",
    "dateTime": "2026-11-01T12:00:00-08:00",
    "endTime": "2026-11-01T13:30:00-08:00",
    "capacity": 6,
    "category": "Coffee & Connection",
    "hostNote": "Look for the green notebook. First-timers welcome!"
  }
}
```

Add the existing `imageUrl` from `/api/uploads/image` at the top level for a cover photo. The post author is the host; `text` is the description. Text-only posts and existing events with only title/location/dateTime continue to work.

`endTime` is optional and must be after `dateTime`. `capacity` is optional: omit it or use null for unlimited spots; otherwise use a positive integer. It counts all RSVPs. Send `event.includeHost: true` to include the authenticated host when creating an event, matching the website's "including you" label; by default the host is not automatically attending. `category` is optional (up to 80 characters), and `hostNote` is optional (up to 500). Other attendee IDs are never copied from a creation request.

The API also supports local cover image names, cost text, saved events, private Friends lists, profile handles/bios, and event feed filters. See [the broncocircle website API contract](./website-api.md) for field mappings and endpoints. The Express-served website now calls these endpoints; static previews remain a separate browser-local demo.

## Details, RSVP, cancel

| Request | Result |
| --- | --- |
| `GET /api/posts/:id` | Full post with host, attendee names/photos, comments, and your RSVP state. Works for regular posts too. |
| `PUT /api/posts/:id/rsvp` | RSVP as yourself; no body needed. |
| `DELETE /api/posts/:id/rsvp` | Cancel your own RSVP; no body needed. |

Event responses include top-level `attendeeCount`, `spotsRemaining` (null for unlimited), and `isGoing`. `event.attendees` contains profiles with `_id`, `name`, and optional `avatarUrl`. Feed responses include the same event information. Creation returns the saved post; use the details endpoint to retrieve populated profiles and calculated counts.

Repeated RSVP/cancel calls are safe. Atomic capacity checks prevent simultaneous requests from overbooking. Existing attendees can repeat RSVP even when full. A full event returns **409**, RSVP on a regular post returns **400**, missing posts return **404**, malformed IDs return **400**, and missing/invalid login tokens return **401**. Requests cannot RSVP or cancel on behalf of another user. Authenticated profiles can RSVP to a public feed event without circle membership.

## Profile photo

Upload a photo through the existing `POST /api/uploads/image`. Send **PATCH /api/profiles/me** with `{ "avatarUrl": "RETURNED_IMAGE_URL" }`. The URL must be an HTTPS image delivery URL in the configured Cloudinary cloud. Host, commenter, and attendee responses include avatarUrl when present. Set it to null to remove it.

## Quick Postman test

1. Log in as Alex, create an event, and copy the post `_id`.
2. GET the post: expect zero attendees and `isGoing: false`.
3. PUT the RSVP endpoint: expect one attendee and `isGoing: true`.
4. Repeat PUT: the count must stay at one.
5. Log in as Jordan and RSVP with Jordan's token. For capacity 1, expect 409 until Alex cancels.
6. DELETE with Alex's token, then retry Jordan's RSVP.

`npm run test:live` exercises real MongoDB RSVP updates, duplicate/concurrent requests, a last-seat race, cancellation, safe field handling, and avatar retrieval. It cleans up only its own test records and uploaded image. The website in `broncocircle/` uses event dialogs, saved plans, and calendar export; see [event-frontend.md](./event-frontend.md). Event edits/deletion and automatic event expiry are not included.
