// Smooth and Sharpen Tool - For smoothing or sharpening pixels
class SmoothSharpenTool {
  constructor(editor) {
    this.editor = editor;
    this.name = "smoothsharpen";
    this.intensity = 50; // Percentage intensity (0-100)
    this.size = 3; // Brush size (1-10)
    this.isDrawing = false;
    this.mode = "smooth"; // 'smooth' or 'sharpen'
    this.applyOnce = false; // Apply once per mouse down
    this.processedPixels = new Set(); // Track processed pixels for apply once
  }

  // Handle mouse down event
  onMouseDown(x, y, event) {
    if (!this.editor.currentSprite || !this.editor.layerManager) return;

    this.isDrawing = true;
    this.processedPixels.clear(); // Clear processed pixels for new stroke

    // Start batch operation for undo/redo
    this.editor.layerManager.startBatchOperation();

    this.applyEffect(x, y);
  }

  // Handle mouse drag event
  onMouseDrag(x, y, lastX, lastY, event) {
    if (!this.editor.currentSprite || !this.isDrawing) return;

    // Apply effect along the drag path
    this.applyEffectLine(lastX, lastY, x, y);
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
    // Could show effect preview here
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

  // Apply smooth/sharpen effect at position
  applyEffect(x, y) {
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
          // Check if pixel is within circular brush
          if (this.size > 1) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > this.size / 2) continue;
          }
          
          const pixelKey = `${pixelX},${pixelY}`;
          if (this.applyOnce && this.processedPixels.has(pixelKey)) {
            continue;
          }

          const processedColor = this.mode === "smooth" 
            ? this.smoothPixel(pixelX, pixelY, layerManager)
            : this.sharpenPixel(pixelX, pixelY, layerManager);
          
