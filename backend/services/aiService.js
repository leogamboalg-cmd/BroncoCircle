import ollama from "ollama";

const MODEL = "llama3.2:1b";

export async function askAI(prompt, { json = false, localOnly = false } = {}) {
  if (typeof prompt !== "string" || !prompt.trim()) {
    throw new Error("A non-empty prompt is required.");
  }

  if (!localOnly && process.env.AI_RELAY_URL) {
    const url = new URL(process.env.AI_RELAY_URL);
    if (url.protocol !== 'https:' || url.username || url.password || !process.env.AI_RELAY_TOKEN) throw new Error('Configure an HTTPS AI relay URL and token.');
    const response = await fetch(new URL('/generate',url), {
      method:'POST', signal:AbortSignal.timeout(28000),
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.AI_RELAY_TOKEN}`},
      body:JSON.stringify({prompt:prompt.trim(),json})
    });
    if (!response.ok) throw new Error('Laptop AI relay is unavailable.');
    const data=await response.json();
    if(typeof data.response!=='string') throw new Error('Invalid AI relay response.');
    return data.response.trim();
  }

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
