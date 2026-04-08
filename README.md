# HCI-PROJECT-CLASSNOTE-AI

# 🎓 ClassNote AI

**ClassNote AI** is a real-time AI-powered lecture assistant designed to help students capture, organize, and review lecture content more effectively. It combines audio recording, transcription, note management, and intelligent study tools into one seamless system.

---

##  Features

###  Lecture Recording

* Record lectures directly in the browser
* Uploads audio to backend server
* Stores recordings for future processing

###  Transcription (In Progress)

* Converts speech to text
* Simulated live typing animation (Phase 1)
* Future: real-time AI transcription

###  Smart Notes System

* Save lecture notes
* Organize notes by subject
* View note history in Review page

###  Export Notes

* Export notes as PDF using jsPDF

###  Subject Management

* Add subjects
* Select subjects before recording
* Future: rename and delete subjects

###  Quiz System (Planned)

* Auto-generate quizzes from notes
* Multiple choice, true/false, mixed
* Shuffle questions

###  Modern UI

* Glassmorphism sidebar
* Gradient background
* Dark mode toggle
* Animated transcription box
* Glowing record button

---

##  Project Structure

```
ClassNote AI/
│
├── Backend/
│   ├── server.js
│   ├── uploads/
│
├── Frontend/
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   ├── assets/
│       ├── record.png
│       ├── stop.png
│
└── README.md
```

---

##  Technologies Used

### Frontend

* HTML5
* CSS3 (Glassmorphism, animations)
* JavaScript (Vanilla JS)

### Backend

* Node.js
* Express.js
* Multer (file uploads)
* CORS

### Libraries

* jsPDF (PDF export)

---

##  How to Run

### 1. Start Backend

```bash
cd Backend
node server.js
```

Expected output:

```
 Server running on http://localhost:3000
```

---

### 2. Start Frontend

* Open `Frontend/index.html`
* Right-click → **Open with Live Server**

Runs on:

```
http://localhost:5500
```

---

##  How It Works

1. User clicks **Record**
2. Audio is captured via browser microphone
3. User clicks **Stop**
4. Audio is sent to backend (`/audio`)
5. Backend saves file in `/uploads`
6. (Future) AI processes audio → transcription → notes → quiz

---

##  Current Status

###  Completed

* UI Layout & Design
* Sidebar Navigation
* Audio Recording
* Backend Upload System
* Notes Saving (localStorage)
* PDF Export

###  In Progress

* AI Transcription (Speech-to-Text)
* Subject-based filtering
* Quiz generation

###  Planned

* Real-time transcription
* Login system
* Email support form
* Mobile app version

---

##  Future Improvements

* Convert to mobile app (Capacitor / React Native)
* Cloud database (Firebase / MongoDB)
* Real-time collaboration
* AI summaries and highlights
* Smart search and tagging

---

##  Developers

* Arabaca, Monica Sophia
* Madredano, Ilczar June
* Dela Cruz, Necole
* Ceballos, Ajhay

---

##  Project Goal

> “This project aims to create an AI-powered lecture assistant that can record lectures, convert speech into text in real time, summarize important points, and generate possible study questions to help students better understand and review lecture material.”

---

##  Support

A support system will be added where users can:

* Submit concerns
* Contact developers via email

---

##  Conclusion

ClassNote AI is designed to reduce cognitive overload in learning environments by automating note-taking and enhancing study workflows through AI.

---

 *Built for students, by students.*
