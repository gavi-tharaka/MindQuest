// ============================================================================
// MINDQUEST — GAMIFIED HABIT RPG & MINDFUL STUDIO (UNIVERSAL APP ENGINE)
// ============================================================================

class ArtStudio {
  constructor(options = {}) {
    this.canvas = document.getElementById(options.canvasId || "drawing-canvas");
    this.ctx = this.canvas ? this.canvas.getContext("2d", { willReadFrequently: true }) : null;
    this.container = document.getElementById(options.containerId || "canvas-studio-wrapper");

    this.tool = "pen";
    this.color = "#1e293b";
    this.brushSize = 5;
    this.opacity = 1;
    this.bgColor = "#ffffff";
    this.isDrawing = false;
    this.hasContent = false;
    this.isFullscreen = false;

    this.history = [];
    this.redoStack = [];
    this.maxHistory = 25;

    this.startX = 0;
    this.startY = 0;
    this.snapshotBeforeShape = null;

    if (this.canvas && this.ctx) {
      this.init();
    }
  }

  init() {
    this.resetCanvas(false);
    this.bindEvents();
    this.bindToolbarUI();
  }

  resetCanvas(saveUndo = true) {
    if (!this.ctx) return;
    if (saveUndo && this.hasContent) {
      this.pushHistory();
    }
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = "source-over";
    this.ctx.fillStyle = this.bgColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.hasContent = false;
    this.history = [];
    this.redoStack = [];
    this.pushHistory();
    this.updateHistoryButtons();
  }

  pushHistory() {
    if (!this.ctx) return;
    try {
      const imgData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      this.history.push(imgData);
      if (this.history.length > this.maxHistory) {
        this.history.shift();
      }
      this.updateHistoryButtons();
    } catch (_) {}
  }

  undo() {
    if (!this.ctx || this.history.length <= 1) return;
    const current = this.history.pop();
    this.redoStack.push(current);
    const prev = this.history[this.history.length - 1];
    if (prev) {
      this.ctx.putImageData(prev, 0, 0);
      this.hasContent = this.history.length > 1;
    }
    this.updateHistoryButtons();
  }

  redo() {
    if (!this.ctx || this.redoStack.length === 0) return;
    const next = this.redoStack.pop();
    this.history.push(next);
    this.ctx.putImageData(next, 0, 0);
    this.hasContent = true;
    this.updateHistoryButtons();
  }

  updateHistoryButtons() {
    const undoBtn = document.getElementById("canvas-undo-btn");
    const redoBtn = document.getElementById("canvas-redo-btn");
    if (undoBtn) undoBtn.disabled = this.history.length <= 1;
    if (redoBtn) redoBtn.disabled = this.redoStack.length === 0;
  }

  getPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / (rect.width || 1);
    const scaleY = this.canvas.height / (rect.height || 1);
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  bindEvents() {
    this.canvas.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch (_) {}
      const { x, y } = this.getPos(e);

      if (this.tool === "bucket") {
        this.redoStack = [];
        this.floodFill(Math.round(x), Math.round(y), this.color);
        this.hasContent = true;
        this.pushHistory();
        return;
      }

      this.isDrawing = true;
      this.hasContent = true;
      this.redoStack = [];
      this.startX = x;
      this.startY = y;

      if (["line", "rect", "circle"].includes(this.tool)) {
        this.snapshotBeforeShape = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        return;
      }

      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      this.applyBrushSettings();

      if (this.tool === "airbrush") {
        this.sprayAt(x, y);
      } else {
        this.ctx.lineTo(x + 0.01, y + 0.01);
        this.ctx.stroke();
      }
    });

    this.canvas.addEventListener("pointermove", (e) => {
      if (!this.isDrawing) return;
      const { x, y } = this.getPos(e);

      if (["line", "rect", "circle"].includes(this.tool)) {
        if (this.snapshotBeforeShape) {
          this.ctx.putImageData(this.snapshotBeforeShape, 0, 0);
        }
        this.applyBrushSettings();
        this.drawShapePreview(this.startX, this.startY, x, y);
        return;
      }

      if (this.tool === "airbrush") {
        this.sprayAt(x, y);
        return;
      }

      this.applyBrushSettings();
      this.ctx.lineTo(x, y);
      this.ctx.stroke();
    });

    const finishStroke = () => {
      if (!this.isDrawing) return;
      this.isDrawing = false;
      this.ctx.globalAlpha = 1;
      this.ctx.globalCompositeOperation = "source-over";
      this.snapshotBeforeShape = null;
      this.pushHistory();
    };

    this.canvas.addEventListener("pointerup", finishStroke);
    this.canvas.addEventListener("pointercancel", finishStroke);
  }

  applyBrushSettings() {
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.globalCompositeOperation = "source-over";

    if (this.tool === "eraser") {
      this.ctx.strokeStyle = this.bgColor;
      this.ctx.lineWidth = this.brushSize * 2.2;
      this.ctx.globalAlpha = 1;
    } else if (this.tool === "marker") {
      this.ctx.strokeStyle = this.color;
      this.ctx.lineWidth = this.brushSize * 2.5;
      this.ctx.globalAlpha = 0.35;
    } else {
      this.ctx.strokeStyle = this.color;
      this.ctx.lineWidth = this.brushSize;
      this.ctx.globalAlpha = this.opacity;
    }
  }

  sprayAt(x, y) {
    const density = Math.max(15, this.brushSize * 3);
    const radius = this.brushSize * 2;
    this.ctx.fillStyle = this.color;
    this.ctx.globalAlpha = 0.25;
    for (let i = 0; i < density; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      const dx = x + Math.cos(angle) * r;
      const dy = y + Math.sin(angle) * r;
      this.ctx.fillRect(dx, dy, 1.5, 1.5);
    }
  }

  drawShapePreview(x1, y1, x2, y2) {
    this.ctx.beginPath();
    if (this.tool === "line") {
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();
    } else if (this.tool === "rect") {
      this.ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    } else if (this.tool === "circle") {
      const rx = Math.abs(x2 - x1) / 2;
      const ry = Math.abs(y2 - y1) / 2;
      const cx = Math.min(x1, x2) + rx;
      const cy = Math.min(y1, y2) + ry;
      this.ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      this.ctx.stroke();
    }
  }

  floodFill(startX, startY, fillHex) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;

    const imgData = this.ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    const fillRGB = this.hexToRgb(fillHex);
    const startPos = (startY * width + startX) * 4;
    const startR = data[startPos];
    const startG = data[startPos + 1];
    const startB = data[startPos + 2];
    const startA = data[startPos + 3];

    if (
      Math.abs(startR - fillRGB.r) < 5 &&
      Math.abs(startG - fillRGB.g) < 5 &&
      Math.abs(startB - fillRGB.b) < 5 &&
      startA > 240
    ) {
      return;
    }

    const tolerance = 38;
    const visited = new Uint8Array(width * height);
    const stack = [startX, startY];

    const matchesStart = (pos) =>
      Math.abs(data[pos] - startR) <= tolerance &&
      Math.abs(data[pos + 1] - startG) <= tolerance &&
      Math.abs(data[pos + 2] - startB) <= tolerance &&
      Math.abs(data[pos + 3] - startA) <= tolerance;

    while (stack.length > 0) {
      const y = stack.pop();
      const x = stack.pop();
      const idx = y * width + x;

      if (x < 0 || x >= width || y < 0 || y >= height || visited[idx]) continue;
      const pos = idx * 4;
      if (!matchesStart(pos)) continue;

      visited[idx] = 1;
      data[pos] = fillRGB.r;
      data[pos + 1] = fillRGB.g;
      data[pos + 2] = fillRGB.b;
      data[pos + 3] = 255;

      stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
    }

    this.ctx.putImageData(imgData, 0, 0);
  }

  hexToRgb(hex) {
    const clean = hex.replace("#", "");
    const num = parseInt(clean.length === 3 ? clean.replace(/(.)/g, "$1$1") : clean, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  loadDataUrlToCanvas(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.ctx.fillStyle = this.bgColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        const ratio = Math.min(this.canvas.width / img.width, this.canvas.height / img.height);
        const w = img.width * ratio;
        const h = img.height * ratio;
        const x = (this.canvas.width - w) / 2;
        const y = (this.canvas.height - h) / 2;
        this.ctx.drawImage(img, x, y, w, h);
        this.hasContent = true;
        this.pushHistory();
        resolve();
      };
      img.src = dataUrl;
    });
  }

  toggleFullscreen(forceState) {
    this.isFullscreen = typeof forceState === "boolean" ? forceState : !this.isFullscreen;
    if (this.container) {
      this.container.classList.toggle("studio-fullscreen", this.isFullscreen);
    }
    const fsBtn = document.getElementById("toggle-fullscreen-canvas-btn");
    if (fsBtn) {
      fsBtn.innerHTML = this.isFullscreen
        ? `<i class="ri-fullscreen-exit-line"></i> Exit Fullscreen`
        : `<i class="ri-fullscreen-line"></i> Fullscreen`;
    }
  }

  bindToolbarUI() {
    document.querySelectorAll("[data-canvas-tool]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-canvas-tool]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.tool = btn.dataset.canvasTool;
      });
    });

    document.querySelectorAll(".color-swatch").forEach((swatch) => {
      swatch.addEventListener("click", () => {
        document.querySelectorAll(".color-swatch").forEach((s) => s.classList.remove("active"));
        swatch.classList.add("active");
        this.color = swatch.dataset.color;
        const customPicker = document.getElementById("custom-color-picker");
        if (customPicker) customPicker.value = this.color;
        if (this.tool === "eraser") this.setTool("pen");
      });
    });

    const customPicker = document.getElementById("custom-color-picker");
    if (customPicker) {
      customPicker.addEventListener("input", (e) => {
        this.color = e.target.value;
        document.querySelectorAll(".color-swatch").forEach((s) => s.classList.remove("active"));
        if (this.tool === "eraser") this.setTool("pen");
      });
    }

    const brushSizeInput = document.getElementById("brush-size");
    const brushSizeLabel = document.getElementById("brush-size-label");
    if (brushSizeInput) {
      brushSizeInput.addEventListener("input", (e) => {
        this.brushSize = Number(e.target.value);
        if (brushSizeLabel) brushSizeLabel.textContent = `${this.brushSize}px`;
      });
    }

    document.querySelectorAll("[data-paper-bg]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-paper-bg]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.bgColor = btn.dataset.paperBg;
        this.floodFill(2, 2, this.bgColor);
        this.pushHistory();
      });
    });

    const undoBtn = document.getElementById("canvas-undo-btn");
    if (undoBtn) undoBtn.addEventListener("click", () => this.undo());

    const redoBtn = document.getElementById("canvas-redo-btn");
    if (redoBtn) redoBtn.addEventListener("click", () => this.redo());

    const clearBtn = document.getElementById("clear-canvas-btn");
    if (clearBtn) clearBtn.addEventListener("click", () => this.resetCanvas(true));

    const downloadBtn = document.getElementById("download-canvas-btn");
    if (downloadBtn) {
      downloadBtn.addEventListener("click", () => {
        const link = document.createElement("a");
        link.download = `mindquest-art-${Date.now()}.png`;
        link.href = this.canvas.toDataURL("image/png");
        link.click();
      });
    }

    const fsBtn = document.getElementById("toggle-fullscreen-canvas-btn");
    if (fsBtn) fsBtn.addEventListener("click", () => this.toggleFullscreen());

    const fsCloseBtn = document.getElementById("close-fullscreen-studio-btn");
    if (fsCloseBtn) fsCloseBtn.addEventListener("click", () => this.toggleFullscreen(false));
  }

  setTool(toolName) {
    this.tool = toolName;
    document.querySelectorAll("[data-canvas-tool]").forEach((b) => {
      b.classList.toggle("active", b.dataset.canvasTool === toolName);
    });
  }

  toDataURL() {
    return this.hasContent ? this.canvas.toDataURL("image/png", 0.85) : null;
  }
}

// ============================================================================
// 1. STATE & CONSTANTS
// ============================================================================
let fb = null;
let currentUser = null;
let isLocalMode = false;
let userProfile = null;
let habitsCache = [];
let tasksCache = [];
let rewardsCache = [];
let journalsCache = [];
let remindersCache = [];
let categoriesCache = [];
let unsubscribers = [];

// UI State
let activeMainTab = "home";
let activeOthersSec = "reminders";
let selectedMood = "good";
let habitFilter = "all";
let taskFilter = "pending";
let journalMediaMode = "none";
let uploadedJournalDataUrl = null;
let selectedAvatarDraft = "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix";
let selectedTaskDuration = "30";
let selectedCategoryIcon = "ri-mental-health-fill";
let selectedCategoryColor = "#4f46e5";
let calendarCursor = new Date();
let selectedCalendarDateStr = toDateString(new Date());
let pendingConfirmAction = null;

// Edit State Variables
let editingHabitId = null;
let editingTaskId = null;
let editingReminderId = null;
let editingJournalId = null;
let editingCategoryId = null;
let editingRewardId = null;
let activeDetailPopup = null;

const artStudio = new ArtStudio({
  canvasId: "drawing-canvas",
  containerId: "canvas-studio-wrapper"
});

const PRIORITY_MULTIPLIER = { High: 1.5, Medium: 1.25, Low: 1.0 };
const PRIORITY_WEIGHT_ORDER = { High: 3, Medium: 2, Low: 1 };
const TASK_PRIORITY_POINTS = { High: 50, Medium: 30, Low: 15 };

const DEFAULT_CATEGORIES = [
  { id: "cat-mindfulness", name: "Mindfulness", icon: "ri-mental-health-fill", color: "#8b5cf6" },
  { id: "cat-health", name: "Health & Fitness", icon: "ri-heart-pulse-fill", color: "#10b981" },
  { id: "cat-work", name: "Work & Career", icon: "ri-briefcase-4-fill", color: "#4f46e5" },
  { id: "cat-study", name: "Study & Learning", icon: "ri-book-read-fill", color: "#06b6d4" },
  { id: "cat-finance", name: "Finance", icon: "ri-money-dollar-circle-fill", color: "#f59e0b" },
  { id: "cat-personal", name: "Personal Life", icon: "ri-home-heart-fill", color: "#e11d48" }
];

// ============================================================================
// 2. PWA SERVICE WORKER REGISTRATION
// ============================================================================
if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

// ============================================================================
// 3. UTILITIES, TOASTS & CONFIRMATION DIALOG
// ============================================================================
function toDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}

function showToast(message, icon = "ri-sparkling-2-fill") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<i class="${icon}"></i><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.25s ease";
    setTimeout(() => toast.remove(), 260);
  }, 3200);
}

function openConfirmModal(title, description, onConfirm) {
  document.getElementById("confirm-modal-title").textContent = title;
  document.getElementById("confirm-modal-desc").textContent = description;
  pendingConfirmAction = onConfirm;
  document.getElementById("confirm-modal").classList.remove("hidden");
}

document.getElementById("confirm-cancel-btn").addEventListener("click", () => {
  pendingConfirmAction = null;
  document.getElementById("confirm-modal").classList.add("hidden");
});

document.getElementById("confirm-accept-btn").addEventListener("click", async () => {
  const fn = pendingConfirmAction;
  pendingConfirmAction = null;
  document.getElementById("confirm-modal").classList.add("hidden");
  if (typeof fn === "function") await fn();
});

// ============================================================================
// 4. PERSISTENT STORAGE ENGINE
// ============================================================================
function getUidKey() {
  return currentUser ? currentUser.uid : "local_hero";
}

function saveLocalDataStore() {
  if (!isLocalMode) return;
  const uid = getUidKey();
  try {
    localStorage.setItem(
      `mindquest_store_${uid}`,
      JSON.stringify({
        userProfile,
        habitsCache,
        tasksCache,
        rewardsCache,
        journalsCache
      })
    );
  } catch (_) {}
}

function loadLocalDataStore(uid = "local_hero") {
  try {
    const raw = localStorage.getItem(`mindquest_store_${uid}`);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.userProfile) {
        userProfile = data.userProfile;
        habitsCache = data.habitsCache || [];
        tasksCache = data.tasksCache || [];
        rewardsCache = data.rewardsCache || [];
        journalsCache = data.journalsCache || [];
        return true;
      }
    }
  } catch (_) {}
  return false;
}

