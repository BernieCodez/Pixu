// Brightness Tool - For adjusting brightness of pixels
class BrightnessTool {
  constructor(editor) {
    this.editor = editor;
    this.name = "brightness";
    this.intensity = 10; // Percentage change
    this.size = 1;
    this.isDrawing = false;
    this.mode = "rgb"; // 'rgb' or 'hsl'
    this.applyOnce = false; // New: apply once per mouse down
    this.randomMode = false; // New: random intensity mode
    this.processedPixels = new Set(); // New: track processed pixels for apply once
  }

  // Handle mouse down event
  onMouseDown(x, y, event) {
    if (!this.editor.currentSprite || !this.editor.layerManager) return;

    this.isDrawing = true;
    this.processedPixels.clear(); // Clear processed pixels for new stroke

    // Start batch operation for undo/redo
    this.editor.layerManager.startBatchOperation();

    this.adjustBrightness(x, y);
  }

  // Handle mouse drag event
  onMouseDrag(x, y, lastX, lastY, event) {
    if (!this.editor.currentSprite || !this.isDrawing) return;

    // Adjust brightness along the drag path
    this.adjustBrightnessLine(lastX, lastY, x, y);
  }

  // Handle mouse up event
  onMouseUp(x, y, event) {
    if (!this.editor.currentSprite || !this.isDrawing) return;

    this.isDrawing = false;
    this.processedPixels.clear(); // Clear processed pixels

    // End batch operation - this will save to history
    this.editor.layerManager.endBatchOperation();

    // Update UI without saving to history again
    this.editor.updateUI();
  }

  // Handle mouse move event
  onMouseMove(x, y, event) {
    // Could show brightness preview here
  }

  // Handle mouse leave event
  onMouseLeave(event) {
    if (this.isDrawing) {
      this.isDrawing = false;
      this.processedPixels.clear(); // Clear processed pixels

      // End batch operation - this will save to history
      this.editor.layerManager.endBatchOperation();

      this.editor.updateUI();
    }
  }

