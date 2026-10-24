import { askAI } from "../services/aiService.js";
import { recommendEvents } from '../services/eventRecommendations.js';

export function getAIStatus(req,res) {
  return res.json({relayUrlConfigured:Boolean(process.env.AI_RELAY_URL),relayKeyConfigured:Boolean(process.env.AI_RELAY_TOKEN)});
}

export async function findPlans(req,res) {
  const query=req.body?.query, events=req.body?.events;
  if(typeof query!=='string' || !query.trim() || query.length>500 || !Array.isArray(events) || events.length>50) {
    return res.status(400).json({error:'Enter a request up to 500 characters and at most 50 events.'});
  }
  return res.json(await recommendEvents(query.trim(),events,prompt=>askAI(prompt,{json:true})));
}

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
