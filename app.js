const STORAGE_KEYS = {
  users: "classnote_users",
  currentUser: "classnote_user",
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
const aiSummaryResult = document.getElementById("aiSummaryResult");
const summaryStatus = document.getElementById("summaryStatus");
const quizTypeSelect = document.getElementById("quizType");
const quizCountInput = document.getElementById("quizCount");
const quizStatus = document.getElementById("quizStatus");
const quizResultContainer = document.getElementById("quizResultContainer");
const quizSubjectSelect = document.getElementById("quizSubjectSelect");

function resolveBackendBaseUrl() {
  const configuredUrl = localStorage.getItem("classnote_backend_url")?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (isLocalhost) {
    return "http://localhost:3000";
  }

  return window.location.origin.replace(/\/+$/, "");
}

const BACKEND_BASE_URL = resolveBackendBaseUrl();
const BACKEND_API_URL = `${BACKEND_BASE_URL}/ai`;
const BACKEND_HEALTH_URL = `${BACKEND_BASE_URL}/health`;
const BACKEND_TRANSCRIBE_URL = `${BACKEND_BASE_URL}/transcribe`;

const loadingOverlay = document.getElementById("loadingOverlay");
const loadingText = document.getElementById("loadingText");
const loadingProgress = document.getElementById("loadingProgress");
const popupModal = document.getElementById("popupModal");
const popupTitle = document.getElementById("popupTitle");
const popupMessage = document.getElementById("popupMessage");

const landingPage = document.getElementById("landingPage");
const authForm = document.getElementById("authForm");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const passwordIcon = document.getElementById("passwordIcon");
const authError = document.getElementById("authError");
const authTabs = document.querySelectorAll(".auth-tab");
const authSubmit = document.querySelector(".auth-submit");

const pageButtons = Array.from(document.querySelectorAll(".nav-item"));
const pages = Array.from(document.querySelectorAll(".page"));

let subjects = [];
let selectedSubjectId = null;
let selectedNoteId = null;
let recognition = null;
let isRecording = false;
let transcriptText = "";
let editingSubjectId = null;
let editingSubjectDraft = "";
let hasMicrophonePermission = false;
let recordingStream = null;
let mediaRecorder = null;
let recordedAudioChunks = [];
let speechRecognitionSupported = false;
let isRecognitionActive = false;

let isLoggedIn = false;
let currentUser = null;
let loadingTimerId = null;

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function getUserStorageSuffix() {
  if (!currentUser?.email) return null;
  return encodeURIComponent(normalizeEmail(currentUser.email));
}

function getSubjectsStorageKey() {
  const suffix = getUserStorageSuffix();
  return suffix ? `${STORAGE_KEYS.subjects}_${suffix}` : STORAGE_KEYS.subjects;
}

function getSelectedSubjectStorageKey() {
  const suffix = getUserStorageSuffix();
  return suffix ? `${STORAGE_KEYS.selectedSubjectId}_${suffix}` : STORAGE_KEYS.selectedSubjectId;
}

function loadStoredUsers() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.users);
    const users = saved ? JSON.parse(saved) : [];
    return Array.isArray(users) ? users : [];
  } catch (error) {
    console.error("Could not load saved users:", error);
    return [];
  }
}

function saveStoredUsers(users) {
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
}

function saveCurrentUserSession(user) {
  currentUser = user;
  isLoggedIn = Boolean(user);

  if (user) {
    localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEYS.currentUser);
  }
}

function migrateLegacyUserStore() {
  const users = loadStoredUsers();
  if (users.length > 0) return;

  try {
    const legacyUserRaw = localStorage.getItem(STORAGE_KEYS.currentUser);
    if (!legacyUserRaw) return;

    const legacyUser = JSON.parse(legacyUserRaw);
    if (!legacyUser?.email || !legacyUser?.password) return;

    saveStoredUsers([{
      email: normalizeEmail(legacyUser.email),
      password: legacyUser.password,
      createdAt: legacyUser.createdAt || new Date().toISOString()
    }]);
  } catch (error) {
    console.error("Could not migrate legacy user store:", error);
  }
}

function migrateLegacySubjectStore() {
  if (!currentUser?.email) return;

  const scopedSubjectsKey = getSubjectsStorageKey();
  const scopedSelectedSubjectKey = getSelectedSubjectStorageKey();
  const hasScopedSubjects = localStorage.getItem(scopedSubjectsKey);
  const legacySubjects = localStorage.getItem(STORAGE_KEYS.subjects);

  if (hasScopedSubjects || !legacySubjects) return;

  localStorage.setItem(scopedSubjectsKey, legacySubjects);

  const legacySelectedSubjectId = localStorage.getItem(STORAGE_KEYS.selectedSubjectId);
  if (legacySelectedSubjectId) {
    localStorage.setItem(scopedSelectedSubjectKey, legacySelectedSubjectId);
  }

  localStorage.removeItem(STORAGE_KEYS.subjects);
  localStorage.removeItem(STORAGE_KEYS.selectedSubjectId);
}

