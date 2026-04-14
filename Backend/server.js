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
