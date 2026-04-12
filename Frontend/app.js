// SIDEBAR
const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menuBtn");
const closeBtn = document.getElementById("closeSidebar");

menuBtn.onclick = () => sidebar.classList.add("active");
closeBtn.onclick = () => sidebar.classList.remove("active");

// PAGE NAV
function showPage(id) {
    document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
    document.getElementById(id).classList.remove("hidden");

    if (id === "review") showNotes();
}

// DARK MODE
document.getElementById("darkToggle").onclick = () => {
    document.body.classList.toggle("light");
};

// ===== SUBJECT SYSTEM =====

let subjects = JSON.parse(localStorage.getItem("subjects")) || [];
let currentSubject = null;

function saveSubjects() {
    localStorage.setItem("subjects", JSON.stringify(subjects));
}

function addSubject() {
    const input = document.getElementById("subjectInput");
    if (!input.value.trim()) return;

    subjects.push({
        name: input.value,
        notes: []
    });

    input.value = "";
    saveSubjects();
    renderSubjects();
}

function renderSubjects() {
    const list = document.getElementById("subjectList");
    list.innerHTML = "";

    subjects.forEach((subject, index) => {
        const li = document.createElement("li");

        li.onclick = () => selectSubject(index);

        li.innerHTML = `
            <span>${subject.name}</span>
            <div>
              <button onclick="event.stopPropagation(); renameSubject(${index})">✏️</button>
              <button onclick="event.stopPropagation(); deleteSubject(${index})">❌</button>
             </div>
`;

        list.appendChild(li);
    });
}

function selectSubject(index) {
    currentSubject = index;
    showPage("record");
}

function deleteSubject(index) {
    subjects.splice(index, 1);
    saveSubjects();
    renderSubjects();
}


function renameSubject(index) {
    const newName = prompt("Enter new name:");
    if (!newName) return;

    subjects[index].name = newName;
    saveSubjects();
    renderSubjects();
}

renderSubjects();

// ===== RECORDING (SIMULATED) =====

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const textBox = document.getElementById("text");

startBtn.onclick = () => {
    textBox.innerText = "Recording...";
};

stopBtn.onclick = () => {
    typeText("This is a simulated transcription of your lecture...");
};

// TYPING EFFECT
function typeText(text) {
    let i = 0;
    textBox.innerText = "";

    function typing() {
        if (i < text.length) {
            textBox.innerText += text.charAt(i);
            i++;
            setTimeout(typing, 20);
        }
    }

    typing();
}

// SAVE NOTE
function saveNote() {
    if (currentSubject === null) {
        alert("Select a subject first!");
        return;
    }

    subjects[currentSubject].notes.push({
        content: textBox.innerText,
        date: new Date().toLocaleString()
    });

    saveSubjects();
    alert("Saved!");
}

// SHOW NOTES
function showNotes() {
    const container = document.getElementById("notesContainer");

    if (currentSubject === null) {
        container.innerHTML = "Select a subject first!";
        return;
    }

    const notes = subjects[currentSubject].notes;

    container.innerHTML = "";

    notes.forEach(n => {
        const div = document.createElement("div");
        div.innerHTML = `<b>${n.date}</b><br>${n.content}<hr>`;
        container.appendChild(div);
    });
}

// EXPORT PDF
function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.text(textBox.innerText, 10, 10);
    doc.save("notes.pdf");
}