function loadCategories() {
  try {
    const raw = localStorage.getItem(`mindquest_categories_${getUidKey()}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        categoriesCache = parsed;
        return;
      }
    }
  } catch (_) {}
  categoriesCache = [...DEFAULT_CATEGORIES];
}

function saveCategories() {
  try {
    localStorage.setItem(`mindquest_categories_${getUidKey()}`, JSON.stringify(categoriesCache));
  } catch (_) {}
}

function getCategoryById(catId) {
  return (
    categoriesCache.find((c) => c.id === catId || c.name === catId) ||
    categoriesCache[0] ||
    DEFAULT_CATEGORIES[0]
  );
}

function loadExtendedMetaMap() {
  try {
    const raw = localStorage.getItem(`mindquest_ext_meta_${getUidKey()}`);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return {};
}

function saveExtendedMeta(key, data) {
  const map = loadExtendedMetaMap();
  map[key] = { ...(map[key] || {}), ...data };
  try {
    localStorage.setItem(`mindquest_ext_meta_${getUidKey()}`, JSON.stringify(map));
  } catch (_) {}
}

function getExtendedMeta(id, titleFallback) {
  const map = loadExtendedMetaMap();
  return map[id] || map[titleFallback] || {};
}

function loadReminders() {
  try {
    const raw = localStorage.getItem(`mindquest_reminders_${getUidKey()}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      remindersCache = Array.isArray(parsed)
        ? parsed.filter(
            (r) =>
              r.id !== "rem-default-1" &&
              r.title !== "Evening Mindfulness & Hydrate Check"
          )
        : [];
      saveReminders();
      return;
    }
  } catch (_) {}
  remindersCache = [];
}

function saveReminders() {
  try {
    localStorage.setItem(`mindquest_reminders_${getUidKey()}`, JSON.stringify(remindersCache));
  } catch (_) {}
}

// ============================================================================
// 5. LOGIN & SESSION MANAGEMENT
// ============================================================================
function startLocalOrDemoSession(customName = "Explorer", customEmail = "hero@mindquest.app") {
  isLocalMode = true;
  currentUser = { uid: "local_hero", email: customEmail, displayName: customName };
  localStorage.setItem("mindquest_active_local_session", JSON.stringify(currentUser));

  loadCategories();
  syncCategoryDropdowns();
  loadReminders();

  const hasSavedStore = loadLocalDataStore("local_hero");
  if (!hasSavedStore) {
    const now = new Date();
    const futureHour = Math.min(23, now.getHours() + 2);
    const passedHour = Math.max(0, now.getHours() - 2);
    const pad = (n) => String(n).padStart(2, "0");

    userProfile = {
      displayName: customName,
      email: customEmail,
      photoURL: "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix",
      pointsBalance: 160,
      lifetimePoints: 490
    };

    habitsCache = [
      {
        id: "demo-h1",
        title: "Mindful Breathing & Meditation (15m)",
        description: "Sit quietly, focus on deep diaphragmatic breathing for 15 minutes, and clear mental clutter.",
        categoryId: "cat-mindfulness",
        frequency: "daily",
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        deadlineTime: `${pad(futureHour)}:30`,
        priority: "High",
        basePoints: 30,
        currentStreak: 6,
        longestStreak: 12,
        lastCompletedDate: null
      },
      {
        id: "demo-h2",
        title: "Evening Book Reading (20 Pages)",
        description: "Read at least 20 pages of a non-fiction or personal growth book before bed without phone distractions.",
        categoryId: "cat-study",
        frequency: "daily",
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        deadlineTime: `${pad(futureHour)}:30`,
        priority: "Medium",
        basePoints: 25,
        currentStreak: 3,
        longestStreak: 7,
        lastCompletedDate: null
      },
      {
        id: "demo-h3",
        title: "Sunrise Stretching (Missed Deadline Demo)",
        description: "Full-body morning mobility and stretching routine right after waking up.",
        categoryId: "cat-health",
        frequency: "daily",
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        deadlineTime: `${pad(passedHour)}:00`,
        priority: "Low",
        basePoints: 20,
        currentStreak: 0,
        longestStreak: 4,
        lastCompletedDate: null
      }
    ];

    tasksCache = [
      {
        id: "demo-t1",
        title: "Prepare Sprint Presentation Deck",
        description: "Compile key project metrics, system architecture diagram, and executive summary slides for the team review.",
        categoryId: "cat-work",
        deadline: new Date(now.getTime() + 45 * 60 * 1000).toISOString(),
        priority: "High",
        basePoints: 50,
        completed: false,
        subtasks: [
          {
            id: "sub-1",
            title: "Draft Architecture Diagram",
            points: 15,
            deadlineMs: now.getTime() + 15 * 60 * 1000,
            completed: false
          },
          {
            id: "sub-2",
            title: "Write Executive Summary Slide",
            points: 20,
            deadlineMs: now.getTime() + 30 * 60 * 1000,
            completed: false
          }
        ]
      },
      {
        id: "demo-t2",
        title: "Submit Expense Receipt (Overdue Demo)",
        description: "Upload monthly software subscription invoices to the finance portal.",
        categoryId: "cat-finance",
        deadline: new Date(now.getTime() - 2 * 3600 * 1000).toISOString(),
        priority: "Medium",
        basePoints: 30,
        completed: false,
        subtasks: []
      }
    ];

    rewardsCache = [
      { id: "demo-r1", title: "1 Hour Gaming Session", cost: 80, redeemedCount: 2 },
      { id: "demo-r2", title: "Iced Matcha / Coffee Treat", cost: 120, redeemedCount: 1 }
    ];

    journalsCache = [
      {
        id: "demo-j1",
        date: toDateString(now),
        mood: "great",
        content: "Focused on high-priority habits today! Sub-tasks make breaking down big work much easier.",
        drawingDataUrl: null
      }
    ];

    saveLocalDataStore();
  }

  document.getElementById("auth-view").classList.add("hidden");
  document.getElementById("app-view").classList.remove("hidden");

  renderAllViews();
  checkUpcomingDeadlines();
}

document.getElementById("demo-login-btn").addEventListener("click", () => {
  startLocalOrDemoSession("Kaelen the Focused", "hero@mindquest.app");
  showToast("Logged into MindQuest!", "ri-gamepad-line");
});

document.getElementById("google-login-btn").addEventListener("click", async () => {
  if (window.location.protocol === "file:" || !fb || !fb.auth) {
    startLocalOrDemoSession("Explorer", "user@gmail.com");
    showToast("Signed in!", "ri-shield-check-line");
    return;
  }

  try {
    isLocalMode = false;
    const result = await fb.signInWithPopup(fb.auth, fb.googleProvider);
    const user = result.user;

    currentUser = user;
    userProfile = {
      displayName: user.displayName || "Explorer",
      email: user.email || "",
      photoURL: user.photoURL || null,
      pointsBalance: 0,
      lifetimePoints: 0
    };
    document.getElementById("auth-view").classList.add("hidden");
    document.getElementById("app-view").classList.remove("hidden");
    loadCategories();
    syncCategoryDropdowns();
    loadReminders();
    renderAllViews();

    try {
      const userRef = fb.doc(fb.db, "users", user.uid);
      const snap = await fb.getDoc(userRef);
      if (!snap.exists()) {
        await fb.setDoc(userRef, {
          displayName: user.displayName || "Explorer",
          email: user.email || "",
          photoURL: user.photoURL || null,
          pointsBalance: 0,
          lifetimePoints: 0,
          updatedAt: fb.serverTimestamp()
        });
      }
    } catch (_) {}
  } catch (err) {
    startLocalOrDemoSession("Explorer", "user@gmail.com");
    showToast("Signed in!", "ri-login-circle-line");
  }
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  localStorage.removeItem("mindquest_active_local_session");
  isLocalMode = false;
  currentUser = null;
  unsubscribers.forEach((u) => u());
  unsubscribers = [];
  if (fb && fb.auth) {
    try {
      await fb.signOut(fb.auth);
    } catch (_) {}
  }
  document.getElementById("auth-view").classList.remove("hidden");
  document.getElementById("app-view").classList.add("hidden");
  document.getElementById("drawer-overlay").classList.add("hidden");
});

const savedLocalSession = localStorage.getItem("mindquest_active_local_session");
if (savedLocalSession) {
  try {
    const parsed = JSON.parse(savedLocalSession);
    startLocalOrDemoSession(parsed.displayName || "Explorer", parsed.email || "hero@mindquest.app");
  } catch (_) {}
}

(async function initFirebaseBackground() {
  if (window.location.protocol === "file:") return;
  try {
    const [appMod, authMod, fsMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js")
    ]);

    const firebaseConfig = {
      apiKey: "AIzaSyBZ4x7u1MgQtvedmHslxpRi3aVddhbzOd8",
      authDomain: "myprojects-8880c.firebaseapp.com",
      projectId: "myprojects-8880c",
      storageBucket: "myprojects-8880c.firebasestorage.app",
      messagingSenderId: "482773926576",
      appId: "1:482773926576:web:87cba1a507de8790fcf175",
      measurementId: "G-9826FV7GP5"
    };

    const app = appMod.initializeApp(firebaseConfig);
    const auth = authMod.getAuth(app);
    const db = fsMod.getFirestore(app);
    const googleProvider = new authMod.GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: "select_account" });

    fb = {
      app,
      auth,
      db,
      googleProvider,
      signInWithPopup: authMod.signInWithPopup,
      signOut: authMod.signOut,
      doc: fsMod.doc,
      getDoc: fsMod.getDoc,
      setDoc: fsMod.setDoc,
      updateDoc: fsMod.updateDoc,
      addDoc: fsMod.addDoc,
      deleteDoc: fsMod.deleteDoc,
      collection: fsMod.collection,
      query: fsMod.query,
      orderBy: fsMod.orderBy,
      onSnapshot: fsMod.onSnapshot,
      runTransaction: fsMod.runTransaction,
      serverTimestamp: fsMod.serverTimestamp,
      Timestamp: fsMod.Timestamp
    };

    authMod.onAuthStateChanged(auth, (user) => {
      if (isLocalMode) return;
      unsubscribers.forEach((u) => u());
      unsubscribers = [];
      currentUser = user;

      if (!user) {
        if (!localStorage.getItem("mindquest_active_local_session")) {
          document.getElementById("auth-view").classList.remove("hidden");
          document.getElementById("app-view").classList.add("hidden");
          document.getElementById("drawer-overlay").classList.add("hidden");
        }
        return;
      }

      document.getElementById("auth-view").classList.add("hidden");
      document.getElementById("app-view").classList.remove("hidden");

      if (!userProfile) {
        userProfile = {
          displayName: user.displayName || "Explorer",
          email: user.email || "",
          photoURL: user.photoURL || null,
          pointsBalance: 0,
          lifetimePoints: 0
        };
      }

      loadCategories();
      syncCategoryDropdowns();
      loadReminders();
      renderAllViews();

      unsubscribers.push(
        fb.onSnapshot(fb.doc(fb.db, "users", user.uid), (snap) => {
          if (!snap.exists()) return;
          userProfile = snap.data();
          applyThemeAndProfileUI();
        })
      );

      unsubscribers.push(
        fb.onSnapshot(
          fb.query(fb.collection(fb.db, "users", user.uid, "habits"), fb.orderBy("createdAt", "desc")),
          (snap) => {
            habitsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            renderAllViews();
            checkUpcomingDeadlines();
          }
        )
      );

      unsubscribers.push(
        fb.onSnapshot(
          fb.query(fb.collection(fb.db, "users", user.uid, "tasks"), fb.orderBy("createdAt", "desc")),
          (snap) => {
            tasksCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            renderAllViews();
            checkUpcomingDeadlines();
          }
        )
      );

      unsubscribers.push(
        fb.onSnapshot(
          fb.query(fb.collection(fb.db, "users", user.uid, "rewards"), fb.orderBy("cost", "asc")),
          (snap) => {
            rewardsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            renderRewards(rewardsCache);
          }
        )
      );

      unsubscribers.push(
        fb.onSnapshot(
          fb.query(fb.collection(fb.db, "users", user.uid, "journals"), fb.orderBy("createdAt", "desc")),
          (snap) => {
            journalsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            renderJournals(journalsCache);
          }
        )
      );
    });
  } catch (_) {}
})();

// ============================================================================
// 6. 5-TAB NAVIGATION & OTHERS SUB-NAVIGATION
// ============================================================================
function switchMainTab(tabName) {
  activeMainTab = tabName;
  document.querySelectorAll("[data-nav-tab]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.navTab === tabName);
  });

  ["home", "habits", "tasks", "journal", "others"].forEach((t) => {
    const view = document.getElementById(`tab-view-${t}`);
    if (view) view.classList.toggle("hidden", t !== tabName);
  });

  if (tabName === "others") {
    renderCalendar();
    renderCategoriesManager();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-nav-tab]").forEach((btn) => {
  btn.addEventListener("click", () => switchMainTab(btn.dataset.navTab));
});

function switchOthersSection(secName) {
  activeOthersSec = secName;
  document.querySelectorAll("[data-others-sec]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.othersSec === secName);
  });
  ["reminders", "categories", "rewards", "profile"].forEach((s) => {
    const panel = document.getElementById(`others-sec-${s}`);
    if (panel) panel.classList.toggle("hidden", s !== secName);
  });
  if (secName === "reminders") renderCalendar();
}

document.querySelectorAll("[data-others-sec]").forEach((btn) => {
  btn.addEventListener("click", () => switchOthersSection(btn.dataset.othersSec));
});

// ============================================================================
// 7. DEADLINE & COUNTDOWN ENGINE
// ============================================================================
function getPreviousScheduledDate(habit, today = new Date()) {
  const cursor = new Date(today);
  for (let i = 1; i <= 7; i++) {
    cursor.setDate(cursor.getDate() - 1);
    const dow = cursor.getDay();
    if (habit.frequency === "daily" || (habit.daysOfWeek || []).includes(dow)) {
      return toDateString(cursor);
    }
  }
  return toDateString(today);
}

function getHabitDeadlineDate(deadlineTime, now = new Date()) {
  const [hours, minutes] = (deadlineTime || "23:59").split(":").map(Number);
  const deadline = new Date(now);
  deadline.setHours(hours, minutes, 59, 999);
  return deadline;
}

function isWithinDeadlineTime(deadlineTime, now = new Date()) {
  return now.getTime() <= getHabitDeadlineDate(deadlineTime, now).getTime();
}

function formatCountdown(msRemaining) {
  if (msRemaining <= 0) {
    return { text: "Expired", expired: true, urgency: "expired" };
  }

  const totalSeconds = Math.floor(msRemaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n) => String(n).padStart(2, "0");
  const text =
    days > 0
      ? `${days}d ${pad(hours)}h ${pad(minutes)}m`
      : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  let urgency = "normal";
  if (msRemaining <= 15 * 60 * 1000) {
    urgency = "critical";
  } else if (msRemaining <= 60 * 60 * 1000) {
    urgency = "urgent";
  }

  return { text, expired: false, urgency };
}

function getTaskDeadlineDate(task) {
  if (!task.deadline) return null;
  if (typeof task.deadline.toDate === "function") return task.deadline.toDate();
  return new Date(task.deadline);
}

function sortHabitsByDeadlineAndPriority(habits, now = new Date()) {
  const todayStr = toDateString(now);
  return [...habits].sort((a, b) => {
    const aDone = a.lastCompletedDate === todayStr;
    const bDone = b.lastCompletedDate === todayStr;
    const aDue = getHabitDeadlineDate(a.deadlineTime, now).getTime();
    const bDue = getHabitDeadlineDate(b.deadlineTime, now).getTime();
    const aExpired = !aDone && now.getTime() > aDue;
    const bExpired = !bDone && now.getTime() > bDue;

    const getBucket = (done, expired) => (!done && !expired ? 0 : done ? 1 : 2);
    const bucketA = getBucket(aDone, aExpired);
    const bucketB = getBucket(bDone, bExpired);
    if (bucketA !== bucketB) return bucketA - bucketB;

    const diffMs = Math.abs(aDue - bDue);
    if (diffMs <= 15 * 60 * 1000) {
      const pDiff = (PRIORITY_WEIGHT_ORDER[b.priority] || 1) - (PRIORITY_WEIGHT_ORDER[a.priority] || 1);
      if (pDiff !== 0) return pDiff;
    }

    return aDue - bDue;
  });
}

