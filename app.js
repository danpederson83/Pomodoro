const SETTINGS_STORAGE_KEY = "pomodoro.settings.v1";
const TASKS_STORAGE_KEY = "pomodoro.tasks.v1";
const SETTINGS_OPEN_STORAGE_KEY = "pomodoro.settingsOpen.v1";

const DEFAULT_SETTINGS = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  autoAdvance: true
};

const PHASE_INFO = {
  work: {
    label: "Work",
    className: "phase-work"
  },
  shortBreak: {
    label: "Short Break",
    className: "phase-short-break"
  },
  longBreak: {
    label: "Long Break",
    className: "phase-long-break"
  }
};

const dom = {
  phaseLabel: document.getElementById("phaseLabel"),
  progressBar: document.getElementById("progressBar"),
  timeMinutes: document.getElementById("timeMinutes"),
  timeSeconds: document.getElementById("timeSeconds"),
  periods: Array.from(document.querySelectorAll("#pomodoroDots .period")),
  startPauseBtn: document.getElementById("startPauseBtn"),
  resetBtn: document.getElementById("resetBtn"),
  nextBtn: document.getElementById("nextBtn"),
  workMinutesInput: document.getElementById("workMinutesInput"),
  shortBreakMinutesInput: document.getElementById("shortBreakMinutesInput"),
  longBreakMinutesInput: document.getElementById("longBreakMinutesInput"),
  autoAdvanceInput: document.getElementById("autoAdvanceInput"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn"),
  settingsToggle: document.getElementById("settingsToggle"),
  settingsSection: document.querySelector(".settings"),
  taskForm: document.getElementById("taskForm"),
  taskInput: document.getElementById("taskInput"),
  taskList: document.getElementById("taskList")
};

const state = {
  settings: loadSettings(),
  currentPhase: "work",
  secondsRemaining: 0,
  timerId: null,
  isRunning: false,
  completedWorkSessions: 0,
  tasks: loadTasks(),
  settingsOpen: loadSettingsOpen()
};

state.secondsRemaining = getPhaseDurationSeconds(state.currentPhase);
populateSettingsInputs();
applySettingsOpenState();
renderTasks();
render();

dom.startPauseBtn.addEventListener("click", onStartPauseClick);
dom.resetBtn.addEventListener("click", onResetClick);
dom.nextBtn.addEventListener("click", onNextClick);
dom.saveSettingsBtn.addEventListener("click", onSaveSettingsClick);
dom.settingsToggle.addEventListener("click", onSettingsToggleClick);
dom.taskForm.addEventListener("submit", onTaskFormSubmit);
dom.taskList.addEventListener("change", onTaskListChange);
dom.taskList.addEventListener("click", onTaskListClick);

function onStartPauseClick() {
  if (!state.isRunning) {
    requestNotificationPermissionIfNeeded();
    startTimer();
    return;
  }
  pauseTimer();
}

function onResetClick() {
  pauseTimer();
  state.currentPhase = "work";
  state.secondsRemaining = getPhaseDurationSeconds("work");
  state.completedWorkSessions = 0;
  render();
}

function onSettingsToggleClick() {
  state.settingsOpen = !state.settingsOpen;
  saveSettingsOpen(state.settingsOpen);
  applySettingsOpenState();
}

function applySettingsOpenState() {
  dom.settingsSection.classList.toggle("collapsed", !state.settingsOpen);
  dom.settingsToggle.setAttribute("aria-expanded", String(state.settingsOpen));
}

function onSaveSettingsClick() {
  const nextSettings = {
    workMinutes: clampInt(dom.workMinutesInput.value, 1, 120, state.settings.workMinutes),
    shortBreakMinutes: clampInt(dom.shortBreakMinutesInput.value, 1, 60, state.settings.shortBreakMinutes),
    longBreakMinutes: clampInt(dom.longBreakMinutesInput.value, 1, 90, state.settings.longBreakMinutes),
    autoAdvance: Boolean(dom.autoAdvanceInput.checked)
  };

  state.settings = nextSettings;
  saveSettings(nextSettings);
  state.secondsRemaining = getPhaseDurationSeconds(state.currentPhase);
  render();
}

function startTimer() {
  if (state.timerId !== null) {
    return;
  }

  state.isRunning = true;
  dom.startPauseBtn.textContent = "Pause";
  state.timerId = window.setInterval(tick, 1000);
  render();
}

function pauseTimer() {
  if (state.timerId !== null) {
    window.clearInterval(state.timerId);
  }
  state.timerId = null;
  state.isRunning = false;
  dom.startPauseBtn.textContent = "Start";
  render();
}

function tick() {
  if (state.secondsRemaining > 0) {
    state.secondsRemaining -= 1;
    render();
    return;
  }

  completeCurrentPhase();
}

function completeCurrentPhase() {
  const finishedPhase = state.currentPhase;

  if (finishedPhase === "work") {
    state.completedWorkSessions += 1;
  }

  playChime();
  showNotification(`${PHASE_INFO[finishedPhase].label} complete`, getNotificationBody(finishedPhase));

  const nextPhase = getNextPhase(finishedPhase);
  state.currentPhase = nextPhase;
  state.secondsRemaining = getPhaseDurationSeconds(nextPhase);

  if (!state.settings.autoAdvance) {
    pauseTimer();
  }

  render();
}

function getNextPhase(phase) {
  if (phase === "work") {
    return state.completedWorkSessions % 4 === 0 ? "longBreak" : "shortBreak";
  }
  return "work";
}

function onNextClick() {
  pauseTimer();
  if (state.currentPhase === "work") {
    state.currentPhase = state.completedWorkSessions === 3 ? "longBreak" : "shortBreak";
  } else {
    if (state.currentPhase === "longBreak") {
      state.completedWorkSessions = 0;
    } else {
      state.completedWorkSessions += 1;
    }
    state.currentPhase = "work";
  }
  state.secondsRemaining = getPhaseDurationSeconds(state.currentPhase);
  render();
}

function getPhaseDurationSeconds(phase) {
  if (phase === "work") {
    return state.settings.workMinutes * 60;
  }
  if (phase === "shortBreak") {
    return state.settings.shortBreakMinutes * 60;
  }
  return state.settings.longBreakMinutes * 60;
}

function getNotificationBody(phase) {
  if (phase === "work") {
    return state.currentPhase === "longBreak"
      ? "Time for a long break."
      : "Time for a short break.";
  }
  return "Back to work.";
}

function render() {
  const phaseMeta = PHASE_INFO[state.currentPhase];

  dom.phaseLabel.textContent = phaseMeta.label;
  const minutes = Math.floor(state.secondsRemaining / 60);
  const seconds = state.secondsRemaining % 60;
  dom.timeMinutes.textContent = String(minutes).padStart(2, "0");
  dom.timeSeconds.textContent = String(seconds).padStart(2, "0");
  updateProgressBar();
  updatePeriodIndicators();
  updateBodyPhaseClass(phaseMeta.className);
  document.body.classList.toggle("timer-running", state.isRunning);
  updatePageTitle();
}

function updateProgressBar() {
  const totalSeconds = getPhaseDurationSeconds(state.currentPhase);
  const elapsedSeconds = totalSeconds - state.secondsRemaining;
  const progressPercent = totalSeconds > 0 ? (elapsedSeconds / totalSeconds) * 100 : 0;

  dom.progressBar.style.setProperty("--progress", `${progressPercent}%`);
  dom.progressBar.setAttribute("aria-valuenow", Math.round(progressPercent));
  dom.progressBar.classList.toggle("active", state.isRunning);
}

function getCurrentPeriodIndex() {
  if (state.currentPhase === "work") {
    return state.completedWorkSessions * 2;
  }
  if (state.currentPhase === "shortBreak") {
    return state.completedWorkSessions * 2 + 1;
  }
  return 7; // longBreak
}

function updatePeriodIndicators() {
  const current = getCurrentPeriodIndex();
  dom.periods.forEach((el, index) => {
    el.classList.toggle("filled", index <= current);
  });
}

function updateBodyPhaseClass(nextClassName) {
  Object.values(PHASE_INFO).forEach((phase) => {
    document.body.classList.remove(phase.className);
  });
  document.body.classList.add(nextClassName);
}

function updatePageTitle() {
  document.title = `${formatMMSS(state.secondsRemaining)} - ${PHASE_INFO[state.currentPhase].label}`;
}

function formatMMSS(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function requestNotificationPermissionIfNeeded() {
  if (!("Notification" in window)) {
    return;
  }
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

function showNotification(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }
  new Notification(title, { body });
}

function playChime() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    return;
  }

  const audioContext = new AudioCtx();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 880;
  gainNode.gain.value = 0.0001;

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  const now = audioContext.currentTime;
  gainNode.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

  oscillator.start(now);
  oscillator.stop(now + 0.37);

  oscillator.onended = () => {
    audioContext.close().catch(() => {});
  };
}