          if (processedColor) {
            layerManager.setPixel(pixelX, pixelY, processedColor);
            if (this.applyOnce) {
              this.processedPixels.add(pixelKey);
            }
          }
        }
      }
    }

    layerManager.setBatchMode(false);

    // Trigger canvas redraw
    this.editor.canvasManager.render();
  }

  // Apply effect along a line
  applyEffectLine(x1, y1, x2, y2) {
    // Use Bresenham's line algorithm
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;

    let x = x1;
    let y = y1;

    while (true) {
      this.applyEffect(x, y);

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

  // Smooth a pixel by averaging with neighbors
  smoothPixel(x, y, layerManager) {
    const currentColor = layerManager.getPixel(x, y);
    
    // Skip transparent pixels
    if (currentColor[3] === 0) return null;

    const neighbors = this.getNeighborPixels(x, y, layerManager);
    
    // If no neighbors, return original color
    if (neighbors.length === 0) return currentColor;

    // Calculate average color
    let totalR = currentColor[0];
    let totalG = currentColor[1];
    let totalB = currentColor[2];
    let totalA = currentColor[3];
    let count = 1;

    neighbors.forEach(neighbor => {
      if (neighbor[3] > 0) { // Only count non-transparent pixels
        totalR += neighbor[0];
        totalG += neighbor[1];
        totalB += neighbor[2];
        totalA += neighbor[3];
        count++;
      }
    });

    const avgR = Math.round(totalR / count);
    const avgG = Math.round(totalG / count);
    const avgB = Math.round(totalB / count);
    const avgA = Math.round(totalA / count);

    // Blend with original based on intensity
    const intensity = this.intensity / 100;
    const newR = Math.round(currentColor[0] * (1 - intensity) + avgR * intensity);
    const newG = Math.round(currentColor[1] * (1 - intensity) + avgG * intensity);
    const newB = Math.round(currentColor[2] * (1 - intensity) + avgB * intensity);
    const newA = Math.round(currentColor[3] * (1 - intensity) + avgA * intensity);

    return [
      Math.max(0, Math.min(255, newR)),
      Math.max(0, Math.min(255, newG)),
      Math.max(0, Math.min(255, newB)),
      Math.max(0, Math.min(255, newA))
    ];
  }

  // Sharpen a pixel using unsharp mask technique
  sharpenPixel(x, y, layerManager) {
    const currentColor = layerManager.getPixel(x, y);
    
    // Skip transparent pixels
    if (currentColor[3] === 0) return null;

    const neighbors = this.getNeighborPixels(x, y, layerManager);
    
    // If no neighbors, return original color
    if (neighbors.length === 0) return currentColor;

    // Calculate average of neighbors
    let totalR = 0, totalG = 0, totalB = 0, totalA = 0;
    let count = 0;

    neighbors.forEach(neighbor => {
      if (neighbor[3] > 0) { // Only count non-transparent pixels
        totalR += neighbor[0];
        totalG += neighbor[1];
        totalB += neighbor[2];
        totalA += neighbor[3];
        count++;
      }
    });

    if (count === 0) return currentColor;

    const avgR = totalR / count;
    const avgG = totalG / count;
    const avgB = totalB / count;
    const avgA = totalA / count;

    // Apply unsharp mask: original + (original - blurred) * amount
    const intensity = this.intensity / 100;
    const newR = currentColor[0] + (currentColor[0] - avgR) * intensity;
    const newG = currentColor[1] + (currentColor[1] - avgG) * intensity;
    const newB = currentColor[2] + (currentColor[2] - avgB) * intensity;
    const newA = currentColor[3] + (currentColor[3] - avgA) * intensity * 0.1; // Less aggressive on alpha

    return [
      Math.max(0, Math.min(255, Math.round(newR))),
      Math.max(0, Math.min(255, Math.round(newG))),
      Math.max(0, Math.min(255, Math.round(newB))),
      Math.max(0, Math.min(255, Math.round(newA)))
    ];
  }

  // Get neighboring pixels for smoothing/sharpening calculations
  getNeighborPixels(x, y, layerManager) {
    const neighbors = [];
    const width = layerManager.width;
    const height = layerManager.height;

    // 3x3 kernel around the pixel
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue; // Skip center pixel

        const nx = x + dx;
        const ny = y + dy;

        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          neighbors.push(layerManager.getPixel(nx, ny));
        }
      }
    }

    return neighbors;
  }

  // Set effect intensity
  setIntensity(intensity) {
    this.intensity = Math.max(0, Math.min(100, intensity));
  }

  // Set brush size
  setSize(size) {
    this.size = Math.max(1, Math.min(10, size));
  }

  // Set apply once mode
  setApplyOnce(applyOnce) {
    this.applyOnce = applyOnce;
  }

  // Set mode (smooth or sharpen)
  setMode(mode) {
    this.mode = mode === "sharpen" ? "sharpen" : "smooth";
  }

  // Get tool settings UI elements
  getSettingsHTML() {
    return `
      <div class="setting-group">
        <label for="smoothsharpen-intensity">Intensity:</label>
        <div class="slider-container">
          <input type="range" id="smoothsharpen-intensity" min="0" max="100" value="${this.intensity}">
          <input type="number" class="slider-value-input" data-slider="smoothsharpen-intensity" min="0" max="100" value="${this.intensity}">%
        </div>
      </div>
      <div class="setting-group">
        <label for="smoothsharpen-size">Size:</label>
        <div class="slider-container">
          <input type="range" id="smoothsharpen-size" min="1" max="10" value="${this.size}">
          <input type="number" class="slider-value-input" data-slider="smoothsharpen-size" min="1" max="10" value="${this.size}">
        </div>
      </div>
      <div class="setting-group">
        <label>
          <input type="checkbox" id="smoothsharpen-apply-once" ${this.applyOnce ? "checked" : ""}>
          Apply Once
        </label>
      </div>
      <div class="setting-group">
        <label>
          <input type="checkbox" id="smoothsharpen-sharpen-mode" ${this.mode === "sharpen" ? "checked" : ""}>
          Sharpen
        </label>
      </div>
    `;
}

  // Initialize tool settings event listeners
  initializeSettings() {
    const intensitySlider = document.getElementById("smoothsharpen-intensity");
    const sizeSlider = document.getElementById("smoothsharpen-size");
    const applyOnceCheckbox = document.getElementById("smoothsharpen-apply-once");
    const sharpenCheckbox = document.getElementById("smoothsharpen-sharpen-mode");
    
    // Get the number inputs
    const intensityInput = document.querySelector('[data-slider="smoothsharpen-intensity"]');
    const sizeInput = document.querySelector('[data-slider="smoothsharpen-size"]');

    if (intensitySlider && intensityInput) {
        // Slider to input sync
        intensitySlider.addEventListener("input", (e) => {
            const value = parseInt(e.target.value);
            this.setIntensity(value);
            intensityInput.value = this.intensity;
        });
        
        // Input to slider sync
        intensityInput.addEventListener("input", (e) => {
            const value = parseInt(e.target.value);
            if (value >= 0 && value <= 100) {
                this.setIntensity(value);
                intensitySlider.value = this.intensity;
            }
        });
        
        // Validate on blur
        intensityInput.addEventListener("blur", (e) => {
            const value = parseInt(e.target.value);
            if (isNaN(value) || value < 0 || value > 100) {
                e.target.value = this.intensity;
            }
        });
    }

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

    if (applyOnceCheckbox) {
        applyOnceCheckbox.addEventListener("change", (e) => {
            this.setApplyOnce(e.target.checked);
        });
    }

    if (sharpenCheckbox) {
        sharpenCheckbox.addEventListener("change", (e) => {
            this.setMode(e.target.checked ? "sharpen" : "smooth");
        });
    }
}

  // Get tool cursor
  getCursor() {
    return "crosshair";
  }
}