// ============================================================================
// 8. CATEGORIES MANAGER & DROPDOWN SYNC
// ============================================================================
function syncCategoryDropdowns() {
  const selects = document.querySelectorAll(".category-dropdown");
  const optionsHtml = categoriesCache
    .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`)
    .join("");

  selects.forEach((sel) => {
    const prev = sel.value;
    sel.innerHTML = optionsHtml;
    if (prev && categoriesCache.some((c) => c.id === prev)) {
      sel.value = prev;
    }
  });
}

function renderCategoriesManager() {
  const container = document.getElementById("categories-manage-list");
  if (!container) return;

  container.innerHTML = categoriesCache
    .map(
      (c) => `
      <div class="list-item">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:32px;height:32px;border-radius:8px;background:${c.color}20;color:${c.color};display:flex;align-items:center;justify-content:center;font-size:16px;">
            <i class="${escapeHtml(c.icon)}"></i>
          </div>
          <div>
            <strong style="font-size:13.5px;">${escapeHtml(c.name)}</strong>
            <div class="item-meta"><span>${escapeHtml(c.color)}</span></div>
          </div>
        </div>
        <div class="quest-actions">
          <button type="button" class="btn-edit-item" data-edit-cat="${escapeHtml(c.id)}" title="Edit Category">
            <i class="ri-edit-line"></i>
          </button>
          ${
            categoriesCache.length > 1
              ? `<button type="button" class="btn-delete-item" data-delete-cat="${escapeHtml(c.id)}" title="Delete Category">
                   <i class="ri-delete-bin-6-line"></i>
                 </button>`
              : ""
          }
        </div>
      </div>
    `
    )
    .join("");

  container.querySelectorAll("[data-edit-cat]").forEach((btn) => {
    btn.addEventListener("click", () => startEditCategory(btn.dataset.editCat));
  });

  container.querySelectorAll("[data-delete-cat]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.deleteCat;
      const cat = getCategoryById(id);
      openConfirmModal("Delete Category?", `Remove "${cat.name}" from your categories list?`, () => {
        categoriesCache = categoriesCache.filter((c) => c.id !== id);
        if (editingCategoryId === id) resetCategoryForm();
        saveCategories();
        syncCategoryDropdowns();
        renderCategoriesManager();
        renderAllViews();
        showToast("Category removed", "ri-delete-bin-line");
      });
    });
  });
}

function startEditCategory(catId) {
  const cat = categoriesCache.find((c) => c.id === catId);
  if (!cat) return;
  editingCategoryId = cat.id;
  document.getElementById("category-form-title").textContent = "Edit Category";
  document.getElementById("category-submit-btn").innerHTML = `<i class="ri-save-3-line"></i> Update Category`;
  document.getElementById("category-cancel-edit-btn").classList.remove("hidden");
  document.getElementById("category-name-input").value = cat.name;

  selectedCategoryIcon = cat.icon;
  document.querySelectorAll("#category-icon-picker .icon-pick-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.icon === cat.icon);
  });

  selectedCategoryColor = cat.color;
  document.querySelectorAll("#category-color-picker .cat-color-swatch").forEach((s) => {
    s.classList.toggle("active", s.dataset.catColor === cat.color);
  });
  document.getElementById("category-name-input").focus();
}

function resetCategoryForm() {
  editingCategoryId = null;
  document.getElementById("category-form").reset();
  document.getElementById("category-form-title").textContent = "Create Category";
  document.getElementById("category-submit-btn").innerHTML = `<i class="ri-add-circle-line"></i> Save Category`;
  document.getElementById("category-cancel-edit-btn").classList.add("hidden");
}

document.getElementById("category-cancel-edit-btn").addEventListener("click", resetCategoryForm);

document.querySelectorAll("#category-icon-picker .icon-pick-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#category-icon-picker .icon-pick-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedCategoryIcon = btn.dataset.icon;
  });
});

document.querySelectorAll("#category-color-picker .cat-color-swatch").forEach((swatch) => {
  swatch.addEventListener("click", () => {
    document.querySelectorAll("#category-color-picker .cat-color-swatch").forEach((s) => s.classList.remove("active"));
    swatch.classList.add("active");
    selectedCategoryColor = swatch.dataset.catColor;
  });
});

document.getElementById("category-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("category-name-input").value.trim();
  if (!name) return;

  if (editingCategoryId) {
    const idx = categoriesCache.findIndex((c) => c.id === editingCategoryId);
    if (idx !== -1) {
      categoriesCache[idx] = {
        ...categoriesCache[idx],
        name,
        icon: selectedCategoryIcon,
        color: selectedCategoryColor
      };
    }
    saveCategories();
    syncCategoryDropdowns();
    renderCategoriesManager();
    renderAllViews();
    resetCategoryForm();
    showToast(`Category "${name}" updated!`, selectedCategoryIcon);
    return;
  }

  const newCat = {
    id: `cat-${Date.now()}`,
    name,
    icon: selectedCategoryIcon,
    color: selectedCategoryColor
  };
  categoriesCache.push(newCat);
  saveCategories();
  syncCategoryDropdowns();
  renderCategoriesManager();
  e.target.reset();
  showToast(`Category "${name}" added!`, newCat.icon);
});

// ============================================================================
// 9. PROFILE CUSTOMIZATION & THEME ENGINE
// ============================================================================
function getLocalProfileKey(uid) {
  return `mindquest_custom_profile_${uid || "local_hero"}`;
}

function loadCustomProfileMeta(uid) {
  try {
    const raw = localStorage.getItem(getLocalProfileKey(uid));
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return {
    heroClass: "Mindful Mage",
    bio: "Every small habit completed on time builds legendary discipline.",
    avatarFrame: "frame-cyber",
    accentTheme: "indigo",
    customAvatar: null
  };
}

function saveCustomProfileMeta(uid, meta) {
  try {
    localStorage.setItem(getLocalProfileKey(uid), JSON.stringify(meta));
  } catch (_) {}
}

function applyThemeAndProfileUI() {
  if (!userProfile) return;
  const uid = getUidKey();
  const customMeta = loadCustomProfileMeta(uid);

  const displayName = userProfile.displayName || "Explorer";
  const avatarUrl =
    customMeta.customAvatar ||
    userProfile.photoURL ||
    "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix";
  const heroClass = userProfile.heroClass || customMeta.heroClass || "Mindful Mage";
  const bio = userProfile.bio || customMeta.bio || "Stay consistent and conquer your daily quests!";
  const frameClass = userProfile.avatarFrame || customMeta.avatarFrame || "frame-cyber";
  const accent = userProfile.accentTheme || customMeta.accentTheme || "indigo";

  document.documentElement.setAttribute("data-accent", accent);

  document.getElementById("points-balance").textContent = userProfile.pointsBalance ?? 0;
  document.getElementById("user-name").textContent = displayName;
  document.getElementById("lifetime-points").textContent = `Lifetime: ${userProfile.lifetimePoints ?? 0} pts`;
  document.getElementById("user-avatar").src = avatarUrl;
  document.getElementById("header-user-avatar").src = avatarUrl;

  document.getElementById("hero-display-name").textContent = displayName;
  document.getElementById("hero-class-badge").innerHTML = `<i class="ri-magic-line"></i> ${escapeHtml(heroClass)}`;
  document.getElementById("hero-bio-text").textContent = `"${bio}"`;
  document.getElementById("hero-avatar-img").src = avatarUrl;
  document.getElementById("hero-avatar-frame").className = `hero-avatar-wrap ${frameClass}`;

  const othersProfileBox = document.getElementById("others-profile-summary");
  if (othersProfileBox) {
    othersProfileBox.innerHTML = `
      <div class="hero-avatar-wrap ${frameClass}">
        <img src="${avatarUrl}" alt="Avatar" class="hero-avatar" />
      </div>
      <div>
        <strong style="font-size:15px;display:block;">${escapeHtml(displayName)}</strong>
        <span class="hero-class-pill" style="margin:3px 0;display:inline-flex;"><i class="ri-magic-line"></i> ${escapeHtml(heroClass)}</span>
        <p class="small-muted">"${escapeHtml(bio)}"</p>
      </div>
    `;
  }

  const lifetime = userProfile.lifetimePoints || 0;
  const level = Math.floor(lifetime / 200) + 1;
  const currentLevelXp = lifetime % 200;
  const xpPercent = Math.min(100, Math.max(4, Math.round((currentLevelXp / 200) * 100)));

  const ranks = [
    "Novice Adventurer",
    "Apprentice Seeker",
    "Habit Guardian",
    "Focus Knight",
    "Mindful Master",
    "Grand Champion",
    "Mythic Legend"
  ];
  const rankName = ranks[Math.min(ranks.length - 1, level - 1)];

  document.getElementById("hero-level-badge").textContent = `LV ${level}`;
  document.getElementById("xp-rank-label").innerHTML = `<i class="ri-medal-fill"></i> ${rankName}`;
  document.getElementById("xp-progress-text").textContent = `${currentLevelXp} / 200 XP`;
  document.getElementById("xp-fill-bar").style.width = `${xpPercent}%`;
  document.getElementById("stat-lifetime-pts").textContent = `${lifetime}`;

  updateDashboardStats();
}

function updateDashboardStats() {
  const now = new Date();
  const todayStr = toDateString(now);
  const todayDow = now.getDay();

  const todaysHabits = habitsCache.filter(
    (h) => h.frequency === "daily" || (h.daysOfWeek || []).includes(todayDow)
  );
  const completedToday = todaysHabits.filter((h) => h.lastCompletedDate === todayStr).length;
  const bestStreak = habitsCache.reduce((max, h) => Math.max(max, h.longestStreak || 0, h.currentStreak || 0), 0);

  document.getElementById("stat-best-streak").textContent = `${bestStreak}d`;
  document.getElementById("stat-today-progress").textContent = `${completedToday}/${todaysHabits.length}`;
  document.getElementById("stat-reminders-count").textContent = `${remindersCache.length}`;
}

// ============================================================================
// 10. GAMIFICATION ACTIONS
// ============================================================================
async function awardUserPoints(pointsEarned) {
  if (!userProfile || pointsEarned <= 0) return;
  if (isLocalMode || !fb) {
    userProfile.pointsBalance += pointsEarned;
    userProfile.lifetimePoints += pointsEarned;
    saveLocalDataStore();
    applyThemeAndProfileUI();
    return;
  }
  if (!currentUser) return;
  const userRef = fb.doc(fb.db, "users", currentUser.uid);
  await fb.runTransaction(fb.db, async (tx) => {
    const uSnap = await tx.get(userRef);
    if (!uSnap.exists()) return;
    const uData = uSnap.data();
    tx.update(userRef, {
      pointsBalance: (uData.pointsBalance || 0) + pointsEarned,
      lifetimePoints: (uData.lifetimePoints || 0) + pointsEarned,
      updatedAt: fb.serverTimestamp()
    });
  });
}

async function completeHabit(habitId) {
  const now = new Date();
  const todayStr = toDateString(now);

  if (isLocalMode || !fb) {
    const habit = habitsCache.find((h) => h.id === habitId);
    if (!habit || habit.lastCompletedDate === todayStr) return;
    if (!isWithinDeadlineTime(habit.deadlineTime, now)) {
      showToast("This habit's deadline has passed for today!", "ri-time-line");
      return;
    }
    habit.currentStreak = (habit.currentStreak || 0) + 1;
    habit.longestStreak = Math.max(habit.longestStreak || 0, habit.currentStreak);
    habit.lastCompletedDate = todayStr;
    const streakMultiplier = 1 + Math.min(habit.currentStreak - 1, 20) * 0.15;
    const priorityWeight = PRIORITY_MULTIPLIER[habit.priority] || 1.0;
    const pointsEarned = Math.round(habit.basePoints * priorityWeight * streakMultiplier);
    await awardUserPoints(pointsEarned);
    saveLocalDataStore();
    renderAllViews();
    showToast(`+${pointsEarned} PTS! Streak: ${habit.currentStreak}d!`, "ri-fire-fill");
    return;
  }

  if (!currentUser) return;
  const userRef = fb.doc(fb.db, "users", currentUser.uid);
  const habitRef = fb.doc(fb.db, "users", currentUser.uid, "habits", habitId);

  let earned = 0;
  await fb
    .runTransaction(fb.db, async (tx) => {
      const [uSnap, hSnap] = await Promise.all([tx.get(userRef), tx.get(habitRef)]);
      if (!uSnap.exists() || !hSnap.exists()) return;

      const uData = uSnap.data();
      const hData = hSnap.data();

      if (hData.lastCompletedDate === todayStr) return;
      if (!isWithinDeadlineTime(hData.deadlineTime, now)) {
        throw new Error("DEADLINE_PASSED");
      }

      const prevScheduled = getPreviousScheduledDate(hData, now);
      const onTime = isWithinDeadlineTime(hData.deadlineTime, now);
      const isConsecutive = hData.lastCompletedDate === prevScheduled && onTime;

      const newStreak = isConsecutive ? hData.currentStreak + 1 : 1;
      const newLongest = Math.max(hData.longestStreak, newStreak);

      const streakMultiplier = 1 + Math.min(newStreak - 1, 20) * 0.15;
      const priorityWeight = PRIORITY_MULTIPLIER[hData.priority] || 1.0;
      const pointsEarned = Math.round(hData.basePoints * priorityWeight * streakMultiplier);
      earned = pointsEarned;

      tx.update(habitRef, {
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastCompletedDate: todayStr
      });

      tx.update(userRef, {
        pointsBalance: uData.pointsBalance + pointsEarned,
        lifetimePoints: uData.lifetimePoints + pointsEarned,
        updatedAt: fb.serverTimestamp()
      });
    })
    .then(() => {
      if (earned > 0) showToast(`Habit Complete! +${earned} PTS!`, "ri-copper-diamond-fill");
    })
    .catch((err) => {
      if (err.message === "DEADLINE_PASSED") {
        showToast("Today's deadline has passed for this habit!", "ri-error-warning-line");
        renderAllViews();
      }
    });
}

async function completeSubtask(taskId, subtaskId) {
  const task = tasksCache.find((t) => t.id === taskId);
  if (!task) return;
  const ext = getExtendedMeta(task.id, task.title);
  const subtasks = task.subtasks || ext.subtasks || [];
  const sub = subtasks.find((s) => s.id === subtaskId);
  if (!sub || sub.completed) return;

  const now = new Date();
  if (sub.deadlineMs && now.getTime() > sub.deadlineMs) {
    showToast("Sub-task timer expired!", "ri-time-line");
    return;
  }

  sub.completed = true;
  task.subtasks = subtasks;
  saveExtendedMeta(task.id, { ...ext, subtasks });
  saveExtendedMeta(task.title, { ...ext, subtasks });
  saveLocalDataStore();

  await awardUserPoints(sub.points || 10);
  renderAllViews();
  showToast(`Sub-task Done! +${sub.points || 10} PTS!`, "ri-checkbox-circle-fill");
}

async function completeTask(taskId) {
  const now = new Date();
  const task = tasksCache.find((t) => t.id === taskId);
  if (!task || task.completed) return;

  const deadlineDate = getTaskDeadlineDate(task);
  if (deadlineDate && now > deadlineDate) {
    showToast("Task deadline has passed!", "ri-time-line");
    return;
  }

  const pointsEarned = TASK_PRIORITY_POINTS[task.priority] || 30;

  if (isLocalMode || !fb) {
    task.completed = true;
    await awardUserPoints(pointsEarned);
    saveLocalDataStore();
    renderAllViews();
    showToast(`Task Completed! +${pointsEarned} PTS!`, "ri-checkbox-circle-fill");
    return;
  }

  if (!currentUser) return;
  const userRef = fb.doc(fb.db, "users", currentUser.uid);
  const taskRef = fb.doc(fb.db, "users", currentUser.uid, "tasks", taskId);

  await fb.runTransaction(fb.db, async (tx) => {
    const [uSnap, tSnap] = await Promise.all([tx.get(userRef), tx.get(taskRef)]);
    if (!uSnap.exists() || !tSnap.exists()) return;

    const uData = uSnap.data();
    const tData = tSnap.data();
    if (tData.completed) return;

    tx.update(taskRef, {
      completed: true,
      completedAt: fb.serverTimestamp()
    });

    tx.update(userRef, {
      pointsBalance: uData.pointsBalance + pointsEarned,
      lifetimePoints: uData.lifetimePoints + pointsEarned,
      updatedAt: fb.serverTimestamp()
    });
  });

  showToast(`Task Completed! +${pointsEarned} PTS!`, "ri-checkbox-circle-fill");
}

function requestDeleteItem(collectionName, itemId, label = "this item") {
  openConfirmModal(
    "Confirm Delete",
    `Are you sure you want to permanently delete ${label}?`,
    async () => {
      if (isLocalMode || !fb) {
        if (collectionName === "habits") habitsCache = habitsCache.filter((h) => h.id !== itemId);
        if (collectionName === "tasks") tasksCache = tasksCache.filter((t) => t.id !== itemId);
        if (collectionName === "journals") journalsCache = journalsCache.filter((j) => j.id !== itemId);
        if (collectionName === "rewards") rewardsCache = rewardsCache.filter((r) => r.id !== itemId);
        saveLocalDataStore();
        renderAllViews();
        showToast("Deleted successfully", "ri-delete-bin-line");
        return;
      }
      if (!currentUser) return;
      try {
        await fb.deleteDoc(fb.doc(fb.db, "users", currentUser.uid, collectionName, itemId));
        showToast("Deleted successfully", "ri-delete-bin-line");
      } catch (_) {}
    }
  );
}

async function redeemReward(rewardId) {
  if (isLocalMode || !fb) {
    const r = rewardsCache.find((item) => item.id === rewardId);
    if (!r) return;
    if (userProfile.pointsBalance < r.cost) {
      showToast("Not enough points to redeem this reward!", "ri-error-warning-line");
      return;
    }
    userProfile.pointsBalance -= r.cost;
    r.redeemedCount = (r.redeemedCount || 0) + 1;
    saveLocalDataStore();
    applyThemeAndProfileUI();
    renderRewards(rewardsCache);
    showToast(`Redeemed "${r.title}"!`, "ri-gift-2-fill");
    return;
  }

  if (!currentUser) return;
  const userRef = fb.doc(fb.db, "users", currentUser.uid);
  const rewardRef = fb.doc(fb.db, "users", currentUser.uid, "rewards", rewardId);

  await fb.runTransaction(fb.db, async (tx) => {
    const [uSnap, rSnap] = await Promise.all([tx.get(userRef), tx.get(rewardRef)]);
    if (!uSnap.exists() || !rSnap.exists()) return;

    const uData = uSnap.data();
    const rData = rSnap.data();
    if (uData.pointsBalance < rData.cost) {
      showToast("Not enough points to redeem this reward!", "ri-error-warning-line");
      return;
    }

    tx.update(rewardRef, { redeemedCount: rData.redeemedCount + 1 });
    tx.update(userRef, {
      pointsBalance: uData.pointsBalance - rData.cost,
      updatedAt: fb.serverTimestamp()
    });
    showToast(`Redeemed "${rData.title}"!`, "ri-gift-2-fill");
  });
}

function renderAllViews() {
  applyThemeAndProfileUI();
  renderHabits();
  renderTasks();
  renderRemindersViews();
  renderRewards(rewardsCache);
  renderJournals(journalsCache);
  renderCalendar();
  renderCategoriesManager();
}

// ============================================================================
// 11. UI RENDERERS (MINIMALIST HOME + DETAILED TABS + HOME CLICK POPUP)
// ============================================================================
/**
 * Minimalist Home Row for Habits: ONLY Icon, Title, Priority, and Countdown (No inline description; click opens popup)
 */
function buildHomeHabitMinimalHtml(h, now = new Date()) {
  const deadlineDate = getHabitDeadlineDate(h.deadlineTime, now);
  const msLeft = deadlineDate.getTime() - now.getTime();
  const countdown = formatCountdown(msLeft);
  const ext = getExtendedMeta(h.id, h.title);
  const cat = getCategoryById(h.categoryId || ext.categoryId || (h.tags && h.tags[0]));

  return `
    <div class="home-minimal-item priority-card-${h.priority || "Medium"}" data-habit-card="${h.id}" data-home-detail-type="habit" data-home-detail-id="${h.id}" title="Click to view details & description">
      <div class="home-minimal-left">
        <div class="home-cat-icon" style="background:${cat.color}18;color:${cat.color}">
          <i class="${escapeHtml(cat.icon)}"></i>
        </div>
        <span class="home-minimal-title">${escapeHtml(h.title)}</span>
      </div>
      <div class="home-minimal-right">
        <span class="badge badge-${h.priority}">${h.priority}</span>
        <span class="countdown-pill ${countdown.urgency}" data-habit-countdown="${h.id}">
          <i class="ri-timer-flash-line"></i> ${countdown.text}
        </span>
      </div>
    </div>
  `;
}

/**
 * Minimalist Home Row for Tasks: ONLY Icon, Title, Priority, and Countdown (No inline description; click opens popup)
 */
function buildHomeTaskMinimalHtml(t, now = new Date()) {
  const deadlineDate = getTaskDeadlineDate(t);
  const msLeft = deadlineDate ? deadlineDate.getTime() - now.getTime() : 0;
  const cd = formatCountdown(msLeft);
  const ext = getExtendedMeta(t.id, t.title);
  const cat = getCategoryById(t.categoryId || ext.categoryId || (t.tags && t.tags[0]));

  return `
    <div class="home-minimal-item priority-card-${t.priority || "Medium"}" data-task-card="${t.id}" data-home-detail-type="task" data-home-detail-id="${t.id}" title="Click to view details & description">
      <div class="home-minimal-left">
        <div class="home-cat-icon" style="background:${cat.color}18;color:${cat.color}">
          <i class="${escapeHtml(cat.icon)}"></i>
        </div>
        <span class="home-minimal-title">${escapeHtml(t.title)}</span>
      </div>
      <div class="home-minimal-right">
        <span class="badge badge-${t.priority}">${t.priority}</span>
        <span class="countdown-pill ${cd.urgency}" data-task-countdown="${t.id}">
          <i class="ri-timer-line"></i> ${cd.text}
        </span>
      </div>
    </div>
  `;
}

function bindHomeDetailClickEvents(container) {
  if (!container) return;
  container.querySelectorAll("[data-home-detail-type]").forEach((row) => {
    row.addEventListener("click", () => {
      openItemDetailPopup(row.dataset.homeDetailType, row.dataset.homeDetailId);
    });
  });
}

function openItemDetailPopup(type, itemId) {
  const now = new Date();
  const todayStr = toDateString(now);
  const modal = document.getElementById("item-detail-modal");
  const catIconEl = document.getElementById("detail-modal-cat-icon");
  const typeEl = document.getElementById("detail-modal-type");
  const titleEl = document.getElementById("detail-modal-title");
  const bodyEl = document.getElementById("detail-modal-body");
  const actionsEl = document.getElementById("detail-modal-actions");

  activeDetailPopup = { type, itemId };

  if (type === "habit") {
    const h = habitsCache.find((item) => item.id === itemId);
    if (!h) return;
    const ext = getExtendedMeta(h.id, h.title);
    const cat = getCategoryById(h.categoryId || ext.categoryId || (h.tags && h.tags[0]));
    const desc = h.description ?? ext.description ?? "";
    const done = h.lastCompletedDate === todayStr;
    const deadlineDate = getHabitDeadlineDate(h.deadlineTime, now);
    const cd = formatCountdown(deadlineDate.getTime() - now.getTime());
    const isExpired = !done && cd.expired;

    catIconEl.style.background = `${cat.color}20`;
    catIconEl.style.color = cat.color;
    catIconEl.innerHTML = `<i class="${escapeHtml(cat.icon)}"></i>`;
    typeEl.textContent = `Habit Quest • ${cat.name}`;
    titleEl.textContent = h.title;

    bodyEl.innerHTML = `
      <div class="item-meta" style="margin-top:0;">
        <span class="badge badge-${h.priority}">${h.priority} Priority</span>
        <span class="streak-pill"><i class="ri-fire-fill"></i> Streak: ${h.currentStreak || 0}d</span>
        <span><i class="ri-alarm-line"></i> Deadline: ${h.deadlineTime}</span>
        <span class="countdown-pill ${done ? "" : cd.urgency}" data-habit-countdown="${h.id}">
          <i class="ri-timer-flash-line"></i> ${done ? "Completed Today" : cd.text}
        </span>
      </div>
      <div>
        <label class="field-label" style="margin-top:4px;margin-bottom:4px;">Description</label>
        <div class="detail-desc-box ${desc ? "" : "empty-desc"}">${
          desc ? escapeHtml(desc) : "No description added for this habit."
        }</div>
      </div>
    `;

    actionsEl.innerHTML = `
      <div style="display:flex;gap:6px;">
        <button type="button" class="btn-secondary btn-xs" id="detail-popup-edit-btn">
          <i class="ri-edit-line"></i> Edit
        </button>
        <button type="button" class="btn-danger-small" id="detail-popup-delete-btn">
          <i class="ri-delete-bin-6-line"></i> Delete
        </button>
      </div>
      <button type="button" class="btn-complete-quest ${done ? "done-btn" : ""}" id="detail-popup-complete-btn" ${
        done || isExpired ? "disabled" : ""
      }>
        ${
          done
            ? `<i class="ri-check-double-line"></i> Completed`
            : isExpired
            ? `<i class="ri-lock-2-line"></i> Expired`
            : `<i class="ri-copper-diamond-line"></i> Complete (+${h.basePoints} pts)`
        }
      </button>
    `;

    document.getElementById("detail-popup-edit-btn").addEventListener("click", () => {
      modal.classList.add("hidden");
      openHabitModalForEdit(h.id);
    });
    document.getElementById("detail-popup-delete-btn").addEventListener("click", () => {
      modal.classList.add("hidden");
      requestDeleteItem("habits", h.id, `"${h.title}"`);
    });
    const compBtn = document.getElementById("detail-popup-complete-btn");
    if (compBtn && !done && !isExpired) {
      compBtn.addEventListener("click", async () => {
        await completeHabit(h.id);
        modal.classList.add("hidden");
      });
    }
    modal.classList.remove("hidden");
    return;
  }

  if (type === "task") {
    const t = tasksCache.find((item) => item.id === itemId);
    if (!t) return;
    const ext = getExtendedMeta(t.id, t.title);
    const cat = getCategoryById(t.categoryId || ext.categoryId || (t.tags && t.tags[0]));
    const desc = t.description ?? ext.description ?? "";
    const subtasks = t.subtasks || ext.subtasks || [];
    const deadlineDate = getTaskDeadlineDate(t);
    const msLeft = deadlineDate ? deadlineDate.getTime() - now.getTime() : 0;
    const cd = formatCountdown(msLeft);
    const isExpired = !t.completed && cd.expired;
    const taskPoints = TASK_PRIORITY_POINTS[t.priority] || 30;

    catIconEl.style.background = `${cat.color}20`;
    catIconEl.style.color = cat.color;
    catIconEl.innerHTML = `<i class="${escapeHtml(cat.icon)}"></i>`;
    typeEl.textContent = `Action Task • ${cat.name}`;
    titleEl.textContent = t.title;

    const subtasksHtml =
      subtasks.length > 0
        ? `<div>
            <label class="field-label" style="margin-bottom:4px;">Sub-tasks / Parts</label>
            <div class="task-subitems-list" style="margin-top:0;padding-top:0;border-top:none;">
              ${subtasks
                .map((sub) => {
                  const subMsLeft = (sub.deadlineMs || now.getTime() + 60000) - now.getTime();
                  const subCd = formatCountdown(subMsLeft);
                  const subExpired = !sub.completed && subCd.expired;
                  return `
                    <div class="subtask-chip-item ${sub.completed ? "is-completed" : subExpired ? "is-expired" : ""}">
                      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                        <i class="ri-git-commit-line" style="color:var(--primary)"></i>
                        <strong>${escapeHtml(sub.title)}</strong>
                        <span class="countdown-pill ${sub.completed ? "" : subCd.urgency}" data-subtask-countdown="${t.id}__${sub.id}">
                          ${sub.completed ? "Done ✓" : subExpired ? "Expired" : subCd.text}
                        </span>
                      </div>
                      <button type="button" class="btn-small" data-popup-subtask="${t.id}__${sub.id}" ${
                        sub.completed || subExpired ? "disabled" : ""
                      }>
                        ${sub.completed ? "✓" : `+${sub.points || 10} pts`}
                      </button>
                    </div>
                  `;
                })
                .join("")}
            </div>
          </div>`
        : "";

    bodyEl.innerHTML = `
      <div class="item-meta" style="margin-top:0;">
        <span class="badge badge-${t.priority}">${t.priority} (${taskPoints} pts)</span>
        ${
          deadlineDate
            ? `<span><i class="ri-calendar-event-line"></i> ${deadlineDate.toLocaleString([], {
                dateStyle: "short",
                timeStyle: "short"
              })}</span>`
            : ""
        }
        <span class="countdown-pill ${t.completed ? "" : cd.urgency}" data-task-countdown="${t.id}">
          <i class="ri-timer-line"></i> ${t.completed ? "Completed" : cd.text}
        </span>
      </div>
      <div>
        <label class="field-label" style="margin-top:4px;margin-bottom:4px;">Description</label>
        <div class="detail-desc-box ${desc ? "" : "empty-desc"}">${
          desc ? escapeHtml(desc) : "No description added for this task."
        }</div>
      </div>
      ${subtasksHtml}
    `;

    bodyEl.querySelectorAll("[data-popup-subtask]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const [tId, sId] = btn.dataset.popupSubtask.split("__");
        await completeSubtask(tId, sId);
        openItemDetailPopup("task", tId);
      });
    });

    actionsEl.innerHTML = `
      <div style="display:flex;gap:6px;">
        <button type="button" class="btn-secondary btn-xs" id="detail-popup-edit-btn">
          <i class="ri-edit-line"></i> Edit
        </button>
        <button type="button" class="btn-danger-small" id="detail-popup-delete-btn">
          <i class="ri-delete-bin-6-line"></i> Delete
        </button>
      </div>
      <button type="button" class="btn-complete-quest ${t.completed ? "done-btn" : ""}" id="detail-popup-complete-btn" ${
        t.completed || isExpired ? "disabled" : ""
      }>
        ${
          t.completed
            ? `<i class="ri-check-double-line"></i> Completed`
            : isExpired
            ? `<i class="ri-lock-2-line"></i> Expired`
            : `<i class="ri-copper-diamond-line"></i> Complete (+${taskPoints} pts)`
        }
      </button>
    `;

    document.getElementById("detail-popup-edit-btn").addEventListener("click", () => {
      modal.classList.add("hidden");
      openTaskModalForEdit(t.id);
    });
    document.getElementById("detail-popup-delete-btn").addEventListener("click", () => {
      modal.classList.add("hidden");
      requestDeleteItem("tasks", t.id, `"${t.title}"`);
    });
    const compBtn = document.getElementById("detail-popup-complete-btn");
    if (compBtn && !t.completed && !isExpired) {
      compBtn.addEventListener("click", async () => {
        await completeTask(t.id);
        modal.classList.add("hidden");
      });
    }
    modal.classList.remove("hidden");
    return;
  }

  if (type === "reminder") {
    const r = remindersCache.find((item) => item.id === itemId);
    if (!r) return;
    const cat = getCategoryById(r.categoryId);
    const dt = new Date(r.datetime);
    const cd = formatCountdown(dt.getTime() - now.getTime());
    const desc = r.description || "";

    catIconEl.style.background = `${cat.color}20`;
    catIconEl.style.color = cat.color;
    catIconEl.innerHTML = `<i class="${escapeHtml(cat.icon)}"></i>`;
    typeEl.textContent = `Reminder • ${cat.name}`;
    titleEl.textContent = r.title;

    bodyEl.innerHTML = `
      <div class="item-meta" style="margin-top:0;">
        <span><i class="ri-calendar-event-line"></i> ${dt.toLocaleString([], {
          dateStyle: "medium",
          timeStyle: "short"
        })}</span>
        <span class="countdown-pill ${cd.urgency}">${cd.expired ? "Passed" : cd.text}</span>
      </div>
      <div>
        <label class="field-label" style="margin-top:4px;margin-bottom:4px;">Description</label>
        <div class="detail-desc-box ${desc ? "" : "empty-desc"}">${
          desc ? escapeHtml(desc) : "No description added for this reminder."
        }</div>
      </div>
    `;

    actionsEl.innerHTML = `
      <div style="display:flex;gap:6px;">
        <button type="button" class="btn-secondary btn-xs" id="detail-popup-edit-btn">
          <i class="ri-edit-line"></i> Edit
        </button>
        <button type="button" class="btn-danger-small" id="detail-popup-delete-btn">
          <i class="ri-delete-bin-6-line"></i> Delete
        </button>
      </div>
      <button type="button" class="btn-primary btn-xs" id="detail-popup-close-btn">
        Close
      </button>
    `;

    document.getElementById("detail-popup-edit-btn").addEventListener("click", () => {
      modal.classList.add("hidden");
      openReminderModalForEdit(r.id);
    });
    document.getElementById("detail-popup-delete-btn").addEventListener("click", () => {
      modal.classList.add("hidden");
      openConfirmModal("Delete Reminder?", `Remove "${r.title}" from your reminders?`, () => {
        remindersCache = remindersCache.filter((item) => item.id !== r.id);
        saveReminders();
        renderAllViews();
        showToast("Reminder deleted", "ri-delete-bin-line");
      });
    });
    document.getElementById("detail-popup-close-btn").addEventListener("click", () => {
      modal.classList.add("hidden");
    });

    modal.classList.remove("hidden");
  }
}

function buildHabitCardHtml(h, now = new Date()) {
  const todayStr = toDateString(now);
  const done = h.lastCompletedDate === todayStr;
  const deadlineDate = getHabitDeadlineDate(h.deadlineTime, now);
  const msLeft = deadlineDate.getTime() - now.getTime();
  const countdown = formatCountdown(msLeft);
  const isExpired = !done && countdown.expired;

  const ext = getExtendedMeta(h.id, h.title);
  const cat = getCategoryById(h.categoryId || ext.categoryId || (h.tags && h.tags[0]));
  const desc = h.description ?? ext.description ?? "";

  let statusBadgeHtml = "";
  if (done) {
    statusBadgeHtml = `<span class="countdown-pill"><i class="ri-checkbox-circle-fill"></i> Done</span>`;
  } else if (isExpired) {
    statusBadgeHtml = `<span class="countdown-pill expired" data-habit-countdown="${h.id}"><i class="ri-time-line"></i> Expired (${h.deadlineTime})</span>`;
  } else {
    statusBadgeHtml = `<span class="countdown-pill ${countdown.urgency}" data-habit-countdown="${h.id}"><i class="ri-timer-flash-line"></i> ${countdown.text}</span>`;
  }

  const stateClass = done ? "is-completed" : isExpired ? "is-expired" : "";
  const priorityClass = `priority-card-${h.priority || "Medium"}`;
  const buttonLabel = done
    ? `<i class="ri-check-double-line"></i> Done`
    : isExpired
    ? `<i class="ri-lock-2-line"></i> Expired`
    : `<i class="ri-copper-diamond-line"></i> +${h.basePoints} pts`;

  return `
    <div class="list-item ${priorityClass} ${stateClass}" data-habit-card="${h.id}">
      <div style="flex:1;min-width:0;">
        <div class="quest-title">
          <span>${escapeHtml(h.title)}</span>
        </div>
        ${desc ? `<div class="item-description-text">${escapeHtml(desc)}</div>` : ""}
        <div class="item-meta">
          <span class="cat-chip" style="border-color:${cat.color}40;color:${cat.color}">
            <i class="${escapeHtml(cat.icon)}"></i> ${escapeHtml(cat.name)}
          </span>
          <span class="badge badge-${h.priority}">${h.priority}</span>
          <span class="streak-pill"><i class="ri-fire-fill"></i> ${h.currentStreak || 0}d</span>
          <span><i class="ri-alarm-line"></i> ${h.deadlineTime}</span>
          ${statusBadgeHtml}
        </div>
      </div>
      <div class="quest-actions">
        <button class="btn-complete-quest ${done ? "done-btn" : ""}" data-complete-habit="${h.id}" ${done || isExpired ? "disabled" : ""}>
          ${buttonLabel}
        </button>
        <button class="btn-edit-item" data-edit-habit="${h.id}" title="Edit Habit">
          <i class="ri-edit-line"></i>
        </button>
        <button class="btn-delete-item" data-delete-habit="${h.id}" data-habit-title="${escapeHtml(h.title)}" title="Delete Habit">
          <i class="ri-delete-bin-6-line"></i>
        </button>
      </div>
    </div>
  `;
}

function bindHabitCardEvents(container) {
  if (!container) return;
  container.querySelectorAll("[data-complete-habit]").forEach((btn) => {
    btn.addEventListener("click", () => completeHabit(btn.dataset.completeHabit));
  });
  container.querySelectorAll("[data-edit-habit]").forEach((btn) => {
    btn.addEventListener("click", () => openHabitModalForEdit(btn.dataset.editHabit));
  });
  container.querySelectorAll("[data-delete-habit]").forEach((btn) => {
    btn.addEventListener("click", () =>
      requestDeleteItem("habits", btn.dataset.deleteHabit, `"${btn.dataset.habitTitle}"`)
    );
  });
}

function renderHomeActiveQuests() {
  const homeQuestsContainer = document.getElementById("home-active-quests-list");
  if (!homeQuestsContainer) return;

  const now = new Date();
  const todayStr = toDateString(now);
  const todayDow = now.getDay();

  // Active Habits (Top 5)
  const activeHabits = sortHabitsByDeadlineAndPriority(
    habitsCache.filter((h) => h.frequency === "daily" || (h.daysOfWeek || []).includes(todayDow)),
    now
  )
    .filter((h) => h.lastCompletedDate !== todayStr && isWithinDeadlineTime(h.deadlineTime, now))
    .slice(0, 5)
    .map((h) => ({
      itemType: "habit",
      data: h,
      deadlineMs: getHabitDeadlineDate(h.deadlineTime, now).getTime(),
      priorityWeight: PRIORITY_WEIGHT_ORDER[h.priority] || 1
    }));

  // Active Tasks (Top 5)
  const sortedTasks = [...tasksCache].sort((a, b) => {
    const dA = getTaskDeadlineDate(a)?.getTime() || Infinity;
    const dB = getTaskDeadlineDate(b)?.getTime() || Infinity;
    if (Math.abs(dA - dB) <= 15 * 60 * 1000) {
      return (PRIORITY_WEIGHT_ORDER[b.priority] || 1) - (PRIORITY_WEIGHT_ORDER[a.priority] || 1);
    }
    return dA - dB;
  });

  const activeTasks = sortedTasks
    .filter((t) => {
      if (t.completed) return false;
      const d = getTaskDeadlineDate(t);
      return !d || now.getTime() <= d.getTime();
    })
    .slice(0, 5)
    .map((t) => ({
      itemType: "task",
      data: t,
      deadlineMs: getTaskDeadlineDate(t)?.getTime() || Infinity,
      priorityWeight: PRIORITY_WEIGHT_ORDER[t.priority] || 1
    }));

  // Combine & sort all active Habits and Tasks together by deadline & priority
  const combined = [...activeHabits, ...activeTasks].sort((a, b) => {
    if (Math.abs(a.deadlineMs - b.deadlineMs) <= 15 * 60 * 1000) {
      return b.priorityWeight - a.priorityWeight;
    }
    return a.deadlineMs - b.deadlineMs;
  });

  if (combined.length === 0) {
    homeQuestsContainer.innerHTML = `<p class="small-muted" style="padding:8px 0;">No active habits or tasks right now.</p>`;
  } else {
    homeQuestsContainer.innerHTML = combined
      .map((entry) =>
        entry.itemType === "habit"
          ? buildHomeHabitMinimalHtml(entry.data, now)
          : buildHomeTaskMinimalHtml(entry.data, now)
      )
      .join("");
    bindHomeDetailClickEvents(homeQuestsContainer);
  }
}

function renderHabits() {
  const habitsTabContainer = document.getElementById("habits-list");
  const now = new Date();
  const todayStr = toDateString(now);
  const todayDow = now.getDay();

  const todaysAll = sortHabitsByDeadlineAndPriority(
    habitsCache.filter((h) => h.frequency === "daily" || (h.daysOfWeek || []).includes(todayDow)),
    now
  );

  renderHomeActiveQuests();

  // Habits Tab List
  if (habitsTabContainer) {
    const filtered = todaysAll.filter((h) => {
      const done = h.lastCompletedDate === todayStr;
      const expired = !done && !isWithinDeadlineTime(h.deadlineTime, now);
      if (habitFilter === "active") return !done && !expired;
      if (habitFilter === "done") return done;
      if (habitFilter === "expired") return expired;
      return true;
    });

    if (filtered.length === 0) {
      habitsTabContainer.innerHTML = `
        <div style="text-align:center;padding:18px 10px;color:var(--muted);font-size:12px;">
          No habits in this filter for today.
        </div>`;
    } else {
      habitsTabContainer.innerHTML = filtered.map((h) => buildHabitCardHtml(h, now)).join("");
      bindHabitCardEvents(habitsTabContainer);
    }
  }
}

function buildTaskCardHtml(t, now = new Date()) {
  const deadlineDate = getTaskDeadlineDate(t);
  let isExpired = false;
  let countdownHtml = "";

  if (deadlineDate) {
    const msLeft = deadlineDate.getTime() - now.getTime();
    const cd = formatCountdown(msLeft);
    isExpired = !t.completed && cd.expired;
    const formattedDate = deadlineDate.toLocaleString([], { dateStyle: "short", timeStyle: "short" });

    if (t.completed) {
      countdownHtml = `<span class="countdown-pill"><i class="ri-check-line"></i> Completed</span>`;
    } else if (isExpired) {
      countdownHtml = `<span class="countdown-pill expired" data-task-countdown="${t.id}"><i class="ri-error-warning-line"></i> Overdue (${formattedDate})</span>`;
    } else {
      countdownHtml = `<span class="countdown-pill ${cd.urgency}" data-task-countdown="${t.id}"><i class="ri-timer-line"></i> ${cd.text}</span>`;
    }
  }

  const ext = getExtendedMeta(t.id, t.title);
  const cat = getCategoryById(t.categoryId || ext.categoryId || (t.tags && t.tags[0]));
  const desc = t.description ?? ext.description ?? "";
  const subtasks = t.subtasks || ext.subtasks || [];
  const taskPoints = TASK_PRIORITY_POINTS[t.priority] || 30;

  const subtasksHtml =
    subtasks.length > 0
      ? `<div class="task-subitems-list">
          ${subtasks
            .map((sub) => {
              const subMsLeft = (sub.deadlineMs || now.getTime() + 60000) - now.getTime();
              const subCd = formatCountdown(subMsLeft);
              const subExpired = !sub.completed && subCd.expired;
              const subState = sub.completed ? "is-completed" : subExpired ? "is-expired" : "";
              return `
                <div class="subtask-chip-item ${subState}">
                  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                    <i class="ri-git-commit-line" style="color:var(--primary)"></i>
                    <strong>${escapeHtml(sub.title)}</strong>
                    <span class="countdown-pill ${sub.completed ? "" : subCd.urgency}" data-subtask-countdown="${t.id}__${sub.id}">
                      ${sub.completed ? "Done ✓" : subExpired ? "Expired" : subCd.text}
                    </span>
                  </div>
                  <button type="button" class="btn-small" data-complete-subtask="${t.id}__${sub.id}" ${sub.completed || subExpired ? "disabled" : ""}>
                    ${sub.completed ? "✓" : `+${sub.points || 10} pts`}
                  </button>
                </div>
              `;
            })
            .join("")}
        </div>`
      : "";

  const stateClass = t.completed ? "is-completed" : isExpired ? "is-expired" : "";
  const priorityClass = `priority-card-${t.priority || "Medium"}`;
  const btnText = t.completed
    ? `<i class="ri-check-double-line"></i> Done`
    : isExpired
    ? `<i class="ri-lock-2-line"></i> Expired`
    : `<i class="ri-copper-diamond-line"></i> +${taskPoints} pts`;

  return `
    <div class="list-item ${priorityClass} ${stateClass}" data-task-card="${t.id}" style="flex-direction:column;align-items:stretch;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <div style="flex:1;min-width:0;">
          <div class="quest-title">${escapeHtml(t.title)}</div>
          ${desc ? `<div class="item-description-text">${escapeHtml(desc)}</div>` : ""}
          <div class="item-meta">
            <span class="cat-chip" style="border-color:${cat.color}40;color:${cat.color}">
              <i class="${escapeHtml(cat.icon)}"></i> ${escapeHtml(cat.name)}
            </span>
            <span class="badge badge-${t.priority}">${t.priority} (${taskPoints} pts)</span>
            ${countdownHtml}
          </div>
        </div>
        <div class="quest-actions">
          <button class="btn-complete-quest ${t.completed ? "done-btn" : ""}" data-complete-task="${t.id}" ${t.completed || isExpired ? "disabled" : ""}>
            ${btnText}
          </button>
          <button class="btn-edit-item" data-edit-task="${t.id}" title="Edit Task">
            <i class="ri-edit-line"></i>
          </button>
          <button class="btn-delete-item" data-delete-task="${t.id}" data-task-title="${escapeHtml(t.title)}" title="Delete Task">
            <i class="ri-delete-bin-6-line"></i>
          </button>
        </div>
      </div>
      ${subtasksHtml}
    </div>
  `;
}

function bindTaskCardEvents(container) {
  if (!container) return;
  container.querySelectorAll("[data-complete-task]").forEach((btn) => {
    btn.addEventListener("click", () => completeTask(btn.dataset.completeTask));
  });
  container.querySelectorAll("[data-edit-task]").forEach((btn) => {
    btn.addEventListener("click", () => openTaskModalForEdit(btn.dataset.editTask));
  });
  container.querySelectorAll("[data-delete-task]").forEach((btn) => {
    btn.addEventListener("click", () =>
      requestDeleteItem("tasks", btn.dataset.deleteTask, `"${btn.dataset.taskTitle}"`)
    );
  });
  container.querySelectorAll("[data-complete-subtask]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [tId, sId] = btn.dataset.completeSubtask.split("__");
      completeSubtask(tId, sId);
    });
  });
}

function renderTasks() {
  const tasksTabContainer = document.getElementById("tasks-list");
  const now = new Date();

  const sortedTasks = [...tasksCache].sort((a, b) => {
    const dA = getTaskDeadlineDate(a)?.getTime() || Infinity;
    const dB = getTaskDeadlineDate(b)?.getTime() || Infinity;
    if (Math.abs(dA - dB) <= 15 * 60 * 1000) {
      return (PRIORITY_WEIGHT_ORDER[b.priority] || 1) - (PRIORITY_WEIGHT_ORDER[a.priority] || 1);
    }
    return dA - dB;
  });

  renderHomeActiveQuests();

  // Tasks Tab
  if (tasksTabContainer) {
    const filtered = sortedTasks.filter((t) => {
      const deadlineDate = getTaskDeadlineDate(t);
      const isExpired = !t.completed && deadlineDate && now.getTime() > deadlineDate.getTime();
      if (taskFilter === "completed") return t.completed;
      if (taskFilter === "expired") return isExpired;
      return !t.completed;
    });

    if (filtered.length === 0) {
      tasksTabContainer.innerHTML = `
        <div style="text-align:center;padding:18px 10px;color:var(--muted);font-size:12px;">
          No tasks in this view. Click "+ New Task" to start one!
        </div>`;
    } else {
      tasksTabContainer.innerHTML = filtered.map((t) => buildTaskCardHtml(t, now)).join("");
      bindTaskCardEvents(tasksTabContainer);
    }
  }
}

function renderRemindersViews() {
  const homeRemList = document.getElementById("home-reminders-list");
  const othersRemList = document.getElementById("others-reminders-list");
  const now = new Date();

  const sorted = [...remindersCache].sort(
    (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
  );

  // Minimalist Reminder Row for Home (Click to open popup with description)
  if (homeRemList) {
    if (sorted.length === 0) {
      homeRemList.innerHTML = `<p class="small-muted">No reminders scheduled.</p>`;
    } else {
      homeRemList.innerHTML = sorted
        .slice(0, 5)
        .map((r) => {
          const dt = new Date(r.datetime);
          const cd = formatCountdown(dt.getTime() - now.getTime());
          const cat = getCategoryById(r.categoryId);
          return `
            <div class="home-minimal-item ${cd.expired ? "is-expired" : ""}" data-home-detail-type="reminder" data-home-detail-id="${r.id}" title="Click to view details & description">
              <div class="home-minimal-left">
                <div class="home-cat-icon" style="background:${cat.color}18;color:${cat.color}">
                  <i class="${escapeHtml(cat.icon)}"></i>
                </div>
                <span class="home-minimal-title">${escapeHtml(r.title)}</span>
              </div>
              <div class="home-minimal-right">
                <span class="countdown-pill ${cd.urgency}">${cd.expired ? "Passed" : cd.text}</span>
              </div>
            </div>
          `;
        })
        .join("");
      bindHomeDetailClickEvents(homeRemList);
    }
  }

  // Full Reminder Row for Others Tab
  if (othersRemList) {
    if (sorted.length === 0) {
      othersRemList.innerHTML = `<p class="small-muted">No reminders scheduled.</p>`;
    } else {
      othersRemList.innerHTML = sorted
        .map((r) => {
          const dt = new Date(r.datetime);
          const msLeft = dt.getTime() - now.getTime();
          const cd = formatCountdown(msLeft);
          const cat = getCategoryById(r.categoryId);
          const desc = r.description || "";

          return `
            <div class="list-item ${cd.expired ? "is-expired" : ""}">
              <div style="flex:1;min-width:0;">
                <div class="quest-title">
                  <i class="ri-notification-3-fill" style="color:#f59e0b"></i>
                  <span>${escapeHtml(r.title)}</span>
                </div>
                ${desc ? `<div class="item-description-text">${escapeHtml(desc)}</div>` : ""}
                <div class="item-meta">
                  <span class="cat-chip" style="color:${cat.color}"><i class="${escapeHtml(cat.icon)}"></i> ${escapeHtml(cat.name)}</span>
                  <span><i class="ri-calendar-event-line"></i> ${dt.toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</span>
                  <span class="countdown-pill ${cd.urgency}">${cd.expired ? "Passed" : cd.text}</span>
                </div>
              </div>
              <div class="quest-actions">
                <button type="button" class="btn-edit-item" data-edit-reminder="${r.id}" title="Edit Reminder">
                  <i class="ri-edit-line"></i>
                </button>
                <button type="button" class="btn-delete-item" data-delete-reminder="${r.id}" title="Delete Reminder">
                  <i class="ri-delete-bin-6-line"></i>
                </button>
              </div>
            </div>
          `;
        })
        .join("");

      othersRemList.querySelectorAll("[data-edit-reminder]").forEach((btn) => {
        btn.addEventListener("click", () => openReminderModalForEdit(btn.dataset.editReminder));
      });

      othersRemList.querySelectorAll("[data-delete-reminder]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.deleteReminder;
          openConfirmModal("Delete Reminder?", "Remove this reminder from your schedule?", () => {
            remindersCache = remindersCache.filter((r) => r.id !== id);
            saveReminders();
            renderAllViews();
            showToast("Reminder deleted", "ri-delete-bin-line");
          });
        });
      });
    }
  }
}

function renderCalendar() {
  const monthLabel = document.getElementById("calendar-month-label");
  const grid = document.getElementById("calendar-days-grid");
  if (!monthLabel || !grid) return;

  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  monthLabel.textContent = new Date(year, month, 1).toLocaleString([], {
    month: "long",
    year: "numeric"
  });

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = toDateString(new Date());

  let cellsHtml = "";
  for (let i = 0; i < firstDow; i++) {
    cellsHtml += `<div class="cal-day empty"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const dStr = toDateString(dateObj);
    const hasRem = remindersCache.some((r) => toDateString(new Date(r.datetime)) === dStr);
    const hasTask = tasksCache.some((t) => {
      const td = getTaskDeadlineDate(t);
      return td && toDateString(td) === dStr;
    });

    const isToday = dStr === todayStr;
    const isSelected = dStr === selectedCalendarDateStr;

    cellsHtml += `
      <button type="button" class="cal-day ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}" data-cal-date="${dStr}">
        <span>${d}</span>
        <div class="cal-dots">
          ${hasRem ? `<span class="cal-dot" style="background:#f59e0b"></span>` : ""}
          ${hasTask ? `<span class="cal-dot" style="background:#06b6d4"></span>` : ""}
        </div>
      </button>
    `;
  }

  grid.innerHTML = cellsHtml;
  grid.querySelectorAll("[data-cal-date]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedCalendarDateStr = btn.dataset.calDate;
      renderCalendar();
    });
  });

  renderSelectedDatePreview(selectedCalendarDateStr);
}

