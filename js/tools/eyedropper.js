// Eyedropper Tool - For picking colors from the canvas
class EyedropperTool {
  constructor(editor) {
    this.editor = editor;
    this.name = "eyedropper";
  }

  // Handle mouse down event
  onMouseDown(x, y, event) {
    if (!this.editor.currentSprite) return;

    this.pickColor(x, y, event);
  }

  // Handle mouse drag event
  onMouseDrag(x, y, lastX, lastY, event) {
    if (!this.editor.currentSprite) return;

    // Allow color picking while dragging
    this.pickColor(x, y, event);
  }

  // Handle mouse up event
  onMouseUp(x, y, event) {
    // Color picking is completed on mouse down
  }

  // Handle mouse move event
  onMouseMove(x, y, event) {
    // Show color preview at cursor position
    this.showColorPreview(x, y);
  }

  // Handle mouse leave event
  onMouseLeave(event) {
    this.hideColorPreview();
  }

  // Pick color from the specified position
  pickColor(x, y, event) {
    if (!this.editor.currentSprite) return;

    const sprite = this.editor.currentSprite;

    // Layer support: use LayerManager composite pixel for picking
    const layerManager = this.editor.layerManager;
    if (!layerManager) return;
    const width = layerManager.width;
    const height = layerManager.height;
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return;
    }
    // Pick composite pixel (visible result)
    const pickedColor = layerManager.getCompositePixel(x, y);

    // Fix the primary/secondary pick logic
    const isPrimaryPick = !event.shiftKey && event.button !== 2; // Left click without shift and not right click

    if (isPrimaryPick) {
      // Set as primary color
      this.editor.setPrimaryColor(pickedColor);

      // Update UI through multiple pathways to ensure it works
      this.updateColorUI(pickedColor);
    } else {
      // Set as secondary color
      this.editor.setSecondaryColor(pickedColor);
    }

