BRONCOCIRCLE — CAMPUS EVENT PROFILE

Open index.html for the profile or discover.html for the campus feed in a
modern browser. No installation, framework, API key, or build step is required.
Keep the assets folder beside the source files.
For the best browser features, serve this folder with any local web server.

FILES
index.html  Page structure and accessible dialogs
styles.css  Responsive layout, green/gold palette, and local fonts
app.js      Sample events, filters, RSVP, saving, forms, and calendar export
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
Replace assets/avatar.jpg with your own square portrait.
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
