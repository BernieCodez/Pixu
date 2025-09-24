// Shape Tool - For drawing lines, rectangles, and circles
class ShapeTool {
  constructor(editor) {
    this.editor = editor;
    this.name = "shape";
    this.size = 1;
    this.opacity = 100;
    this.color = [0, 0, 0, 255];
    this.shapeType = "line";
    this.filled = false;
    this.isDrawing = false;
    this.startX = 0;
    this.startY = 0;
  }

  // Handle mouse down event
  onMouseDown(x, y, event) {
    if (!this.editor.layerManager) return;
    this.isDrawing = true;
    this.startX = x;
    this.startY = y;
    this.editor.layerManager.startBatchOperation();

    // Show preview using canvas manager
    this.updatePreview(x, y);
  }

  // Handle mouse drag event
  onMouseDrag(x, y, lastX, lastY, event) {
    if (!this.editor.layerManager || !this.isDrawing) return;
    this.updatePreview(x, y);
  }

  // Handle mouse up event
  onMouseUp(x, y, event) {
    if (!this.editor.layerManager || !this.isDrawing) return;
    this.isDrawing = false;

    // Clear preview and draw final shape
    this.editor.canvasManager.clearShapePreview();
    this.drawShape(this.startX, this.startY, x, y);

    this.editor.layerManager.endBatchOperation();
    this.editor.updateUI();
  }

  // Handle mouse move event (when not drawing)
  onMouseMove(x, y, event) {
    // Could show cursor preview here
  }

  // Handle mouse leave event
  onMouseLeave(event) {
    if (this.isDrawing) {
      this.isDrawing = false;
      this.editor.canvasManager.clearShapePreview();
      this.editor.layerManager.endBatchOperation();
      this.editor.updateUI();
    }
  }

  // Update preview using canvas manager
  updatePreview(endX, endY) {
    if (!this.editor.canvasManager) return;

    const previewPixels = this.getShapePixels(
      this.startX,
      this.startY,
      endX,
      endY
    );

    // Create shape info for preview
    const shapeInfo = this.getShapeInfo(this.startX, this.startY, endX, endY);

    this.editor.canvasManager.showShapePreviewWithInfo(
      previewPixels, 
      this.color, 
      this.opacity,
      shapeInfo
    );
  }

