# Caption helper

`aiService.js` exports `suggestCaption(postText)`, which returns a caption string.
It uses the installed Ollama package and local `llama3.2:1b` model. The helper
can be called directly or through `POST /api/ai/caption`.

## Call from Postman

Start the backend with `npm start`, then send a **POST** request to
`http://localhost:3000/api/ai/caption` (or your configured `PORT`). Choose
**Body → raw → JSON**, with `Content-Type: application/json`:

```json
{
  "post": "Studying with friends at the CPP library."
}
```

A successful response is `200` with `{ "caption": "<generated caption>" }`.
Missing, blank, or non-string `post` values return `400` with an `error` field.
If caption generation fails, the endpoint returns `503` with an `error` field.
The route does not save a post or caption to the database.

## Local model setup and direct usage

Make sure the Ollama app is running. Download the model once:

```sh
ollama pull llama3.2:1b
```

Then run this from `backend/`:

```sh
node --input-type=module -e "import { suggestCaption } from './services/aiService.js'; console.log(await suggestCaption('Studying with friends at the CPP library.'));"
```

It prints one caption. A connection error means Ollama needs to be started
(open the Ollama app or run `ollama serve`). A model-not-found error means
you need to run the pull command above.

Package docs: https://github.com/ollama/ollama-js
