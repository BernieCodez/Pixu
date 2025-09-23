// Eraser Tool - For erasing pixels (making them transparent) with opacity support
class EraserTool {
  constructor(editor) {
    this.editor = editor;
    this.name = "eraser";
    this.size = 1;
    this.opacity = 100; // Added opacity property
    this.isDrawing = false;
    this.applyOnce = false; // Apply once per mouse down
    this.processedPixels = new Set(); // Track processed pixels for apply once
  }

  // Handle mouse down event
  onMouseDown(x, y, event) {
    if (!this.editor.layerManager) return;
    this.isDrawing = true;
    this.processedPixels.clear(); // Clear processed pixels for new stroke
    this.editor.layerManager.startBatchOperation();
    this.erasePixel(x, y);
  }

  // Handle mouse drag event
  onMouseDrag(x, y, lastX, lastY, event) {
    if (!this.editor.layerManager || !this.isDrawing) return;
    // Erase line from last position to current position
    this.eraseLine(lastX, lastY, x, y);
  }

  // Handle mouse up event
  onMouseUp(x, y, event) {
    if (!this.editor.layerManager || !this.isDrawing) return;
    this.isDrawing = false;
    this.processedPixels.clear(); // Clear processed pixels
    // TODO: Implement layerManager history if needed
    this.editor.layerManager.endBatchOperation();
    this.editor.updateUI();
  }

  // Handle mouse move event (when not drawing)
  onMouseMove(x, y, event) {
    // Could show eraser preview here in the future
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

  // Erase pixels at position with opacity support
  erasePixel(x, y) {
    if (!this.editor.layerManager) return;
    const layerManager = this.editor.layerManager;
    const halfSize = Math.floor(this.size / 2);
    
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
          // For round erasers, check distance
          if (this.size > 1) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > this.size / 2) continue;
          }
          
          // Check if pixel should be processed (apply once mode)
          const pixelKey = `${pixelX},${pixelY}`;
          if (this.applyOnce && this.processedPixels.has(pixelKey)) {
            continue;
          }
          
          // Handle opacity-based erasing
          if (this.opacity < 100) {
            // Get existing pixel
            const existingPixel = layerManager.getPixel(pixelX, pixelY);
            // Calculate new alpha based on eraser opacity
            const eraseStrength = this.opacity / 100;
            const newAlpha = Math.round(existingPixel[3] * (1 - eraseStrength));
            const partiallyErasedColor = [
              existingPixel[0],
              existingPixel[1], 
              existingPixel[2],
              newAlpha
            ];
            layerManager.setPixel(pixelX, pixelY, partiallyErasedColor);
          } else {
            // Full erase - make completely transparent
            const transparentColor = [0, 0, 0, 0];
            layerManager.setPixel(pixelX, pixelY, transparentColor);
          }
          
          // Mark pixel as processed for apply once mode
          if (this.applyOnce) {
            this.processedPixels.add(pixelKey);
          }
        }
      }
    }
    this.editor.canvasManager.render();
  }

  // Erase a line between two points
  eraseLine(x1, y1, x2, y2) {
    // Use Bresenham's line algorithm for smooth erasing
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;

    let x = x1;
    let y = y1;

    while (true) {
      this.erasePixel(x, y);

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

  // Set eraser size
  setSize(size) {
    this.size = Math.max(1, Math.min(10, size));
  }

  // Set eraser opacity
  setOpacity(opacity) {
    this.opacity = Math.max(0, Math.min(100, opacity));
  }

  // Set apply once mode
  setApplyOnce(applyOnce) {
    this.applyOnce = applyOnce;
  }

  // Get tool settings UI elements
  getSettingsHTML() {
  return `
          <div class="setting-group">
              <label for="eraser-size">Size:</label>
              <div class="slider-container">
                  <input type="range" id="eraser-size" min="1" max="10" value="${this.size}">
                  <input type="number" class="slider-value-input" data-slider="eraser-size" min="1" max="10" value="${this.size}">
              </div>
          </div>
          <div class="setting-group">
              <label for="eraser-opacity">Opacity:</label>
              <div class="slider-container">
                  <input type="range" id="eraser-opacity" min="0" max="100" value="${this.opacity}">
                  <input type="number" class="slider-value-input" data-slider="eraser-opacity" min="0" max="100" value="${this.opacity}">%
              </div>
          </div>
          <div class="setting-group">
              <label>
                  <input type="checkbox" id="eraser-apply-once" ${this.applyOnce ? "checked" : ""}>
                  Apply Once
              </label>
          </div>
      `;
}

  // Initialize tool settings event listeners
  initializeSettings() {
  const sizeSlider = document.getElementById("eraser-size");
  const opacitySlider = document.getElementById("eraser-opacity");
  const applyOnceCheckbox = document.getElementById("eraser-apply-once");
  
  // Get the number inputs
  const sizeInput = document.querySelector('[data-slider="eraser-size"]');
  const opacityInput = document.querySelector('[data-slider="eraser-opacity"]');
  
  if (sizeSlider && sizeInput) {
    // Slider to input sync
    sizeSlider.addEventListener("input", (e) => {
      const value = parseInt(e.target.value);
      this.setSize(value);
      sizeInput.value = this.size;
    });
    
    // Input to slider sync
    sizeInput.addEventListener("input", (e) => {
      const value = parseInt(e.target.value);
      if (value >= 1 && value <= 10) {
        this.setSize(value);
        sizeSlider.value = this.size;
      }
    });
    
    // Validate on blur
    sizeInput.addEventListener("blur", (e) => {
      const value = parseInt(e.target.value);
      if (isNaN(value) || value < 1 || value > 10) {
        e.target.value = this.size;
      }
    });
  }

  if (opacitySlider && opacityInput) {
    // Slider to input sync
    opacitySlider.addEventListener("input", (e) => {
      const value = parseInt(e.target.value);
      this.setOpacity(value);
      opacityInput.value = this.opacity;
    });
    
    // Input to slider sync
    opacityInput.addEventListener("input", (e) => {
      const value = parseInt(e.target.value);
      if (value >= 0 && value <= 100) {
        this.setOpacity(value);
        opacitySlider.value = this.opacity;
      }
    });
    
    // Validate on blur
    opacityInput.addEventListener("blur", (e) => {
      const value = parseInt(e.target.value);
      if (isNaN(value) || value < 0 || value > 100) {
        e.target.value = this.opacity;
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