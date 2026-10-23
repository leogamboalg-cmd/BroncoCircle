import ollama from "ollama";

const MODEL = "llama3.2:1b";

export async function askAI(prompt) {
  if (typeof prompt !== "string" || !prompt.trim()) {
    throw new Error("A non-empty prompt is required.");
  }

  const result = await ollama.chat({
    model: MODEL,
    messages: [{ role: "user", content: prompt.trim() }],
    options: {
      temperature: 0.7,
    },
  });

  return result.message.content.trim();
}
