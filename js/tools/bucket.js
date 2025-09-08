// Bucket Tool - For filling areas with color
class BucketTool {
  constructor(editor) {
    this.editor = editor;
    this.name = "bucket";
    this.color = [0, 0, 0, 255]; // Black
    this.opacity = 100; // Opacity percentage (0-100)
    this.tolerance = 0; // Color matching tolerance
    this.fillAll = false; // New: fill all pixels of matching color
    this.fillConnectedOnly = true; // Traditional flood fill behavior
  }

  // Handle mouse down event
  onMouseDown(x, y, event) {
    if (!this.editor.layerManager) return;
    if (this.fillAll) {
      this.fillAllPixels(x, y);
    } else {
      this.floodFill(x, y);
    }
    // TODO: Implement layerManager history if needed
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
    const targetColor = layerManager.getPixel(startX, startY);
    if (this.opacity > 0 && this.colorsEqual(targetColor, this.color)) return;
    const stack = [[startX, startY]];
    const visited = new Set();
    const fillColor = [...this.color];
    fillColor[3] = Math.round((fillColor[3] * this.opacity) / 100);
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
      if (this.opacity === 0) {
        layerManager.setPixel(x, y, [0, 0, 0, 0]);
      } else if (this.opacity < 100) {
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
    this.editor.canvasManager.render();
  }

  // Fill all pixels of matching color regardless of connectivity - FIXED VERSION
  fillAllPixels(startX, startY) {
    if (!this.editor.layerManager) return;
    const layerManager = this.editor.layerManager;
    const targetColor = layerManager.getPixel(startX, startY);
    if (this.opacity > 0 && this.colorsEqual(targetColor, this.color)) return;
    const fillColor = [...this.color];
    fillColor[3] = Math.round((fillColor[3] * this.opacity) / 100);
    for (let y = 0; y < layerManager.height; y++) {
      for (let x = 0; x < layerManager.width; x++) {
        const currentColor = layerManager.getPixel(x, y);
        if (this.colorMatches(currentColor, targetColor)) {
          if (this.opacity === 0) {
            layerManager.setPixel(x, y, [0, 0, 0, 0]);
          } else if (this.opacity < 100) {
            const blendedColor = this.blendColors(currentColor, fillColor);
            layerManager.setPixel(x, y, blendedColor);
          } else {
            layerManager.setPixel(x, y, fillColor);
          }
        }
      }
    }
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
                <label for="fill-opacity">Opacity:</label>
                <div class="slider-container">
                    <input type="range" id="fill-opacity" min="0" max="100" value="${
                      this.opacity
                    }">
                    <span class="slider-value">${this.opacity}%</span>
                </div>
            </div>
            <div class="setting-group">
                <label for="fill-tolerance">Color Tolerance:</label>
                <div class="slider-container">
                    <input type="range" id="fill-tolerance" min="0" max="100" value="${
                      this.tolerance
                    }">
                    <span class="slider-value">${this.tolerance}%</span>
                </div>
                <small class="setting-help">Higher tolerance fills similar colors</small>
            </div>
            <div class="setting-group">
                <label>Fill Mode:</label>
                <div class="button-group">
                    <button class="btn btn-secondary btn-sm ${
                      !this.fillAll ? "active" : ""
                    }" id="fill-mode-connected" data-mode="connected">Connected Only</button>
                    <button class="btn btn-secondary btn-sm ${
                      this.fillAll ? "active" : ""
                    }" id="fill-mode-all" data-mode="all">Fill All</button>
                </div>
                <small class="setting-help">Connected: traditional flood fill | Fill All: fills all matching pixels</small>
            </div>
            <div class="setting-group">
                <label>
                    <input type="checkbox" id="fill-all-checkbox" ${
                      this.fillAll ? "checked" : ""
                    }>
                    Fill all pixels of same color (ignores connectivity)
                </label>
            </div>
        `;
  }

  // Initialize tool settings event listeners
  initializeSettings() {
    const opacitySlider = document.getElementById("fill-opacity");
    const toleranceSlider = document.getElementById("fill-tolerance");
    const opacityValue = opacitySlider.nextElementSibling;
    const toleranceValue = toleranceSlider.nextElementSibling;
    const fillAllCheckbox = document.getElementById("fill-all-checkbox");

    // Opacity slider
    opacitySlider.addEventListener("input", (e) => {
      this.setOpacity(parseInt(e.target.value));
      opacityValue.textContent = `${this.opacity}%`;
    });

    // Tolerance slider
    toleranceSlider.addEventListener("input", (e) => {
      this.setTolerance(parseInt(e.target.value));
      toleranceValue.textContent = `${this.tolerance}%`;
    });

    // Fill all checkbox
    if (fillAllCheckbox) {
      fillAllCheckbox.addEventListener("change", (e) => {
        this.setFillAll(e.target.checked);
        // Update button states
        const connectedBtn = document.getElementById("fill-mode-connected");
        const allBtn = document.getElementById("fill-mode-all");
        if (connectedBtn && allBtn) {
          if (this.fillAll) {
            connectedBtn.classList.remove("active");
            allBtn.classList.add("active");
          } else {
            connectedBtn.classList.add("active");
            allBtn.classList.remove("active");
          }
        }
      });
    }

    // Mode buttons
    const connectedModeBtn = document.getElementById("fill-mode-connected");
    const allModeBtn = document.getElementById("fill-mode-all");

    if (connectedModeBtn && allModeBtn) {
      connectedModeBtn.addEventListener("click", () => {
        this.setFillAll(false);
        connectedModeBtn.classList.add("active");
        allModeBtn.classList.remove("active");
        // Update checkbox
        if (fillAllCheckbox) {
          fillAllCheckbox.checked = false;
        }
      });

      allModeBtn.addEventListener("click", () => {
        this.setFillAll(true);
        allModeBtn.classList.add("active");
        connectedModeBtn.classList.remove("active");
        // Update checkbox
        if (fillAllCheckbox) {
          fillAllCheckbox.checked = true;
        }
      });
    }
  }

  // Get tool cursor
  getCursor() {
    return "crosshair";
  }
}
