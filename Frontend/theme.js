const THEME_STORAGE_KEY = "classnote_theme";

function applyTheme(theme) {
  const useDarkMode = theme === "dark";
  const icons = document.querySelectorAll("[data-theme-icon]");

  document.body.classList.toggle("dark-mode", useDarkMode);
  localStorage.setItem(THEME_STORAGE_KEY, useDarkMode ? "dark" : "light");

  icons.forEach((icon) => {
    icon.className = useDarkMode ? "fa-regular fa-sun" : "fa-regular fa-moon";
  });
}

function toggleTheme() {
  const nextTheme = document.body.classList.contains("dark-mode") ? "light" : "dark";
  applyTheme(nextTheme);
}

function initTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || "light";
  const buttons = document.querySelectorAll("[data-theme-toggle]");

  applyTheme(savedTheme);

  buttons.forEach((button) => {
    button.addEventListener("click", toggleTheme);
  });
}

window.ClassNoteTheme = {
  applyTheme,
  initTheme,
  toggleTheme
};

initTheme();