  // Get shape information for preview display
  getShapeInfo(startX, startY, endX, endY) {
    const info = { type: this.shapeType };
    
    switch (this.shapeType) {
      case "line":
        const dx = endX - startX;
        const dy = endY - startY;
        info.length = Math.round(Math.sqrt(dx * dx + dy * dy));
        break;
      case "rectangle":
        info.width = Math.abs(endX - startX) + 1;
        info.height = Math.abs(endY - startY) + 1;
        break;
      case "circle":
        info.radius = Math.round(
          Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2))
        );
        break;
    }
    
    return info;
  }

  // Draw final shape
  drawShape(startX, startY, endX, endY) {
    const pixels = this.getShapePixels(startX, startY, endX, endY);
    const color = [...this.color];
    color[3] = Math.round((color[3] * this.opacity) / 100);

    pixels.forEach(([x, y]) => {
      this.drawPixel(x, y, color);
    });

    this.editor.canvasManager.render();
  }

  // Get pixels for the current shape
  getShapePixels(startX, startY, endX, endY) {
    switch (this.shapeType) {
      case "line":
        return this.getLinePixels(startX, startY, endX, endY);
      case "rectangle":
        return this.getRectanglePixels(startX, startY, endX, endY);
      case "circle":
        return this.getCirclePixels(startX, startY, endX, endY);
      default:
        return [];
    }
  }

  // Get pixels for a line
  getLinePixels(x1, y1, x2, y2) {
    const pixels = [];

    // Bresenham's line algorithm
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;

    let x = x1;
    let y = y1;

    while (true) {
      // Add pixels for brush size
      const brushPixels = this.getBrushPixels(x, y);
      pixels.push(...brushPixels);

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

    return pixels;
  }

  // Get pixels for a rectangle
  getRectanglePixels(x1, y1, x2, y2) {
    const pixels = [];
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    if (this.filled) {
      // Fill the rectangle
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const brushPixels = this.getBrushPixels(x, y);
          pixels.push(...brushPixels);
        }
      }
    } else {
      // Draw rectangle outline
      // Top and bottom edges
      for (let x = minX; x <= maxX; x++) {
        const topPixels = this.getBrushPixels(x, minY);
        const bottomPixels = this.getBrushPixels(x, maxY);
        pixels.push(...topPixels, ...bottomPixels);
      }
      // Left and right edges
      for (let y = minY; y <= maxY; y++) {
        const leftPixels = this.getBrushPixels(minX, y);
        const rightPixels = this.getBrushPixels(maxX, y);
        pixels.push(...leftPixels, ...rightPixels);
      }
    }

    return pixels;
  }

  // Get pixels for a circle
  getCirclePixels(centerX, centerY, endX, endY) {
    const pixels = [];
    const radius = Math.round(
      Math.sqrt(Math.pow(endX - centerX, 2) + Math.pow(endY - centerY, 2))
    );

    if (radius === 0) {
      const brushPixels = this.getBrushPixels(centerX, centerY);
      return brushPixels;
    }

    if (this.filled) {
      // Fill the circle
      for (let y = centerY - radius; y <= centerY + radius; y++) {
        for (let x = centerX - radius; x <= centerX + radius; x++) {
          const distance = Math.sqrt(
            Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
          );
          if (distance <= radius) {
            const brushPixels = this.getBrushPixels(x, y);
            pixels.push(...brushPixels);
          }
        }
      }
    } else {
      // Draw circle outline using midpoint circle algorithm
      let x = 0;
      let y = radius;
      let d = 1 - radius;

      const addCirclePoints = (cx, cy, x, y) => {
        const points = [
          [cx + x, cy + y],
          [cx - x, cy + y],
          [cx + x, cy - y],
          [cx - x, cy - y],
          [cx + y, cy + x],
          [cx - y, cy + x],
          [cx + y, cy - x],
          [cx - y, cy - x],
        ];

        points.forEach(([px, py]) => {
          const brushPixels = this.getBrushPixels(px, py);
          pixels.push(...brushPixels);
        });
      };

      addCirclePoints(centerX, centerY, x, y);

      while (x < y) {
        x++;
        if (d < 0) {
          d += 2 * x + 1;
        } else {
          y--;
          d += 2 * (x - y) + 1;
        }
        addCirclePoints(centerX, centerY, x, y);
      }
    }

    return pixels;
  }

  // Get brush pixels around a center point
  getBrushPixels(centerX, centerY) {
    const pixels = [];
    const halfSize = Math.floor(this.size / 2);

    for (let dy = -halfSize; dy <= halfSize; dy++) {
      for (let dx = -halfSize; dx <= halfSize; dx++) {
        const x = centerX + dx;
        const y = centerY + dy;

        // For round brushes, check distance
        if (this.size > 1) {
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance > this.size / 2) continue;
        }

        pixels.push([x, y]);
      }
    }

    return pixels;
  }

  // Draw a single pixel
  drawPixel(x, y, color) {
    if (!this.editor.layerManager) return;

    const layerManager = this.editor.layerManager;

    // Check bounds
    if (x >= 0 && x < layerManager.width && y >= 0 && y < layerManager.height) {
      if (this.opacity < 100) {
        const existingPixel = layerManager.getPixel(x, y);
        const blendedColor = this.blendColors(existingPixel, color);
        layerManager.setPixel(x, y, blendedColor);
      } else {
        layerManager.setPixel(x, y, color);
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

  // Set brush size
  setSize(size) {
    this.size = Math.max(1, Math.min(10, size));
  }

  // Set opacity
  setOpacity(opacity) {
    this.opacity = Math.max(0, Math.min(100, opacity));
  }

  // Set shape type
  setShapeType(shapeType) {
    if (["line", "rectangle", "circle"].includes(shapeType)) {
      this.shapeType = shapeType;
    }
  }

  // Set filled mode
  setFilled(filled) {
    this.filled = filled;
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

  // Get settings HTML
  getSettingsHTML() {
    return `
    <div class="setting-group">
      <label for="shape-type">Shape:</label>
      <select id="shape-type" class="shape-select">
        <option value="line" ${
          this.shapeType === "line" ? "selected" : ""
        }>Line</option>
        <option value="rectangle" ${
          this.shapeType === "rectangle" ? "selected" : ""
        }>Rectangle</option>
        <option value="circle" ${
          this.shapeType === "circle" ? "selected" : ""
        }>Circle</option>
      </select>
    </div>
    <div class="setting-group">
      <label for="shape-size">Size:</label>
      <div class="slider-container">
        <input type="range" id="shape-size" min="1" max="10" value="${
          this.size
        }">
        <input type="number" class="slider-value-input" data-slider="shape-size" min="1" max="10" value="${
          this.size
        }">
      </div>
    </div>
    <div class="setting-group">
      <label for="shape-opacity">Opacity:</label>
      <div class="slider-container">
        <input type="range" id="shape-opacity" min="0" max="100" value="${
          this.opacity
        }">
        <input type="number" class="slider-value-input" data-slider="shape-opacity" min="0" max="100" value="${
          this.opacity
        }">%
      </div>
    </div>
    <div class="setting-group" id="shape-filled-group" style="${
      this.shapeType === "line" ? "display: none;" : ""
    }">
      <label>
        <input type="checkbox" id="shape-filled" ${
          this.filled ? "checked" : ""
        }>
        Fill
      </label>
    </div>
  `;
  }

  // Initialize settings
  initializeSettings() {
    const shapeTypeSelect = document.getElementById("shape-type");
    const sizeSlider = document.getElementById("shape-size");
    const opacitySlider = document.getElementById("shape-opacity");
    const filledCheckbox = document.getElementById("shape-filled");
    const filledGroup = document.getElementById("shape-filled-group");

    const sizeInput = document.querySelector('[data-slider="shape-size"]');
    const opacityInput = document.querySelector(
      '[data-slider="shape-opacity"]'
    );

    if (shapeTypeSelect) {
      shapeTypeSelect.addEventListener("change", (e) => {
        this.setShapeType(e.target.value);
        // Show/hide filled option based on shape type
        if (filledGroup) {
          filledGroup.style.display = e.target.value === "line" ? "none" : "";
        }
      });
    }

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

    if (opacitySlider && opacityInput) {
      opacitySlider.addEventListener("input", (e) => {
        const value = parseInt(e.target.value);
        this.setOpacity(value);
        opacityInput.value = this.opacity;
      });

      opacityInput.addEventListener("input", (e) => {
        const value = parseInt(e.target.value);
        if (value >= 0 && value <= 100) {
          this.setOpacity(value);
          opacitySlider.value = this.opacity;
        }
      });

      opacityInput.addEventListener("blur", (e) => {
        const value = parseInt(e.target.value);
        if (isNaN(value) || value < 0 || value > 100) {
          e.target.value = this.opacity;
        }
      });
    }

    if (filledCheckbox) {
      filledCheckbox.addEventListener("change", (e) => {
        this.setFilled(e.target.checked);
      });
    }
  }

  // Get cursor
  getCursor() {
    return "crosshair";
  }
}