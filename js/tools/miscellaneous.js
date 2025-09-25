// Miscellaneous Tool - Collection of small utility features
class MiscellaneousTool {
  constructor(editor) {
    this.editor = editor;
    this.name = "miscellaneous";
    this.currentMode = "dither"; // Default mode
    this.ditherSize = 1;
    this.ditherOpacity = 50;
    this.mirrorAxis = "horizontal"; // horizontal, vertical, both
    this.isDrawing = false;
    this.color = [0, 0, 0, 255];
    this.processedPixels = new Set();
  }

  // Handle mouse down event
  onMouseDown(x, y, event) {
    if (!this.editor.layerManager) return;
    
    if (this.currentMode === "dither" || this.currentMode === "mirror") {
      this.isDrawing = true;
      this.processedPixels.clear();
      this.editor.layerManager.startBatchOperation();
      this.applyCurrentMode(x, y);
    } else if (this.currentMode === "center") {
      this.centerCanvasView();
    }
  }

  // Handle mouse drag event
  onMouseDrag(x, y, lastX, lastY, event) {
    if (!this.editor.layerManager || !this.isDrawing) return;
    
    if (this.currentMode === "dither" || this.currentMode === "mirror") {
      this.drawLine(lastX, lastY, x, y);
    }
  }

  // Handle mouse up event
  onMouseUp(x, y, event) {
    if (!this.editor.layerManager || !this.isDrawing) return;
    
    this.isDrawing = false;
    this.processedPixels.clear();
    this.editor.layerManager.endBatchOperation();
    this.editor.updateUI();
  }

  // Handle mouse move event
  onMouseMove(x, y, event) {
    // Could show preview here in the future
  }

  // Handle mouse leave event
  onMouseLeave(event) {
    if (this.isDrawing) {
      this.isDrawing = false;
      this.processedPixels.clear();
      this.editor.layerManager.endBatchOperation();
      this.editor.updateUI();
    }
  }

  // Apply current mode at position
  applyCurrentMode(x, y) {
    switch (this.currentMode) {
      case "dither":
        this.applyDither(x, y);
        break;
      case "mirror":
        this.applyMirrorDraw(x, y);
        break;
      case "center":
        this.centerCanvasView();
        break;
    }
  }