function loadSubjects() {
  if (!currentUser?.email) {
    subjects = [];
    return;
  }

  try {
    const saved = localStorage.getItem(getSubjectsStorageKey());
    subjects = saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error("Could not load saved subjects:", error);
    subjects = [];
  }
}

function saveSubjects() {
  if (!currentUser?.email) return;
  localStorage.setItem(getSubjectsStorageKey(), JSON.stringify(subjects));
}

function loadSelectedSubject() {
  if (!currentUser?.email) {
    selectedSubjectId = null;
    return;
  }

  selectedSubjectId = localStorage.getItem(getSelectedSubjectStorageKey());

  if (!selectedSubjectId && subjects.length > 0) {
    selectedSubjectId = subjects[0].id;
    localStorage.setItem(getSelectedSubjectStorageKey(), selectedSubjectId);
  }
}

function setSelectedSubject(subjectId) {
  selectedSubjectId = subjectId;
  if (currentUser?.email) {
    localStorage.setItem(getSelectedSubjectStorageKey(), subjectId);
  }
  updateCurrentSubjectHeading();
  renderSubjects();
  renderNotes();
}

function getSelectedSubject() {
  return subjects.find((subject) => subject.id === selectedSubjectId) || null;
}

function getSubjects() {
  return subjects;
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
    selectedNoteId = null;
    return;
  }

  const noteExists = subject.notes.some((note) => note.id === selectedNoteId);
  if (!noteExists) {
    selectedNoteId = null;
  }

  notesContainer.innerHTML = [...subject.notes]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((note) => `
      <div class="note-card ${note.id === selectedNoteId ? "selected-note" : ""}" onclick="selectNoteForSummary('${subject.id}', '${note.id}')">
        <div class="note-header">
          <small>${formatDate(note.createdAt)}</small>
          <button class="delete-btn" type="button" onclick="event.stopPropagation(); deleteNote('${subject.id}', '${note.id}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
        <p>${escapeHtml(note.content).replace(/\n/g, "<br>")}</p>
      </div>
    `)
    .join("");
}

function buildNotesForAI() {
  const subject = getSelectedSubject();
  if (!subject) return "";

  if (selectedNoteId) {
    const selectedNote = subject.notes.find((note) => note.id === selectedNoteId);
    return selectedNote ? selectedNote.content.trim() : "";
  }

  const liveTranscript = transcriptText.trim() || textOutput.textContent.trim();
  const currentText = liveTranscript && liveTranscript !== TRANSCRIPT_PLACEHOLDER ? liveTranscript : "";
  return currentText;
}

function getBackendUnavailableMessage(action) {
  const githubPagesHint = window.location.hostname.endsWith("github.io")
    ? " GitHub Pages cannot run the Node/Express backend by itself, so deploy the Backend separately and set localStorage.classnote_backend_url to that backend URL."
    : "";

  return `Unable to reach the backend while trying to ${action}. Make sure the backend is running at ${BACKEND_BASE_URL}.${githubPagesHint}`;
}

function isNetworkError(error) {
  return error?.name === "TypeError" || error?.name === "AbortError";
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function wakeBackend() {
  try {
    await fetchWithTimeout(BACKEND_HEALTH_URL, { method: "GET" }, 12000);
  } catch (error) {
    console.warn("Backend wake-up failed:", error);
  }
}

async function postAIRequest(body) {
  try {
    let response;

    try {
      response = await fetchWithTimeout(BACKEND_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }, 45000);
    } catch (error) {
      if (!isNetworkError(error)) {
        throw error;
      }

      await wakeBackend();
      response = await fetchWithTimeout(BACKEND_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }, 45000);
    }

    const rawText = await response.text();
    if (!rawText) {
      let errorMsg = `Empty response from AI service. Status: ${response.status}`;
      if (response.status === 405) {
        errorMsg = "AI service method not allowed (405). Make sure the backend server is running at http://localhost:3000 and that /ai accepts POST requests.";
      }
      throw new Error(errorMsg);
    }

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      throw new Error(`Invalid JSON from AI service. Response: ${rawText}`);
    }

    if (!response.ok) {
      throw new Error(data.error || data.message || `AI request failed with status ${response.status}`);
    }

    return data.result;
  } catch (error) {
    if (isNetworkError(error)) {
      throw new Error(getBackendUnavailableMessage("reach the AI service"));
    }

    throw new Error(error.message || "Unable to connect to AI service.");
  }
}

async function checkBackendHealth() {
  try {
    const response = await fetchWithTimeout(BACKEND_HEALTH_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    }, 15000);

    if (!response.ok) {
      throw new Error(`Backend health check failed with status ${response.status}`);
    }

    const data = await response.json();
    showPopup("Backend Health", `Backend is healthy.\nStatus: ${data.ok ? "OK" : "Not OK"}`);
  } catch (error) {
    const message = isNetworkError(error)
      ? getBackendUnavailableMessage("check backend health")
      : error.message;
    showPopup("Backend Health Error", message, true);
  }
}

function checkAuth() {
  migrateLegacyUserStore();

  const user = localStorage.getItem(STORAGE_KEYS.currentUser);
  if (user) {
    currentUser = JSON.parse(user);
    isLoggedIn = true;
    migrateLegacySubjectStore();
    showApp();
  } else {
    showLanding();
  }
}

