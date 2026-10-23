# BroncoCircle

CPP community app. See [project.md](project.md) for the idea.

- `frontend/` ? reserved for the frontend.
- `backend/server.js` ? starts Express.
- `backend/routes/` ? two files defining profile and post URLs.
- `backend/controllers/` ? two files returning sample data.

## Run

Install Node.js 22 or newer, then:

```sh
cd backend
npm install
npm start
```

Open these URLs:

- http://localhost:3000/api/health
- http://localhost:3000/api/profiles
- http://localhost:3000/api/posts

`import` loads code from another file or package. Routes connect URLs to
controllers; controllers send the response. Data is just sample arrays.

## MongoDB (optional)

From `backend/`, copy the example config in PowerShell:

```powershell
Copy-Item .env.example .env
```

Set `MONGODB_URI` in `.env` to your local MongoDB or Atlas connection string,
then run `npm start`. Local MongoDB must be running; for Atlas, allow your IP
and use your database user's credentials. `.env` is ignored by Git.

`db.js` connects to the `MiniHacks` database. The server prints
`MongoDB connected` when the connection succeeds. Without a URI, it skips
MongoDB. An invalid connection stops startup. Profiles and posts still return
sample arrays; saving data comes later.

Connection string help: [MongoDB setup guide](https://www.mongodb.com/docs/drivers/node/current/get-started/).

## Models

`backend/models/` contains `Profile.js`, `Post.js`, `Circle.js`, `Message.js`,
and `Meetup.js`. They use the collections `profiles`, `posts`, `circles`,
`messages`, and `meetups` in `MiniHacks`.

`connection.js` shares the existing client from `db.js`; `index.js` exports
the models. Startup attaches them after `connectDB()` without changing `db.js`.
In a controller, use `import { Profile } from "../models/index.js"` and
`await Profile.find()` to read profiles. Current routes still use sample arrays.

Profile `availability` and circle `sharedAvailability` are arrays of
`{ day, start, end }` (for example, Thursday, `12:00`, `13:00`). IDs use MongoDB
ObjectIds. Meetups have `proposedTimes` as dates and `votes` as
`{ profile, time }`. Arrays default to empty; a meetup needs at least one proposed
time. Names, major, text, location, and individual reference fields are required
where applicable. References do not check whether a linked record exists.
