# Post images

## Setup

Install backend dependencies with `npm install`. Put these credentials in **backend/.env only**, alongside your MongoDB URI:

```dotenv
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Restart with `npm start`. No unsigned preset is required. The server uses Cloudinary's signed Node SDK upload stream; secrets never go to the browser. See the [Cloudinary upload documentation](https://cloudinary.com/documentation/node_image_and_video_upload).

## Browser

Open `http://localhost:3000/` (use your configured PORT if different). Express serves the new plain HTML/JS frontend from `../frontend`, so no separate frontend server or CORS setup is needed. `/api/health` and other API endpoints remain available.

Sign up or log in, create your profile if prompted, write a post, and select an optional photo. The page shows a preview. Posting uploads the photo first, then saves the returned URL with the post; feed cards display it. Upload failure preserves your draft and prevents publishing. Removing the photo or leaving it unselected creates a text-only post. Text is still required. The token is stored in sessionStorage for this browser tab; logout clears it locally (it does not revoke the server session).

## Postman

1. Sign up/login and create a profile as described in [identity.md](./identity.md).
2. Send **POST** `http://localhost:3000/api/uploads/image` with **Authorization → Bearer Token**.
3. Choose **Body → form-data**. Add key `image`, change its type from Text to **File**, and select a JPEG, PNG, or WebP file up to 5 MB. Let Postman set multipart Content-Type and boundary automatically.
4. Expect **201** with `{ "imageUrl": "https://res.cloudinary.com/..." }`.
5. Send **POST /api/posts**, raw JSON, with the same bearer token:

```json
{
  "text": "Lunch with friends!",
  "imageUrl": "PASTE_THE_RETURNED_HTTPS_URL_HERE"
}
```

6. Expect 201. `GET /api/posts` includes `imageUrl`. Refresh the browser and restart the backend to check persistence.
7. Repeat without `imageUrl` to check text-only posts.

Missing/unsupported files return 400, files over 5 MB return 413, missing/invalid tokens return 401, and accounts without profiles return 403. Missing Cloudinary configuration returns 503; provider failures return 502 without leaking raw provider errors. SVG and remote URL uploads are not accepted by the upload endpoint. File signatures are checked locally and Cloudinary validates the actual image contents.

## Design and verification

`Post.imageUrl` is optional and must use HTTPS on the configured Cloudinary cloud's image-upload delivery path. The backend does not fetch client-provided URLs. Returned URLs are public image URLs, not access-controlled media. URL validation restricts the delivery cloud but does not prove which account uploaded a URL. Each upload uses a server-selected account folder and generated asset ID.

Files are kept in memory with a 5 MB limit and streamed to Cloudinary, with a 30-second SDK timeout. Uploading and post creation are separate operations: abandoning a draft or failing to save a post can leave an unused Cloudinary asset. Automatic asset cleanup and upload rate limits are follow-up work before a public launch.

Run `node --test tests/auth.test.js tests/identity.test.js tests/uploads.test.js`. Tests mock Cloudinary and database operations, covering upload success, validation, size limits, auth, provider errors, URL validation, and optional image posts. A real Cloudinary/MongoDB round trip requires your credentials and running database; it is not covered by these mocked tests.
