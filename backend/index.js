// Small Express backend that queries Google Generative Language (Gemini-like) to predict ETA delays.
// It expects an env var GOOGLE_API_KEY and exposes POST /predict_gemini which accepts:
// { items: [ { scheduled_time: "...", route_length_km: 7.3, weather_rain: 0.0, traffic_index: 0.0 }, ... ] }
// Response: { predictions: [ { predicted_delay_minutes: 2.1 }, ... ] }

import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8000;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";
// The endpoint used here is the Google Generative Language (v1beta2) model endpoint commonly used.
// If your environment needs a different endpoint or model name (e.g., 'gemini-*'), adjust below.
const GEN_API_URL = "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generate";

// Local fallback heuristic (same as frontend's simple rule)
function localPredictItems(items) {
  return items.map(it => {
    let hour = 8;
    try { hour = new Date(it.scheduled_time).getHours(); } catch (e) {}
    const route = Math.max(0, Number(it.route_length_km || 0));
    const rain = Number(it.weather_rain || 0);
    const traffic = Number(it.traffic_index || 0);

    let pred = route * 0.6;
    if (hour >= 7 && hour <= 9) pred += 2.0;
    pred += traffic * 0.8;
    pred += rain * 1.5;
    const minute = new Date(it.scheduled_time).getMinutes();
    const jitter = ((minute % 7) - 3) * 0.2;
    pred = Math.max(0, Math.round((pred + jitter) * 10) / 10);
    return { predicted_delay_minutes: pred };
  });
}

// Build prompt instructing the model to return strict JSON only (array of objects)
function buildPrompt(items) {
  const exampleInput = [
    { scheduled_time: "2025-11-28T08:00:00", route_length_km: 7.3, weather_rain: 0.0, traffic_index: 1.2 }
  ];
  const instruction = `
You are a model that predicts the delay in minutes (a non-negative number) for scheduled bus arrivals.
Input: a JSON array of objects, each containing scheduled_time (ISO 8601), route_length_km (float), weather_rain (float), and traffic_index (float).
Output: return ONLY a JSON array (no extra explanation, no Markdown) of the same length, where each element is an object with a single numeric field "predicted_delay_minutes".

Example:
Input: ${JSON.stringify(exampleInput)}
Output: [{"predicted_delay_minutes": 2.4}]
  
Now produce predictions for this input. Respond with strict JSON only.
Input: ${JSON.stringify(items)}
`;
  return instruction;
}

// Helper to extract JSON from model text output robustly
function extractJsonFromText(text) {
  if (!text || typeof text !== "string") return null;
  // Try to find the first '[' and the last ']' and parse the substring
  const first = text.indexOf("[");
  const last = text.lastIndexOf("]");
  if (first !== -1 && last !== -1 && last > first) {
    const substr = text.slice(first, last + 1);
    try {
      const parsed = JSON.parse(substr);
      return parsed;
    } catch (err) {
      // fall through
    }
  }
  // As fallback, try to parse entire text
  try {
    return JSON.parse(text);
  } catch (err) {
    return null;
  }
}

app.post("/predict_gemini", async (req, res) => {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items must be a non-empty array" });
    }

    // If no API key configured, return local fallback
    if (!GOOGLE_API_KEY) {
      const local = localPredictItems(items);
      return res.json({ predictions: local });
    }

    // Build the prompt
    const promptText = buildPrompt(items);

    // Request body depends on the Generative Language API spec; send a simple prompt request.
    const body = {
      prompt: {
        text: promptText
      },
      // adjust as needed:
      maxOutputTokens: 300,
      temperature: 0.0,
      topP: 0.95
    };

    const resp = await fetch(GEN_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GOOGLE_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      // If model returns non-200, fallback to local predictor but also return a warning
      console.warn("Generative API returned non-OK:", resp.status, await resp.text());
      const local = localPredictItems(items);
      return res.status(200).json({ predictions: local, warning: "Generative API returned error; used local fallback" });
    }

    const genJson = await resp.json();

    // Try to obtain text from a few possible response fields
    let textOutput = null;
    if (genJson?.candidates?.[0]?.content) {
      textOutput = genJson.candidates[0].content;
    } else if (genJson?.candidates?.[0]?.output) {
      textOutput = genJson.candidates[0].output;
    } else if (genJson?.output?.[0]?.content?.[0]?.text) {
      textOutput = genJson.output[0].content[0].text;
    } else if (genJson?.output_text) {
      textOutput = genJson.output_text;
    } else if (typeof genJson === "string") {
      textOutput = genJson;
    } else {
      // Last resort: stringify entire response
      textOutput = JSON.stringify(genJson);
    }

    const parsed = extractJsonFromText(textOutput);
    if (!parsed || !Array.isArray(parsed) || parsed.length !== items.length) {
      // fallback to local predictor if model response not parseable or wrong length
      console.warn("Model output not valid JSON array or length mismatch. modelText:", textOutput);
      const local = localPredictItems(items);
      return res.status(200).json({ predictions: local, warning: "Model output not parseable; used local fallback" });
    }

    // Normalize each element to ensure predicted_delay_minutes present
    const normalized = parsed.map(p => {
      if (p && typeof p.predicted_delay_minutes !== "undefined") {
        return { predicted_delay_minutes: Number(p.predicted_delay_minutes) };
      }
      // if item missing, fallback to local single prediction for that input
      return { predicted_delay_minutes: 0.0 };
    });

    return res.json({ predictions: normalized });
  } catch (err) {
    console.error("predict_gemini error:", err);
    // last-resort fallback
    try {
      const { items } = req.body || {};
      const local = Array.isArray(items) ? localPredictItems(items) : [];
      return res.status(500).json({ predictions: local, warning: "Server error; used local fallback" });
    } catch (e) {
      return res.status(500).json({ error: "Server error" });
    }
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", has_api_key: !!GOOGLE_API_KEY });
});

app.listen(PORT, () => {
  console.log(`ETA Gemini proxy running on port ${PORT} (GEN_API_URL=${GEN_API_URL})`);
});