function renderSelectedDatePreview(dateStr) {
  const heading = document.getElementById("selected-date-heading");
  const countBadge = document.getElementById("selected-date-count");
  const list = document.getElementById("calendar-date-items");
  if (!list) return;

  heading.textContent = `Schedule for ${dateStr}`;
  const rems = remindersCache.filter((r) => toDateString(new Date(r.datetime)) === dateStr);
  const tasks = tasksCache.filter((t) => {
    const td = getTaskDeadlineDate(t);
    return td && toDateString(td) === dateStr;
  });

  countBadge.textContent = `${rems.length + tasks.length} events`;

  const itemsHtml = [
    ...rems.map(
      (r) => `
      <div class="list-item">
        <div>
          <strong>🔔 ${escapeHtml(r.title)}</strong>
          ${r.description ? `<div class="item-description-text">${escapeHtml(r.description)}</div>` : ""}
          <div class="item-meta"><span>Reminder • ${new Date(r.datetime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>
        </div>
      </div>`
    ),
    ...tasks.map(
      (t) => `
      <div class="list-item">
        <div>
          <strong>⚡ ${escapeHtml(t.title)}</strong>
          <div class="item-meta"><span>Task • ${t.priority} Priority</span></div>
        </div>
      </div>`
    )
  ];

  list.innerHTML =
    itemsHtml.length > 0
      ? itemsHtml.join("")
      : `<p class="small-muted">No specific reminders or tasks on ${dateStr}.</p>`;
}

