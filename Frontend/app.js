// SIDEBAR
const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menuBtn");

menuBtn.onclick = () => {
    sidebar.classList.toggle("active");
};

// PAGE NAVIGATION
function showPage(id) {
    document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
    document.getElementById(id).classList.remove("hidden");
}

// DARK MODE
document.getElementById("darkToggle").onclick = () => {
    document.body.classList.toggle("light");
};

// SUBJECT SYSTEM
let subjects = JSON.parse(localStorage.getItem("subjects")) || [];

function addSubject() {
    const input = document.getElementById("subjectInput");
    subjects.push(input.value);
    localStorage.setItem("subjects", JSON.stringify(subjects));
    renderSubjects();
}

function renderSubjects() {
    const list = document.getElementById("subjectList");
    list.innerHTML = "";

    subjects.forEach(s => {
        const li = document.createElement("li");
        li.innerText = s;
        li.onclick = () => showPage("record");
        list.appendChild(li);
    });
}

renderSubjects();

// RECORDING (basic simulation)
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const textBox = document.getElementById("text");

startBtn.onclick = () => {
    textBox.innerText = "Recording...";
};

stopBtn.onclick = () => {
    typeText("This is a simulated transcription from your lecture...");
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

// SAVE NOTES
function saveNote() {
    let notes = JSON.parse(localStorage.getItem("notes")) || [];

    notes.push({
        content: textBox.innerText,
        date: new Date().toLocaleString()
    });

    localStorage.setItem("notes", JSON.stringify(notes));
    alert("Saved!");
}

// SHOW NOTES
function showNotes() {
    const container = document.getElementById("notesContainer");
    const notes = JSON.parse(localStorage.getItem("notes")) || [];

    container.innerHTML = "";

    notes.forEach(n => {
        const div = document.createElement("div");
        div.innerText = n.date + " - " + n.content;
        container.appendChild(div);
    });
}

document.getElementById("review").onclick = showNotes;

// EXPORT PDF
function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.text(textBox.innerText, 10, 10);
    doc.save("notes.pdf");
}