function showLanding() {
  landingPage.style.display = "flex";
  document.querySelector("aside").style.display = "none";
  document.querySelector("header").style.display = "none";
  document.querySelector("main").style.display = "none";
}

function showApp() {
  landingPage.style.display = "none";
  document.querySelector("aside").style.display = "block";
  document.querySelector("header").style.display = "block";
  document.querySelector("main").style.display = "block";
}

function togglePasswordVisibility() {
  const type = passwordInput.type === "password" ? "text" : "password";
  passwordInput.type = type;
  passwordIcon.className = type === "password" ? "fa-solid fa-eye" : "fa-solid fa-eye-slash";
}

function switchAuthTab(tab) {
  authTabs.forEach(t => t.classList.remove("active"));
  document.querySelector(`[data-tab="${tab}"]`).classList.add("active");
  authSubmit.textContent = tab === "signin" ? "Sign In" : "Sign Up";
  authError.style.display = "none";
}

function handleAuth(e) {
  e.preventDefault();
  const email = normalizeEmail(emailInput.value);
  const password = passwordInput.value;
  const isSignUp = authSubmit.textContent === "Sign Up";

  if (!email || !password) {
    showAuthError("Please fill in all fields.");
    return;
  }

  if (isSignUp) {
    const users = loadStoredUsers();
    const existingUser = users.find((user) => normalizeEmail(user.email) === email);
    if (existingUser) {
      showAuthError("An account with this email already exists.");
      return;
    }

    const user = { email, password, createdAt: new Date().toISOString() };
    users.push(user);
    saveStoredUsers(users);
    saveCurrentUserSession(user);
    migrateLegacySubjectStore();
    loadSubjects();
    loadSelectedSubject();
    updateCurrentSubjectHeading();
    renderSubjects();
    renderNotes();
    populateQuizSubjectSelect();
    showApp();
  } else {
    const users = loadStoredUsers();
    if (users.length === 0) {
      showAuthError("No account found. Please sign up first.");
      return;
    }

    const user = users.find((storedUser) => normalizeEmail(storedUser.email) === email);
    if (!user) {
      showAuthError("No account found with that email.");
      return;
    }

    if (user.password !== password) {
      showAuthError("Incorrect email or password.");
      return;
    }

    saveCurrentUserSession(user);
    migrateLegacySubjectStore();
    loadSubjects();
    loadSelectedSubject();
    updateCurrentSubjectHeading();
    renderSubjects();
    renderNotes();
    populateQuizSubjectSelect();
    showApp();
  }
}

function showAuthError(message) {
  authError.textContent = message;
  authError.style.display = "block";
}

function showLoading(text = "Loading...", progress = 0, options = {}) {
  const { delay = 0 } = options;
  clearTimeout(loadingTimerId);
  loadingText.textContent = text;
  loadingProgress.style.width = `${progress}%`;

  if (delay > 0) {
    loadingTimerId = window.setTimeout(() => {
      loadingOverlay.style.display = "flex";
    }, delay);
    return;
  }

  loadingOverlay.style.display = "flex";
}

function hideLoading() {
  clearTimeout(loadingTimerId);
  loadingOverlay.style.display = "none";
}

function showPopup(title, message, isError = false) {
  popupTitle.textContent = isError ? "Error" : "Success";
  popupTitle.style.color = isError ? "var(--danger)" : "var(--success)";
  popupMessage.textContent = message;
  popupModal.style.display = "flex";
}

function closePopup() {
  popupModal.style.display = "none";
}

function logout() {
  saveCurrentUserSession(null);
  subjects = [];
  selectedSubjectId = null;
  selectedNoteId = null;
  updateAIResult(aiSummaryResult, "");
  updateAIResult(quizResultContainer, "");
  setAIStatus(summaryStatus, "", false);
  setAIStatus(quizStatus, "", false);
  showLanding();
}

function setAIStatus(element, message, visible = true) {
  if (!element) return;
  element.textContent = message;
  element.style.display = visible ? "block" : "none";
}

function updateAIResult(container, text) {
  if (!container) return;
  container.textContent = text || "";
  container.style.display = text ? "block" : "none";
}

function populateQuizSubjectSelect() {
  if (!quizSubjectSelect) return;

  const availableSubjects = getSubjects();
  const previousValue = quizSubjectSelect.value;

  if (availableSubjects.length === 0) {
    quizSubjectSelect.innerHTML = '<option value="">No subjects available</option>';
    quizSubjectSelect.value = "";
    return;
  }

  quizSubjectSelect.innerHTML = [
    '<option value="">Select Subject</option>',
    ...availableSubjects.map((subject) => (
      `<option value="${escapeHtml(subject.name)}">${escapeHtml(subject.name)}</option>`
    ))
  ].join("");

  if (availableSubjects.some((subject) => subject.name === previousValue)) {
    quizSubjectSelect.value = previousValue;
    return;
  }

  const selectedSubject = getSelectedSubject();
  quizSubjectSelect.value = selectedSubject?.name || "";
}