  // Apply dithering effect
  applyDither(x, y) {
    if (!this.editor.layerManager) return;
    
    const layerManager = this.editor.layerManager;
    const halfSize = Math.floor(this.ditherSize / 2);
    
    // Create dither pattern
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
          // Create checkerboard dither pattern
          const shouldDither = (pixelX + pixelY) % 2 === 0;
          
          if (shouldDither) {
            const existingPixel = layerManager.getPixel(pixelX, pixelY);
            const ditherColor = [...this.color];
            ditherColor[3] = Math.round((ditherColor[3] * this.ditherOpacity) / 100);
            
            const blendedColor = this.blendColors(existingPixel, ditherColor);
            layerManager.setPixel(pixelX, pixelY, blendedColor);
          }
        }
      }
    }
    
    this.editor.canvasManager.render();
  }

  // Apply mirror drawing
  applyMirrorDraw(x, y) {
    if (!this.editor.layerManager) return;
    
    const layerManager = this.editor.layerManager;
    const positions = this.getMirrorPositions(x, y);
    
    positions.forEach(pos => {
      if (
        pos.x >= 0 &&
        pos.x < layerManager.width &&
        pos.y >= 0 &&
        pos.y < layerManager.height
      ) {
        const pixelKey = `${pos.x},${pos.y}`;
        if (!this.processedPixels.has(pixelKey)) {
          layerManager.setPixel(pos.x, pos.y, this.color);
          this.processedPixels.add(pixelKey);
        }
      }
    });
    
    this.editor.canvasManager.render();
  }

  // Get mirror positions based on current axis
  getMirrorPositions(x, y) {
    const layerManager = this.editor.layerManager;
    const centerX = Math.floor(layerManager.width / 2);
    const centerY = Math.floor(layerManager.height / 2);
    const positions = [{ x, y }]; // Original position
    
    switch (this.mirrorAxis) {
      case "horizontal":
        positions.push({ x: layerManager.width - 1 - x, y });
        break;
      case "vertical":
        positions.push({ x, y: layerManager.height - 1 - y });
        break;
      case "both":
        positions.push(
          { x: layerManager.width - 1 - x, y },
          { x, y: layerManager.height - 1 - y },
          { x: layerManager.width - 1 - x, y: layerManager.height - 1 - y }
        );
        break;
      case "diagonal":
        positions.push({ x: y, y: x }); // Swap x and y for diagonal mirror
        break;
    }
    
    return positions;
  }

  // Center the canvas view
  centerCanvasView() {
    if (this.editor.canvasManager && this.editor.canvasManager.centerView) {
      this.editor.canvasManager.centerView();
      if (this.editor.uiController) {
        this.editor.uiController.showNotification('Canvas centered', 'success');
      }
    }
  }

  // Draw a line between two points
  drawLine(x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;

    let x = x1;
    let y = y1;

    while (true) {
      this.applyCurrentMode(x, y);

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

    const bgAlpha = ba / 255;
    const fgAlpha = fa / 255;

    const blendedAlpha = fgAlpha + bgAlpha * (1 - fgAlpha);

    if (blendedAlpha === 0) {
      return [0, 0, 0, 0];
    }

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

  // Set current mode
  setMode(mode) {
    if (["dither", "mirror", "center"].includes(mode)) {
      this.currentMode = mode;
    }
  }

  // Set dither size
  setDitherSize(size) {
    this.ditherSize = Math.max(1, Math.min(10, size));
  }

  // Set dither opacity
  setDitherOpacity(opacity) {
    this.ditherOpacity = Math.max(0, Math.min(100, opacity));
  }

  // Set mirror axis
  setMirrorAxis(axis) {
    if (["horizontal", "vertical", "both", "diagonal"].includes(axis)) {
      this.mirrorAxis = axis;
    }
  }

  // Set color
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

  // Set color from hex
  setColorFromHex(hex) {
    const color = this.hexToRgba(hex);
    if (color) {
      this.setColor(color);
    }
  }

  // Convert hex to RGBA
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

  // Get tool settings HTML
  getSettingsHTML() {
    return `
      <div class="setting-group">
        <label for="misc-mode">Mode:</label>
        <select id="misc-mode" class="misc-select toolbar-dropdown">
          <option value="dither" ${this.currentMode === "dither" ? "selected" : ""}>Dithering</option>
          <option value="mirror" ${this.currentMode === "mirror" ? "selected" : ""}>Mirror Draw</option>
          <option value="center" ${this.currentMode === "center" ? "selected" : ""}>Center Canvas</option>
        </select>
      </div>
      
      <div class="setting-group dither-settings" ${this.currentMode !== "dither" ? 'style="display: none;"' : ""}>
        <label for="dither-size">Size:</label>
        <div class="slider-container">
          <input type="range" id="dither-size" min="1" max="10" value="${this.ditherSize}">
          <input type="number" class="slider-value-input" data-slider="dither-size" min="1" max="10" value="${this.ditherSize}">
        </div>
      </div>
      
      <div class="setting-group dither-settings" ${this.currentMode !== "dither" ? 'style="display: none;"' : ""}>
        <label for="dither-opacity">Opacity:</label>
        <div class="slider-container">
          <input type="range" id="dither-opacity" min="0" max="100" value="${this.ditherOpacity}">
          <input type="number" class="slider-value-input" data-slider="dither-opacity" min="0" max="100" value="${this.ditherOpacity}">%
        </div>
      </div>
      
      <div class="setting-group mirror-settings" ${this.currentMode !== "mirror" ? 'style="display: none;"' : ""}>
        <label for="mirror-axis">Mirror Axis:</label>
        <select id="mirror-axis" class="misc-select toolbar-dropdown">
          <option value="horizontal" ${this.mirrorAxis === "horizontal" ? "selected" : ""}>Horizontal</option>
          <option value="vertical" ${this.mirrorAxis === "vertical" ? "selected" : ""}>Vertical</option>
          <option value="both" ${this.mirrorAxis === "both" ? "selected" : ""}>Both</option>
          <option value="diagonal" ${this.mirrorAxis === "diagonal" ? "selected" : ""}>Diagonal</option>
        </select>
      </div>
      
      <div class="setting-group center-settings" ${this.currentMode !== "center" ? 'style="display: none;"' : ""}>
        <p class="help-text">Click on canvas to center the view</p>
        <button id="center-canvas-btn" class="btn btn-sm btn-secondary" style="width: 100%;">
          <i class="fas fa-crosshairs"></i> Center Canvas
        </button>
      </div>
    `;
  }

  // Initialize tool settings event listeners
  initializeSettings() {
    const modeSelect = document.getElementById("misc-mode");
    const ditherSizeSlider = document.getElementById("dither-size");
    const ditherOpacitySlider = document.getElementById("dither-opacity");
    const mirrorAxisSelect = document.getElementById("mirror-axis");
    const centerCanvasBtn = document.getElementById("center-canvas-btn");
    
    // Get number inputs
    const ditherSizeInput = document.querySelector('[data-slider="dither-size"]');
    const ditherOpacityInput = document.querySelector('[data-slider="dither-opacity"]');

    // Mode selection
    if (modeSelect) {
      modeSelect.addEventListener("change", (e) => {
        this.setMode(e.target.value);
        this.updateSettingsVisibility();
      });
    }

    // Dither size controls
    if (ditherSizeSlider && ditherSizeInput) {
      ditherSizeSlider.addEventListener("input", (e) => {
        const value = parseInt(e.target.value);
        this.setDitherSize(value);
        ditherSizeInput.value = this.ditherSize;
      });
      
      ditherSizeInput.addEventListener("input", (e) => {
        const value = parseInt(e.target.value);
        if (value >= 1 && value <= 10) {
          this.setDitherSize(value);
          ditherSizeSlider.value = this.ditherSize;
        }
      });
    }

    // Dither opacity controls
    if (ditherOpacitySlider && ditherOpacityInput) {
      ditherOpacitySlider.addEventListener("input", (e) => {
        const value = parseInt(e.target.value);
        this.setDitherOpacity(value);
        ditherOpacityInput.value = this.ditherOpacity;
      });
      
      ditherOpacityInput.addEventListener("input", (e) => {
        const value = parseInt(e.target.value);
        if (value >= 0 && value <= 100) {
          this.setDitherOpacity(value);
          ditherOpacitySlider.value = this.ditherOpacity;
        }
      });
    }

    // Mirror axis selection
    if (mirrorAxisSelect) {
      mirrorAxisSelect.addEventListener("change", (e) => {
        this.setMirrorAxis(e.target.value);
      });
    }

    // Center canvas button
    if (centerCanvasBtn) {
      centerCanvasBtn.addEventListener("click", () => {
        this.centerCanvasView();
      });
    }
  }

  // Update settings visibility based on current mode
  updateSettingsVisibility() {
    const ditherSettings = document.querySelectorAll(".dither-settings");
    const mirrorSettings = document.querySelectorAll(".mirror-settings");
    const centerSettings = document.querySelectorAll(".center-settings");

    ditherSettings.forEach(el => {
      el.style.display = this.currentMode === "dither" ? "" : "none";
    });
    
    mirrorSettings.forEach(el => {
      el.style.display = this.currentMode === "mirror" ? "" : "none";
    });
    
    centerSettings.forEach(el => {
      el.style.display = this.currentMode === "center" ? "" : "none";
    });
  }

  // Get tool cursor
  getCursor() {
    switch (this.currentMode) {
      case "dither":
        return "crosshair";
      case "mirror":
        return "crosshair";
      case "center":
        return "grab";
      default:
        return "default";
    }
  }
}