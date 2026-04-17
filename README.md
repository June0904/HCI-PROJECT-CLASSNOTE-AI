# ClassNote AI

## Overview

**ClassNote AI** is a real-time AI-powered lecture transcription and study assistant designed for students. It captures audio during lectures, converts speech to text, and organizes notes automatically to reduce cognitive overload and improve learning efficiency.

---

## Features

* **Real-Time Audio Recording**
* **AI-Powered Transcription**
* **Automatic Note Generation**
* **Subject-Based Organization**
* **Web-Based Interface (Mobile Ready)**
* **Fast Processing via API Integration**

---

## Tech Stack

### Frontend

* HTML, CSS, JavaScript

### Backend

* Node.js
* Express.js

### AI Integration

* OpenAI API (for transcription and text processing)

---

## Project Structure

```
ClassNote-AI/
│
├── frontend/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   └── assets/
│
├── backend/
│   ├── server.js
│   ├── routes/
│   ├── controllers/
│   └── uploads/
│
├── package.json
└── README.md
```

---

## Installation & Setup

### 1. Clone the Repository

```
git clone https://github.com/your-username/classnote-ai.git
cd classnote-ai
```

### 2. Install Backend Dependencies

```
cd backend
npm install
```

### 3. Create Environment Variables

Create a `.env` file inside `/backend`:

```
OPENAI_API_KEY=your_api_key_here
PORT=3000
```

### 4. Run the Server

```
node server.js
```

Server should run on:

```
http://localhost:3000
```

---

## Usage

1. Open the web app in your browser
2. Select a subject
3. Click **Record** to start capturing audio
4. Click **Stop** to process transcription
5. View generated notes instantly

---

## Mobile Version

This app can be converted into a mobile experience using:

* Progressive Web App (PWA)
* Capacitor (for Android deployment)

---

## API Flow

```
User Audio → Backend Server → OpenAI API → Transcription → Notes Display
```

---

## Known Issues

* Microphone permissions may vary by browser
* Large audio files may take longer to process
* Requires stable internet connection

---

## Future Improvements

* Native mobile app (React Native / Flutter)
* Notifications & reminders
* Cloud storage for notes
* AI summarization & keyword extraction
* Export notes (PDF, DOCX)

---

## Security Notes

* Never expose your API key in frontend code
* Always store sensitive data in `.env`

---

## Author

# **Madredano, Ilczar June**
Student - Information Technology - University of San Agustin
# **Arabaca, Monica Sophia**
Student - Information Technology - University of San Agustin
# **Dela Cruz, Necole**
Student - Information Technology - University of San Agustin
# **Ceballos, Ajhay**
Student - Information Technology - University of San Agustin

---

## License

This project is for educational purposes.
