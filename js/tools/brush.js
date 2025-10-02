// Brush Tool - For painting pixels with Apply Once functionality
class BrushTool {
  constructor(editor) {
  this.editor = editor;
  this.name = "brush";
  this.size = 1;
  this.color = [0, 0, 0, 255]; // Black
  this.isDrawing = false;
  this.applyOnce = false;
  this.processedPixels = new Set();
}

  // Handle mouse down event
  onMouseDown(x, y, event) {
    if (!this.editor.layerManager) return;
    this.isDrawing = true;
    this.processedPixels.clear(); // Clear processed pixels for new stroke
    this.editor.layerManager.startBatchOperation();

    this.drawPixel(x, y);
  }

  // Handle mouse drag event
  onMouseDrag(x, y, lastX, lastY, event) {
    if (!this.editor.layerManager || !this.isDrawing) return;
    // Draw line from last position to current position
    this.drawLine(lastX, lastY, x, y);
  }

  // Handle mouse up event
  onMouseUp(x, y, event) {
    if (!this.editor.layerManager || !this.isDrawing) return;
    this.isDrawing = false;
    this.processedPixels.clear(); // Clear processed pixels
    // Save to history after brush stroke is complete
    // TODO: Implement layerManager history if needed
    this.editor.layerManager.endBatchOperation();
    this.editor.updateUI();
  }

  // Handle mouse move event (when not drawing)
  onMouseMove(x, y, event) {
    // Could show preview here in the future
  }

  // Handle mouse leave event
  onMouseLeave(event) {
    if (this.isDrawing) {
      this.isDrawing = false;
      this.processedPixels.clear(); // Clear processed pixels
      // TODO: Implement layerManager history if needed
      this.editor.layerManager.endBatchOperation();
      this.editor.updateUI();
    }
  }

  // Draw a single pixel or brush stroke at position
  drawPixel(x, y) {
    if (!this.editor.layerManager) return;
    const layerManager = this.editor.layerManager;
    const halfSize = Math.floor(this.size / 2);

    // Use color's alpha directly (no opacity multiplication)
    const color = [...this.color];

    for (let dy = -halfSize; dy <= halfSize; dy++) {
      for (let dx = -halfSize; dx <= halfSize; dx++) {
        const pixelX = x + dx;
        const pixelY = y + dy;

        if (
          pixelX >= 0 &&
          pixelX < layerManager.width &&
          pixelY >= 0 &&
          pixelY < layerManager.height
        ) {
          if (this.size > 1) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > this.size / 2) continue;
          }

          const pixelKey = `${pixelX},${pixelY}`;
          if (this.applyOnce && this.processedPixels.has(pixelKey)) {
            continue;
          }

          // Blend with existing pixel if alpha < 255
          if (color[3] < 255) {
            const existingPixel = layerManager.getPixel(pixelX, pixelY);
            const blendedColor = this.blendColors(existingPixel, color);
            layerManager.setPixel(pixelX, pixelY, blendedColor);
          } else {
            layerManager.setPixel(pixelX, pixelY, color);
          }

          if (this.applyOnce) {
            this.processedPixels.add(pixelKey);
          }
        }
      }
    }
    this.editor.canvasManager.render();
  }

  // Draw a line between two points
  drawLine(x1, y1, x2, y2) {
    // Use Bresenham's line algorithm for smooth drawing
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;

    let x = x1;
    let y = y1;

    while (true) {
      this.drawPixel(x, y);

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

  // Blend two colors with alpha blending
  blendColors(background, foreground) {
    const [br, bg, bb, ba] = background;
    const [fr, fg, fb, fa] = foreground;

    // Convert alpha values to 0-1 range
    const bgAlpha = ba / 255;
    const fgAlpha = fa / 255;

    // Calculate blended alpha
    const blendedAlpha = fgAlpha + bgAlpha * (1 - fgAlpha);

    if (blendedAlpha === 0) {
      return [0, 0, 0, 0];
    }

    // Calculate blended RGB
    const blendedR = Math.round(
      (fr * fgAlpha + br * bgAlpha * (1 - fgAlpha)) / blendedAlpha
    );
    const blendedG = Math.round(
      (fg * fgAlpha + bg * bgAlpha * (1 - fgAlpha)) / blendedAlpha
    );
    const blendedB = Math.round(
      (fb * fgAlpha + bb * bgAlpha * (1 - fgAlpha)) / blendedAlpha
    );

    return [blendedR, blendedG, blendedB, Math.round(blendedAlpha * 255)];
  }

  // Set brush size
  setSize(size) {
    this.size = Math.max(1, Math.min(10, size));
  }

  // Set apply once mode
  setApplyOnce(applyOnce) {
    this.applyOnce = applyOnce;
  }

  // Set brush color
  setColor(color) {
    if (Array.isArray(color) && color.length >= 3) {
      this.color = [
        Math.max(0, Math.min(255, color[0])),
        Math.max(0, Math.min(255, color[1])),
        Math.max(0, Math.min(255, color[2])),
        color[3] !== undefined ? Math.max(0, Math.min(255, color[3])) : 255,
      ];
    }
  }

  // Set brush color from hex string
  setColorFromHex(hex) {
    const color = this.hexToRgba(hex);
    if (color) {
      this.setColor(color);
    }
  }

  // Convert hex color to RGBA array
  hexToRgba(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [
          parseInt(result[1], 16),
          parseInt(result[2], 16),
          parseInt(result[3], 16),
          255,
        ]
      : null;
  }

  // Get tool settings UI elements
  getSettingsHTML() {
    return `
    <div class="setting-group">
      <label for="brush-size">Size:</label>
      <div class="slider-container">
        <input type="range" id="brush-size" min="1" max="10" value="${
          this.size
        }">
        <input type="number" class="slider-value-input" data-slider="brush-size" min="1" max="10" value="${
          this.size
        }">
      </div>
    </div>
    <div class="setting-group">
      <label>
        <input type="checkbox" id="brush-apply-once" ${
          this.applyOnce ? "checked" : ""
        }>
        Apply Once
      </label>
    </div>
  `;
  }

  // Initialize tool settings event listeners
  initializeSettings() {
  const sizeSlider = document.getElementById("brush-size");
  const applyOnceCheckbox = document.getElementById("brush-apply-once");
  const sizeInput = document.querySelector('[data-slider="brush-size"]');

  if (sizeSlider && sizeInput) {
    sizeSlider.addEventListener("input", (e) => {
      const value = parseInt(e.target.value);
      this.setSize(value);
      sizeInput.value = this.size;
    });
    
    sizeInput.addEventListener("input", (e) => {
      const value = parseInt(e.target.value);
      if (value >= 1 && value <= 10) {
        this.setSize(value);
        sizeSlider.value = this.size;
      }
    });
    
    sizeInput.addEventListener("blur", (e) => {
      const value = parseInt(e.target.value);
      if (isNaN(value) || value < 1 || value > 10) {
        e.target.value = this.size;
      }
    });
  }

  if (applyOnceCheckbox) {
    applyOnceCheckbox.addEventListener("change", (e) => {
      this.setApplyOnce(e.target.checked);
    });
  }
}

  // Get tool cursor
  getCursor() {
    return "crosshair";
  }
}
