# Backend models

The backend defines six Mongoose models in [`models/`](./models). They use the MongoDB database **`MiniHacks`**. Fields and rules below describe the current schemas.

## Account

Source: [`models/Account.js`](./models/Account.js) · Collection: `accounts`. See [auth.md](./auth.md) for endpoints and middleware usage. Accounts are separate from profiles.

| Field | Type | Rules / meaning |
| --- | --- | --- |
| `name` | String | Required and trimmed. |
| `email` | String | Required, trimmed, lowercased, and uniquely indexed. Signup explicitly ensures the index exists. |
| `passwordHash` | String | Required salted scrypt hash; excluded from queries by default. |
| `tokenHash` | String | SHA-256 hash of the current bearer token; excluded from queries by default. |
| `tokenExpiresAt` | Date | Session expiration; excluded from queries by default. |
| `createdAt` | Date | Defaults to the current time. |

## Profile

Source: [`models/Profile.js`](./models/Profile.js) · Collection: `profiles`

Represents a person, their interests, and when they are available.

`account` is a required ObjectId reference to Account, assigned from the bearer token. A partial unique index enforces one profile per linked account while allowing legacy unlinked seed profiles. See [identity.md](./identity.md).

| Field | Type | Rules / meaning |
| --- | --- | --- |
| `name` | String | Required; surrounding whitespace is trimmed. |
| `major` | String | Required; surrounding whitespace is trimmed. |
| `interests` | String array | Interest names; each entry is required and trimmed. Defaults to `[]`; the array may be empty. |
| `availability` | Availability array | Available time blocks; defaults to `[]`. See the embedded schema below. |

### Availability (embedded schema)

Used by both `Profile.availability` and `Circle.sharedAvailability`. Each entry has no separate `_id`.

| Field | Type | Rules / meaning |
| --- | --- | --- |
| `day` | String | Required and trimmed; day label, such as `Monday`. |
| `start` | String | Required and trimmed; campus-local start time, such as `12:00`. |
| `end` | String | Required and trimmed; campus-local end time, such as `13:00`. |

The schema does not enforce day names, a time format, or that `end` comes after `start`.

## Post

Source: [`models/Post.js`](./models/Post.js) · Collection: `posts`

Represents a community feed post written by a profile, optionally announcing an event.

`imageUrl` is an optional HTTPS Cloudinary image URL returned by `POST /api/uploads/image`. Omitting it keeps text-only posts working; text remains required. See [uploads.md](./uploads.md) for setup and testing.

| Field | Type | Rules / meaning |
| --- | --- | --- |
| `author` | ObjectId → Profile | Required; references the author's profile. |
| `text` | String | Required; surrounding whitespace is trimmed. |
| `createdAt` | Date | Required; defaults to the current time when the document is created. Can be supplied explicitly. |
| `likes` | ObjectId array → Profile | Profiles that liked the post; defaults to `[]`. Use `likes.length` as the like count. Each entry is required; duplicates are not prevented by the schema. |
| `comments` | Comment array | Embedded comments; defaults to `[]`. Each comment gets its own `_id` for identifying it when editing or deleting. |
| `event` | Event object | Optional; omitted by default. Providing it makes the post an event and requires all three event fields below. No separate event `_id` is generated. |

### Comment (embedded schema)

| Field | Type | Rules / meaning |
| --- | --- | --- |
| `author` | ObjectId → Profile | Required; profile that wrote the comment. |
| `text` | String | Required and trimmed; comment body. |
| `createdAt` | Date | Required; defaults to the current time when the comment is created. |

### Event (optional embedded schema)

| Field | Type | Rules / meaning |
| --- | --- | --- |
| `title` | String | Required and trimmed when `event` is provided. |
| `location` | String | Required and trimmed when `event` is provided. |
| `dateTime` | Date | Required when `event` is provided; stores the event's date and time as one value. Supply an ISO 8601 timestamp with a timezone, such as `2026-11-01T18:00:00-08:00`. |

Regular posts omit `event` (or set it to `null`). Event posts still require the top-level `author` and `text`. There is no future-date restriction or separate `isEvent` flag; the presence of event details identifies an event post. Like uniqueness and comment permissions must be handled by application logic.

