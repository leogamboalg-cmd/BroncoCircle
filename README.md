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