function selectNoteForSummary(subjectId, noteId) {
  const subject = getSelectedSubject();
  if (!subject || subject.id !== subjectId) {
    return;
  }

  if (selectedNoteId === noteId) {
    selectedNoteId = null;
    setAIStatus(summaryStatus, "Note deselected.");
  } else {
    selectedNoteId = noteId;
    setAIStatus(summaryStatus, "Selected note ready for summary.");
  }

  renderNotes();
}

async function generateSummary() {
  const subject = getSelectedSubject();
  const notesText = buildNotesForAI();

  if (!subject || !selectedNoteId) {
    showPopup("Error", "Please select a note in Review to summarize first.", true);
    return;
  }

  if (!notesText) {
    showPopup("Error", "Selected note has no text to summarize.", true);
    return;
  }

  showLoading("Generating AI Summary...", 20, { delay: 200 });
  setAIStatus(summaryStatus, "Generating summary...");
  updateAIResult(aiSummaryResult, "");

  try {
    showLoading("Sending request to AI...", 40);
    const result = await postAIRequest({
      mode: "summary",
      subjectName: subject.name,
      notes: notesText
    });

    showLoading("Processing response...", 80);
    setAIStatus(summaryStatus, "Summary generated successfully.");
    updateAIResult(aiSummaryResult, result);
    hideLoading();
  } catch (error) {
    hideLoading();
    setAIStatus(summaryStatus, `AI Summary error: ${error.message}`);
    updateAIResult(aiSummaryResult, "");
    showPopup("Error", `Failed to generate summary: ${error.message}`, true);
  }
}

function clearSummary() {
  if (!selectedNoteId) {
    showPopup("Error", "Select a note first before clearing the summary.", true);
    return;
  }

  setAIStatus(summaryStatus, "Summary cleared.");
  updateAIResult(aiSummaryResult, "");
}
async function generateQuiz() {
  const selectedSubjectName = quizSubjectSelect?.value;
  if (!selectedSubjectName) {
    showPopup("Error", "Please select a subject before generating a quiz.", true);
    return;
  }

  const subjects = getSubjects();
  const subject = subjects.find(s => s.name === selectedSubjectName);
  if (!subject) {
    showPopup("Error", "Selected subject not found.", true);
    return;
  }

  const notesText = (subject.notes || []).map(note => note.content.trim()).filter(content => content).join("\n\n");
  const quizType = quizTypeSelect?.value || "multiple_choice";
  const questionCount = Number(quizCountInput?.value) || 5;

  if (!notesText) {
    showPopup("Error", "Please record or save at least one note for the selected subject before generating a quiz.", true);
    return;
  }

  if (questionCount < 1 || questionCount > 10) {
    showPopup("Error", "Please choose between 1 and 10 questions.", true);
    return;
  }

  showLoading("Generating AI Quiz...", 20, { delay: 200 });
  setAIStatus(quizStatus, "Generating quiz...");
  updateAIResult(quizResultContainer, "");

  try {
    showLoading("Sending request to AI...", 40);
    const result = await postAIRequest({
      mode: "quiz",
      subjectName: subject.name,
      notes: notesText,
      quizType,
      questionCount
    });

    showLoading("Processing response...", 80);
    setAIStatus(quizStatus, "Quiz generated successfully.");
    renderInteractiveQuiz(result, quizType);
    hideLoading();
  } catch (error) {
    hideLoading();
    setAIStatus(quizStatus, `AI Quiz error: ${error.message}`);
    updateAIResult(quizResultContainer, "");
    showPopup("Error", `Failed to generate quiz: ${error.message}`, true);
  }
}

