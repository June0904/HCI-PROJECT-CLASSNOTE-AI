const STORAGE_KEYS = {
  subjects: "classnote_subjects",
  selectedSubjectId: "classnote_selected_subject_id",
  theme: "classnote_theme"
};

const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menuBtn");
const desktopCollapseBtn = document.getElementById("desktopCollapseBtn");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const mainContent = document.getElementById("mainContent");

const subjectInput = document.getElementById("subjectInput");
const subjectList = document.getElementById("subjectList");
const notesContainer = document.getElementById("notesContainer");
const currentSubjectTitle = document.getElementById("currentSubjectTitle");

const startBtn = document.getElementById("startBtn");
const statusText = document.getElementById("statusText");
const textOutput = document.getElementById("text");
const recordControls = document.getElementById("recordControls");

const headerThemeBtn = document.getElementById("headerThemeBtn");
const headerThemeIcon = document.getElementById("headerThemeIcon");

const pageButtons = Array.from(document.querySelectorAll(".nav-item"));
const pages = Array.from(document.querySelectorAll(".page"));

let subjects = [];
let selectedSubjectId = null;
let recognition = null;
let isRecording = false;
let transcriptText = "";

function loadSubjects() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.subjects);
    subjects = saved ? JSON.parse(saved) : [];
  } catch {
    subjects = [];
  }
}

function saveSubjects() {
  localStorage.setItem(STORAGE_KEYS.subjects, JSON.stringify(subjects));
}

function loadSelectedSubject() {
  selectedSubjectId = localStorage.getItem(STORAGE_KEYS.selectedSubjectId);
  if (!selectedSubjectId && subjects.length > 0) {
    selectedSubjectId = subjects[0].id;
    localStorage.setItem(STORAGE_KEYS.selectedSubjectId, selectedSubjectId);
  }
}

function setSelectedSubject(subjectId) {
  selectedSubjectId = subjectId;
  localStorage.setItem(STORAGE_KEYS.selectedSubjectId, subjectId);
  updateCurrentSubjectHeading();
  renderSubjects();
  renderNotes();
}

function getSelectedSubject() {
  return subjects.find((subject) => subject.id === selectedSubjectId) || null;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function renderSubjects() {
  if (!subjectList) return;

  if (subjects.length === 0) {
    subjectList.innerHTML = `
      <li>
        <div class="empty-state-card">
          No subjects yet. Add your first subject to get started.
        </div>
      </li>
    `;
    return;
  }

  subjectList.innerHTML = subjects.map((subject) => {
    const isSelected = subject.id === selectedSubjectId;
    const notesCount = Array.isArray(subject.notes) ? subject.notes.length : 0;

    return `
      <li>
        <div class="subject-card ${isSelected ? "selected-subject" : ""}">
          <div class="subject-left" onclick="openSubject('${subject.id}')">
            <div class="subject-main">
              <div class="subject-badge">
                <i class="fa-solid fa-book"></i>
              </div>

              <div class="subject-name-wrap">
                <h4 class="subject-name">${escapeHtml(subject.name)}</h4>
                <div class="subject-meta">
                  ${notesCount} ${notesCount === 1 ? "note" : "notes"} • Created ${formatDate(subject.createdAt)}
                </div>
              </div>
            </div>
          </div>

          <div class="subject-actions">
            <button class="subject-action-btn" type="button" onclick="recordForSubject('${subject.id}')">
              <i class="fa-solid fa-microphone"></i>
              <span>Record</span>
            </button>

            <button class="subject-action-btn rename-btn" type="button" onclick="renameSubject('${subject.id}')">
              <i class="fa-solid fa-pen"></i>
              <span>Rename</span>
            </button>

            <button class="subject-action-btn delete-subject-btn" type="button" onclick="deleteSubject('${subject.id}')">
              <i class="fa-solid fa-trash"></i>
              <span>Delete</span>
            </button>
          </div>
        </div>
      </li>
    `;
  }).join("");
}

function renderNotes() {
  if (!notesContainer) return;

  const subject = getSelectedSubject();

  if (!subject) {
    notesContainer.innerHTML = `
      <div class="empty-state-card">
        Select or create a subject first to view notes.
      </div>
    `;
    return;
  }

  if (!subject.notes || subject.notes.length === 0) {
    notesContainer.innerHTML = `
      <div class="empty-state-card">
        No notes yet for <strong>${escapeHtml(subject.name)}</strong>.
      </div>
    `;
    return;
  }

  notesContainer.innerHTML = [...subject.notes]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((note) => `
      <div class="note-card">
        <div class="note-header">
          <small>${formatDate(note.createdAt)}</small>
          <button class="delete-btn" type="button" onclick="deleteNote('${subject.id}', '${note.id}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
        <p>${escapeHtml(note.content).replace(/\n/g, "<br>")}</p>
      </div>
    `)
    .join("");
}

function updateCurrentSubjectHeading() {
  const subject = getSelectedSubject();
  if (!currentSubjectTitle) return;
  currentSubjectTitle.textContent = subject ? `Recording • ${subject.name}` : "Recording";
}

function showPage(pageId) {
  pages.forEach((page) => {
    page.classList.toggle("hidden", page.id !== pageId);
  });

  pageButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.page === pageId);
  });
}

