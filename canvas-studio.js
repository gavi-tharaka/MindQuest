// ============================================================================
// MINDQUEST ART & COLORING STUDIO (Fullscreen Canvas + Flood Fill + Upload)
// ============================================================================

export class ArtStudio {
  constructor(options = {}) {
    this.canvas = document.getElementById(options.canvasId || "drawing-canvas");
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.container = document.getElementById(options.containerId || "canvas-studio-wrapper");

    // State
    this.tool = "pen"; // 'pen' | 'marker' | 'airbrush' | 'bucket' | 'eraser' | 'line' | 'rect' | 'circle'
    this.color = "#4f46e5";
    this.brushSize = 5;
    this.opacity = 1;
    this.bgColor = "#ffffff";
    this.isDrawing = false;
    this.hasContent = false;
    this.isFullscreen = false;

    // Undo / Redo History
    this.history = [];
    this.redoStack = [];
    this.maxHistory = 25;

    // Shape preview snapshot
    this.startX = 0;
    this.startY = 0;
    this.snapshotBeforeShape = null;

    this.init();
  }

  init() {
    this.resetCanvas(false);
    this.bindEvents();
    this.bindToolbarUI();
  }

  resetCanvas(saveUndo = true) {
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
    try {
      const imgData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      this.history.push(imgData);
      if (this.history.length > this.maxHistory) {
        this.history.shift();
      }
      this.updateHistoryButtons();
    } catch (e) {
      console.warn("Could not push canvas history:", e);
    }
  }

  undo() {
    if (this.history.length <= 1) return;
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
    if (this.redoStack.length === 0) return;
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
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  bindEvents() {
    this.canvas.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.canvas.setPointerCapture(e.pointerId);
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
        // Draw a single dot on click
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
      // Highlighter / Coloring Marker
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

  // Fast Flood Fill (Paint Bucket) for coloring shapes
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
      return; // Same color
    }

    const tolerance = 38;
    const visited = new Uint8Array(width * height);
    const stack = [startX, startY];

    const matchesStart = (pos) => {
      return (
        Math.abs(data[pos] - startR) <= tolerance &&
        Math.abs(data[pos + 1] - startG) <= tolerance &&
        Math.abs(data[pos + 2] - startB) <= tolerance &&
        Math.abs(data[pos + 3] - startA) <= tolerance
      );
    };

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

  // Draw an external image onto the canvas so user can also color/annotate it
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
    // Tool buttons
    document.querySelectorAll("[data-canvas-tool]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-canvas-tool]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.tool = btn.dataset.canvasTool;
      });
    });

    // Color swatches
    document.querySelectorAll(".color-swatch").forEach((swatch) => {
      swatch.addEventListener("click", () => {
        document.querySelectorAll(".color-swatch").forEach((s) => s.classList.remove("active"));
        swatch.classList.add("active");
        this.color = swatch.dataset.color;
        const customPicker = document.getElementById("custom-color-picker");
        if (customPicker) customPicker.value = this.color;
        if (this.tool === "eraser") {
          this.setTool("pen");
        }
      });
    });

    // Custom color picker
    const customPicker = document.getElementById("custom-color-picker");
    if (customPicker) {
      customPicker.addEventListener("input", (e) => {
        this.color = e.target.value;
        document.querySelectorAll(".color-swatch").forEach((s) => s.classList.remove("active"));
        if (this.tool === "eraser") {
          this.setTool("pen");
        }
      });
    }

    // Brush size
    const brushSizeInput = document.getElementById("brush-size");
    const brushSizeLabel = document.getElementById("brush-size-label");
    if (brushSizeInput) {
      brushSizeInput.addEventListener("input", (e) => {
        this.brushSize = Number(e.target.value);
        if (brushSizeLabel) brushSizeLabel.textContent = `${this.brushSize}px`;
      });
    }

    // Paper background selector
    document.querySelectorAll("[data-paper-bg]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-paper-bg]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const oldBg = this.bgColor;
        this.bgColor = btn.dataset.paperBg;
        // Flood fill background or tint canvas background
        this.floodFill(2, 2, this.bgColor);
        this.pushHistory();
      });
    });

    // Undo / Redo / Clear / Download / Fullscreen
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
    if (fsBtn) {
      fsBtn.addEventListener("click", () => this.toggleFullscreen());
    }

    const fsCloseBtn = document.getElementById("close-fullscreen-studio-btn");
    if (fsCloseBtn) {
      fsCloseBtn.addEventListener("click", () => this.toggleFullscreen(false));
    }
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
