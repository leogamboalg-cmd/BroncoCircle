# Publish the connected app

The Node/Express app serves `broncocircle/`, the existing `frontend/login/`
page, and `/api` together. GitHub Pages is a static preview until a live app
URL is configured. Do not put MongoDB or Cloudinary secrets in Pages settings.

## Render

1. Connect Render to this GitHub repository and create a Blueprint from
   `render.yaml` on `main`. Keep the root directory at the repository root;
   the backend needs both website folders outside `backend/`.
2. Enter `MONGODB_URI`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and
   `CLOUDINARY_API_SECRET` in Render's private environment settings. Use the
   MongoDB database already used by this app. A localhost MongoDB connection
   cannot be reached from Render; a hosted MongoDB connection is required.
3. Allow the Render service's outbound addresses in your database's network
   access settings. Deploy and verify `/api/health`, `/login/`, and
   `/discover.html` on the service's HTTPS URL. Test signup/login and creating
   an event with a photo there before enabling the redirect.

The Blueprint uses a free web-service plan. Confirm Render's displayed plan
before creating the service. No database is provisioned by this file.

## Keep the current GitHub Pages link

1. The workflow now defaults to the supplied app URL,
   `https://broncocircle-1.onrender.com`. To change it, set the repository
   variable `LIVE_APP_URL` in Settings → Secrets and variables → Actions → Variables.
2. Run the **Deploy BroncoCircle to GitHub Pages** workflow from Actions, or
   push a website change. Pages Source should remain **GitHub Actions**.
3. Existing Pages links then forward to the connected app, preserving the
   selected page, query string, and event fragment. Tokens are not forwarded;
   users sign in on the live app's origin.

Before publishing, the workflow checks the Render health endpoint, teammate
login, and Discover page. A failed check prevents publishing a broken redirect.
The build script can also produce a static preview with no live app URL.
Login needs the running backend to authenticate.
`deployment.json` on Pages identifies the deployed commit and live target.
To restore static preview mode, remove the workflow's default live URL and
unset the repository variable, then rerun the workflow.

## Local checks

From `backend/`: `node --test --test-isolation=none tests/*.test.js`.
The build checks verify website/login assets and live-link routing without
contacting Render or reading local secrets. Browser checks are available with
`npm run test:website` and require an installed browser and launch permission.