function expandSidebar() {
  sidebar.classList.remove("collapsed");
  sidebar.classList.add("expanded");
  mainContent.classList.remove("collapsed");
}

function collapseSidebar() {
  sidebar.classList.remove("expanded");
  sidebar.classList.add("collapsed");
  mainContent.classList.add("collapsed");
}

function applyResponsiveSidebarState() {
  if (!sidebar.classList.contains("collapsed") && !sidebar.classList.contains("expanded")) {
    sidebar.classList.add("collapsed");
  }

  if (sidebar.classList.contains("collapsed")) {
    mainContent.classList.add("collapsed");
  } else {
    mainContent.classList.remove("collapsed");
  }

  sidebar.classList.remove("mobile-open");
  sidebarOverlay.classList.remove("show");
}

function addSubject() {
  const name = subjectInput.value.trim();

  if (!name) {
    alert("Please enter a subject name.");
    return;
  }

  const subject = {
    id: `subject_${Date.now()}`,
    name,
    createdAt: new Date().toISOString(),
    notes: []
  };

  subjects.unshift(subject);
  saveSubjects();
  setSelectedSubject(subject.id);
  subjectInput.value = "";
  renderSubjects();
  renderNotes();
}

function openSubject(subjectId) {
  setSelectedSubject(subjectId);
  showPage("review");
}

function recordForSubject(subjectId) {
  setSelectedSubject(subjectId);
  showPage("record");
}

function renameSubject(subjectId) {
  const subject = subjects.find((item) => item.id === subjectId);
  if (!subject) return;

  const newName = prompt("Rename subject:", subject.name);
  if (newName === null) return;

  const trimmed = newName.trim();
  if (!trimmed) {
    alert("Subject name cannot be empty.");
    return;
  }

  subject.name = trimmed;
  saveSubjects();
  renderSubjects();
  renderNotes();
  updateCurrentSubjectHeading();
}

function deleteSubject(subjectId) {
  const subject = subjects.find((item) => item.id === subjectId);
  if (!subject) return;

  const confirmed = confirm(`Delete "${subject.name}"?`);
  if (!confirmed) return;

  subjects = subjects.filter((item) => item.id !== subjectId);
  saveSubjects();

  if (selectedSubjectId === subjectId) {
    selectedSubjectId = subjects.length ? subjects[0].id : null;
    if (selectedSubjectId) {
      localStorage.setItem(STORAGE_KEYS.selectedSubjectId, selectedSubjectId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.selectedSubjectId);
    }
  }

  updateCurrentSubjectHeading();
  renderSubjects();
  renderNotes();
}

function saveNote() {
  const subject = getSelectedSubject();

  if (!subject) {
    alert("Please create or select a subject first.");
    return;
  }

  const content = transcriptText.trim() || textOutput.textContent.trim();

  if (!content || content === "Your transcription will appear here...") {
    alert("There is no note to save yet.");
    return;
  }

  subject.notes.unshift({
    id: `note_${Date.now()}`,
    content,
    createdAt: new Date().toISOString()
  });

  saveSubjects();
  renderSubjects();
  renderNotes();

  transcriptText = "";
  textOutput.textContent = "Your transcription will appear here...";
  statusText.textContent = "Tap to start recording";

  alert("Note saved successfully.");
}

