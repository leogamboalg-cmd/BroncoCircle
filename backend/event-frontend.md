# Event website

The website lives in `broncocircle/`, served by `backend/server.js`.
Run `npm start` from `backend/`, then open `http://localhost:3000/discover.html`.

Sign in and create a profile to publish events, upload a cover photo, RSVP,
save plans, or comment. Event details open in a dialog and support shared links.
Use Refresh or return to the tab to load other users' changes. Times are Pacific.

See [website-api.md](./website-api.md) for the API contract and current checks.
`npm run test:browser` (also `npm run test:website`) runs the current site's
browser checks against an isolated API fixture without touching MongoDB.
It requires permission to launch installed Chrome/Edge.

The historical `scripts/testEventBrowser.js` and `browser-test-report.json`
describe the retired interface and are not used by the current test commands.
