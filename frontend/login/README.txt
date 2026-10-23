BRONCOCIRCLE — SEPARATE LOGIN / SIGNUP SCREEN

Only new files inside frontend/login/ are needed. Existing pages, backend,
models, routes, styles, and package files do not need to be edited.

OPEN THE PAGE
Run your existing backend with MongoDB configured, then open:
http://localhost:3000/login/
The current Express server already serves the frontend folder, including
this new subfolder. Opening the HTML directly previews the design only.

ACCOUNT FLOW
Both Log in and Sign up ask only for email and password. No school ID.
POST /api/auth/login sends { email, password }.
POST /api/auth/signup sends { name, email, password }.
The initial account name is the email text before @, capped at 100 characters,
because the existing API requires it. The existing profile-setup screen
collects the person's chosen profile name and major separately.

Successful signup creates a real account through the existing MongoDB API.
This page does not create a second database or change the account model.
Passwords are sent to the existing backend and are never saved by this page.
The returned token is saved in sessionStorage as broncocircle-token, matching
the existing frontend/feed.js. After authentication, the page opens the
existing frontend/index.html, where profile setup/feed logic continues.

CONNECT IT TO OTHER PAGES
Your teammate can link any entry button to /login/.
To change the page opened after login, edit afterAuth in LOGIN_CONFIG at
the top of login.js. The default ../index.html resolves to /index.html.
Keep the page on the API's origin: the current backend does not enable CORS.

FILES TO PUSH
frontend/login/index.html
frontend/login/login.css
frontend/login/login.js
frontend/login/background.svg
frontend/login/assets/ (local fonts, favicon, and font licenses)
frontend/login/README.txt

No external images, libraries, build step, or font requests are required.
The background is an original SVG drawing; the logo and fonts match the
existing BroncoCircle pages. The asset folder includes the font licenses.

DATABASE REQUIREMENT AND TEST SCOPE
The API needs a configured MongoDB connection to create and authenticate
accounts. A frontend preview alone cannot create an account. Browser checks
use controlled HTTP responses to verify request bodies, error handling,
token storage, navigation, accessibility, and narrow-screen layout. A live
MongoDB account round-trip must be tested against your configured backend.
