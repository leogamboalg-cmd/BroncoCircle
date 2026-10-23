import { askAI } from "../services/aiService.js";

export async function generateAIResponse(req, res) {
  const prompt = req.body?.prompt;

  if (typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "Please provide a prompt." });
  }

  try {
    const response = await askAI(prompt);
    return res.json({ response });
  } catch (error) {
    console.error("AI request failed:", error);
    return res.status(503).json({
      error:
        "Could not get an AI response. Make sure Ollama is running and llama3.2:1b is installed.",
    });
  }
}
