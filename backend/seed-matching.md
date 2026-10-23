# Matching demo data

From `backend/`, run:

```sh
npm run seed:matching
```

Requires `MONGODB_URI` (or `MONGO_URI`) in `.env` and a reachable MongoDB database. Writes to the existing `MiniHacks` database. Creates 11 demo accounts with linked profiles and two text posts with likes/comments. Cloudinary and Ollama are not needed. No circles are pre-created, so you can test the actual suggestion → accept → invitation → join flow.

The seed uses deterministic IDs and insert-only upserts: rerunning does not duplicate records, overwrite edited profiles, reset passwords/tokens, or delete any data. If you change demo preferences, restore them through the profile editor to reproduce the initial expectations below. If the script stops halfway, fix the connection/index issue and rerun. Demo email/ID conflicts cause an error rather than taking ownership of an existing account.

To validate fixtures and print expected matches **without connecting to MongoDB or writing anything**, run:

```sh
npm run seed:matching -- --preview
```

## Logins and expected results

All newly created demo accounts use password **`BroncoDemo123!`**. Email addresses use the reserved `.example` domain; they are not real students.

| Email | Expected initial result |
| --- | --- |
| `alex@matching-demo.example` | Four-person soccer group: Alex, Jordan, Sam, Taylor; Thursday 12:30–13:00. |
| `jordan@matching-demo.example` | Same soccer group. |
| `sam@matching-demo.example` | Same soccer group. |
| `taylor@matching-demo.example` | Same soccer group. |
| `casey@matching-demo.example` | Small gaming group with Morgan; Friday 15:30–16:00. |
| `morgan@matching-demo.example` | Same small gaming group. |
| `avery@matching-demo.example` | Soccer interest but wrong day; no demo match. |
| `riley@matching-demo.example` | Available at the same time but no shared interest; no demo match. |
| `quinn@matching-demo.example` | Soccer but less than 30 minutes of overlap; no demo match. |
| `jamie@matching-demo.example` | Matching opted out; excluded despite compatible interests/time. |
| `drew@matching-demo.example` | No availability; no demo match. |

These expectations describe the demo profiles alone. Other opted-in profiles in your database can change actual suggestions. The seed prints a demo-only preview from saved demo profiles after seeding, so existing edits are reflected.

## Test in browser or Postman

1. Start the backend with `npm start` and open `http://localhost:3000/`.
2. Log in as Alex and click **Find matches / refresh**. Demo profiles already have preferences and matching consent set, except Jamie.
3. Accept the soccer group. Only Alex should appear as joined.
4. Log in as Jordan in a separate browser/tab, refresh invitations, and join. Confirm both appear under My circles. Use the returned circle ID with the existing message endpoints if desired.
5. Try Casey for the small-group case, Avery for no match, and Jamie for the opt-out case.

For Postman, `POST /api/auth/login` with raw JSON:

```json
{ "email": "alex@matching-demo.example", "password": "BroncoDemo123!" }
```

Copy `token` into **Authorization → Bearer Token**, call `GET /api/circles/suggestions`, then send one suggestion's `candidateIds` to `POST /api/circles`:

```json
{ "candidateIds": ["COPY_IDS_FROM_THE_SUGGESTION"] }
```

Use Jordan's own token to call `GET /api/circles/invitations` and `POST /api/circles/:id/join`. Never reuse Alex's token to act as Jordan.

Run `node --test tests/matchingFixtures.test.js` for an offline check of the expected groups and schema validation. This does not test live database writes. These known-password accounts are for development/demo use; remove or disable them before using this database publicly.
