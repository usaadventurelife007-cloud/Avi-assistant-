import express from "express";
import rateLimit from "express-rate-limit";

const app = express();
const PORT = process.env.PORT || 3000;
app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));
app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/public/index.html");
});
app.use("/api/", rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false }));

app.post("/api/chat", async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "AI backend needs OPENAI_API_KEY configured on the server." });

  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  const language = ["hi-IN", "en-IN", "en-US"].includes(req.body?.language) ? req.body.language : "en-IN";
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-20) : [];
  if (!message || message.length > 4000) return res.status(400).json({ error: "Send a message under 4,000 characters." });

  const safeHistory = history
    .filter(m => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
    .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        instructions: `You are AVI, a helpful mobile voice assistant. Be clear, concise, friendly, and suitable for spoken replies. Reply in Hindi when the user writes Hindi or asks for Hindi; otherwise follow the user's language. Voice locale: ${language}. Do not claim to have opened apps, accessed private data, or performed actions unless the client explicitly confirms it. If asked to open a website, explain that the app can open supported websites using its local commands.`,
        input: [
          ...safeHistory,
          { role: "user", content: message }
        ],
        max_output_tokens: 500
      })
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("OpenAI API error:", data?.error?.message || response.status);
      return res.status(502).json({ error: "AI provider request failed. Check the server API key, billing, model access, and logs." });
    }
    const reply = (data.output || [])
      .flatMap(item => item.content || [])
      .filter(item => item.type === "output_text")
      .map(item => item.text)
      .join("\n")
      .trim();
    return res.json({ reply: reply || "Sorry, I couldn't create a reply this time." });
  } catch (error) {
    console.error("Chat endpoint error:", error);
    return res.status(500).json({ error: "The AI server encountered an error." });
  }
});

app.listen(PORT, () => console.log(`AVI running on http://localhost:${PORT}`));
