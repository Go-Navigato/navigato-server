// Navigato Backend Server
// Node.js + Express proxy for Anthropic API
//
// Setup:
//   npm install express cors node-fetch
//   Set environment variable: ANTHROPIC_API_KEY=sk-ant-...
//   Set environment variable: SESSION_PIN=your-chosen-pin (e.g. "navigato2026")
//   node server.js
//
// Deploy to Render:
//   1. Push this file (and package.json) to a GitHub repo
//   2. Create a new Web Service on render.com pointing to that repo
//   3. Set ANTHROPIC_API_KEY and SESSION_PIN in Render environment variables
//   4. Render will auto-deploy on every push

import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3001;

const API_KEY = process.env.ANTHROPIC_API_KEY;
const SESSION_PIN = process.env.SESSION_PIN || "navigato";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

// ── CORS ──────────────────────────────────────────────────────────────────────
// In production, replace "*" with your actual Netlify URL
// e.g. "https://navigato.netlify.app"
// During initial testing, "*" is fine
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "2mb" }));

// ── PIN verification endpoint ─────────────────────────────────────────────────
app.post("/api/verify-pin", (req, res) => {
  const { pin } = req.body;
  if (!pin) return res.status(400).json({ error: "Pin required" });
  if (pin === SESSION_PIN) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: "Incorrect PIN" });
  }
});

// ── Main chat proxy endpoint ──────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { pin, system, messages, max_tokens, tools } = req.body;

  // PIN check on every request — simple stateless auth
  if (!pin || pin !== SESSION_PIN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!API_KEY) {
    return res.status(500).json({ error: "API key not configured on server" });
  }

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array required" });
  }

  try {
    const body = {
      model: MODEL,
      max_tokens: max_tokens || 1100,
      messages,
    };
    if (system) body.system = system;
    if (tools) body.tools = tools;

    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Anthropic API error"
      });
    }

    res.json(data);

  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: "Server error: " + err.message });
  }
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", model: MODEL });
});

app.listen(PORT, () => {
  console.log(`Navigato server running on port ${PORT}`);
});