document.getElementById("cal-prev-btn").addEventListener("click", () => {
  calendarCursor.setMonth(calendarCursor.getMonth() - 1);
  renderCalendar();
});
document.getElementById("cal-next-btn").addEventListener("click", () => {
  calendarCursor.setMonth(calendarCursor.getMonth() + 1);
  renderCalendar();
});
document.getElementById("cal-today-btn").addEventListener("click", () => {
  calendarCursor = new Date();
  selectedCalendarDateStr = toDateString(calendarCursor);
  renderCalendar();
});

document.getElementById("reminder-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = document.getElementById("reminder-title").value.trim();
  const description = document.getElementById("reminder-description").value.trim();
  const dtVal = document.getElementById("reminder-datetime").value;
  const catId = document.getElementById("reminder-category-select").value;

  remindersCache.push({
    id: `rem-${Date.now()}`,
    title,
    description,
    datetime: new Date(dtVal).toISOString(),
    categoryId: catId
  });
  saveReminders();
  selectedCalendarDateStr = toDateString(new Date(dtVal));
  renderAllViews();
  e.target.reset();
  showToast("Reminder added!", "ri-notification-3-line");
});

function renderRewards(rewards) {
  const drawerContainer = document.getElementById("rewards-list");
  const othersContainer = document.getElementById("others-rewards-list");

  const buildRewardHtml = (r) => `
    <div class="list-item">
      <div>
        <strong>${escapeHtml(r.title)}</strong>
        <div class="item-meta">
          <span><i class="ri-copper-diamond-fill" style="color:var(--primary)"></i> ${r.cost} pts</span>
          <span>• Claimed: ${r.redeemedCount || 0}x</span>
        </div>
      </div>
      <div class="quest-actions">
        <button class="btn-small" data-redeem-reward="${r.id}">
          <i class="ri-shopping-bag-3-line"></i> Redeem
        </button>
        <button class="btn-edit-item" data-edit-reward="${r.id}" title="Edit Reward">
          <i class="ri-edit-line"></i>
        </button>
        <button class="btn-delete-item" data-delete-reward="${r.id}" data-reward-title="${escapeHtml(r.title)}" title="Delete Reward">
          <i class="ri-delete-bin-6-line"></i>
        </button>
      </div>
    </div>
  `;

  const html =
    rewards.length === 0
      ? `<p class="small-muted">Create custom real-life rewards above.</p>`
      : rewards.map(buildRewardHtml).join("");

  if (drawerContainer) drawerContainer.innerHTML = html;
  if (othersContainer) othersContainer.innerHTML = html;

  [drawerContainer, othersContainer].forEach((box) => {
    if (!box) return;
    box.querySelectorAll("[data-redeem-reward]").forEach((btn) => {
      btn.addEventListener("click", () => redeemReward(btn.dataset.redeemReward));
    });
    box.querySelectorAll("[data-edit-reward]").forEach((btn) => {
      btn.addEventListener("click", () => openRewardEditModal(btn.dataset.editReward));
    });
    box.querySelectorAll("[data-delete-reward]").forEach((btn) => {
      btn.addEventListener("click", () =>
        requestDeleteItem("rewards", btn.dataset.deleteReward, `reward "${btn.dataset.rewardTitle}"`)
      );
    });
  });
}