function parseMultipleChoiceQuiz(text) {
  const questions = [];
  const normalizedText = text
    .replace(/\r/g, "")
    .replace(/([^\n])\s+([A-D][\.\):]\s+)/g, "$1\n$2");
  const lines = normalizedText.split('\n').map(line => line.trim()).filter(line => line);

  let currentQuestion = null;
  let currentOptions = [];
  let inAnswerKey = false;

  function extractChoiceOptions(value) {
    const options = [];
    const optionPattern = /(?:^|[\s-])([A-D])[\.\):]\s*(.+?)(?=(?:\s+[A-D][\.\):]\s)|$)/gi;
    let match;

    while ((match = optionPattern.exec(value)) !== null) {
      options.push({
        letter: match[1].toUpperCase(),
        text: match[2].trim()
      });
    }

    return options;
  }

  function parseMultipleChoiceAnswer(value) {
    const patterns = [
      /^(\d+)[\.\):\-]?\s*(?:answer|correct answer|option)?\s*[:\-]?\s*([A-D])\b/i,
      /^(\d+)[\.\):\-]?\s*\(([A-D])\)/i
    ];

    for (const pattern of patterns) {
      const match = value.match(pattern);
      if (match) {
        return {
          questionNumber: Number.parseInt(match[1], 10),
          answerLetter: match[2].toUpperCase()
        };
      }
    }

    return null;
  }

  for (const line of lines) {
    // Check for answer key section
    if (line.toLowerCase().includes('answer key') || line.toLowerCase().includes('answers:')) {
      inAnswerKey = true;
      continue;
    }

    if (inAnswerKey) {
      const parsedAnswer = parseMultipleChoiceAnswer(line);
      if (parsedAnswer && questions[parsedAnswer.questionNumber - 1]) {
        questions[parsedAnswer.questionNumber - 1].correctAnswer = parsedAnswer.answerLetter;
      }
      continue;
    }

    // Check for question number
    const questionMatch = line.match(/^(\d+)[\.\)]\s*(.+)/);
    if (questionMatch) {
      if (currentQuestion) {
        currentQuestion.options = currentOptions;
        questions.push(currentQuestion);
      }

      const questionBody = questionMatch[2];
      const inlineOptions = extractChoiceOptions(questionBody);
      const cleanedQuestion = inlineOptions.length > 0
        ? questionBody.split(/\s+[A-D][\.\):]\s+/)[0].trim()
        : questionBody;

      currentQuestion = {
        number: parseInt(questionMatch[1]),
        question: cleanedQuestion,
        options: [],
        correctAnswer: null
      };
      currentOptions = inlineOptions;
      continue;
    }

    // Check for options (A. B. C. D., A), A:, - A.)
    const optionMatch = line.match(/^(?:[-*]\s*)?([A-D])[\.\):]\s*(.+)/i);
    if (optionMatch && currentQuestion) {
      currentOptions.push({
        letter: optionMatch[1].toUpperCase(),
        text: optionMatch[2]
      });
      continue;
    }
  }

  // Add last question
  if (currentQuestion) {
    currentQuestion.options = currentOptions;
    questions.push(currentQuestion);
  }

  return questions;
}

function normalizeMultipleChoiceQuestions(questions) {
  return questions.map((question) => {
    const originalOptions = Array.isArray(question.options) ? question.options : [];
    const dedupedOptions = [];
    const seenOptionTexts = new Set();
    const correctAnswerLetter = question.correctAnswer?.toUpperCase() || null;

    originalOptions.forEach((option) => {
      const cleanedText = option.text?.replace(/\s+/g, " ").trim();
      if (!cleanedText) return;

      const normalizedTextKey = cleanedText.toLowerCase();
      if (seenOptionTexts.has(normalizedTextKey)) return;

      seenOptionTexts.add(normalizedTextKey);
      dedupedOptions.push({
        ...option,
        text: cleanedText,
        originalLetter: option.letter?.toUpperCase() || null,
        isOriginallyCorrect: option.letter?.toUpperCase() === correctAnswerLetter
      });
    });

    const fillerOptions = [
      "Review the notes for the correct answer.",
      "This option was unavailable from the quiz response.",
      "Choose the answer that best matches the lesson.",
      "Recheck the topic details in your saved notes."
    ];

    for (const fillerText of fillerOptions) {
      if (dedupedOptions.length >= 4) break;
      if (seenOptionTexts.has(fillerText.toLowerCase())) continue;

      seenOptionTexts.add(fillerText.toLowerCase());
      dedupedOptions.push({
        text: fillerText,
        originalLetter: null,
        isOriginallyCorrect: false
      });
    }

    const trimmedOptions = dedupedOptions.slice(0, 4);
    const shuffledOptions = [...trimmedOptions];

    for (let index = shuffledOptions.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffledOptions[index], shuffledOptions[randomIndex]] = [shuffledOptions[randomIndex], shuffledOptions[index]];
    }

    const normalizedOptions = shuffledOptions.map((option, index) => ({
      ...option,
      letter: String.fromCharCode(65 + index)
    }));

    const matchedCorrectOption = normalizedOptions.find((option) => option.isOriginallyCorrect);

    return {
      ...question,
      options: normalizedOptions,
      correctAnswer: matchedCorrectOption ? matchedCorrectOption.letter : null,
      correctAnswerText: matchedCorrectOption ? matchedCorrectOption.text : null
    };
  });
}

function parseTrueFalseQuiz(text) {
  const questions = [];
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);

  let inAnswerKey = false;

  for (const line of lines) {
    if (line.toLowerCase().includes('answer key') || line.toLowerCase().includes('answers:')) {
      inAnswerKey = true;
      continue;
    }

    if (inAnswerKey) {
      const answerMatch = line.match(/^(\d+)\.\s*(true|false)/i);
      if (answerMatch && questions[answerMatch[1] - 1]) {
        questions[answerMatch[1] - 1].correctAnswer = answerMatch[2].toLowerCase() === 'true';
      }
      continue;
    }

    const questionMatch = line.match(/^(\d+)\.\s*(.+)/);
    if (questionMatch) {
      questions.push({
        number: parseInt(questionMatch[1]),
        question: questionMatch[2],
        correctAnswer: null
      });
    }
  }

  return questions;
}

