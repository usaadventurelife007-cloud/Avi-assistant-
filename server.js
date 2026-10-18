
import express from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = "gemini-3.8-flash";

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "20kb" }));
app.use(express.static(process.cwd()));

app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/index.html");
});

app.use("/api/", rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false
}));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf"
    ];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, WEBP images and PDF files are supported."));
    }
  }
});

async function askGemini({ apiKey, message, language, history = [], file }) {
  const contents = history
    .filter(m =>
      m &&
      ["user", "assistant", "model"].includes(m.role) &&
      typeof m.content === "string"
    )
    .slice(-20)
    .map(m => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content.slice(0, 4000) }]
    }));

  const parts = [{
    text: `${message || "Please describe or analyze the attached file."}\nReply in ${language === "hi-IN" ? "Hindi" : "the user's preferred language"}.`
  }];

  if (file) {
    parts.push({
      inline_data: {
        mime_type: file.mimetype,
        data: file.buffer.toString("base64")
      }
    });
  }

  contents.push({ role: "user", parts });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
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
Be friendly, concise, and useful.
Reply in Hindi when the user writes Hindi or asks for Hindi.
For uploaded images, describe and analyze what is visible.
For uploaded PDFs, summarize and answer questions using the document.
Never claim to perform actions you did not perform.`
          }]
        },
        contents,
        generationConfig: { maxOutputTokens: 700 }
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("Gemini API error:", data?.error?.message || response.status);
    throw new Error("Gemini request failed. Check the API key, model access, quota, and Render logs.");
  }

  return (data.candidates?.[0]?.content?.parts || [])
    .map(part => part.text || "")
    .join("\n")
    .trim() || "Sorry, I couldn't create a reply this time.";
}

function getLanguage(value) {
  return ["hi-IN", "en-IN", "en-US"].includes(value) ? value : "en-IN";
}

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

  if (!message || message.length > 4000) {
    return res.status(400).json({
      error: "Send a message under 4,000 characters."
    });
  }

  try {
    const reply = await askGemini({
      apiKey,
      message,
      language: getLanguage(req.body?.language),
      history: Array.isArray(req.body?.history) ? req.body.history : []
    });

    return res.json({ reply });
  } catch (error) {
    console.error("Chat endpoint error:", error.message);
    return res.status(502).json({
      error: "AVI could not get a reply. Check the Gemini API key, model access, quota, and Render logs."
    });
  }
});

app.post("/api/upload-chat", (req, res) => {
  upload.single("file")(req, res, async (uploadError) => {
    if (uploadError) {
      return res.status(400).json({ error: uploadError.message });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(503).json({
        error: "GEMINI_API_KEY is missing in Render settings."
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "Please select an image or PDF file."
      });
    }

    const message = typeof req.body?.message === "string"
      ? req.body.message.trim().slice(0, 4000)
      : "";

    try {
      const reply = await askGemini({
        apiKey,
        message,
        language: getLanguage(req.body?.language),
        file: req.file
      });

      return res.json({
        reply,
        fileName: req.file.originalname
      });
    } catch (error) {
      console.error("Upload endpoint error:", error.message);
      return res.status(502).json({
        error: "AVI could not analyze this file. Check Gemini model access, API quota, and Render logs."
      });
    }
  });
});

app.use((err, req, res, next) => {
  console.error("Server error:", err.message);
  res.status(500).json({ error: "Unexpected server error." });
});

app.listen(PORT, () => {
  console.log(`AVI running on port ${PORT}`);
});