function renderJournals(journals) {
  const drawerContainer = document.getElementById("journals-list");
  const galleryContainer = document.getElementById("dashboard-journals-grid");
  const moodEmoji = { great: "🤩", good: "🙂", okay: "😐", low: "😔", stressed: "😫" };

  if (journals.length === 0) {
    const emptyMsg = `<p class="small-muted">No journal entries yet. Click "Write Journal" to record your thoughts!</p>`;
    if (drawerContainer) drawerContainer.innerHTML = emptyMsg;
    if (galleryContainer) galleryContainer.innerHTML = emptyMsg;
    return;
  }

  if (drawerContainer) {
    drawerContainer.innerHTML = journals
      .slice(0, 6)
      .map(
        (j) => `
        <div class="list-item" style="flex-direction:column;align-items:flex-start;">
          <div style="display:flex;justify-content:space-between;align-items:center;width:100%;font-size:11px;color:var(--muted);">
            <span>${moodEmoji[j.mood] || "🙂"} ${escapeHtml((j.mood || "good").toUpperCase())} • ${escapeHtml(j.date || "")}</span>
            <div style="display:flex;gap:4px;">
              <button type="button" class="btn-edit-item" data-edit-journal="${j.id}" title="Edit Journal">
                <i class="ri-edit-line"></i>
              </button>
              <button type="button" class="btn-delete-item" data-delete-journal="${j.id}" title="Delete Journal">
                <i class="ri-delete-bin-6-line"></i>
              </button>
            </div>
          </div>
          <p style="font-size:12.5px;margin-top:4px;">${escapeHtml(j.content || "(Visual Entry)")}</p>
          ${
            j.drawingDataUrl
              ? `<img src="${j.drawingDataUrl}" alt="Journal Media" style="width:100%;border-radius:8px;margin-top:5px;border:1px solid var(--border);" />`
              : ""
          }
        </div>
      `
      )
      .join("");
  }

  if (galleryContainer) {
    galleryContainer.innerHTML = journals
      .map(
        (j) => `
        <div class="journal-card-item">
          <div class="journal-card-top">
            <span class="journal-mood-tag">${moodEmoji[j.mood] || "🙂"} ${escapeHtml((j.mood || "good").toUpperCase())}</span>
            <div style="display:flex;align-items:center;gap:4px;">
              <span><i class="ri-calendar-line"></i> ${escapeHtml(j.date || "")}</span>
              <button type="button" class="btn-edit-item" data-edit-journal="${j.id}" title="Edit Journal Entry">
                <i class="ri-edit-line"></i>
              </button>
              <button type="button" class="btn-delete-item" data-delete-journal="${j.id}" title="Delete Journal Entry">
                <i class="ri-delete-bin-6-line"></i>
              </button>
            </div>
          </div>
          <p style="font-size:13px;line-height:1.5;color:var(--text);">${escapeHtml(j.content || "(Artwork / Photo Reflection)")}</p>
          ${
            j.drawingDataUrl
              ? `<img src="${j.drawingDataUrl}" alt="Journal Visual" class="journal-card-img" />`
              : ""
          }
        </div>
      `
      )
      .join("");
  }

  [drawerContainer, galleryContainer].forEach((box) => {
    if (!box) return;
    box.querySelectorAll("[data-edit-journal]").forEach((btn) => {
      btn.addEventListener("click", () => openJournalModalForEdit(btn.dataset.editJournal));
    });
    box.querySelectorAll("[data-delete-journal]").forEach((btn) => {
      btn.addEventListener("click", () =>
        requestDeleteItem("journals", btn.dataset.deleteJournal, "this journal entry")
      );
    });
  });
}

// ============================================================================
// 12. REAL-TIME 1-SECOND TICKER
// ============================================================================
function tickLiveCountdowns() {
  const now = new Date();
  const clockEl = document.getElementById("live-system-clock");
  if (clockEl) {
    clockEl.textContent = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  const todayStr = toDateString(now);
  let stateFlipped = false;

  habitsCache.forEach((h) => {
    if (h.lastCompletedDate === todayStr) return;
    const badges = document.querySelectorAll(`[data-habit-countdown="${h.id}"]`);
    const cards = document.querySelectorAll(`[data-habit-card="${h.id}"]`);
    if (badges.length === 0) return;

    const deadlineDate = getHabitDeadlineDate(h.deadlineTime, now);
    const msLeft = deadlineDate.getTime() - now.getTime();
    const cd = formatCountdown(msLeft);

    if (cd.expired) {
      cards.forEach((cardEl) => {
        if (!cardEl.classList.contains("is-expired")) stateFlipped = true;
      });
    } else {
      badges.forEach((badgeEl) => {
        badgeEl.className = `countdown-pill ${cd.urgency}`;
        badgeEl.innerHTML = `<i class="ri-timer-flash-line"></i> ${cd.text}`;
      });
    }
  });

  tasksCache.forEach((t) => {
    const ext = getExtendedMeta(t.id, t.title);
    const subtasks = t.subtasks || ext.subtasks || [];
    subtasks.forEach((sub) => {
      if (sub.completed || !sub.deadlineMs) return;
      const subBadges = document.querySelectorAll(`[data-subtask-countdown="${t.id}__${sub.id}"]`);
      const msLeft = sub.deadlineMs - now.getTime();
      const cd = formatCountdown(msLeft);
      subBadges.forEach((b) => {
        b.textContent = cd.expired ? "Expired" : cd.text;
        b.className = `countdown-pill ${cd.urgency}`;
      });
    });

    if (t.completed || !t.deadline) return;
    const badges = document.querySelectorAll(`[data-task-countdown="${t.id}"]`);
    const cards = document.querySelectorAll(`[data-task-card="${t.id}"]`);
    if (badges.length === 0) return;

    const deadlineDate = getTaskDeadlineDate(t);
    const msLeft = deadlineDate.getTime() - now.getTime();
    const cd = formatCountdown(msLeft);

    if (cd.expired) {
      cards.forEach((cardEl) => {
        if (!cardEl.classList.contains("is-expired")) stateFlipped = true;
      });
    } else {
      badges.forEach((badgeEl) => {
        badgeEl.className = `countdown-pill ${cd.urgency}`;
        badgeEl.innerHTML = `<i class="ri-timer-line"></i> ${cd.text}`;
      });
    }
  });

  if (stateFlipped) {
    renderHabits();
    renderTasks();
    updateDashboardStats();
  }
}

setInterval(tickLiveCountdowns, 1000);

// ============================================================================
// 13. JOURNAL OPTIONAL MEDIA & TASK DURATION / SUB-TASK BUILDER
// ============================================================================
function compressImageFile(file, maxWidth = 850, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const offCanvas = document.createElement("canvas");
        offCanvas.width = w;
        offCanvas.height = h;
        const offCtx = offCanvas.getContext("2d");
        offCtx.fillStyle = "#ffffff";
        offCtx.fillRect(0, 0, w, h);
        offCtx.drawImage(img, 0, 0, w, h);
        resolve(offCanvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function setJournalMediaMode(mode) {
  journalMediaMode = mode;
  document.querySelectorAll("[data-journal-media]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.journalMedia === mode);
  });
  document.getElementById("canvas-studio-wrapper").classList.toggle("hidden", mode !== "draw");
  document.getElementById("journal-upload-panel").classList.toggle("hidden", mode !== "upload");
}

document.querySelectorAll("[data-journal-media]").forEach((btn) => {
  btn.addEventListener("click", () => setJournalMediaMode(btn.dataset.journalMedia));
});

const journalImageInput = document.getElementById("journal-image-input");
document.getElementById("trigger-file-select-btn").addEventListener("click", () => {
  journalImageInput.click();
});

journalImageInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    uploadedJournalDataUrl = await compressImageFile(file, 880, 0.82);
    document.getElementById("uploaded-image-preview").src = uploadedJournalDataUrl;
    document.getElementById("upload-empty-state").classList.add("hidden");
    document.getElementById("upload-preview-state").classList.remove("hidden");
    showToast("Photo attached!", "ri-image-check-line");
  } catch (_) {}
});