## Circle

Source: [`models/Circle.js`](./models/Circle.js) · Collection: `circles`

Represents a group of profiles with shared interests and availability.

| Field | Type | Rules / meaning |
| --- | --- | --- |
| `name` | String | Required; surrounding whitespace is trimmed. |
| `members` | ObjectId array → Profile | Group members; each entry is required. Defaults to `[]`; no minimum size or uniqueness rule. |
| `sharedInterests` | String array | Shared interest names; each entry is required and trimmed. Defaults to `[]`. |
| `sharedAvailability` | Availability array | Shared time blocks using the embedded availability schema; defaults to `[]`. |

The schema stores shared interests and availability; it does not calculate them from members.

## Message

Source: [`models/Message.js`](./models/Message.js) · Collection: `messages`

Represents a message sent within a circle.

| Field | Type | Rules / meaning |
| --- | --- | --- |
| `circle` | ObjectId → Circle | Required; circle receiving the message. |
| `author` | ObjectId → Profile | Required; profile that wrote the message. |
| `text` | String | Required; surrounding whitespace is trimmed. |
| `createdAt` | Date | Required; defaults to the current time when the document is created. Can be supplied explicitly. |

The schema does not check that the author belongs to the circle.

## Meetup

Source: [`models/Meetup.js`](./models/Meetup.js) · Collection: `meetups`

Represents a proposed gathering for a circle, including candidate times and votes.

| Field | Type | Rules / meaning |
| --- | --- | --- |
| `circle` | ObjectId → Circle | Required; circle organizing the meetup. |
| `location` | String | Required; surrounding whitespace is trimmed. |
| `proposedTimes` | Date array | Must contain at least one time; each entry is required. Empty arrays fail validation with `Propose at least one time.` |
| `votes` | Vote array | Votes for meetup times; defaults to `[]`. See below. |

### Vote (embedded schema)

Each vote has no separate `_id`.

| Field | Type | Rules / meaning |
| --- | --- | --- |
| `profile` | ObjectId → Profile | Required; person casting the vote. |
| `time` | Date | Required; proposed time they chose. |

The schema does not enforce one vote per profile, circle membership, future dates, or that a vote's `time` appears in `proposedTimes`.

## Shared behavior and relationships

- Every top-level model gets an automatic MongoDB `_id` of type ObjectId. Mongoose also uses its default `__v` version key when documents are saved.
- `ref` fields describe relationships for Mongoose population. They do not automatically load related documents or enforce that referenced documents exist.
- Required strings cannot be empty after trimming. Required array entries do not make their containing array nonempty; only `Meetup.proposedTimes` explicitly requires at least one entry.
- There are no custom model methods, statics, virtuals, or middleware. Account declares a unique email index.
- Automatic timestamps are not enabled. `Account`, `Post`, and `Message` declare `createdAt`; no model declares `updatedAt`.

| Model | References |
| --- | --- |
| Account | None |
| Profile | None |
| Post | `author` → Profile; `likes[]` → Profile; `comments[].author` → Profile |
| Circle | `members[]` → Profile |
| Message | `circle` → Circle; `author` → Profile |
| Meetup | `circle` → Circle; `votes[].profile` → Profile |

## Connection and exports

[`models/connection.js`](./models/connection.js) exports `modelConnection`, `connectModels()`, and `schemaOptions`. `connectModels()` attaches the existing MongoDB client from [`db.js`](./db.js) when it is available and the client connection is disconnected. The models share that client and select `MiniHacks`.

All six top-level schemas use these options:

| Option | Value | Effect |
| --- | --- | --- |
| `autoCreate` | `false` | Mongoose does not automatically create collections on startup. |
| `autoIndex` | `false` | Mongoose does not automatically build indexes on startup. |
| `bufferCommands` | `false` | Model operations are not queued while waiting for a connection. |

[`models/index.js`](./models/index.js) re-exports `connectModels` and the six named models: `Account`, `Profile`, `Post`, `Circle`, `Message`, and `Meetup`.

**Current API:** Profile and post controllers now use MongoDB documents and ObjectId references. Authenticated actions derive the acting profile from the token; see [identity.md](./identity.md).
