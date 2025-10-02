// Bucket Tool - For filling areas with color
class BucketTool {
constructor(editor) {
  this.editor = editor;
  this.name = "bucket";
  this.color = [0, 0, 0, 255]; // Black
  this.tolerance = 0;
  this.fillAll = false;
  this.fillConnectedOnly = true;
}

  // Handle mouse down event
  onMouseDown(x, y, event) {
    if (!this.editor.layerManager) return;

    // Start batch operation for undo/redo
    this.editor.layerManager.startBatchOperation();

    if (this.fillAll) {
      this.fillAllPixels(x, y);
    } else {
      this.floodFill(x, y);
    }

    // End batch operation - this will save to history
    this.editor.layerManager.endBatchOperation();

    this.editor.updateUI();
  }

  // Handle other mouse events (not used for fill tool)
  onMouseDrag(x, y, lastX, lastY, event) {
    // Fill tool doesn't use drag events
  }

  onMouseUp(x, y, event) {
    // Fill tool doesn't use mouse up events
  }

  onMouseMove(x, y, event) {
    // Could show fill preview here in the future
  }

  onMouseLeave(event) {
    // Fill tool doesn't need mouse leave handling
  }

  // Traditional flood fill algorithm - FIXED VERSION
 floodFill(startX, startY) {
  if (!this.editor.layerManager) return;
  const layerManager = this.editor.layerManager;
  const activeLayer = layerManager.getActiveLayer();
  if (!activeLayer || activeLayer.locked) return;

  const targetColor = layerManager.getPixel(startX, startY);
  if (this.colorsEqual(targetColor, this.color)) return;

  const stack = [[startX, startY]];
  const visited = new Set();
  const fillColor = [...this.color]; // Use color's alpha directly

  layerManager.setBatchMode(true);

  while (stack.length > 0) {
    const [x, y] = stack.pop();
    const key = `${x},${y}`;
    if (
      visited.has(key) ||
      x < 0 ||
      x >= layerManager.width ||
      y < 0 ||
      y >= layerManager.height
    ) {
      continue;
    }
    const currentColor = layerManager.getPixel(x, y);
    if (!this.colorMatches(currentColor, targetColor)) {
      continue;
    }
    visited.add(key);
    
    // Use color's alpha for blending
    if (fillColor[3] === 0) {
      layerManager.setPixel(x, y, [0, 0, 0, 0]);
    } else if (fillColor[3] < 255) {
      const blendedColor = this.blendColors(currentColor, fillColor);
      layerManager.setPixel(x, y, blendedColor);
    } else {
      layerManager.setPixel(x, y, fillColor);
    }
    
    stack.push([x + 1, y]);
    stack.push([x - 1, y]);
    stack.push([x, y + 1]);
    stack.push([x, y - 1]);
  }

  layerManager.setBatchMode(false);
  this.editor.canvasManager.render();
}

  // Fill all pixels of matching color regardless of connectivity - FIXED VERSION
  fillAllPixels(startX, startY) {
  if (!this.editor.layerManager) return;
  const layerManager = this.editor.layerManager;
  const activeLayer = layerManager.getActiveLayer();
  if (!activeLayer || activeLayer.locked) return;

  const targetColor = layerManager.getPixel(startX, startY);
  if (this.colorsEqual(targetColor, this.color)) return;

  const fillColor = [...this.color]; // Use color's alpha directly

  layerManager.setBatchMode(true);

  for (let y = 0; y < layerManager.height; y++) {
    for (let x = 0; x < layerManager.width; x++) {
      const currentColor = layerManager.getPixel(x, y);
      if (this.colorMatches(currentColor, targetColor)) {
        if (fillColor[3] === 0) {
          layerManager.setPixel(x, y, [0, 0, 0, 0]);
        } else if (fillColor[3] < 255) {
          const blendedColor = this.blendColors(currentColor, fillColor);
          layerManager.setPixel(x, y, blendedColor);
        } else {
          layerManager.setPixel(x, y, fillColor);
        }
      }
    }
  }

  layerManager.setBatchMode(false);
  this.editor.canvasManager.render();
}

  // Blend two colors with alpha blending (copied from BrushTool)
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
  // Set fill opacity
  setOpacity(opacity) {
    this.opacity = Math.max(0, Math.min(100, opacity));
  }

  // Check if two colors match within tolerance
  colorMatches(color1, color2) {
    if (this.tolerance === 0) {
      return this.colorsEqual(color1, color2);
    }

    const [r1, g1, b1, a1] = color1;
    const [r2, g2, b2, a2] = color2;

    // Calculate color distance using Euclidean distance
    const distance = Math.sqrt(
      Math.pow(r1 - r2, 2) +
        Math.pow(g1 - g2, 2) +
        Math.pow(b1 - b2, 2) +
        Math.pow(a1 - a2, 2)
    );

    // Convert tolerance percentage to actual distance threshold
    // Maximum possible distance is sqrt(255^2 * 4) ≈ 510
    const maxDistance = Math.sqrt(255 * 255 * 4);
    const threshold = (this.tolerance / 100) * maxDistance;

    return distance <= threshold;
  }

  // Check if two colors are exactly equal
  colorsEqual(color1, color2) {
    return (
      color1[0] === color2[0] &&
      color1[1] === color2[1] &&
      color1[2] === color2[2] &&
      color1[3] === color2[3]
    );
  }

  // Set fill color
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

  // Set fill color from hex string
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

  // Set color tolerance
  setTolerance(tolerance) {
    this.tolerance = Math.max(0, Math.min(100, tolerance));
  }

  // Set fill all mode
  setFillAll(fillAll) {
    this.fillAll = fillAll;
    this.fillConnectedOnly = !fillAll;
  }

  // Get tool settings UI elements
  getSettingsHTML() {
  return `
    <div class="setting-group">
      <label for="fill-tolerance">Tolerance:</label>
      <div class="slider-container">
        <input type="range" id="fill-tolerance" min="0" max="100" value="${this.tolerance}">
        <input type="number" class="slider-value-input" data-slider="fill-tolerance" min="0" max="100" value="${this.tolerance}">%
      </div>
    </div>
    <div class="setting-group">
      <label>
        <input type="checkbox" id="fill-all-checkbox" ${this.fillAll ? "checked" : ""}>
        Fill All Matching
      </label>
    </div>
  `;
}

  // Initialize tool settings event listeners
  initializeSettings() {
  const toleranceSlider = document.getElementById("fill-tolerance");
  const fillAllCheckbox = document.getElementById("fill-all-checkbox");
  const toleranceInput = document.querySelector('[data-slider="fill-tolerance"]');

  if (toleranceSlider && toleranceInput) {
    toleranceSlider.addEventListener("input", (e) => {
      const value = parseInt(e.target.value);
      this.setTolerance(value);
      toleranceInput.value = this.tolerance;
    });

    toleranceInput.addEventListener("input", (e) => {
      const value = parseInt(e.target.value);
      if (value >= 0 && value <= 100) {
        this.setTolerance(value);
        toleranceSlider.value = this.tolerance;
      }
    });

    toleranceInput.addEventListener("blur", (e) => {
      const value = parseInt(e.target.value);
      if (isNaN(value) || value < 0 || value > 100) {
        e.target.value = this.tolerance;
      }
    });
  }

  if (fillAllCheckbox) {
    fillAllCheckbox.addEventListener("change", (e) => {
      this.setFillAll(e.target.checked);
    });
  }
}

  // Get tool cursor
  getCursor() {
    return "crosshair";
  }
}
