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

The model's event IDs are checked against the catalog before returning results.
Descriptions and model explanations are rendered as text. Preferences are
limited to 500 characters. The fallback matches words, not natural-language
scheduling constraints; users should check the displayed Pacific event times.