    // Provide visual feedback
    this.showPickedColorFeedback(x, y, pickedColor, isPrimaryPick, event);
  }

  // Comprehensive UI update method
  updateColorUI(pickedColor) {
    // Convert to consistent format
    let rgba = pickedColor;
    if (!Array.isArray(rgba)) {
      rgba = [
        pickedColor.r,
        pickedColor.g,
        pickedColor.b,
        pickedColor.a ?? 255,
      ];
    }

    // Update through UIController if available
    if (
      this.editor.uiManager &&
      typeof this.editor.uiManager.setColorFromEyedropper === "function"
    ) {
      this.editor.uiManager.setColorFromEyedropper(rgba);
    }

    // Direct UI updates as fallback
    const hex = this.rgbaToHex(rgba);

    // Update color picker input


    // Update primary color display
    const primaryColor = document.getElementById("primary-color");
    if (primaryColor) {
      primaryColor.style.backgroundColor = hex;
    }

    // Update color wheel if it exists
    if (this.editor.uiManager && this.editor.uiManager.colorPicker) {
      try {
        this.editor.uiManager.colorPicker.color.hexString = hex;
      } catch (e) {
        console.warn("Could not update color wheel:", e);
      }
    }

    // Update color input fields
    const hexInput = document.getElementById("color-hex");
    const rgbInput = document.getElementById("color-rgb");
    if (hexInput) {
      hexInput.value = hex;
    }
    if (rgbInput) {
      rgbInput.value = `rgb(${rgba[0]},${rgba[1]},${rgba[2]})`;
    }

    // Deselect palette swatches
    const paletteSwatches = document.querySelectorAll(".color-swatch");
    paletteSwatches.forEach((swatch) => {
      swatch.classList.remove("selected");
    });

    // Trigger editor's color update if available
    if (typeof this.editor.updateColorUI === "function") {
      this.editor.updateColorUI();
    }

    // Force a UI refresh through UIController if available
    if (
      this.editor.uiManager &&
      typeof this.editor.uiManager.updateColorDisplay === "function"
    ) {
      this.editor.uiManager.updateColorDisplay();
    }
  }

  // Show color preview at cursor position (use LayerManager composite)
  showColorPreview(x, y) {
    const layerManager = this.editor.layerManager;
    if (!layerManager) return;
    const width = layerManager.width;
    const height = layerManager.height;
    if (x < 0 || x >= width || y < 0 || y >= height) {
      this.hideColorPreview();
      return;
    }
    const color = layerManager.getCompositePixel(x, y);
    const hexColor = this.rgbaToHex(color);
    let preview = document.getElementById("eyedropper-preview");
    if (!preview) {
      preview = document.createElement("div");
      preview.id = "eyedropper-preview";
      preview.className = "eyedropper-preview";
      document.body.appendChild(preview);
    }
    let screenPos;
    if (this.editor.canvasManager && this.editor.canvasManager.spriteToScreen) {
      screenPos = this.editor.canvasManager.spriteToScreen(x, y);
    } else {
      const canvas =
        this.editor.canvasManager?.mainCanvas ||
        document.querySelector("canvas");
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        screenPos = { x: rect.left + x * 10, y: rect.top + y * 10 };
      } else {
        screenPos = { x: 100, y: 100 };
      }
    }
    preview.style.left = `${screenPos.x + 20}px`;
    preview.style.top = `${screenPos.y - 30}px`;
    preview.style.backgroundColor = hexColor;
    preview.textContent = hexColor.toUpperCase();
    preview.style.display = "block";
    const alpha = Array.isArray(color) ? color[3] : color.a ?? 255;
    if (alpha === 0) {
      preview.textContent = "Transparent";
      preview.style.backgroundColor = "transparent";
      preview.style.border = "2px dashed #666";
      preview.style.color = "#666";
    } else {
      preview.style.border = "2px solid #333";
      preview.style.color = this.getContrastColor(color);
    }
  }

  // Hide color preview
  hideColorPreview() {
    const preview = document.getElementById("eyedropper-preview");
    if (preview) {
      preview.style.display = "none";
    }
  }

  // Show visual feedback when color is picked
  showPickedColorFeedback(x, y, color, isPrimary, event) {
    // Use cursor position from event if available
    let screenPos;
    if (event && typeof event.clientX === "number" && typeof event.clientY === "number") {
      screenPos = { x: event.clientX, y: event.clientY };
    } else if (this.editor.canvasManager && this.editor.canvasManager.spriteToScreen) {
      screenPos = this.editor.canvasManager.spriteToScreen(x, y);
    } else {
      // Fallback positioning
      const canvas =
        this.editor.canvasManager?.mainCanvas ||
        document.querySelector("canvas");
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        screenPos = { x: rect.left + x * 10, y: rect.top + y * 10 };
      } else {
        return; // Can't show feedback without position
      }
    }

    const ripple = document.createElement("div");
    ripple.className = "color-pick-ripple";
    ripple.style.position = "fixed";
    ripple.style.left = `${screenPos.x}px`;
    ripple.style.top = `${screenPos.y}px`;
    ripple.style.width = "20px";
    ripple.style.height = "20px";
    ripple.style.borderRadius = "50%";
    ripple.style.border = `3px solid ${isPrimary ? "#00d4ff" : "#ff6b00"}`;
    ripple.style.backgroundColor = "transparent";
    ripple.style.transform = "translate(-50%, -50%) scale(0)";
    ripple.style.animation = "colorPickRipple 0.6s ease-out";
    ripple.style.pointerEvents = "none";
    ripple.style.zIndex = "10000";

    document.body.appendChild(ripple);

    // Remove ripple after animation
    setTimeout(() => {
      if (ripple.parentNode) {
        ripple.parentNode.removeChild(ripple);
      }
    }, 600);

    // Add ripple animation CSS if not exists
    if (!document.getElementById("eyedropper-styles")) {
      const style = document.createElement("style");
      style.id = "eyedropper-styles";
      style.textContent = `
                .eyedropper-preview {
                    position: fixed;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: bold;
                    z-index: 10000;
                    pointer-events: none;
                    font-family: monospace;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                    display: none;
                }
                
                @keyframes colorPickRipple {
                    0% {
                        transform: translate(-50%, -50%) scale(0);
                        opacity: 1;
                    }
                    100% {
                        transform: translate(-50%, -50%) scale(2);
                        opacity: 0;
                    }
                }
            `;
      document.head.appendChild(style);
    }
  }

  // Convert RGBA color to hex string
  rgbaToHex(rgba) {
    // Handle different input formats
    let r, g, b, a;

    if (Array.isArray(rgba)) {
      [r, g, b, a] = rgba;
    } else if (rgba && typeof rgba === "object") {
      r = rgba.r;
      g = rgba.g;
      b = rgba.b;
      a = rgba.a;
    } else {
      return "#000000"; // Fallback
    }

    if (a === 0) return "transparent";

    const toHex = (n) => {
      const hex = Math.round(Math.max(0, Math.min(255, n)))
        .toString(16)
        .padStart(2, "0");
      return hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  // Get contrasting color (black or white) for text
  getContrastColor(rgba) {
    let r, g, b;

    if (Array.isArray(rgba)) {
      [r, g, b] = rgba;
    } else if (rgba && typeof rgba === "object") {
      r = rgba.r;
      g = rgba.g;
      b = rgba.b;
    } else {
      return "#ffffff"; // Fallback
    }

    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#000000" : "#ffffff";
  }

  // Get color information at position (use LayerManager composite)
  getColorInfo(x, y) {
    const layerManager = this.editor.layerManager;
    if (!layerManager) return null;
    const width = layerManager.width;
    const height = layerManager.height;
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return null;
    }
    const color = layerManager.getCompositePixel(x, y);
    let r, g, b, a;
    if (Array.isArray(color)) {
      [r, g, b, a] = color;
    } else if (color && typeof color === "object") {
      r = color.r;
      g = color.g;
      b = color.b;
      a = color.a ?? 255;
    } else {
      return null;
    }
    return {
      rgba: [r, g, b, a],
      hex: this.rgbaToHex([r, g, b, a]),
      isTransparent: a === 0,
      position: { x, y },
    };
  }

  // Get tool settings UI elements
  // Get tool settings UI elements
  getSettingsHTML() {
    return `
        <div class="setting-group">
            <label>Click to pick colors</label>
            <div class="eyedropper-shortcuts">
                Left: Primary | Shift/Right: Secondary
            </div>
        </div>
        <div class="setting-group">
            <div class="color-info" id="eyedropper-info">
                Hover over pixels
            </div>
        </div>
    `;
  }

  // Initialize tool settings event listeners
  initializeSettings() {
    // Add right-click support for secondary color picking
    if (this.editor.canvasManager && this.editor.canvasManager.mainCanvas) {
      this.editor.canvasManager.mainCanvas.addEventListener(
        "contextmenu",
        (e) => {
          if (this.editor.currentTool === this) {
            e.preventDefault();
            const pos = this.editor.canvasManager.screenToSprite(
              e.clientX,
              e.clientY
            );
            const mockEvent = { shiftKey: true, button: 2 };
            this.pickColor(pos.x, pos.y, mockEvent);
          }
        }
      );

      // Update color info display and show color preview on mouse move
      this.editor.canvasManager.mainCanvas.addEventListener(
        "mousemove",
        (e) => {
          if (this.editor.currentTool === this) {
            const pos = this.editor.canvasManager.screenToSprite(
              e.clientX,
              e.clientY
            );
            this.updateColorInfo(pos.x, pos.y);
            this.showColorPreview(pos.x, pos.y); // <-- Always show preview on mouse move
          }
        }
      );

      // Hide color preview on mouse leave
      this.editor.canvasManager.mainCanvas.addEventListener(
        "mouseleave",
        (e) => {
          if (this.editor.currentTool === this) {
            this.hideColorPreview();
          }
        }
      );
    }
  }

  // Update color information display

  // Update color information display
  updateColorInfo(x, y) {
    const infoElement = document.getElementById("eyedropper-info");
    if (!infoElement) return;

    const colorInfo = this.getColorInfo(x, y);

    if (colorInfo) {
      const { rgba, hex, isTransparent } = colorInfo;

      if (isTransparent) {
        infoElement.innerHTML = `Transparent`;
      } else {
        infoElement.innerHTML = `${hex.toUpperCase()} | RGB(${rgba[0]},${
          rgba[1]
        },${rgba[2]})`;
      }
    } else {
      infoElement.innerHTML = "Out of bounds";
    }
  }

  // Get tool cursor
  getCursor() {
    return "crosshair";
  }
}