document.getElementById("remove-uploaded-img-btn").addEventListener("click", () => {
  uploadedJournalDataUrl = null;
  journalImageInput.value = "";
  document.getElementById("upload-empty-state").classList.remove("hidden");
  document.getElementById("upload-preview-state").classList.add("hidden");
});

document.getElementById("send-upload-to-canvas-btn").addEventListener("click", async () => {
  if (!uploadedJournalDataUrl) return;
  setJournalMediaMode("draw");
  await artStudio.loadDataUrlToCanvas(uploadedJournalDataUrl);
  showToast("Image opened in Coloring Studio!", "ri-palette-line");
});

document.querySelectorAll("#task-duration-presets .duration-pill").forEach((pill) => {
  pill.addEventListener("click", () => {
    document.querySelectorAll("#task-duration-presets .duration-pill").forEach((p) => p.classList.remove("active"));
    pill.classList.add("active");
    selectedTaskDuration = pill.dataset.duration;
    const customWrap = document.getElementById("task-custom-datetime-wrap");
    customWrap.classList.toggle("hidden", selectedTaskDuration !== "other");
    if (selectedTaskDuration === "other") {
      const now = new Date();
      document.getElementById("task-custom-date").value = toDateString(now);
      document.getElementById("task-custom-time").value = "21:00";
    }
  });
});

function addSubtaskBuilderRow(initialSub = null) {
  const container = document.getElementById("subtasks-rows-container");
  const row = document.createElement("div");
  row.className = "subtask-form-row";
  if (initialSub && initialSub.id) {
    row.dataset.subId = initialSub.id;
    row.dataset.subCompleted = initialSub.completed ? "1" : "0";
    row.dataset.subDeadlineMs = initialSub.deadlineMs || "";
  }
  const initTitle = initialSub ? initialSub.title : "";
  const initPts = initialSub ? initialSub.points || 15 : 15;
  row.innerHTML = `
    <input type="text" class="subtask-title-inp" placeholder="Sub-task / Part name" required maxlength="100" value="${escapeHtml(initTitle)}" />
    <input type="number" class="subtask-pts-inp" value="${initPts}" min="5" max="200" title="Points for this part" />
    <select class="subtask-dur-inp" title="Time for this part">
      <option value="5">5 Min</option>
      <option value="15" selected>15 Min</option>
      <option value="30">30 Min</option>
      <option value="60">1 Hour</option>
      <option value="180">3 Hours</option>
    </select>
    <button type="button" class="btn-delete-item remove-subtask-btn" title="Remove Part">
      <i class="ri-close-circle-line"></i>
    </button>
  `;
  row.querySelector(".remove-subtask-btn").addEventListener("click", () => row.remove());
  container.appendChild(row);
}

document.getElementById("add-subtask-row-btn").addEventListener("click", () => addSubtaskBuilderRow());

