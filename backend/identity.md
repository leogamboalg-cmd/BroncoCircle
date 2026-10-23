# Account-linked experiences

Each request follows bearer token → Account → Profile → posts/circles/messages/votes. `requireAccount` sets `req.account`; `requireProfile` loads `req.profile` using the account ID. Client-supplied account/author/profile IDs cannot change the acting user. Profile creation is separate from signup because it requires a major.

## Postman: create your profile

After signup/login, set **Authorization → Bearer Token** to your returned token. Send **POST** `http://localhost:3000/api/profiles`, raw JSON:

```json
{
  "name": "Alex",
  "major": "Computer Science",
  "interests": ["soccer"],
  "availability": [{ "day": "Thursday", "start": "12:00", "end": "13:00" }]
}
```

The backend assigns `account` from your token. Duplicate profile creation returns 409. `GET /api/profiles/me` reads your profile; `PATCH /api/profiles/me` edits only your name, major, interests, and availability. Both return 404 if setup is incomplete. Other endpoints requiring a profile return 403 until you create one.

## Endpoints (all require a bearer token)

| Request | Body / behavior |
| --- | --- |
| `GET /api/profiles` | Up to 100 profiles; account references excluded. |
| `POST /api/posts` | `{ "text": "Anyone free for lunch?" }`; optional `event` with title, location, dateTime. Author is your profile. |
| `GET /api/posts` | Shared feed, newest first, up to 50 posts, including author display data. |
| `GET /api/posts?mine=true` | Only your posts. |
| `POST /api/posts/:id/comments` | `{ "text": "Count me in!" }`; author is your profile. |
| `PUT /api/posts/:id/likes` | Adds your profile once; no body needed. |
| `DELETE /api/posts/:id/likes` | Removes your like; no body needed. |
| `GET /api/circles` | Only circles containing your profile. |
| `GET /api/circles/:id/messages` | Latest 50 messages in chronological order; members only. |
| `POST /api/circles/:id/messages` | `{ "text": "Hello!" }`; members only, author is your profile. |
| `PUT /api/meetups/:id/vote` | `{ "time": "2026-11-01T20:00:00Z" }`; must match a proposed time and belong to the circle. Atomically replaces your existing vote. |

Posts, circles, messages, and votes require a linked profile as well as a token. AI retains its current behavior. Circle creation/joining and meetup creation are still future work; these endpoints use existing circle/meetup documents with real profile references.

## Existing data and indexes

Profile has a required `account` ObjectId referencing Account. A partial unique index enforces one linked profile per account while permitting legacy seed profiles with no account. Profile creation explicitly ensures this index because automatic indexing is disabled. Existing profiles are not automatically assigned by name/email; each account creates its own profile. No data is deleted or reassigned. Conflicting old indexes or duplicate account links must be resolved before index creation can succeed.

## Verification

Run `node --test tests/auth.test.js tests/identity.test.js`. The tests use mocked database operations and check profile isolation, ignored impersonation fields, membership denial, and identity on posts/comments/likes/messages/votes. Live MongoDB persistence, unique-index behavior, and the vote aggregation pipeline still need an integration check against your configured database.