function parseIdentificationQuiz(text) {
  const questions = [];
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);

  let inAnswerKey = false;

  for (const line of lines) {
    if (line.toLowerCase().includes('answer key') || line.toLowerCase().includes('answers:')) {
      inAnswerKey = true;
      continue;
    }

    if (inAnswerKey) {
      const answerMatch = line.match(/^(\d+)\.\s*(.+)/i);
      if (answerMatch && questions[answerMatch[1] - 1]) {
        questions[answerMatch[1] - 1].correctAnswer = answerMatch[2].trim();
      }
      continue;
    }

    const questionMatch = line.match(/^(\d+)\.\s*(.+)/);
    if (questionMatch) {
      questions.push({
        number: parseInt(questionMatch[1]),
        question: questionMatch[2],
        correctAnswer: null
      });
    }
  }

  return questions;
}

function createQuizHtml(questions, quizType) {
  let html = '<div class="quiz-questions">';

  questions.forEach((question, index) => {
    html += `<div class="quiz-question" data-question-index="${index}">`;
    html += `<h4>Question ${question.number}: ${question.question}</h4>`;

    if (quizType === 'multiple_choice') {
      html += '<div class="quiz-options">';
      question.options.forEach(option => {
        html += `
          <label class="quiz-option">
            <input type="radio" name="question-${index}" value="${option.letter}">
            <span class="option-letter">${option.letter}.</span>
            <span class="option-text">${option.text}</span>
          </label>
        `;
      });
      html += '</div>';
    } else if (quizType === 'true_false') {
      html += `
        <div class="quiz-options">
          <label class="quiz-option">
            <input type="radio" name="question-${index}" value="true">
            <span>True</span>
          </label>
          <label class="quiz-option">
            <input type="radio" name="question-${index}" value="false">
            <span>False</span>
          </label>
        </div>
      `;
    } else if (quizType === 'identification') {
      html += `
        <div class="quiz-input">
          <input type="text" placeholder="Your answer here" class="identification-input">
        </div>
      `;
    } else if (quizType === 'essay') {
      html += `
        <div class="quiz-input">
          <textarea placeholder="Write your essay answer here" class="essay-input" rows="4"></textarea>
        </div>
      `;
    }

    html += '</div>';
  });

  html += '</div>';
  return html;
}

function renderInteractiveQuiz(rawText, quizType) {
  if (!quizResultContainer) return;

  let questions = [];

  if (quizType === "multiple_choice") {
    questions = parseMultipleChoiceQuiz(rawText);
    questions = normalizeMultipleChoiceQuestions(questions);
  } else if (quizType === "true_false") {
    questions = parseTrueFalseQuiz(rawText);
  } else if (quizType === "identification" || quizType === "essay") {
    questions = parseIdentificationQuiz(rawText);
  }

  if (!questions.length) {
    updateAIResult(quizResultContainer, rawText);
    setAIStatus(quizStatus, "Quiz generated, but it could not be converted into interactive questions.");
    return;
  }

  if (quizType === "multiple_choice" && questions.every((question) => question.options.length === 0)) {
    updateAIResult(quizResultContainer, rawText);
    setAIStatus(quizStatus, "Quiz generated, but the answer choices could not be parsed into interactive options.");
    return;
  }

  const quizHtml = `
    ${createQuizHtml(questions, quizType)}
    <button class="primary-btn" type="button" onclick="checkQuizAnswers(window.currentQuizQuestions, window.currentQuizType)">
      Submit Answers
    </button>
  `;

  window.currentQuizQuestions = questions;
  window.currentQuizType = quizType;
  quizResultContainer.innerHTML = quizHtml;
  quizResultContainer.style.display = "block";
}

