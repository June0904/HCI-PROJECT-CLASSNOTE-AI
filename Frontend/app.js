const STORAGE_KEYS = {
  subjects: "classnote_subjects",
  selectedSubjectId: "classnote_selected_subject_id"
};

const TRANSCRIPT_PLACEHOLDER = "Your transcription will appear here...";

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

const pageButtons = Array.from(document.querySelectorAll(".nav-item"));
const pages = Array.from(document.querySelectorAll(".page"));

let subjects = [];
let selectedSubjectId = null;
let recognition = null;
let isRecording = false;
let transcriptText = "";
let editingSubjectId = null;
let editingSubjectDraft = "";
let hasMicrophonePermission = false;

function loadSubjects() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.subjects);
    subjects = saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error("Could not load saved subjects:", error);
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

function focusRenameInput(subjectId) {
  requestAnimationFrame(() => {
    const input = document.querySelector(`[data-rename-input="${subjectId}"]`);
    if (!input) return;

    input.focus();
    input.select();
  });
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
    const isEditing = subject.id === editingSubjectId;

    return `
      <li>
        <div class="subject-card ${isSelected ? "selected-subject" : ""}">
          <div class="subject-left" onclick="${isEditing ? "" : `openSubject('${subject.id}')`}">
            <div class="subject-main">
              <div class="subject-badge">
                <i class="fa-solid fa-book"></i>
              </div>

              <div class="subject-name-wrap">
                ${isEditing ? `
                  <div class="subject-rename-row" onclick="event.stopPropagation()">
                    <input
                      class="subject-rename-input"
                      type="text"
                      value="${escapeHtml(editingSubjectDraft)}"
                      data-rename-input="${subject.id}"
                      oninput="updateRenameDraft('${subject.id}', this.value)"
                      onkeydown="handleRenameKeydown('${subject.id}', event)"
                    />
                    <div class="subject-rename-actions">
                      <button class="subject-action-btn rename-save-btn" type="button" onclick="saveRenamedSubject('${subject.id}')">
                        <i class="fa-solid fa-check"></i>
                        <span>Save</span>
                      </button>
                      <button class="subject-action-btn rename-cancel-btn" type="button" onclick="cancelRenameSubject()">
                        <i class="fa-solid fa-xmark"></i>
                        <span>Cancel</span>
                      </button>
                    </div>
                  </div>
                ` : `
                  <h4 class="subject-name">${escapeHtml(subject.name)}</h4>
                  <div class="subject-meta">
                    ${notesCount} ${notesCount === 1 ? "note" : "notes"} • Created ${formatDate(subject.createdAt)}
                  </div>
                `}
              </div>
            </div>
          </div>

          <div class="subject-actions">
            <button class="subject-action-btn" type="button" onclick="recordForSubject('${subject.id}')">
              <i class="fa-solid fa-microphone"></i>
              <span>Record</span>
            </button>

            <button class="subject-action-btn rename-btn" type="button" onclick="startRenameSubject('${subject.id}')">
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

  if (editingSubjectId) {
    focusRenameInput(editingSubjectId);
  }
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
  sidebarOverlay.classList.add("show");
}

function collapseSidebar() {
  sidebar.classList.remove("expanded");
  sidebar.classList.add("collapsed");
  mainContent.classList.add("collapsed");
  sidebarOverlay.classList.remove("show");
}

function applyResponsiveSidebarState() {
  if (!sidebar.classList.contains("collapsed") && !sidebar.classList.contains("expanded")) {
    sidebar.classList.add("collapsed");
  }

  if (window.innerWidth <= 768) {
    sidebarOverlay.classList.remove("show");
    if (!sidebar.classList.contains("expanded")) {
      mainContent.classList.add("collapsed");
    }
    return;
  }

  sidebarOverlay.classList.remove("show");

  if (sidebar.classList.contains("collapsed")) {
    mainContent.classList.add("collapsed");
  } else {
    mainContent.classList.remove("collapsed");
  }
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
  editingSubjectId = null;
  editingSubjectDraft = "";
  renderSubjects();
  renderNotes();
}

function openSubject(subjectId) {
  if (editingSubjectId) return;

  setSelectedSubject(subjectId);
  showPage("review");
}

function recordForSubject(subjectId) {
  setSelectedSubject(subjectId);
  showPage("record");
}

function startRenameSubject(subjectId) {
  const subject = subjects.find((item) => item.id === subjectId);
  if (!subject) return;

  editingSubjectId = subjectId;
  editingSubjectDraft = subject.name;
  renderSubjects();
}

function updateRenameDraft(subjectId, value) {
  if (editingSubjectId !== subjectId) return;
  editingSubjectDraft = value;
}

function saveRenamedSubject(subjectId) {
  const subject = subjects.find((item) => item.id === subjectId);
  if (!subject) return;

  const trimmed = editingSubjectDraft.trim();
  if (!trimmed) {
    statusText.textContent = "Subject name cannot be empty.";
    focusRenameInput(subjectId);
    return;
  }

  subject.name = trimmed;
  editingSubjectId = null;
  editingSubjectDraft = "";
  saveSubjects();
  renderSubjects();
  renderNotes();
  updateCurrentSubjectHeading();
}

function cancelRenameSubject() {
  editingSubjectId = null;
  editingSubjectDraft = "";
  renderSubjects();
}

function handleRenameKeydown(subjectId, event) {
  event.stopPropagation();

  if (event.key === "Enter") {
    event.preventDefault();
    saveRenamedSubject(subjectId);
  }

  if (event.key === "Escape") {
    event.preventDefault();
    cancelRenameSubject();
  }
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

  editingSubjectId = null;
  editingSubjectDraft = "";
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

  if (!content || content === TRANSCRIPT_PLACEHOLDER) {
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
  textOutput.textContent = TRANSCRIPT_PLACEHOLDER;
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

  if (!content || content === TRANSCRIPT_PLACEHOLDER) {
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

async function ensureMicrophoneAccess() {
  if (hasMicrophonePermission) {
    return true;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    statusText.textContent = "This browser cannot access the microphone.";
    return false;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    hasMicrophonePermission = true;
    return true;
  } catch (error) {
    console.error("Microphone access failed:", error);
    statusText.textContent = "Microphone access was blocked. Please allow microphone permission.";
    return false;
  }
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
        finalTranscript += `${transcript} `;
      } else {
        interimTranscript += transcript;
      }
    }

    if (finalTranscript) {
      transcriptText += finalTranscript;
    }

    const combinedText = `${transcriptText}${interimTranscript}`.trim();
    textOutput.textContent = combinedText || TRANSCRIPT_PLACEHOLDER;
  };

  recognition.onerror = (event) => {
    const errorCode = event?.error || "unknown";

    if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
      statusText.textContent = "Speech recognition permission was denied.";
    } else if (errorCode === "network") {
      statusText.textContent = "Speech recognition network error. Try Chrome or Edge over http://localhost.";
    } else if (errorCode === "audio-capture") {
      statusText.textContent = "No microphone was found for recording.";
    } else {
      statusText.textContent = "Recording error. Please try again.";
    }

    isRecording = false;
    recordControls.classList.remove("recording");
  };

  recognition.onend = () => {
    isRecording = false;
    recordControls.classList.remove("recording");

    if (!statusText.textContent || statusText.textContent === "Listening...") {
      statusText.textContent = "Tap to start recording";
    }
  };
}

async function toggleRecording() {
  if (!recognition) {
    statusText.textContent = "Speech recognition is not available in this browser.";
    return;
  }

  const selectedSubject = getSelectedSubject();
  if (!selectedSubject) {
    alert("Please create or select a subject first.");
    return;
  }

  if (isRecording) {
    recognition.stop();
    return;
  }

  const hasAccess = await ensureMicrophoneAccess();
  if (!hasAccess) return;

  transcriptText = "";
  textOutput.textContent = TRANSCRIPT_PLACEHOLDER;
  statusText.textContent = "Starting recording...";

  try {
    recognition.start();
  } catch (error) {
    console.error("Recognition could not start:", error);

    if (!window.isSecureContext && location.protocol !== "http:" && location.hostname !== "localhost") {
      statusText.textContent = "Open the app from http://localhost so the browser can start recording.";
    } else {
      statusText.textContent = "Recording could not start. Try again in Chrome or Edge.";
    }
  }
}

pageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    showPage(button.dataset.page);
  });
});

menuBtn?.addEventListener("click", expandSidebar);
desktopCollapseBtn?.addEventListener("click", collapseSidebar);
sidebarOverlay?.addEventListener("click", collapseSidebar);

window.addEventListener("resize", applyResponsiveSidebarState);
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
  applyResponsiveSidebarState();
  showPage("home");
}

window.addSubject = addSubject;
window.openSubject = openSubject;
window.recordForSubject = recordForSubject;
window.renameSubject = startRenameSubject;
window.startRenameSubject = startRenameSubject;
window.updateRenameDraft = updateRenameDraft;
window.saveRenamedSubject = saveRenamedSubject;
window.cancelRenameSubject = cancelRenameSubject;
window.handleRenameKeydown = handleRenameKeydown;
window.deleteSubject = deleteSubject;
window.saveNote = saveNote;
window.deleteNote = deleteNote;
window.exportPDF = exportPDF;

init();
