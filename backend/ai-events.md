# Find my next plan

Discover includes a natural-language event finder. It calls the authenticated
`POST /api/ai/recommend-events` endpoint with a request and up to 50 currently
loaded event summaries. No account passwords, emails, or tokens are sent to
the model. Recommendations link to existing event dialogs, including clearly
labeled sample plans. Past and full events are excluded; recommendations do
not create RSVPs or guarantee a spot.

The endpoint uses the existing `askAI` Ollama service (`llama3.2:1b`). The model
must be reachable from the machine running Express. Render cannot reach an
Ollama server on a user's laptop via localhost. If that service is unavailable,
times out, or returns invalid JSON, the UI explicitly shows keyword matches
instead of claiming an AI result. A hosted model connection is still needed
for genuine AI responses on Render.

## Keep the website on Render and run AI on your laptop

1. Keep Ollama running on the laptop with `llama3.2:1b` installed.
2. From `backend/`, run `npm run ai:relay`. This starts a local authenticated
   proxy on port 4010 and creates a private key in `backend/.ai-relay.env`.
   That file is ignored by Git. It is not the MongoDB or login token.
3. In another PowerShell window run:

   ```powershell
   & 'C:\Program Files (x86)\cloudflared\cloudflared.exe' tunnel --url http://127.0.0.1:4010
   ```

4. In Render → your service → Environment add:
   - `AI_RELAY_URL`: the HTTPS `trycloudflare.com` URL printed by cloudflared.
   - `AI_RELAY_TOKEN`: only the value after `AI_RELAY_TOKEN=` in `.ai-relay.env`.
5. Save and deploy the updated main branch. Visitors keep using the Render URL.

Keep the laptop awake, Ollama running, and the relay/tunnel processes open.
If the tunnel restarts, its URL can change: update `AI_RELAY_URL` in Render.
Only the proxy is tunneled, not the raw Ollama port. The key stays on the two
servers and is never included in the website's JavaScript. Removing the two
Render variables restores the original local-Ollama behavior.

The model's event IDs are checked against the catalog before returning results.
Descriptions and model explanations are rendered as text. Preferences are
limited to 500 characters. The fallback matches words, not natural-language
scheduling constraints; users should check the displayed Pacific event times.
