

import express from "express";
import rateLimit from "express-rate-limit";

const app = express();
const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "20kb" }));
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/index.html");
});

app.use("/api/", rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false
}));

app.post("/api/chat", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(503).json({
      error: "GEMINI_API_KEY is missing in Render settings."
    });
  }

  const message = typeof req.body?.message === "string"
    ? req.body.message.trim()
    : "";

  const language = ["hi-IN", "en-IN", "en-US"].includes(req.body?.language)
    ? req.body.language
    : "en-IN";

  const history = Array.isArray(req.body?.history)
    ? req.body.history.slice(-20)
    : [];

  if (!message || message.length > 4000) {
    return res.status(400).json({
      error: "Send a message under 4,000 characters."
    });
  }

  const contents = history
    .filter(m => m && ["user", "assistant", "model"].includes(m.role)
      && typeof m.content === "string")
    .map(m => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content.slice(0, 4000) }]
    }));

  contents.push({ role: "user", parts: [{ text: message }] });

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: `You are AVI, a helpful mobile voice assistant.
Be clear, concise, friendly, and suitable for spoken replies.
Reply in Hindi when the user writes Hindi or asks for Hindi;
otherwise follow the user's language. Voice locale: ${language}.
Never claim to perform actions unless the client confirms them.`
            }]
          },
          contents,
          generationConfig: { maxOutputTokens: 500 }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", data?.error?.message || response.status);
      return res.status(502).json({
        error: "Gemini request failed. Check API key, quota, and Render logs."
      });
    }

    const reply = (data.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || "")
      .join("\n")
      .trim();

    return res.json({
      reply: reply || "Sorry, I couldn't create a reply this time."
    });
  } catch (error) {
    console.error("Chat endpoint error:", error);
    return res.status(500).json({
      error: "The AI server encountered an error."
    });
  }
});

app.listen(PORT, () => console.log(`AVI running on port ${PORT}`));
