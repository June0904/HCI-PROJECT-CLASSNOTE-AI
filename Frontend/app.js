/// --- INITIALIZATION & GLOBAL VARIABLES ---
let subjects = JSON.parse(localStorage.getItem("subjects")) || [];
let currentSubjectIndex = null;
let isRecording = false;

const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menuBtn");
const closeBtn = document.getElementById("closeSidebar");
const darkToggle = document.getElementById("darkToggle");
const textBox = document.getElementById("text");
const statusText = document.getElementById("statusText");
const startBtn = document.getElementById("startBtn");

// --- SIDEBAR & NAVIGATION ---
menuBtn.onclick = () => sidebar.classList.add("active");
closeBtn.onclick = () => sidebar.classList.remove("active");

function showPage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  sidebar.classList.remove("active");
  
  if (id === "review") showNotes();
}

// --- THEME SYSTEM (LIGHT/DARK) ---
darkToggle.onclick = () => {
  document.body.classList.toggle("light-mode");
  
  if (document.body.classList.contains("light-mode")) {
    darkToggle.innerText = "☀️";
    localStorage.setItem("theme", "light");
  } else {
    darkToggle.innerText = "🌙";
    localStorage.setItem("theme", "dark");
  }
};
window.onload = () => {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light") {
    document.body.classList.add("light-mode");
    darkToggle.innerText = "☀️";
    
    const savedIndex = localStorage.getItem("currentSubjectIndex");
    if (savedIndex !== null) {
    currentSubjectIndex = parseInt(savedIndex);
    }

  }
  renderSubjects();
};

// --- SUBJECT MANAGEMENT ---
function saveToStorage() {
  localStorage.setItem("subjects", JSON.stringify(subjects));
}

function addSubject() {
  const input = document.getElementById("subjectInput");
  if (!input.value.trim()) return;
  
  subjects.push({ name: input.value, notes: [] });
  input.value = "";
  saveToStorage();
  renderSubjects();
}

function renderSubjects() {
  const list = document.getElementById("subjectList");
  if (!list) return;

  list.innerHTML = "";

  subjects.forEach((sub, index) => {
    const li = document.createElement("li");

    li.innerHTML = `
      <div class="subject-row" onclick="selectSubject(${index})">
        📁 ${sub.name}
      </div>

      <div class="subject-actions">
        <button onclick="event.stopPropagation(); renameSubject(${index})">✏️</button>
        <button onclick="event.stopPropagation(); deleteSubject(${index})">❌</button>
      </div>
    `;

    list.appendChild(li);
  });
}

function selectSubject(index) {
  currentSubjectIndex = index;
  localStorage.setItem("currentSubjectIndex", index);

  document.getElementById("currentSubjectTitle").innerText = subjects[index].name;
  textBox.innerText = "Your transcription will appear here...";

  showPage("record");
}

function deleteSubject(index) {
  if (confirm("Delete this subject and all notes?")) {
    subjects.splice(index, 1);
    saveToStorage();
    renderSubjects();
  }
}

function renameSubject(index) {
  const newName = prompt("Enter new subject name:", subjects[index].name);
  if (newName && newName.trim() !== "") {
    subjects[index].name = newName.trim();
    saveToStorage();
    renderSubjects();
  }
}

// --- SPEECH RECOGNITION (RECORDING) ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  statusText.innerText = "Speech API not supported in this browser.";
} else {
  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  
  recognition.onresult = (event) => {
    let finalTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      }
    }
    if (finalTranscript) {
      if (textBox.innerText === "Your transcription will appear here...") {
        textBox.innerText = finalTranscript;
      } else {
        textBox.innerText += " " + finalTranscript;
      }
    }
  };
  
let mediaRecorder;
let audioChunks = [];

startBtn.onclick = async () => {

  if (currentSubjectIndex === null) {
    alert("Select a subject first!");
    return;
  }

  if (!isRecording) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = e => {
      audioChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: "audio/webm" });
      sendAudioToServer(blob); // SEND TO BACKEND
    };

    mediaRecorder.start();
    isRecording = true;

    document.getElementById("record").classList.add("recording");
    statusText.innerText = "Recording... Tap to stop";

  } else {
    mediaRecorder.stop();
    isRecording = false;

    document.getElementById("record").classList.remove("recording");
    statusText.innerText = "Stopped.";
  }
};
}

// --- NOTES MANAGEMENT ---
function saveNote() {
  if (currentSubjectIndex === null) return alert("Select a subject first!");
  if (textBox.innerText === "Your transcription will appear here..." || textBox.innerText === "") {
    return alert("Nothing to save!");
  }
  
  subjects[currentSubjectIndex].notes.push({
    content: textBox.innerText,
    date: new Date().toLocaleString()
  });
  
  saveToStorage();
  alert("Note saved to " + subjects[currentSubjectIndex].name);
}

function showNotes() {
  const container = document.getElementById("notesContainer");

  if (currentSubjectIndex === null) {
    container.innerHTML = "<p>Select a subject first.</p>";
    return;
  }

  const notes = subjects[currentSubjectIndex].notes;

  if (notes.length === 0) {
    container.innerHTML = "<p>No notes yet.</p>";
    return;
  }

  container.innerHTML = notes
    .map((n, index) => ({ ...n, index }))
    .reverse()
    .map(n => `
      <div class="note-card">
        <div class="note-header">
          <small>${n.date}</small>
          <button class="delete-btn" onclick="deleteNote(${n.index})">&times;</button>
        </div>
        <p>${n.content}</p>
      </div>
    `).join("");
}

function deleteNote(noteIndex) {
  if (confirm("Are you sure you want to delete this specific note? This cannot be undone.")) {
    subjects[currentSubjectIndex].notes.splice(noteIndex, 1);
    
    saveToStorage();

    showNotes();
  }
  async function sendAudioToServer(blob) {
  const formData = new FormData();
  formData.append("audio", blob, "recording.webm");

  try {
    const res = await fetch("http://localhost:3000/audio", {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    console.log("Uploaded:", data);

  } catch (err) {
    console.error("Upload failed:", err);
  }
}
}