  // Adjust brightness of pixels at position
  adjustBrightness(x, y) {
    // Layer support: use LayerManager for pixel operations
    const layerManager = this.editor.layerManager;
    if (!layerManager) return;
    const activeLayer = layerManager.getActiveLayer();
    if (!activeLayer || activeLayer.locked) return;

    const width = layerManager.width;
    const height = layerManager.height;
    const halfSize = Math.floor(this.size / 2);

    // Use batch mode for multiple pixel operations within single adjustment
    layerManager.setBatchMode(true);

    for (let dy = -halfSize; dy <= halfSize; dy++) {
      for (let dx = -halfSize; dx <= halfSize; dx++) {
        const pixelX = x + dx;
        const pixelY = y + dy;
        if (pixelX >= 0 && pixelX < width && pixelY >= 0 && pixelY < height) {
          if (this.size > 1) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > this.size / 2) continue;
          }
          const pixelKey = `${pixelX},${pixelY}`;
          if (this.applyOnce && this.processedPixels.has(pixelKey)) {
            continue;
          }

          const currentColor = layerManager.getPixel(pixelX, pixelY);
          let intensityToUse = this.intensity;
          if (this.randomMode) {
            const maxIntensity = Math.abs(this.intensity);
            intensityToUse = (Math.random() * 2 - 1) * maxIntensity;
          }
          const adjustedColor =
            this.mode === "hsl"
              ? this.adjustPixelBrightnessHSL(currentColor, intensityToUse)
              : this.adjustPixelBrightness(currentColor, intensityToUse);
          layerManager.setPixel(pixelX, pixelY, adjustedColor);
          if (this.applyOnce) {
            this.processedPixels.add(pixelKey);
          }
        }
      }
    }

    layerManager.setBatchMode(false);

    // Trigger canvas redraw
    this.editor.canvasManager.render();
  }

  // Adjust brightness along a line
  adjustBrightnessLine(x1, y1, x2, y2) {
    // Use Bresenham's line algorithm
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;

    let x = x1;
    let y = y1;

    while (true) {
      this.adjustBrightness(x, y);

      if (x === x2 && y === y2) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }

  // Adjust brightness of a single pixel
  adjustPixelBrightness(color, intensityPercent) {
    const [r, g, b, a] = color;

    // Skip transparent pixels
    if (a === 0) return color;

    // Convert intensity percentage to multiplier
    const multiplier = 1 + intensityPercent / 100;

    // Apply brightness adjustment
    let newR, newG, newB;

    if (intensityPercent > 0) {
      // Brightening: interpolate towards white
      newR = Math.round(r + (255 - r) * (intensityPercent / 100));
      newG = Math.round(g + (255 - g) * (intensityPercent / 100));
      newB = Math.round(b + (255 - b) * (intensityPercent / 100));
    } else {
      // Darkening: interpolate towards black
      const darkening = Math.abs(intensityPercent) / 100;
      newR = Math.round(r * (1 - darkening));
      newG = Math.round(g * (1 - darkening));
      newB = Math.round(b * (1 - darkening));
    }

    // Clamp values to valid range
    newR = Math.max(0, Math.min(255, newR));
    newG = Math.max(0, Math.min(255, newG));
    newB = Math.max(0, Math.min(255, newB));

    return [newR, newG, newB, a];
  }

  // Adjust brightness using HSL color space (alternative method)
  adjustPixelBrightnessHSL(color, intensityPercent) {
    const [r, g, b, a] = color;

    // Skip transparent pixels
    if (a === 0) return color;

    // Convert RGB to HSL
    const hsl = this.rgbToHsl(r, g, b);

    // Adjust lightness
    hsl[2] = Math.max(0, Math.min(1, hsl[2] + intensityPercent / 100));

    // Convert back to RGB
    const [newR, newG, newB] = this.hslToRgb(hsl[0], hsl[1], hsl[2]);

    return [Math.round(newR), Math.round(newG), Math.round(newB), a];
  }

  // Convert RGB to HSL
  rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h,
      s,
      l = (max + min) / 2;

    if (max === min) {
      h = s = 0; // Achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }

    return [h, s, l];
  }

  // Convert HSL to RGB
  hslToRgb(h, s, l) {
    let r, g, b;

    if (s === 0) {
      r = g = b = l; // Achromatic
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;

      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return [r * 255, g * 255, b * 255];
  }

  // Set brightness intensity
  setIntensity(intensity) {
    this.intensity = Math.max(-50, Math.min(50, intensity));
  }

  // Set brush size
  setSize(size) {
    this.size = Math.max(1, Math.min(10, size));
  }

  // Set apply once mode
  setApplyOnce(applyOnce) {
    this.applyOnce = applyOnce;
  }

  // Set random mode
  setRandomMode(randomMode) {
    this.randomMode = randomMode;
  }

  // Get tool settings UI elements
  getSettingsHTML() {
    return `
            <div class="setting-group">
                <label for="brightness-intensity">Intensity:</label>
                <div class="slider-container">
                    <input type="range" id="brightness-intensity" min="-50" max="50" value="${
                      this.intensity
                    }">
                    <span class="slider-value">${
                      this.intensity > 0 ? "+" : ""
                    }${this.intensity}%</span>
                </div>
            </div>
            <div class="setting-group">
                <label for="brightness-size">Brush Size:</label>
                <div class="slider-container">
                    <input type="range" id="brightness-size" min="1" max="10" value="${
                      this.size
                    }">
                    <span class="slider-value">${this.size}</span>
                </div>
            </div>
            <div class="setting-group">
                <label>Mode:</label>
                <div class="button-group">
                    <button class="btn btn-secondary btn-sm active" id="brightness-mode-rgb" data-mode="rgb">RGB</button>
                    <button class="btn btn-secondary btn-sm" id="brightness-mode-hsl" data-mode="hsl">HSL</button>
                </div>
            </div>
            <div class="setting-group">
                <label>
                    <input type="checkbox" id="brightness-apply-once" ${
                      this.applyOnce ? "checked" : ""
                    }>
                    Apply Once (per stroke)
                </label>
            </div>
            <div class="setting-group">
                <label>
                    <input type="checkbox" id="brightness-random" ${
                      this.randomMode ? "checked" : ""
                    }>
                    Random Intensity
                </label>
            </div>
        `;
  }

  // Initialize tool settings event listeners
  initializeSettings() {
    const intensitySlider = document.getElementById("brightness-intensity");
    const sizeSlider = document.getElementById("brightness-size");
    const intensityValue = intensitySlider.nextElementSibling;
    const sizeValue = sizeSlider.nextElementSibling;
    const applyOnceCheckbox = document.getElementById("brightness-apply-once");
    const randomCheckbox = document.getElementById("brightness-random");

    intensitySlider.addEventListener("input", (e) => {
      this.setIntensity(parseInt(e.target.value));
      intensityValue.textContent = `${this.intensity > 0 ? "+" : ""}${
        this.intensity
      }%`;
    });

    sizeSlider.addEventListener("input", (e) => {
      this.setSize(parseInt(e.target.value));
      sizeValue.textContent = this.size;
    });

    // Apply once checkbox
    if (applyOnceCheckbox) {
      applyOnceCheckbox.addEventListener("change", (e) => {
        this.setApplyOnce(e.target.checked);
      });
    }

    // Random mode checkbox
    if (randomCheckbox) {
      randomCheckbox.addEventListener("change", (e) => {
        this.setRandomMode(e.target.checked);
      });
    }

    // Mode buttons
    const rgbModeBtn = document.getElementById("brightness-mode-rgb");
    const hslModeBtn = document.getElementById("brightness-mode-hsl");

    if (rgbModeBtn && hslModeBtn) {
      rgbModeBtn.addEventListener("click", () => {
        this.mode = "rgb";
        rgbModeBtn.classList.add("active");
        hslModeBtn.classList.remove("active");
      });

      hslModeBtn.addEventListener("click", () => {
        this.mode = "hsl";
        hslModeBtn.classList.add("active");
        rgbModeBtn.classList.remove("active");
      });
    }
  }

  // Get tool cursor
  getCursor() {
    return "crosshair";
  }
}