// ============================================================================
// 14. CREATE & EDIT MODAL HELPERS + FORM SUBMISSIONS
// ============================================================================
function toLocalDatetimeInputValue(dateObj = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}T${pad(
    dateObj.getHours()
  )}:${pad(dateObj.getMinutes())}`;
}

function openHabitModalForCreate() {
  editingHabitId = null;
  syncCategoryDropdowns();
  document.getElementById("habit-form").reset();
  document.getElementById("habit-modal-title").textContent = "New Recurring Habit";
  document.getElementById("habit-submit-btn").innerHTML = `<i class="ri-add-circle-line"></i> Create Habit Quest`;
  document.getElementById("habit-description").value = "";
  document.getElementById("habit-deadline-time").value = "21:00";
  document.getElementById("habit-days-wrapper").classList.add("hidden");
  document.getElementById("habit-modal").classList.remove("hidden");
}

function openHabitModalForEdit(habitId) {
  const h = habitsCache.find((item) => item.id === habitId);
  if (!h) return;
  editingHabitId = h.id;
  syncCategoryDropdowns();
  const ext = getExtendedMeta(h.id, h.title);
  const cat = getCategoryById(h.categoryId || ext.categoryId || (h.tags && h.tags[0]));

  document.getElementById("habit-modal-title").textContent = "Edit Habit";
  document.getElementById("habit-submit-btn").innerHTML = `<i class="ri-save-3-line"></i> Save Habit Changes`;
  document.getElementById("habit-title").value = h.title || "";
  document.getElementById("habit-description").value = h.description ?? ext.description ?? "";
  document.getElementById("habit-category-select").value = cat.id;
  document.getElementById("habit-deadline-time").value = h.deadlineTime || "21:00";
  document.getElementById("habit-frequency").value = h.frequency || "daily";
  document.getElementById("habit-priority").value = h.priority || "Medium";
  document.getElementById("habit-points").value = h.basePoints || 20;

  const isWeekly = h.frequency === "weekly";
  document.getElementById("habit-days-wrapper").classList.toggle("hidden", !isWeekly);
  const days = h.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
  document.querySelectorAll("#habit-days-wrapper input[type='checkbox']").forEach((cb) => {
    cb.checked = days.includes(Number(cb.value));
  });

  document.getElementById("habit-modal").classList.remove("hidden");
}

function openTaskModalForCreate() {
  editingTaskId = null;
  syncCategoryDropdowns();
  document.getElementById("task-form").reset();
  document.getElementById("task-modal-title").textContent = "New Action Task";
  document.getElementById("task-submit-btn").innerHTML = `<i class="ri-add-circle-line"></i> Start Task Quest`;
  document.getElementById("task-description").value = "";
  document.getElementById("subtasks-rows-container").innerHTML = "";
  selectedTaskDuration = "30";
  document.querySelectorAll("#task-duration-presets .duration-pill").forEach((p) => {
    p.classList.toggle("active", p.dataset.duration === "30");
  });
  document.getElementById("task-custom-datetime-wrap").classList.add("hidden");
  document.getElementById("task-modal").classList.remove("hidden");
}

function openTaskModalForEdit(taskId) {
  const t = tasksCache.find((item) => item.id === taskId);
  if (!t) return;
  editingTaskId = t.id;
  syncCategoryDropdowns();
  const ext = getExtendedMeta(t.id, t.title);
  const cat = getCategoryById(t.categoryId || ext.categoryId || (t.tags && t.tags[0]));

  document.getElementById("task-modal-title").textContent = "Edit Action Task";
  document.getElementById("task-submit-btn").innerHTML = `<i class="ri-save-3-line"></i> Save Task Changes`;
  document.getElementById("task-title").value = t.title || "";
  document.getElementById("task-description").value = t.description ?? ext.description ?? "";
  document.getElementById("task-category-select").value = cat.id;
  document.getElementById("task-priority").value = t.priority || "Medium";

  selectedTaskDuration = "other";
  document.querySelectorAll("#task-duration-presets .duration-pill").forEach((p) => {
    p.classList.toggle("active", p.dataset.duration === "other");
  });
  document.getElementById("task-custom-datetime-wrap").classList.remove("hidden");

  const dObj = getTaskDeadlineDate(t) || new Date(Date.now() + 30 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  document.getElementById("task-custom-date").value = toDateString(dObj);
  document.getElementById("task-custom-time").value = `${pad(dObj.getHours())}:${pad(dObj.getMinutes())}`;

  const container = document.getElementById("subtasks-rows-container");
  container.innerHTML = "";
  const subtasks = t.subtasks || ext.subtasks || [];
  subtasks.forEach((sub) => addSubtaskBuilderRow(sub));

  document.getElementById("task-modal").classList.remove("hidden");
}

function openReminderModalForCreate() {
  editingReminderId = null;
  syncCategoryDropdowns();
  document.getElementById("reminder-modal-form").reset();
  document.getElementById("reminder-modal-title").textContent = "Schedule Reminder";
  document.getElementById("reminder-modal-submit-btn").innerHTML = `<i class="ri-notification-3-line"></i> Add Reminder`;
  const defaultDt = new Date(Date.now() + 60 * 60 * 1000);
  document.getElementById("reminder-modal-datetime").value = toLocalDatetimeInputValue(defaultDt);
  document.getElementById("reminder-modal").classList.remove("hidden");
}

function openReminderModalForEdit(reminderId) {
  const r = remindersCache.find((item) => item.id === reminderId);
  if (!r) return;
  editingReminderId = r.id;
  syncCategoryDropdowns();

  document.getElementById("reminder-modal-title").textContent = "Edit Reminder";
  document.getElementById("reminder-modal-submit-btn").innerHTML = `<i class="ri-save-3-line"></i> Save Reminder Changes`;
  document.getElementById("reminder-modal-title-input").value = r.title || "";
  document.getElementById("reminder-modal-description").value = r.description || "";
  document.getElementById("reminder-modal-datetime").value = toLocalDatetimeInputValue(new Date(r.datetime));
  document.getElementById("reminder-modal-category").value = r.categoryId || categoriesCache[0]?.id;
  document.getElementById("reminder-modal").classList.remove("hidden");
}

document.getElementById("reminder-modal-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = document.getElementById("reminder-modal-title-input").value.trim();
  const description = document.getElementById("reminder-modal-description").value.trim();
  const dtVal = document.getElementById("reminder-modal-datetime").value;
  const categoryId = document.getElementById("reminder-modal-category").value;

  if (editingReminderId) {
    const idx = remindersCache.findIndex((r) => r.id === editingReminderId);
    if (idx !== -1) {
      remindersCache[idx] = {
        ...remindersCache[idx],
        title,
        description,
        datetime: new Date(dtVal).toISOString(),
        categoryId
      };
    }
    editingReminderId = null;
    showToast("Reminder updated!", "ri-edit-line");
  } else {
    remindersCache.push({
      id: `rem-${Date.now()}`,
      title,
      description,
      datetime: new Date(dtVal).toISOString(),
      categoryId
    });
    showToast("Reminder scheduled!", "ri-notification-3-line");
  }

  saveReminders();
  selectedCalendarDateStr = toDateString(new Date(dtVal));
  renderAllViews();
  document.getElementById("reminder-modal").classList.add("hidden");
});

function openRewardEditModal(rewardId) {
  const r = rewardsCache.find((item) => item.id === rewardId);
  if (!r) return;
  editingRewardId = r.id;
  document.getElementById("reward-edit-title").value = r.title || "";
  document.getElementById("reward-edit-cost").value = r.cost || 50;
  document.getElementById("reward-edit-modal").classList.remove("hidden");
}

document.getElementById("reward-edit-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!editingRewardId) return;
  const title = document.getElementById("reward-edit-title").value.trim();
  const cost = Number(document.getElementById("reward-edit-cost").value) || 50;

  if (isLocalMode || !fb) {
    const r = rewardsCache.find((item) => item.id === editingRewardId);
    if (r) {
      r.title = title;
      r.cost = cost;
    }
    saveLocalDataStore();
    renderRewards(rewardsCache);
  } else if (currentUser) {
    try {
      await fb.updateDoc(fb.doc(fb.db, "users", currentUser.uid, "rewards", editingRewardId), {
        title,
        cost
      });
    } catch (_) {}
  }

  editingRewardId = null;
  document.getElementById("reward-edit-modal").classList.add("hidden");
  showToast("Reward updated!", "ri-edit-line");
});

function openJournalModalForCreate(startMode = "none") {
  editingJournalId = null;
  document.getElementById("journal-modal-title").textContent = "Write Daily Journal";
  document.getElementById("journal-submit-btn").innerHTML = `<i class="ri-check-line"></i> Save Journal Entry`;
  document.getElementById("journal-content").value = "";
  uploadedJournalDataUrl = null;
  document.getElementById("upload-empty-state").classList.remove("hidden");
  document.getElementById("upload-preview-state").classList.add("hidden");
  artStudio.resetCanvas(false);
  setJournalMediaMode(startMode);
  document.getElementById("journal-modal").classList.remove("hidden");
}

function openJournalModalForEdit(journalId) {
  const j = journalsCache.find((item) => item.id === journalId);
  if (!j) return;
  editingJournalId = j.id;
  document.getElementById("journal-modal-title").textContent = "Edit Journal Entry";
  document.getElementById("journal-submit-btn").innerHTML = `<i class="ri-save-3-line"></i> Update Journal Entry`;
  document.getElementById("journal-content").value = j.content || "";

  selectedMood = j.mood || "good";
  document.querySelectorAll(".mood-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.mood === selectedMood);
  });

  if (j.drawingDataUrl) {
    uploadedJournalDataUrl = j.drawingDataUrl;
    document.getElementById("uploaded-image-preview").src = uploadedJournalDataUrl;
    document.getElementById("upload-empty-state").classList.add("hidden");
    document.getElementById("upload-preview-state").classList.remove("hidden");
    setJournalMediaMode("upload");
  } else {
    uploadedJournalDataUrl = null;
    document.getElementById("upload-empty-state").classList.remove("hidden");
    document.getElementById("upload-preview-state").classList.add("hidden");
    setJournalMediaMode("none");
  }

  document.getElementById("journal-modal").classList.remove("hidden");
}

document.querySelectorAll(".mood-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mood-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedMood = btn.dataset.mood;
  });
});

document.getElementById("journal-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const content = document.getElementById("journal-content").value.trim();
  let finalMediaDataUrl = null;

  if (journalMediaMode === "upload" && uploadedJournalDataUrl) {
    finalMediaDataUrl = uploadedJournalDataUrl;
  } else if (journalMediaMode === "draw" && artStudio.hasContent) {
    finalMediaDataUrl = artStudio.toDataURL();
  }

  if (!content && !finalMediaDataUrl) {
    showToast("Please write a reflection or attach an optional drawing/photo!", "ri-edit-line");
    return;
  }

  if (editingJournalId) {
    if (isLocalMode || !fb) {
      const idx = journalsCache.findIndex((j) => j.id === editingJournalId);
      if (idx !== -1) {
        journalsCache[idx] = {
          ...journalsCache[idx],
          mood: selectedMood,
          content,
          drawingDataUrl: finalMediaDataUrl
        };
      }
      saveLocalDataStore();
      renderJournals(journalsCache);
    } else if (currentUser) {
      try {
        await fb.updateDoc(fb.doc(fb.db, "users", currentUser.uid, "journals", editingJournalId), {
          mood: selectedMood,
          content,
          drawingDataUrl: finalMediaDataUrl
        });
      } catch (_) {}
    }
    editingJournalId = null;
    showToast("Journal entry updated!", "ri-edit-line");
  } else {
    if (isLocalMode || !fb) {
      journalsCache.unshift({
        id: `demo-j-${Date.now()}`,
        date: toDateString(),
        mood: selectedMood,
        content,
        drawingDataUrl: finalMediaDataUrl
      });
      saveLocalDataStore();
      renderJournals(journalsCache);
    } else if (currentUser) {
      await fb.addDoc(fb.collection(fb.db, "users", currentUser.uid, "journals"), {
        date: toDateString(),
        mood: selectedMood,
        content,
        drawingDataUrl: finalMediaDataUrl,
        createdAt: fb.serverTimestamp()
      });
    }
    showToast("Journal entry saved!", "ri-book-mark-fill");
  }

  document.getElementById("journal-content").value = "";
  uploadedJournalDataUrl = null;
  document.getElementById("upload-empty-state").classList.remove("hidden");
  document.getElementById("upload-preview-state").classList.add("hidden");
  artStudio.toggleFullscreen(false);
  artStudio.resetCanvas(false);
  setJournalMediaMode("none");
  document.getElementById("journal-modal").classList.add("hidden");
});

document.getElementById("habit-frequency").addEventListener("change", (e) => {
  document.getElementById("habit-days-wrapper").classList.toggle("hidden", e.target.value !== "weekly");
});

document.getElementById("habit-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("habit-title").value.trim();
  const description = document.getElementById("habit-description").value.trim();
  const categoryId = document.getElementById("habit-category-select").value;
  const frequency = document.getElementById("habit-frequency").value;
  const checkedDays = Array.from(
    document.querySelectorAll("#habit-days-wrapper input:checked")
  ).map((el) => Number(el.value));
  const deadlineTime = document.getElementById("habit-deadline-time").value;
  const priority = document.getElementById("habit-priority").value;
  const basePoints = Number(document.getElementById("habit-points").value);
  const cat = getCategoryById(categoryId);

  saveExtendedMeta(title, { categoryId, description });

  if (editingHabitId) {
    saveExtendedMeta(editingHabitId, { categoryId, description });
    if (isLocalMode || !fb) {
      const idx = habitsCache.findIndex((h) => h.id === editingHabitId);
      if (idx !== -1) {
        habitsCache[idx] = {
          ...habitsCache[idx],
          title,
          description,
          categoryId,
          frequency,
          daysOfWeek: frequency === "daily" ? [0, 1, 2, 3, 4, 5, 6] : checkedDays,
          deadlineTime,
          priority,
          tags: [cat.name],
          basePoints
        };
      }
      saveLocalDataStore();
      renderAllViews();
    } else if (currentUser) {
      try {
        await fb.updateDoc(fb.doc(fb.db, "users", currentUser.uid, "habits", editingHabitId), {
          title,
          frequency,
          daysOfWeek: frequency === "daily" ? [0, 1, 2, 3, 4, 5, 6] : checkedDays,
          deadlineTime,
          priority,
          tags: [cat.name],
          basePoints
        });
      } catch (_) {}
    }
    editingHabitId = null;
    document.getElementById("habit-modal").classList.add("hidden");
    showToast("Habit updated!", "ri-edit-line");
    return;
  }

  const habitPayload = {
    title,
    description,
    frequency,
    daysOfWeek: frequency === "daily" ? [0, 1, 2, 3, 4, 5, 6] : checkedDays,
    deadlineTime,
    priority,
    tags: [cat.name],
    basePoints,
    currentStreak: 0,
    longestStreak: 0,
    lastCompletedDate: null
  };

  if (isLocalMode || !fb) {
    const newId = `demo-h-${Date.now()}`;
    saveExtendedMeta(newId, { categoryId, description });
    habitsCache.unshift({ id: newId, categoryId, ...habitPayload });
    saveLocalDataStore();
    renderAllViews();
  } else if (currentUser) {
    const docRef = await fb.addDoc(fb.collection(fb.db, "users", currentUser.uid, "habits"), {
      title,
      frequency: habitPayload.frequency,
      daysOfWeek: habitPayload.daysOfWeek,
      deadlineTime: habitPayload.deadlineTime,
      priority: habitPayload.priority,
      tags: habitPayload.tags,
      basePoints: habitPayload.basePoints,
      currentStreak: 0,
      longestStreak: 0,
      lastCompletedDate: null,
      createdAt: fb.serverTimestamp()
    });
    saveExtendedMeta(docRef.id, { categoryId, description });
  }

  e.target.reset();
  document.getElementById("habit-deadline-time").value = "21:00";
  document.getElementById("habit-modal").classList.add("hidden");
  showToast("New Habit Quest Created!", "ri-calendar-check-fill");
});

document.getElementById("task-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const now = new Date();
  const title = document.getElementById("task-title").value.trim();
  const description = document.getElementById("task-description").value.trim();
  const categoryId = document.getElementById("task-category-select").value;
  const priority = document.getElementById("task-priority").value;
  const cat = getCategoryById(categoryId);

  let deadlineDate = new Date(now.getTime() + 30 * 60 * 1000);
  if (selectedTaskDuration === "other") {
    const dVal = document.getElementById("task-custom-date").value || toDateString(now);
    const tVal = document.getElementById("task-custom-time").value || "23:59";
    deadlineDate = new Date(`${dVal}T${tVal}`);
  } else {
    const mins = Number(selectedTaskDuration) || 30;
    deadlineDate = new Date(now.getTime() + mins * 60 * 1000);
  }

  const subtaskRows = Array.from(document.querySelectorAll("#subtasks-rows-container .subtask-form-row"));
  const subtasks = subtaskRows
    .map((row, idx) => {
      const sTitle = row.querySelector(".subtask-title-inp").value.trim();
      const sPts = Number(row.querySelector(".subtask-pts-inp").value) || 10;
      const sMins = Number(row.querySelector(".subtask-dur-inp").value) || 15;
      if (!sTitle) return null;
      const prevId = row.dataset.subId;
      const prevComp = row.dataset.subCompleted === "1";
      const prevDeadline = Number(row.dataset.subDeadlineMs);
      return {
        id: prevId || `sub-${Date.now()}-${idx}`,
        title: sTitle,
        points: sPts,
        deadlineMs: prevDeadline || now.getTime() + sMins * 60 * 1000,
        completed: prevComp
      };
    })
    .filter(Boolean);

  saveExtendedMeta(title, { categoryId, description, subtasks });
  const autoPoints = TASK_PRIORITY_POINTS[priority] || 30;

  if (editingTaskId) {
    saveExtendedMeta(editingTaskId, { categoryId, description, subtasks });
    if (isLocalMode || !fb) {
      const idx = tasksCache.findIndex((t) => t.id === editingTaskId);
      if (idx !== -1) {
        tasksCache[idx] = {
          ...tasksCache[idx],
          title,
          description,
          categoryId,
          deadline: deadlineDate.toISOString(),
          priority,
          tags: [cat.name],
          basePoints: autoPoints,
          subtasks
        };
      }
      saveLocalDataStore();
      renderAllViews();
    } else if (currentUser) {
      try {
        await fb.updateDoc(fb.doc(fb.db, "users", currentUser.uid, "tasks", editingTaskId), {
          title,
          deadline: fb.Timestamp.fromDate(deadlineDate),
          priority,
          tags: [cat.name],
          basePoints: autoPoints
        });
      } catch (_) {}
      renderAllViews();
    }
    editingTaskId = null;
    document.getElementById("subtasks-rows-container").innerHTML = "";
    document.getElementById("task-modal").classList.add("hidden");
    showToast("Task updated!", "ri-edit-line");
    return;
  }

  if (isLocalMode || !fb) {
    const newId = `demo-t-${Date.now()}`;
    saveExtendedMeta(newId, { categoryId, description, subtasks });
    tasksCache.unshift({
      id: newId,
      title,
      description,
      categoryId,
      deadline: deadlineDate.toISOString(),
      priority,
      tags: [cat.name],
      basePoints: autoPoints,
      completed: false,
      subtasks
    });
    saveLocalDataStore();
    renderAllViews();
  } else if (currentUser) {
    const docRef = await fb.addDoc(fb.collection(fb.db, "users", currentUser.uid, "tasks"), {
      title,
      deadline: fb.Timestamp.fromDate(deadlineDate),
      priority,
      tags: [cat.name],
      basePoints: autoPoints,
      completed: false,
      completedAt: null,
      createdAt: fb.serverTimestamp()
    });
    saveExtendedMeta(docRef.id, { categoryId, description, subtasks });
  }

  e.target.reset();
  document.getElementById("subtasks-rows-container").innerHTML = "";
  document.getElementById("task-modal").classList.add("hidden");
  showToast(`Task Started! (${autoPoints} PTS + ${subtasks.length} Sub-tasks)`, "ri-flashlight-fill");
});

["reward-form", "others-reward-form"].forEach((formId) => {
  const formEl = document.getElementById(formId);
  if (!formEl) return;
  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    const isOthers = formId === "others-reward-form";
    const title = document.getElementById(isOthers ? "others-reward-title" : "reward-title").value.trim();
    const cost = Number(document.getElementById(isOthers ? "others-reward-cost" : "reward-cost").value);

    if (isLocalMode || !fb) {
      rewardsCache.push({ id: `demo-r-${Date.now()}`, title, cost, redeemedCount: 0 });
      saveLocalDataStore();
      renderRewards(rewardsCache);
    } else if (currentUser) {
      await fb.addDoc(fb.collection(fb.db, "users", currentUser.uid, "rewards"), {
        title,
        cost,
        redeemedCount: 0,
        createdAt: fb.serverTimestamp()
      });
    }
    e.target.reset();
    showToast("Reward added to store!", "ri-gift-line");
  });
});

// ============================================================================
// 15. PROFILE MODAL & TRIGGERS
// ============================================================================
function openProfileModal() {
  if (!userProfile) return;
  const uid = getUidKey();
  const customMeta = loadCustomProfileMeta(uid);

  document.getElementById("profile-name-input").value = userProfile.displayName || "Explorer";
  document.getElementById("profile-class-select").value =
    userProfile.heroClass || customMeta.heroClass || "Mindful Mage";
  document.getElementById("profile-bio-input").value = userProfile.bio || customMeta.bio || "";
  document.getElementById("profile-frame-select").value =
    userProfile.avatarFrame || customMeta.avatarFrame || "frame-cyber";
  document.getElementById("profile-accent-select").value =
    userProfile.accentTheme || customMeta.accentTheme || "indigo";

  selectedAvatarDraft =
    customMeta.customAvatar ||
    userProfile.photoURL ||
    "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix";

  syncProfileModalPreview();
  document.getElementById("profile-modal").classList.remove("hidden");
}

function syncProfileModalPreview() {
  const nameVal = document.getElementById("profile-name-input").value.trim() || "Explorer";
  const classVal = document.getElementById("profile-class-select").value;
  const bioVal = document.getElementById("profile-bio-input").value.trim() || "Customize your identity & theme";
  const frameVal = document.getElementById("profile-frame-select").value;

  document.getElementById("preview-profile-name").textContent = nameVal;
  document.getElementById("preview-profile-class").textContent = classVal;
  document.getElementById("preview-profile-bio").textContent = bioVal;
  document.getElementById("preview-avatar-img").src = selectedAvatarDraft;
  document.getElementById("preview-avatar-frame").className = `hero-avatar-wrap ${frameVal}`;
}

["profile-name-input", "profile-class-select", "profile-bio-input", "profile-frame-select"].forEach((id) => {
  document.getElementById(id).addEventListener("input", syncProfileModalPreview);
});

document.querySelectorAll(".avatar-preset-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".avatar-preset-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedAvatarDraft = btn.dataset.avatarUrl;
    document.getElementById("profile-upload-status").textContent = "Preset RPG Avatar selected";
    syncProfileModalPreview();
  });
});

document.getElementById("profile-avatar-file").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    selectedAvatarDraft = await compressImageFile(file, 260, 0.85);
    document.querySelectorAll(".avatar-preset-btn").forEach((b) => b.classList.remove("active"));
    document.getElementById("profile-upload-status").textContent = "Custom photo ready!";
    syncProfileModalPreview();
  } catch (_) {}
});

document.getElementById("profile-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const uid = getUidKey();
  const existingMeta = loadCustomProfileMeta(uid);
  const newName = document.getElementById("profile-name-input").value.trim() || "Explorer";
  const heroClass = document.getElementById("profile-class-select").value;
  const bio = document.getElementById("profile-bio-input").value.trim();
  const avatarFrame = document.getElementById("profile-frame-select").value;
  const accentTheme = document.getElementById("profile-accent-select").value;

  const meta = {
    ...existingMeta,
    heroClass,
    bio,
    avatarFrame,
    accentTheme,
    customAvatar: selectedAvatarDraft
  };
  saveCustomProfileMeta(uid, meta);

  if (userProfile) {
    userProfile.displayName = newName;
    userProfile.photoURL = selectedAvatarDraft;
    userProfile.heroClass = heroClass;
    userProfile.bio = bio;
    userProfile.avatarFrame = avatarFrame;
    userProfile.accentTheme = accentTheme;
    saveLocalDataStore();
  }

  if (!isLocalMode && fb && currentUser) {
    try {
      await fb.updateDoc(fb.doc(fb.db, "users", currentUser.uid), {
        displayName: newName,
        photoURL: selectedAvatarDraft.startsWith("http") ? selectedAvatarDraft : userProfile.photoURL,
        updatedAt: fb.serverTimestamp()
      });
    } catch (_) {}
  }

  applyThemeAndProfileUI();
  document.getElementById("profile-modal").classList.add("hidden");
  showToast("Hero Profile Customized!", "ri-shield-star-line");
});

document.querySelectorAll("[data-habit-filter]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-habit-filter]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    habitFilter = btn.dataset.habitFilter;
    renderHabits();
  });
});

document.querySelectorAll("[data-task-filter]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-task-filter]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    taskFilter = btn.dataset.taskFilter;
    renderTasks();
  });
});

const savedTheme = localStorage.getItem("mindquest_theme_mode") || "light";
document.documentElement.setAttribute("data-theme", savedTheme);
document.getElementById("theme-toggle-icon").className =
  savedTheme === "dark" ? "ri-sun-line" : "ri-moon-clear-line";

document.getElementById("theme-toggle-btn").addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("mindquest_theme_mode", next);
  document.getElementById("theme-toggle-icon").className =
    next === "dark" ? "ri-sun-line" : "ri-moon-clear-line";
});

document.getElementById("open-drawer-btn").addEventListener("click", () => {
  document.getElementById("drawer-overlay").classList.remove("hidden");
});
document.getElementById("close-drawer-btn").addEventListener("click", () => {
  document.getElementById("drawer-overlay").classList.add("hidden");
});
document.getElementById("open-profile-modal-btn").addEventListener("click", openProfileModal);
document.getElementById("others-open-profile-modal-btn").addEventListener("click", openProfileModal);
document.getElementById("header-profile-btn").addEventListener("click", openProfileModal);
document.getElementById("drawer-customize-profile-btn").addEventListener("click", () => {
  document.getElementById("drawer-overlay").classList.add("hidden");
  openProfileModal();
});

["home-quick-journal-btn", "open-journal-btn"].forEach((id) => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("click", () => openJournalModalForCreate("none"));
  }
});

document.getElementById("open-canvas-btn").addEventListener("click", () => {
  openJournalModalForCreate("draw");
  artStudio.toggleFullscreen(true);
});

document.querySelectorAll("[data-open-habit-modal]").forEach((btn) => {
  btn.addEventListener("click", () => openHabitModalForCreate());
});

document.querySelectorAll("[data-open-task-modal]").forEach((btn) => {
  btn.addEventListener("click", () => openTaskModalForCreate());
});

document.getElementById("home-add-reminder-btn").addEventListener("click", () => {
  openReminderModalForCreate();
});

document.getElementById("home-manage-reminders-btn").addEventListener("click", () => {
  switchMainTab("others");
  switchOthersSection("reminders");
});

document.querySelectorAll("[data-close-modal]").forEach((btn) => {
  btn.addEventListener("click", () => {
    artStudio.toggleFullscreen(false);
    document.getElementById(btn.dataset.closeModal).classList.add("hidden");
  });
});

// ============================================================================
// 16. IN-APP DEADLINE REMINDER CHECKER (CLEANED)
// ============================================================================
function checkUpcomingDeadlines() {
  const container = document.getElementById("reminders-container");
  if (container) {
    container.innerHTML = "";
  }
}
