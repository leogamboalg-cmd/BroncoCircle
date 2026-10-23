# Meetup planning in Postman

Restart the backend with `npm start` to load the new routes. Use a bearer token for an account whose profile has **joined** the circle. An invitation alone does not grant access.

## Create a meetup

**POST** `http://localhost:3000/api/circles/YOUR_CIRCLE_ID/meetups`

Select **Authorization → Bearer Token**, then **Body → raw → JSON**:

```json
{
  "location": "BSC",
  "proposedTimes": [
    "2026-11-01T12:00:00-08:00",
    "2026-11-01T13:00:00-08:00"
  ]
}
```

Returns **201** with the saved meetup, including `_id`, `circle`, trimmed `location`, chronologically sorted `proposedTimes`, and empty `votes`. Copy `_id` for voting. The circle comes from the URL; submitted circle IDs and votes are ignored.

Rules: location must be a nonblank string of at most 200 characters. Provide 1–3 distinct, valid ISO date/time strings with `Z` or an explicit offset. Equivalent timestamps with different offsets count as duplicates. Missing fields, invalid calendar dates, timezone-less values, duplicate times, and too many times return 400. There is no future-date restriction or automatic check against the circle's weekly availability.

## List meetups and vote totals

**GET** `http://localhost:3000/api/circles/YOUR_CIRCLE_ID/meetups`

Returns **200** with an array of up to 50 meetups, newest IDs first; an empty circle returns `[]`. Each meetup includes its votes and `voteCounts`:

```json
{
  "voteCounts": [
    { "time": "2026-11-01T20:00:00.000Z", "count": 1 },
    { "time": "2026-11-01T21:00:00.000Z", "count": 0 }
  ]
}
```

The example above shows just the counts field; the actual response is an array of complete meetup objects. Dates are returned in UTC. Both creation and listing require membership; nonmembers receive 403, missing/invalid tokens receive 401, malformed circle IDs receive 400, and nonexistent circles receive 404. Database failures return 503.

## Vote

With Alex's or Jordan's own token, **PUT** `/api/meetups/YOUR_MEETUP_ID/vote`:

```json
{ "time": "2026-11-01T20:00:00Z" }
```

Returns 200. The time must match a proposed instant. Voting again changes your existing vote; concurrent retries do not create duplicates. Use GET on the circle's meetups again to see updated totals. Outsiders cannot vote or read the circle's meetup list. There is no automatic winner/finalization step yet.

## Tests

`tests/meetups.test.js` covers request validation, membership, circle isolation, date normalization, ignored injected fields, vote counts, and database error responses using mocked database calls.

`npm run test:live` now creates the meetup **through the API**, verifies it directly in MongoDB, lists it as another member, checks outsider denial and invalid input, and submits concurrent votes. It cleans up its temporary records and Cloudinary image. See [live-testing.md](./live-testing.md).
