const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const audioDirectory = path.join(__dirname, "audio");
const envFilePath = path.join(__dirname, ".env");
const MAX_AUDIO_UPLOAD_SIZE = 25 * 1024 * 1024;

function loadEnvFile(filePath, { overwriteExisting = false } = {}) {
  if (!fs.existsSync(filePath)) return;

  const envLines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of envLines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) continue;

    const separatorIndex = trimmedLine.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmedLine.slice(0, separatorIndex).trim();
    let value = trimmedLine.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && (overwriteExisting || !process.env[key])) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(envFilePath);

fs.mkdirSync(audioDirectory, { recursive: true });

app.use(cors());
app.use(express.json());

function getOpenAIApiKey() {
  loadEnvFile(envFilePath, { overwriteExisting: true });
  return process.env.OPENAI_API_KEY?.trim() || "";
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function parseJsonResponse(response) {
  const rawText = await response.text();

  if (!rawText) {
    return {};
  }

  try {
    return JSON.parse(rawText);
  } catch (error) {
    return { rawText };
  }
}

app.post("/ai", async (req, res) => {
  const { mode, subjectName, notes, quizType, questionCount } = req.body;
  const OPENAI_API_KEY = getOpenAIApiKey();

  if (!OPENAI_API_KEY) {
    return res.status(500).json({
      error: "OpenAI API key is not configured. Add OPENAI_API_KEY to Backend/.env or set it as an environment variable."
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
      typeInstruction = `Create ${questionCount} multiple choice questions based on the notes. Provide exactly 4 distinct answer choices for each question labeled A, B, C, and D, and include an answer key. Do not repeat answer choices within the same question.`;
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

    const response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
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

    const data = await parseJsonResponse(response);

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
const transcriptionUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_AUDIO_UPLOAD_SIZE
  }
});

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

app.post("/transcribe", transcriptionUpload.single("audio"), async (req, res) => {
  const OPENAI_API_KEY = getOpenAIApiKey();
  if (!OPENAI_API_KEY) {
    return res.status(500).json({
      error: "OpenAI API key is not configured. Add OPENAI_API_KEY to Backend/.env or set it as an environment variable."
    });
  }

  if (!req.file) {
    return res.status(400).json({ error: "No audio file uploaded for transcription." });
  }

  try {
    const fileExtension = path.extname(req.file.originalname || "") || ".webm";
    const safeFilename = `recording${fileExtension}`;
    const fileBlob = new Blob([req.file.buffer], {
      type: req.file.mimetype || "audio/webm"
    });

    const formData = new FormData();
    formData.append("file", fileBlob, safeFilename);
    formData.append("model", "whisper-1");
    formData.append("response_format", "json");
    formData.append("language", "en");

    const response = await fetchWithTimeout("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: formData
    }, 60000);

    const data = await parseJsonResponse(response);
    if (!response.ok) {
      return res.status(500).json({
        error: data.error?.message || data.rawText || "OpenAI transcription failed."
      });
    }

    return res.json({
      text: data.text || "",
      duration: req.body.duration || null
    });
  } catch (error) {
    console.error("Transcription request failed:", error);
    return res.status(500).json({
      error: error.name === "AbortError"
        ? "Audio transcription timed out. Please try a shorter recording."
        : (error.message || "Audio transcription failed.")
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Audio recordings are saved in ${audioDirectory}`);
  const key = getOpenAIApiKey();
  console.log(key
    ? `OpenAI API key loaded (ends with ${key.slice(-4)})`
    : "OpenAI API key is not loaded.");
});