function populateSettingsInputs() {
  dom.workMinutesInput.value = String(state.settings.workMinutes);
  dom.shortBreakMinutesInput.value = String(state.settings.shortBreakMinutes);
  dom.longBreakMinutesInput.value = String(state.settings.longBreakMinutes);
  dom.autoAdvanceInput.checked = Boolean(state.settings.autoAdvance);
}

function loadSettings() {
  try {
    const rawValue = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!rawValue) {
      return { ...DEFAULT_SETTINGS };
    }
    const parsed = JSON.parse(rawValue);
    return {
      workMinutes: clampInt(parsed.workMinutes, 1, 120, DEFAULT_SETTINGS.workMinutes),
      shortBreakMinutes: clampInt(parsed.shortBreakMinutes, 1, 60, DEFAULT_SETTINGS.shortBreakMinutes),
      longBreakMinutes: clampInt(parsed.longBreakMinutes, 1, 90, DEFAULT_SETTINGS.longBreakMinutes),
      autoAdvance: Boolean(parsed.autoAdvance)
    };
  } catch (_error) {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function loadSettingsOpen() {
  try {
    const raw = localStorage.getItem(SETTINGS_OPEN_STORAGE_KEY);
    if (raw === null) {
      return false;
    }
    return JSON.parse(raw) === true;
  } catch (_error) {
    return false;
  }
}

function saveSettingsOpen(open) {
  localStorage.setItem(SETTINGS_OPEN_STORAGE_KEY, JSON.stringify(open));
}

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  if (parsed < min) {
    return min;
  }
  if (parsed > max) {
    return max;
  }
  return parsed;
}