function checkQuizAnswers(questions, quizType) {
  let correctCount = 0;
  let totalQuestions = questions.length;
  let resultsHtml = '<div class="quiz-results"><h3>Quiz Results</h3>';

  questions.forEach((question, index) => {
    const questionDiv = document.querySelector(`[data-question-index="${index}"]`);
    let userAnswer = null;
    let isCorrect = false;

    if (quizType === 'multiple_choice' || quizType === 'true_false') {
      const selectedOption = questionDiv.querySelector(`input[name="question-${index}"]:checked`);
      userAnswer = selectedOption ? selectedOption.value : null;
      isCorrect = userAnswer && (
        (quizType === 'multiple_choice' && userAnswer.toUpperCase() === question.correctAnswer) ||
        (quizType === 'true_false' && userAnswer === question.correctAnswer.toString())
      );
    } else if (quizType === 'identification') {
      const input = questionDiv.querySelector('.identification-input');
      userAnswer = input ? input.value.trim() : '';
      // For identification, we'll show the correct answer but not auto-grade
      isCorrect = null; // Manual grading for identification
    } else if (quizType === 'essay') {
      const textarea = questionDiv.querySelector('.essay-input');
      userAnswer = textarea ? textarea.value.trim() : '';
      // Essays need manual grading
      isCorrect = null;
    }

    const correctMultipleChoiceOption = quizType === 'multiple_choice'
      ? question.options?.find((option) => option.letter === question.correctAnswer)
      : null;
    const correctAnswerDisplay = quizType === 'multiple_choice'
      ? (correctMultipleChoiceOption
        ? `${correctMultipleChoiceOption.letter}. ${correctMultipleChoiceOption.text}`
        : (question.correctAnswerText || question.correctAnswer || 'Not available'))
      : (question.correctAnswer || 'Not available');
    const userAnswerDisplay = quizType === 'multiple_choice' && userAnswer
      ? (() => {
        const selectedChoice = question.options?.find((option) => option.letter === userAnswer);
        return selectedChoice ? `${selectedChoice.letter}. ${selectedChoice.text}` : userAnswer;
      })()
      : (userAnswer || 'No answer');

    // Update question styling
    if (isCorrect === true) {
      questionDiv.classList.add('correct');
      correctCount++;
    } else if (isCorrect === false) {
      questionDiv.classList.add('incorrect');
    }

    // Add result feedback
    let feedbackHtml = '';
    if (quizType === 'multiple_choice' || quizType === 'true_false') {
      feedbackHtml = `
        <div class="question-feedback">
          <strong>Your answer:</strong> ${userAnswerDisplay}
          <br><strong>Correct answer:</strong> ${correctAnswerDisplay}
          <br><span class="result-${isCorrect ? 'correct' : 'incorrect'}">${isCorrect ? '✓ Correct' : '✗ Incorrect'}</span>
        </div>
      `;
    } else if (quizType === 'identification') {
      feedbackHtml = `
        <div class="question-feedback">
          <strong>Your answer:</strong> ${userAnswer || 'No answer'}
          <br><strong>Correct answer:</strong> ${question.correctAnswer || 'Not available'}
          <br><em>(Manual grading required)</em>
        </div>
      `;
    } else if (quizType === 'essay') {
      feedbackHtml = `
        <div class="question-feedback">
          <strong>Your answer:</strong><br>${userAnswer || 'No answer'}
          <br><strong>Suggested answer:</strong><br>${question.correctAnswer || 'Not available'}
          <br><em>(Manual grading required)</em>
        </div>
      `;
    }

    questionDiv.insertAdjacentHTML('beforeend', feedbackHtml);
  });

  // Add overall score for auto-gradable questions
  if (quizType === 'multiple_choice' || quizType === 'true_false') {
    const score = Math.round((correctCount / totalQuestions) * 100);
    resultsHtml += `<div class="quiz-score">Score: ${correctCount}/${totalQuestions} (${score}%)</div>`;
  } else {
    resultsHtml += '<div class="quiz-score">Manual grading required for this quiz type.</div>';
  }

  resultsHtml += '<button class="secondary-btn" onclick="resetQuiz()">Take Quiz Again</button>';
  resultsHtml += '</div>';

  // Replace submit button with results
  const submitBtn = quizResultContainer.querySelector('.primary-btn');
  if (submitBtn) {
    submitBtn.outerHTML = resultsHtml;
  }
}

function resetQuiz() {
  // Reload the quiz page to start over
  showPage('quiz');
}

function updateCurrentSubjectHeading() {
  const subject = getSelectedSubject();
  if (!currentSubjectTitle) return;

  currentSubjectTitle.textContent = subject ? `Recording • ${subject.name}` : "Recording";
}

function showPage(pageId) {
  if (isRecording && pageId !== "record" && recognition) {
    recognition.stop();
  }

  pages.forEach((page) => {
    page.classList.toggle("hidden", page.id !== pageId);
  });

  pageButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.page === pageId);
  });

  if (pageId === "quiz") {
    populateQuizSubjectSelect();
  }
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
  populateQuizSubjectSelect();
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
  populateQuizSubjectSelect();
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
      localStorage.setItem(getSelectedSubjectStorageKey(), selectedSubjectId);
    } else {
      localStorage.removeItem(getSelectedSubjectStorageKey());
    }
  }

  editingSubjectId = null;
  editingSubjectDraft = "";
  updateCurrentSubjectHeading();
  renderSubjects();
  renderNotes();
  populateQuizSubjectSelect();
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
  populateQuizSubjectSelect();

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
  populateQuizSubjectSelect();
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
  if (!navigator.mediaDevices?.getUserMedia) {
    statusText.textContent = "This browser cannot access the microphone.";
    return null;
  }

  try {
    if (recordingStream) {
      return recordingStream;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    hasMicrophonePermission = true;
    recordingStream = stream;
    return stream;
  } catch (error) {
    console.error("Microphone access failed:", error);
    statusText.textContent = "Microphone access was blocked. Please allow microphone permission.";
    return null;
  }
}

function initializeSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    speechRecognitionSupported = false;
    statusText.textContent = "Browser speech recognition is unavailable. Audio will be transcribed after recording.";
    return;
  }

  speechRecognitionSupported = true;
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  recognition.onstart = () => {
    isRecognitionActive = true;
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
      statusText.textContent = "Speech recognition had a network issue. The app will fall back to backend transcription when recording stops.";
    } else if (errorCode === "audio-capture") {
      statusText.textContent = "No microphone was found for recording.";
    } else {
      statusText.textContent = "Recording error. Please try again.";
    }

    isRecognitionActive = false;
  };

  recognition.onend = () => {
    isRecognitionActive = false;
    if (!isRecording && (!statusText.textContent || statusText.textContent === "Listening...")) {
      statusText.textContent = "Tap to start recording";
    }
  };
}

function stopRecordingStream() {
  if (!recordingStream) return;
  recordingStream.getTracks().forEach((track) => track.stop());
  recordingStream = null;
}

