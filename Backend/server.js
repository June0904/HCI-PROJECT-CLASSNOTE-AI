const express = require("express");
const multer = require("multer");
const cors = require("cors");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// STORAGE (SAVE AUDIO FILES)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + "-" + file.originalname;
        cb(null, uniqueName);
    }
});

const upload = multer({ storage });

// TEST ROUTE
app.get("/", (req, res) => {
    res.send("Backend is running");
});

// AUDIO UPLOAD ROUTE
app.post("/audio", upload.single("audio"), (req, res) => {
    console.log("Audio received");

    if (!req.file) {
        console.log("No file received");
        return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("📁 Saved:", req.file.filename);

    res.json({
        message: "Audio uploaded successfully",
        file: req.file.filename
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:3000`);
});
