BRONCOCIRCLE — CAMPUS EVENT PROFILE

LIVE APP
From the repository's backend/ folder, run npm install and npm start, then open
http://localhost:3000/discover.html. Configure backend/.env with MongoDB first.
Sign up or sign in, create your profile, and make an event. Events, RSVPs,
saved plans, comments, and profile edits use your account on the backend.
The event form accepts an optional JPEG, PNG, or WebP photo up to 5 MB with
preview/removal. Configure Cloudinary in backend/.env to enable uploads.
Photos are stored in Cloudinary; the event stores the returned image URL.
Use Edit profile to choose your own profile photo, preview it, or remove it.
Save profile stores the photo URL on your account's profile. Without a photo,
the live app shows your initials instead of a shared default portrait.
Follow people from their profile or a real event post. The Following tab
shows plans from people you follow. Profile counts show followers/following.
Use Refresh or return to the browser tab to get other users' latest updates.
Times are Pacific regardless of the device's timezone. The Find students &
events link uses real API records and opens student profiles and shared plans.
See backend/website-api.md for the API contract and test instructions.

STATIC PREVIEW
Opening the files directly or on GitHub Pages shows a labeled local demo.
GitHub Pages does not run the backend. Demo data stays separate from accounts.
The sections below describe that static preview.

Open index.html for the profile or discover.html for the campus feed in a
modern browser. No installation, framework, API key, or build step is required.
Keep the assets folder beside the source files.
For the best browser features, serve this folder with any local web server.

FILES
index.html  Page structure and accessible dialogs
styles.css  Responsive layout, green/gold palette, and local fonts
app.js      Sample events, filters, RSVP, saving, forms, and calendar export
api.js      Shared API client, session token, and Pacific time conversion
live.js     Live login, profiles, events, RSVP, saves, comments, and refresh
discover.html  Home/discover feed, using the same header and shared profile styles
discover.css   Feed layout and responsive cards
discover.js    Expandable invites, friends/saved feeds, and browser-saved comments
assets/     Included photography, fonts, and favicon

WHAT WORKS
- Three-column image grid on desktop and phone
- Expandable event details; Escape or click outside to close
- RSVP/cancel, live capacity counts, and full-event handling
- Hosting, Going, and Saved tabs
- Hobby filters, text search, and date/capacity sorting
- Create an event and edit the profile
- Share sample-event links and download calendar invitations
- Browser storage remembers profile edits, RSVPs, saved events, and new plans
- The Home icon opens Discover; the green profile icon returns to the profile
- Discover includes hobby/search filters, expandable invites, RSVP, and comments
- Saved events and RSVPs carry between Discover and the profile

CUSTOMIZE
Edit sampleEvents near the top of app.js to change the demo events.
Edit the default profile in loadState() to change the starting name and bio.
Edit the color variables at the top of styles.css to adjust the palette.
Replace assets/teamphoto.jpeg with your own profile photo.
To reset the demo, clear this site's localStorage in your browser.

DEMO SCOPE
Names, dates, attendance, locations, and profile statistics are sample content.
This is a front-end demo. Each browser has its own saved data; custom events
and RSVPs are not shared across users. Real campus accounts, shared events,
notifications, reliable capacity enforcement, and uploads require a backend.
Event times and exported calendar invitations use America/Los_Angeles time.
The demo can be opened offline; clipboard sharing may require localhost/HTTPS.

ASSET CREDITS
Photography: Unsplash (https://unsplash.com), used under the Unsplash license.
These images are illustrative and do not depict actual campus events.
Bowling: Anderson Schmig — https://unsplash.com/photos/IayJpfDhj7E
Hiking: Adria Sanchez Roque — https://unsplash.com/photos/wbYDAnrVnMg
Pool: Alexis Rodriguez — https://unsplash.com/photos/riwX1n2UC3k
Other image source IDs are listed in assets/credits.txt.
Fonts: DM Sans and Manrope, distributed under the SIL Open Font License.
Font license texts are included with the assets.
