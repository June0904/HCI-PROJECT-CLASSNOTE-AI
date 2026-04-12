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
            <span onclick="selectSubject(${index})">📁 ${sub.name}</span>
            <div>
                <button onclick="renameSubject(${index})">✏️</button>
                <button onclick="deleteSubject(${index})">❌</button>
            </div>
        `;
    list.appendChild(li);
  });
}

function selectSubject(index) {
  currentSubjectIndex = index;
  document.getElementById("currentSubjectTitle").innerText = subjects[index].name;
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
  
  startBtn.onclick = () => {
    if (!isRecording) {
      recognition.start();
      isRecording = true;
      document.getElementById("record").classList.add("recording");
      statusText.innerText = "Listening... Tap to stop";
    } else {
      recognition.stop();
      isRecording = false;
      document.getElementById("record").classList.remove("recording");
      statusText.innerText = "Stopped. Tap to resume.";
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
    container.innerHTML = "<p>Select a subject on the Home screen first.</p>";
    return;
  }
  
  const notes = subjects[currentSubjectIndex].notes;
  if (notes.length === 0) {
    container.innerHTML = "<p>No notes saved for this subject yet.</p>";
    return;
  }
  
  // Maps through notes, adding the delete button with the current index
  container.innerHTML = notes.map((n, index) => `
        <div class="note-card">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <small>${n.date}</small>
                <button onclick="deleteNote(${index})" style="background:none; border:none; cursor:pointer; color:#ff4d4d; font-size:1.2rem;">&times;</button>
            </div>
            <p>${n.content}</p>
        </div>
    `).reverse().join("");
}

function deleteNote(noteIndex) {
  if (confirm("Are you sure you want to delete this specific note? This cannot be undone.")) {
    subjects[currentSubjectIndex].notes.splice(noteIndex, 1);
    
    saveToStorage();

    showNotes();
  }
}
