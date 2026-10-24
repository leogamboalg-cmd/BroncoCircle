import ollama from "ollama";

const MODEL = "llama3.2:1b";

export async function askAI(prompt, { json = false, localOnly = false } = {}) {
  if (typeof prompt !== "string" || !prompt.trim()) {
    throw new Error("A non-empty prompt is required.");
  }

  if (!localOnly && process.env.AI_RELAY_URL) {
    const url = new URL(process.env.AI_RELAY_URL);
    if (url.protocol !== 'https:' || url.username || url.password || !process.env.AI_RELAY_TOKEN) throw Object.assign(new Error('Configure an HTTPS AI relay URL and token.'),{code:'relay_configuration'});
    let response;
    try { response = await fetch(new URL('/generate',url), {
      method:'POST', signal:AbortSignal.timeout(28000),
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.AI_RELAY_TOKEN}`},
      body:JSON.stringify({prompt:prompt.trim(),json})
    }); } catch { throw Object.assign(new Error('Laptop AI relay could not be reached.'),{code:'relay_unreachable'}); }
    if (!response.ok) throw Object.assign(new Error('Laptop AI relay is unavailable.'),{code:response.status===401?'relay_key':response.status===429?'ai_busy':'relay_unavailable'});
    const data=await response.json();
    if(typeof data.response!=='string') throw new Error('Invalid AI relay response.');
    return data.response.trim();
  }

  if(!localOnly && process.env.NODE_ENV==='production') throw Object.assign(new Error('Render needs AI_RELAY_URL and AI_RELAY_TOKEN.'),{code:'relay_configuration'});

  const result = await ollama.chat({
    model: MODEL,
    messages: [{ role: "user", content: prompt.trim() }],
    ...(json ? {format:'json'} : {}),
    options: {
      temperature: json ? 0.2 : 0.7,
      num_predict: 300,
    },
  });

  return result.message.content.trim();
}
