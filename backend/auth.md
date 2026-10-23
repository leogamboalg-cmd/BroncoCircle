# Simple accounts

Requires a connected MongoDB database (`MONGODB_URI` in `.env`). Run `npm start`.

## Postman

Send `POST http://localhost:3000/api/auth/signup` with a raw JSON body:

```json
{
  "name": "Alex",
  "email": "alex@cpp.edu",
  "password": "demo-password-123"
}
```

Signup returns 201 with `{ account, token, expiresAt }`. Email is normalized to lowercase and must be unique; duplicates return 409. Passwords must have 8–128 characters; names must have 1–100 characters. This does not verify email ownership or require a CPP email address.

For login, send `POST /api/auth/login` with `{ "email": "alex@cpp.edu", "password": "demo-password-123" }`. It returns the same response shape. Incorrect credentials return 401.

Copy the token into Postman's **Authorization → Bearer Token** field and call `GET /api/auth/me`. A valid token returns `{ account }`; missing, invalid, or expired tokens return 401. Database failures return 503.

## Protect another route

```js
import { requireAccount } from "../middleware/requireAccount.js";

router.post("/", requireAccount, handler);
// handler can use req.account._id, req.account.name, and req.account.email.
```

Profile, post, circle, message, and vote endpoints now use authentication and account-linked profiles. See [identity.md](./identity.md) for setup, endpoints, and membership checks. AI retains its current behavior.

Passwords use salted scrypt hashes. Tokens are random, expire after seven days, and only their SHA-256 hashes are stored. Logging in replaces the previous token, allowing one active session per account. No JWT secret or additional dependencies are needed. Signup explicitly creates the unique email index because automatic indexes are disabled in this project.

Accounts are stored in `accounts`; `Profile.account` links each profile to its owner. Signup does not create a profile; use `POST /api/profiles` after login. Passwords and token hashes are never included in account responses. This minimal version does not include logout, password reset, email verification, or login rate limiting; add rate limiting and use HTTPS before public deployment.

Run `node --test tests/auth.test.js` for HTTP checks with mocked database operations. These checks do not replace a live MongoDB integration test.