function onTaskFormSubmit(e) {
  e.preventDefault();
  const text = dom.taskInput.value.trim();
  if (!text) {
    return;
  }
  state.tasks.push({
    id: String(Date.now()),
    text,
    completed: false
  });
  saveTasks(state.tasks);
  dom.taskInput.value = "";
  renderTasks();
}

function onTaskListChange(e) {
  if (!e.target.classList.contains("task-checkbox")) {
    return;
  }
  const item = e.target.closest("[data-task-id]");
  if (!item) {
    return;
  }
  const id = item.getAttribute("data-task-id");
  const task = state.tasks.find((t) => t.id === id);
  if (task) {
    task.completed = e.target.checked;
    saveTasks(state.tasks);
    renderTasks();
  }
}

function onTaskListClick(e) {
  if (!e.target.classList.contains("task-remove")) {
    return;
  }
  const item = e.target.closest("[data-task-id]");
  if (!item) {
    return;
  }
  const id = item.getAttribute("data-task-id");
  state.tasks = state.tasks.filter((t) => t.id !== id);
  saveTasks(state.tasks);
  renderTasks();
}

function renderTasks() {
  dom.taskList.innerHTML = state.tasks
    .map(
      (task) =>
        `<li data-task-id="${escapeHtml(task.id)}" class="task-item${task.completed ? " completed" : ""}">
          <label class="task-row">
            <input type="checkbox" class="task-checkbox" ${task.completed ? "checked" : ""} aria-label="Mark complete">
            <span class="task-text">${escapeHtml(task.text)}</span>
          </label>
          <button type="button" class="task-remove" aria-label="Remove task">×</button>
        </li>`
    )
    .join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (t) => t && typeof t.id === "string" && typeof t.text === "string" && typeof t.completed === "boolean"
    );
  } catch (_error) {
    return [];
  }
}

function saveTasks(tasks) {
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
}
