# Find My Circle

Matching uses deterministic code, not Ollama. Identity comes from the bearer token.

## Try it

1. Restart the backend and open `http://localhost:3000/`. Log in and create a profile if needed.
2. In **Find My Circle**, enter interests, add free-time blocks, check the opt-in box, and save.
3. Repeat with another account in a separate browser/tab. Use four accounts for a full group. Example: all include `soccer` and Thursday `12:00`–`13:00`.
4. Click **Find matches / refresh**, then **Accept & join**. Only you join; the other candidates receive an invitation.
5. Log in as another candidate, refresh, and join under **Invitations**. Accepted members appear under **My circles**.

Existing accounts default to opted out. No fake profiles are created. Groups of two or three are explicitly labeled as small groups; no compatible users produces a no-match message.

## Algorithm

- Trim and lowercase interests, and remove duplicates. Synonyms are not inferred.
- Use weekly campus-local availability. Merge overlapping/adjacent blocks on each day so duplicate blocks do not inflate overlap.
- Require at least one interest shared by the entire group and a continuous common slot of at least 30 minutes for everyone. Touching endpoints are not overlap. Overnight blocks must be split across days.
- Try each compatible candidate as a seed; greedily add compatible people up to six. Rank additions by shared-interest count, then total shared minutes. Deduplicate groups and rank results by group size, then interests, then minutes, with stable profile-ID tie-breaks.
- Return up to five groups from at most 100 opted-in, account-linked candidates ordered by ID. This bounded demo heuristic does not guarantee a globally optimal grouping.
- Explain matches using actual shared interests and a verified common slot. Suggestions return names, majors, and shared time, without account IDs or full individual schedules.

## API and Postman

All endpoints require a bearer token and a linked profile. First send `PATCH /api/profiles/me` for each test account:

```json
{
  "interests": ["soccer", "gaming"],
  "availability": [{ "day": "Thursday", "start": "12:00", "end": "13:00" }],
  "matchingEnabled": true
}
```

| Request | Behavior |
| --- | --- |
| `GET /api/circles/suggestions` | Returns `{ suggestions, message }`; requires opt-in. Suggestions include candidateIds, members, sharedInterests, sharedAvailability, overlapMinutes, smallGroup, and reason. |
| `POST /api/circles` | Accept with `{ "candidateIds": ["yourProfileId", "otherProfileId"] }` copied from a suggestion. Rechecks current opt-in and compatibility; only the caller joins. |
| `GET /api/circles/invitations` | Suggested circles you have not joined. |
| `POST /api/circles/:id/join` | Invited candidates join themselves; no body needed. Rechecks current opt-in and compatibility. |
| `GET /api/circles` | Circles you have actually joined. Member-only messaging endpoints work after joining. |

Repeating acceptance/joining does not duplicate membership. The same candidate set reuses one circle through a unique matchKey index, explicitly created because automatic indexes are disabled. Request bodies cannot enroll another profile.

## Data and limits

`Profile.matchingEnabled` defaults to false. Availability validates weekday names (normalized to title case), `HH:mm` strings, end after start, and up to 21 blocks. Existing invalid blocks are ignored by matching and need fixing before saving.

`Circle.candidateMembers` holds the suggested profiles; `members` holds only accepted profiles. `matchKey` is the sorted candidate ID set. Shared fields are snapshots of the suggested group at acceptance/join time; later profile edits do not automatically update existing circles. Old circles without candidates are not automatically joinable through invitations.

Opting out prevents new suggestions/acceptance but does not remove memberships or old invitations. Circle leaving, blocking/reporting, automatic meetup suggestions, and a chat UI remain separate work. Members can manually create/list meetups and vote; see [meetups.md](./meetups.md). Concurrent profile edits can make snapshots stale because this flow does not use multi-document transactions.

## Verification

Run `node --test tests/auth.test.js tests/identity.test.js tests/uploads.test.js tests/matching.test.js`.

Tests cover normalization, merged intervals, group-wide overlap, the 30-minute boundary, empty results, small groups, group-size limits, deterministic ordering, opt-in, caller-only acceptance, repeated membership, outsider denial, and stale matches. Database operations are mocked; use the steps above to verify MongoDB persistence and index behavior.