function startMediaRecorder(stream) {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("This browser does not support audio recording.");
  }

  recordedAudioChunks = [];

  const recorderOptions = {};
  if (MediaRecorder.isTypeSupported?.("audio/webm;codecs=opus")) {
    recorderOptions.mimeType = "audio/webm;codecs=opus";
  } else if (MediaRecorder.isTypeSupported?.("audio/webm")) {
    recorderOptions.mimeType = "audio/webm";
  }

  mediaRecorder = Object.keys(recorderOptions).length > 0
    ? new MediaRecorder(stream, recorderOptions)
    : new MediaRecorder(stream);

  mediaRecorder.addEventListener("dataavailable", (event) => {
    if (event.data?.size) {
      recordedAudioChunks.push(event.data);
    }
  });

  mediaRecorder.start(250);
}

function stopMediaRecorder() {
  return new Promise((resolve) => {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      resolve(null);
      return;
    }

    const activeRecorder = mediaRecorder;
    activeRecorder.addEventListener("stop", () => {
      const mimeType = activeRecorder.mimeType || "audio/webm";
      const audioBlob = recordedAudioChunks.length
        ? new Blob(recordedAudioChunks, { type: mimeType })
        : null;
      mediaRecorder = null;
      recordedAudioChunks = [];
      stopRecordingStream();
      resolve(audioBlob);
    }, { once: true });

    activeRecorder.stop();
  });
}

async function transcribeRecordedAudio(audioBlob) {
  if (!audioBlob) {
    throw new Error("No audio was captured to transcribe.");
  }

  const formData = new FormData();
  formData.append("audio", audioBlob, `recording-${Date.now()}.webm`);

  let response;

  try {
    response = await fetchWithTimeout(BACKEND_TRANSCRIBE_URL, {
      method: "POST",
      body: formData
    }, 70000);
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error;
    }

    await wakeBackend();
    response = await fetchWithTimeout(BACKEND_TRANSCRIBE_URL, {
      method: "POST",
      body: formData
    }, 70000);
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Audio transcription failed.");
  }

  return (data.text || "").trim();
}

async function finalizeRecordingSession() {
  showLoading("Finalizing recording...", 30, { delay: 150 });

  if (speechRecognitionSupported && isRecognitionActive) {
    try {
      recognition.stop();
    } catch (error) {
      console.warn("Speech recognition stop failed:", error);
    }
  }

  const audioBlob = await stopMediaRecorder();
  isRecording = false;
  recordControls.classList.remove("recording");

  if (transcriptText.trim()) {
    hideLoading();
    statusText.textContent = "Transcription ready.";
    return;
  }

  statusText.textContent = "Transcribing audio...";

  try {
    const transcribedText = await transcribeRecordedAudio(audioBlob);
    transcriptText = transcribedText;
    textOutput.textContent = transcribedText || TRANSCRIPT_PLACEHOLDER;
    statusText.textContent = transcribedText
      ? "Transcription ready."
      : "Recording finished, but no speech was detected.";
  } catch (error) {
    statusText.textContent = error.message;
  } finally {
    hideLoading();
  }
}

async function toggleRecording() {
  const selectedSubject = getSelectedSubject();
  if (!selectedSubject) {
    alert("Please create or select a subject first.");
    return;
  }

  if (isRecording) {
    await finalizeRecordingSession();
    return;
  }

  const stream = await ensureMicrophoneAccess();
  if (!stream) return;

  transcriptText = "";
  textOutput.textContent = TRANSCRIPT_PLACEHOLDER;
  statusText.textContent = speechRecognitionSupported ? "Starting recording..." : "Recording...";

  try {
    startMediaRecorder(stream);
    isRecording = true;
    recordControls.classList.add("recording");

    if (speechRecognitionSupported && recognition) {
      try {
        recognition.start();
      } catch (recognitionError) {
        console.warn("Speech recognition could not start:", recognitionError);
        statusText.textContent = "Recording... audio will be transcribed after you stop.";
      }
    } else {
      statusText.textContent = "Recording... audio will be transcribed after you stop.";
    }
  } catch (error) {
    console.error("Recording could not start:", error);
    isRecording = false;
    recordControls.classList.remove("recording");
    stopRecordingStream();
    statusText.textContent = "Recording could not start. Please check microphone permissions and browser support.";
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

authTabs.forEach(tab => {
  tab.addEventListener("click", () => switchAuthTab(tab.dataset.tab));
});

authForm?.addEventListener("submit", handleAuth);

subjectInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    addSubject();
  }
});

function init() {
  checkAuth();
  loadSubjects();
  loadSelectedSubject();
  updateCurrentSubjectHeading();
  renderSubjects();
  renderNotes();
  populateQuizSubjectSelect();
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
window.generateSummary = generateSummary;
window.clearSummary = clearSummary;
window.generateQuiz = generateQuiz;
window.checkBackendHealth = checkBackendHealth;
window.resetQuiz = resetQuiz;
window.togglePasswordVisibility = togglePasswordVisibility;
window.closePopup = closePopup;
window.logout = logout;

init();
