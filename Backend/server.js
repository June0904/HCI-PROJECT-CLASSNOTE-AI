const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;
const audioDirectory = path.join(__dirname, "audio");

fs.mkdirSync(audioDirectory, { recursive: true });

app.use(cors());
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "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";

app.post("/ai", async (req, res) => {
  const { mode, subjectName, notes, quizType, questionCount } = req.body;

  if (!OPENAI_API_KEY || OPENAI_API_KEY === "your-openai-api-key-here") {
    return res.status(500).json({
      error: "OpenAI API key is not configured. Set OPENAI_API_KEY in Backend/server.js or use an environment variable."
    });
  }

  if (!mode || !subjectName || !notes) {
    return res.status(400).json({ error: "Missing request data for AI generation." });
  }

  const truncatedNotes = notes.length > 15000 ? notes.slice(0, 15000) : notes;
  let systemMessage = {
    role: "system",
    content: "You are a helpful assistant that creates summaries and quiz questions from lecture notes."
  };

  let userMessage;
  if (mode === "summary") {
    userMessage = {
      role: "user",
      content: `Please summarize the following lecture notes for the subject ${subjectName}. Keep the summary concise and student-friendly, using headings or bullet points where helpful. If the notes are short, provide a strong overview and highlight the key concepts.\n\nNotes:\n${truncatedNotes}`
    };
  } else if (mode === "quiz") {
    let typeInstruction = "Create a set of quiz questions.";

    if (quizType === "true_false") {
      typeInstruction = `Create ${questionCount} true or false statements based on the notes, and include an answer key. Keep each question clear and concise.`;
    } else if (quizType === "multiple_choice") {
      typeInstruction = `Create ${questionCount} multiple choice questions based on the notes. Provide 4 answer choices for each question and include an answer key.`;
    } else if (quizType === "identification") {
      typeInstruction = `Create ${questionCount} identification questions based on the notes. Each question should ask the student to identify a term, person, concept, or definition. Include an answer key.`;
    } else if (quizType === "essay") {
      typeInstruction = `Create ${questionCount} short essay prompts based on the notes. Include a brief suggested answer or guidance for each prompt.`;
    }

    userMessage = {
      role: "user",
      content: `Generate a quiz for the subject ${subjectName}. ${typeInstruction} Use the notes below as source material.\n\nNotes:\n${truncatedNotes}`
    };
  } else {
    return res.status(400).json({ error: "Unknown AI mode requested." });
  }

  try {
    const fetchClient = typeof fetch === "function" ? fetch : null;
    if (!fetchClient) {
      return res.status(500).json({
        error: "Server fetch is not available. Please run this server on Node 18+ or add a fetch polyfill."
      });
    }

    const response = await fetchClient("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [systemMessage, userMessage],
        temperature: 0.7,
        max_tokens: 800
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const message = data.error?.message || "OpenAI service returned an error.";
      return res.status(500).json({ error: message });
    }

    const aiResult = data.choices?.[0]?.message?.content?.trim();
    res.json({ result: aiResult || "No result returned from OpenAI." });
  } catch (error) {
    console.error("AI request failed:", error);
    res.status(500).json({ error: error.message || "AI request failed." });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, audioDirectory);
  },
  filename: (req, file, cb) => {
    const originalName = path.basename(file.originalname, path.extname(file.originalname));
    const safeBaseName = originalName.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/-+/g, "-");
    const extension = path.extname(file.originalname) || ".webm";
    cb(null, `${Date.now()}-${safeBaseName || "recording"}${extension}`);
  }
});

const upload = multer({ storage });

app.get("/", (req, res) => {
  res.send("Backend is running");
});

app.get("/health", (req, res) => {
  res.json({ ok: true, audioDirectory });
});

app.post("/audio", upload.single("audio"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  res.json({
    message: "Audio uploaded successfully",
    file: req.file.filename,
    subject: req.body.subject || "Unassigned",
    recordedAt: req.body.recordedAt || null,
    ai: {
      summaryStatus: "pending",
      quizStatus: "pending"
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Audio recordings are saved in ${audioDirectory}`);
});