function deleteNote(subjectId, noteId) {
  const subject = subjects.find((item) => item.id === subjectId);
  if (!subject) return;

  subject.notes = subject.notes.filter((note) => note.id !== noteId);
  saveSubjects();
  renderSubjects();
  renderNotes();
}

function exportPDF() {
  const subject = getSelectedSubject();
  const content = transcriptText.trim() || textOutput.textContent.trim();

  if (!subject) {
    alert("Please create or select a subject first.");
    return;
  }

  if (!content || content === "Your transcription will appear here...") {
    alert("There is no text to export.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text(`ClassNote AI - ${subject.name}`, 14, 20);

  doc.setFontSize(11);
  const lines = doc.splitTextToSize(content, 180);
  doc.text(lines, 14, 32);

  doc.save(`${subject.name.replace(/\s+/g, "_").toLowerCase()}_note.pdf`);
}

function initializeSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    statusText.textContent = "Speech recognition is not supported on this device/browser.";
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.style.opacity = "0.6";
      startBtn.style.cursor = "not-allowed";
    }
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  recognition.onstart = () => {
    isRecording = true;
    recordControls.classList.add("recording");
    statusText.textContent = "Listening...";
  };

  recognition.onresult = (event) => {
    let finalTranscript = "";
    let interimTranscript = "";

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript + " ";
      } else {
        interimTranscript += transcript;
      }
    }

    if (finalTranscript) {
      transcriptText += finalTranscript;
    }

    const combinedText = `${transcriptText}${interimTranscript}`.trim();
    textOutput.textContent = combinedText || "Your transcription will appear here...";
  };

  recognition.onerror = () => {
    statusText.textContent = "Recording error. Please try again.";
    isRecording = false;
    recordControls.classList.remove("recording");
  };

  recognition.onend = () => {
    isRecording = false;
    recordControls.classList.remove("recording");
    statusText.textContent = "Tap to start recording";
  };
}

function toggleRecording() {
  if (!recognition) return;

  const selectedSubject = getSelectedSubject();
  if (!selectedSubject) {
    alert("Please create or select a subject first.");
    return;
  }

  if (isRecording) {
    recognition.stop();
  } else {
    recognition.start();
  }
}

function applyTheme(theme) {
  document.body.classList.toggle("dark-mode", theme === "dark");

  if (headerThemeIcon) {
    headerThemeIcon.className = theme === "dark"
      ? "fa-regular fa-sun"
      : "fa-regular fa-moon";
  }
}

function loadTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.theme) || "light";
  applyTheme(savedTheme);
}

function toggleTheme() {
  const isDark = document.body.classList.contains("dark-mode");
  const nextTheme = isDark ? "light" : "dark";
  localStorage.setItem(STORAGE_KEYS.theme, nextTheme);
  applyTheme(nextTheme);
}

pageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    showPage(button.dataset.page);
  });
});

menuBtn?.addEventListener("click", expandSidebar);
desktopCollapseBtn?.addEventListener("click", collapseSidebar);

window.addEventListener("resize", applyResponsiveSidebarState);

headerThemeBtn?.addEventListener("click", toggleTheme);
startBtn?.addEventListener("click", toggleRecording);

subjectInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    addSubject();
  }
});

function init() {
  loadSubjects();
  loadSelectedSubject();
  updateCurrentSubjectHeading();
  renderSubjects();
  renderNotes();
  initializeSpeechRecognition();
  loadTheme();
  applyResponsiveSidebarState();
  showPage("home");
}

window.addSubject = addSubject;
window.openSubject = openSubject;
window.recordForSubject = recordForSubject;
window.renameSubject = renameSubject;
window.deleteSubject = deleteSubject;
window.saveNote = saveNote;
window.deleteNote = deleteNote;
window.exportPDF = exportPDF;

init();
