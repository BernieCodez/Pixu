// Canvas Manager - Handles canvas rendering and interactions
class CanvasManager {
  // Render only the selection box overlay
  // Modified renderSelectionBox method - always show handles
  renderSelectionBox(selection) {
    this.clearOverlay();
    if (!selection) return;

    const startX = selection.left * this.zoomLevel;
    const startY = selection.top * this.zoomLevel;
    const width = (selection.right - selection.left + 1) * this.zoomLevel;
    const height = (selection.bottom - selection.top + 1) * this.zoomLevel;

    // Draw selection box
    this.overlayCtx.strokeStyle = "#00d4ff";
    this.overlayCtx.lineWidth = 2;
    this.overlayCtx.setLineDash([5, 5]);
    this.overlayCtx.strokeRect(startX, startY, width, height);
    this.overlayCtx.fillStyle = "rgba(0, 212, 255, 0.1)";
    this.overlayCtx.fillRect(startX, startY, width, height);

    // Always draw scale handles for selections
    this.renderScaleHandles(selection);
  }
  // New method: Render scale handles at selection corners
  renderScaleHandles(selection) {
    if (!selection) return;

    const handleSize = 8; // Size of the handle squares in screen pixels
    const handles = [
      { x: selection.left, y: selection.top, type: "nw" }, // Northwest
      { x: selection.right, y: selection.top, type: "ne" }, // Northeast
      { x: selection.left, y: selection.bottom, type: "sw" }, // Southwest
      { x: selection.right, y: selection.bottom, type: "se" }, // Southeast
    ];

    this.overlayCtx.setLineDash([]); // Reset line dash

    handles.forEach((handle) => {
      const screenX = handle.x * this.zoomLevel;
      const screenY = handle.y * this.zoomLevel;

      // Draw handle background (white)
      this.overlayCtx.fillStyle = "#ffffff";
      this.overlayCtx.fillRect(
        screenX - handleSize / 2,
        screenY - handleSize / 2,
        handleSize,
        handleSize
      );

      // Draw handle border (blue)
      this.overlayCtx.strokeStyle = "#00d4ff";
      this.overlayCtx.lineWidth = 2;
      this.overlayCtx.strokeRect(
        screenX - handleSize / 2,
        screenY - handleSize / 2,
        handleSize,
        handleSize
      );
    });
  }

  /**
   * Debug overlay canvas visibility
   */
  debugOverlayVisibility() {
    console.log("Overlay canvas element:", this.overlayCanvas);
    console.log("Overlay canvas style:", {
      position: this.overlayCanvas.style.position,
      zIndex: this.overlayCanvas.style.zIndex,
      left: this.overlayCanvas.style.left,
      top: this.overlayCanvas.style.top,
      width: this.overlayCanvas.style.width,
      height: this.overlayCanvas.style.height,
      display: this.overlayCanvas.style.display,
      visibility: this.overlayCanvas.style.visibility,
    });
    console.log("Overlay canvas dimensions:", {
      width: this.overlayCanvas.width,
      height: this.overlayCanvas.height,
      clientWidth: this.overlayCanvas.clientWidth,
      clientHeight: this.overlayCanvas.clientHeight,
    });
  }

  /**
   * Show a semi-transparent preview of the dragged selection
   */
  // Modified showDraggedSelectionPreview method - also show scale handles during scaling
  showDraggedSelectionPreview(selection, clipboard) {
    this.clearOverlay();
    if (!selection || !clipboard) return;

    const { left, top } = selection;

    // Draw clipboard pixels at selection bounds, semi-transparent
    this.overlayCtx.globalAlpha = 0.7;
    for (let y = 0; y < clipboard.height; y++) {
      for (let x = 0; x < clipboard.width; x++) {
        const pixel = clipboard.pixels[y][x];
        if (pixel[3] > 0) {
          this.overlayCtx.fillStyle = `rgba(${pixel[0]},${pixel[1]},${
            pixel[2]
          },${pixel[3] / 255})`;
          this.overlayCtx.fillRect(
            (left + x) * this.zoomLevel,
            (top + y) * this.zoomLevel,
            this.zoomLevel,
            this.zoomLevel
          );
        }
      }
    }

    // Draw a border to indicate area
    this.overlayCtx.globalAlpha = 1.0;
    this.overlayCtx.strokeStyle = "#00d4ff";
    this.overlayCtx.lineWidth = 2;
    this.overlayCtx.setLineDash([3, 3]);
    this.overlayCtx.strokeRect(
      left * this.zoomLevel,
      top * this.zoomLevel,
      clipboard.width * this.zoomLevel,
      clipboard.height * this.zoomLevel
    );

    // Always show scale handles during preview (both dragging and scaling)
    if (
      window.editor &&
      window.editor.currentTool &&
      window.editor.currentTool.name === "select"
    ) {
      // Create temporary selection object for handles
      const tempSelection = {
        left: left,
        top: top,
        right: left + clipboard.width - 1,
        bottom: top + clipboard.height - 1,
      };
      this.renderScaleHandles(tempSelection);
    }
  }

  // New method: Check if position is over a scale handle
  isOverScaleHandle(x, y, selection) {
    if (!selection) return null;

    const handleSize = 8;
    const tolerance = handleSize / 2;

    const handles = [
      { x: selection.left, y: selection.top, type: "nw" },
      { x: selection.right, y: selection.top, type: "ne" },
      { x: selection.left, y: selection.bottom, type: "sw" },
      { x: selection.right, y: selection.bottom, type: "se" },
    ];

    for (const handle of handles) {
      const screenX = handle.x * this.zoomLevel;
      const screenY = handle.y * this.zoomLevel;
      const mouseScreenX = x * this.zoomLevel;
      const mouseScreenY = y * this.zoomLevel;

      if (
        Math.abs(mouseScreenX - screenX) <= tolerance &&
        Math.abs(mouseScreenY - screenY) <= tolerance
      ) {
        return handle.type;
      }
    }

    return null;
  }

  // Show dragged selection overlay with shadow effect
  showDraggedSelection(selection, clipboard) {
    this.clearOverlay();
    if (!selection || !clipboard) return;
    const { left, top } = selection;

    // First, render the shadow (darker, slightly transparent version)
    this.overlayCtx.globalAlpha = 0.4;
    for (let y = 0; y < clipboard.height; y++) {
      for (let x = 0; x < clipboard.width; x++) {
        const pixel = clipboard.pixels[y][x];
        if (pixel[3] > 0) {
          // Create shadow effect by darkening the pixel
          const shadowR = Math.max(0, pixel[0] * 0.3);
          const shadowG = Math.max(0, pixel[1] * 0.3);
          const shadowB = Math.max(0, pixel[2] * 0.3);
          this.overlayCtx.fillStyle = `rgba(${shadowR},${shadowG},${shadowB},${
            pixel[3] / 255
          })`;
          // Offset shadow slightly down and right
          this.overlayCtx.fillRect(
            (left + x) * this.zoomLevel + 2,
            (top + y) * this.zoomLevel + 2,
            this.zoomLevel,
            this.zoomLevel
          );
        }
      }
    }

    // Reset alpha and render the actual dragged content
    this.overlayCtx.globalAlpha = 0.8; // Slightly transparent so you can see through
    for (let y = 0; y < clipboard.height; y++) {
      for (let x = 0; x < clipboard.width; x++) {
        const pixel = clipboard.pixels[y][x];
        if (pixel[3] > 0) {
          this.overlayCtx.fillStyle = `rgba(${pixel[0]},${pixel[1]},${
            pixel[2]
          },${pixel[3] / 255})`;
          this.overlayCtx.fillRect(
            (left + x) * this.zoomLevel,
            (top + y) * this.zoomLevel,
            this.zoomLevel,
            this.zoomLevel
          );
        }
      }
    }

    // Reset alpha for border
    this.overlayCtx.globalAlpha = 1.0;

    // Draw selection border
    this.overlayCtx.strokeStyle = "#00d4ff";
    this.overlayCtx.lineWidth = 2;
    this.overlayCtx.setLineDash([5, 5]);
    this.overlayCtx.strokeRect(
      left * this.zoomLevel,
      top * this.zoomLevel,
      clipboard.width * this.zoomLevel,
      clipboard.height * this.zoomLevel
    );
  }

  // Clear dragged selection overlay
  clearDraggedSelection() {
    this.clearOverlay();
  }

  constructor(mainCanvasId, overlayCanvasId) {
    this.mainCanvas = document.getElementById(mainCanvasId);
    this.overlayCanvas = document.getElementById(overlayCanvasId);
    this.mainCtx = this.mainCanvas.getContext("2d");
    this.overlayCtx = this.overlayCanvas.getContext("2d");

    // Canvas properties
    this.zoomLevel = 16; // Pixels per sprite pixel
    this.showGrid = false;
    this.currentSprite = null;

    // Mouse state
    this.isDrawing = false;
    this.lastPos = { x: 0, y: 0 };

    // Selection state
    this.selection = {
      active: false,
      startX: 0,
      startY: 0,
      endX: 0,
      endY: 0,
    };
    // Hovered pixel
    this.hoveredPixel = null;
    this.setupCanvas();
    this.setupEventListeners();
  }

  // Setup canvas properties
  setupCanvas() {
    // Disable image smoothing for pixel-perfect rendering
    this.mainCtx.imageSmoothingEnabled = false;
    this.overlayCtx.imageSmoothingEnabled = false;

    // Set initial size
    this.updateCanvasSize();
  }

  // Update canvas size based on current sprite and zoom level
  updateCanvasSize() {
    if (!this.currentSprite) {
      this.mainCanvas.width = 512;
      this.mainCanvas.height = 512;
      this.overlayCanvas.width = 512;
      this.overlayCanvas.height = 512;
      return;
    }

    const width = this.currentSprite.width * this.zoomLevel;
    const height = this.currentSprite.height * this.zoomLevel;

    this.mainCanvas.width = width;
    this.mainCanvas.height = height;
    this.overlayCanvas.width = width;
    this.overlayCanvas.height = height;

    // Update canvas display size
    this.mainCanvas.style.width = `${width}px`;
    this.mainCanvas.style.height = `${height}px`;
    this.overlayCanvas.style.width = `${width}px`;
    this.overlayCanvas.style.height = `${height}px`;

    this.render();
  }

  /**
   * Set current sprite
   */
  setSprite(sprite) {
    this.currentSprite = sprite;
    this.updateCanvasSize();
    this.render();
  }

  /**
   * Render the current sprite to canvas
   */
  render() {
    if (!this.currentSprite) {
      this.clearCanvas();
      return;
    }

    // Clear canvas
    this.mainCtx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);

    // Render checkerboard background for transparency
    this.renderTransparencyBackground();

    // Render sprite pixels
    this.renderSprite();

    // Render grid if enabled
    if (this.showGrid) {
      this.renderGrid();
    }
  }

  /**
   * Render transparency checkerboard background
   */
  renderTransparencyBackground() {
    const checkerSize = Math.max(1, this.zoomLevel / 4);
    this.mainCtx.fillStyle = "#ffffff";
    this.mainCtx.fillRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);

    this.mainCtx.fillStyle = "#e0e0e0";
    for (let y = 0; y < this.currentSprite.height; y++) {
      for (let x = 0; x < this.currentSprite.width; x++) {
        if ((x + y) % 2 === 1) {
          this.mainCtx.fillRect(
            x * this.zoomLevel,
            y * this.zoomLevel,
            this.zoomLevel,
            this.zoomLevel
          );
        }
      }
    }
  }

  /**
   * Render sprite pixels
   */
  renderSprite() {
    for (let y = 0; y < this.currentSprite.height; y++) {
      for (let x = 0; x < this.currentSprite.width; x++) {
        const [r, g, b, a] = this.currentSprite.getPixel(x, y);

        if (a > 0) {
          this.mainCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
          this.mainCtx.fillRect(
            x * this.zoomLevel,
            y * this.zoomLevel,
            this.zoomLevel,
            this.zoomLevel
          );
        }
      }
    }
  }

  /**
   * Render grid overlay
   */
  renderGrid() {
    this.mainCtx.strokeStyle = "rgba(0, 0, 0, 0.2)";
    this.mainCtx.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x <= this.currentSprite.width; x++) {
      const pos = x * this.zoomLevel + 0.5;
      this.mainCtx.beginPath();
      this.mainCtx.moveTo(pos, 0);
      this.mainCtx.lineTo(pos, this.mainCanvas.height);
      this.mainCtx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y <= this.currentSprite.height; y++) {
      const pos = y * this.zoomLevel + 0.5;
      this.mainCtx.beginPath();
      this.mainCtx.moveTo(0, pos);
      this.mainCtx.lineTo(this.mainCanvas.width, pos);
      this.mainCtx.stroke();
    }
  }

  /**
   * Clear canvas
   */
  clearCanvas() {
    this.mainCtx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
    this.overlayCtx.clearRect(
      0,
      0,
      this.overlayCanvas.width,
      this.overlayCanvas.height
    );
  }

  /**
   * Convert screen coordinates to sprite coordinates
   */
  screenToSprite(screenX, screenY) {
    const rect = this.mainCanvas.getBoundingClientRect();
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;

    return {
      x: Math.floor(canvasX / this.zoomLevel),
      y: Math.floor(canvasY / this.zoomLevel),
    };
  }

  /**
   * Convert sprite coordinates to screen coordinates
   */
  spriteToScreen(spriteX, spriteY) {
    const rect = this.mainCanvas.getBoundingClientRect();
    return {
      x: rect.left + spriteX * this.zoomLevel,
      y: rect.top + spriteY * this.zoomLevel,
    };
  }

  /**
   * Set zoom level
   */
  setZoom(level) {
    this.zoomLevel = Math.max(1, Math.min(64, level));
    this.updateCanvasSize();
  }

  /**
   * Zoom in
   */
  zoomIn() {
    this.setZoom(this.zoomLevel * 2);
  }

  /**
   * Zoom out
   */
  zoomOut() {
    this.setZoom(this.zoomLevel / 2);
  }

  /**
   * Toggle grid visibility
   */
  toggleGrid() {
    this.showGrid = !this.showGrid;
    this.render();
  }

  /**
   * Start selection
   */
  startSelection(x, y) {
    this.selection.active = true;
    this.selection.startX = x;
    this.selection.startY = y;
    this.selection.endX = x;
    this.selection.endY = y;
  }

  /**
   * Update selection
   */
  updateSelection(x, y) {
    if (!this.selection.active) return;

    this.selection.endX = x;
    this.selection.endY = y;
    this.renderSelection();
  }

  /**
   * End selection
   */
  endSelection() {
    this.selection.active = false;
    this.clearOverlay();
  }

  /**
   * Render selection overlay
   */
  renderSelection() {
    this.clearOverlay();

    if (!this.selection.active) return;

    const startX =
      Math.min(this.selection.startX, this.selection.endX) * this.zoomLevel;
    const startY =
      Math.min(this.selection.startY, this.selection.endY) * this.zoomLevel;
    const endX =
      Math.max(this.selection.startX, this.selection.endX) * this.zoomLevel;
    const endY =
      Math.max(this.selection.startY, this.selection.endY) * this.zoomLevel;

    this.overlayCtx.strokeStyle = "#00d4ff";
    this.overlayCtx.lineWidth = 2;
    this.overlayCtx.setLineDash([5, 5]);
    this.overlayCtx.strokeRect(
      startX,
      startY,
      endX - startX + this.zoomLevel,
      endY - startY + this.zoomLevel
    );

    this.overlayCtx.fillStyle = "rgba(0, 212, 255, 0.1)";
    this.overlayCtx.fillRect(
      startX,
      startY,
      endX - startX + this.zoomLevel,
      endY - startY + this.zoomLevel
    );
  }

  /**
   * Clear overlay canvas
   */
  clearOverlay() {
    this.overlayCtx.clearRect(
      0,
      0,
      this.overlayCanvas.width,
      this.overlayCanvas.height
    );
    // Reset any transform/alpha settings
    this.overlayCtx.globalAlpha = 1.0;
    this.overlayCtx.setLineDash([]);
  }

  /**
   * Get selection bounds
   */
  getSelectionBounds() {
    if (!this.selection.active) return null;

    return {
      left: Math.min(this.selection.startX, this.selection.endX),
      top: Math.min(this.selection.startY, this.selection.endY),
      right: Math.max(this.selection.startX, this.selection.endX),
      bottom: Math.max(this.selection.startY, this.selection.endY),
    };
  }

  /**
   * Export canvas as image
   */
  exportAsImage(format = "png") {
    if (!this.currentSprite) return null;

    // Create temporary canvas with actual sprite size
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width = this.currentSprite.width;
    tempCanvas.height = this.currentSprite.height;

    // Render sprite at actual size
    const imageData = this.currentSprite.toImageData();
    tempCtx.putImageData(imageData, 0, 0);

    return tempCanvas.toDataURL(`image/${format}`);
  }

  /**
   * Import image from file
   */
  importFromImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Create temporary canvas to get image data
          const tempCanvas = document.createElement("canvas");
          const tempCtx = tempCanvas.getContext("2d");
          tempCanvas.width = img.width;
          tempCanvas.height = img.height;

          tempCtx.drawImage(img, 0, 0);
          const imageData = tempCtx.getImageData(0, 0, img.width, img.height);

          const sprite = Sprite.fromImageData(
            imageData,
            file.name.replace(/\.[^/.]+$/, "")
          );
          resolve(sprite);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Mouse events on main canvas
    this.mainCanvas.addEventListener("mousedown", (e) => {
      const pos = this.screenToSprite(e.clientX, e.clientY);
      this.isDrawing = true;
      this.lastPos = pos;

      if (window.editor && window.editor.currentTool) {
        window.editor.currentTool.onMouseDown(pos.x, pos.y, e);
      }
    });

    this.mainCanvas.addEventListener("mousemove", (e) => {
      const pos = this.screenToSprite(e.clientX, e.clientY);
      if (window.editor && window.editor.currentTool) {
        if (this.isDrawing) {
          window.editor.currentTool.onMouseDrag(
            pos.x,
            pos.y,
            this.lastPos.x,
            this.lastPos.y,
            e
          );
        } else {
          window.editor.currentTool.onMouseMove(pos.x, pos.y, e);
        }
      }
      this.lastPos = pos;
      // Hover outline logic
      if (
        this.currentSprite &&
        pos.x >= 0 &&
        pos.x < this.currentSprite.width &&
        pos.y >= 0 &&
        pos.y < this.currentSprite.height
      ) {
        if (
          !this.hoveredPixel ||
          this.hoveredPixel.x !== pos.x ||
          this.hoveredPixel.y !== pos.y
        ) {
          this.hoveredPixel = { x: pos.x, y: pos.y };
          this.renderHoverOutline();
        }
      } else {
        if (this.hoveredPixel) {
          this.hoveredPixel = null;
          // Only clear hover outline, not selection overlay
          if (this.selection.active) {
            this.renderSelection();
          } else {
            this.clearOverlay();
          }
        }
      }
    });

    this.mainCanvas.addEventListener("mouseup", (e) => {
      const pos = this.screenToSprite(e.clientX, e.clientY);
      this.isDrawing = false;

      if (window.editor && window.editor.currentTool) {
        window.editor.currentTool.onMouseUp(pos.x, pos.y, e);
      }
    });

    this.mainCanvas.addEventListener("mouseleave", (e) => {
      this.isDrawing = false;
      if (window.editor && window.editor.currentTool) {
        window.editor.currentTool.onMouseLeave(e);
      }
      // Clear hover outline
      this.hoveredPixel = null;
      // Only clear hover outline, not selection overlay
      if (this.selection.active) {
        this.renderSelection();
      } else {
        this.clearOverlay();
      }
    });

    // Context menu prevention
    this.mainCanvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.target.tagName.toLowerCase() === "input") return;

      switch (e.key.toLowerCase()) {
        case "g":
          if (!e.ctrlKey && !e.metaKey) {
            this.toggleGrid();
          }
          break;
        case "=":
        case "+":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.zoomIn();
          }
          break;
        case "-":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.zoomOut();
          }
          break;
      }
    });

    // Scroll to zoom
    this.mainCanvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        if (e.deltaY < 0) {
          this.zoomIn();
        } else {
          this.zoomOut();
        }
      },
      { passive: false }
    );
  }

  /**
   * Create thumbnail canvas for sprite
   */
  createThumbnail(sprite, size = 64) {
    const thumbnailCanvas = document.createElement("canvas");
    const thumbnailCtx = thumbnailCanvas.getContext("2d");
    thumbnailCanvas.width = size;
    thumbnailCanvas.height = size;

    // Calculate scale to fit sprite in thumbnail while maintaining aspect ratio
    const scale = Math.min(size / sprite.width, size / sprite.height);
    const scaledWidth = sprite.width * scale;
    const scaledHeight = sprite.height * scale;
    const offsetX = (size - scaledWidth) / 2;
    const offsetY = (size - scaledHeight) / 2;

    // Render checkerboard background
    thumbnailCtx.fillStyle = "#ffffff";
    thumbnailCtx.fillRect(offsetX, offsetY, scaledWidth, scaledHeight);

    thumbnailCtx.fillStyle = "#e0e0e0";
    const checkerSize = Math.max(1, scale);
    for (let y = 0; y < sprite.height; y++) {
      for (let x = 0; x < sprite.width; x++) {
        if ((x + y) % 2 === 1) {
          thumbnailCtx.fillRect(
            offsetX + x * scale,
            offsetY + y * scale,
            scale,
            scale
          );
        }
      }
    }

    // Render sprite
    for (let y = 0; y < sprite.height; y++) {
      for (let x = 0; x < sprite.width; x++) {
        const [r, g, b, a] = sprite.getPixel(x, y);

        if (a > 0) {
          thumbnailCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
          thumbnailCtx.fillRect(
            offsetX + x * scale,
            offsetY + y * scale,
            scale,
            scale
          );
        }
      }
    }

    return thumbnailCanvas;
  }

  /**
   * Render hover outline for pixel
   */
  // Modified renderHoverOutline method - don't interfere with scale handles and scale with brush size
  renderHoverOutline() {
    // Don't interfere with drag preview or scaling
    if (
      window.editor &&
      window.editor.currentTool &&
      window.editor.currentTool.name === "select" &&
      (window.editor.currentTool.isDragging ||
        window.editor.currentTool.isScaling)
    ) {
      return;
    }

    // Only clear hover outline, not selection overlay
    if (!this.hoveredPixel || !this.currentSprite) {
      // If selection is active, re-render selection overlay
      if (this.selection.active) {
        this.renderSelection();
      } else {
        this.clearOverlay();
      }
      return;
    }

    // If selection is active, render selection first, then hover outline
    if (this.selection.active) {
      this.renderSelection();
    } else {
      this.clearOverlay();
    }

    const { x, y } = this.hoveredPixel;
    this.overlayCtx.save();

    // Get tool color and size
    let color = "#ff9800";
    let toolSize = 1;

    if (window.editor && window.editor.currentTool) {
      // Get tool size for brush and eraser tools
      if (window.editor.currentTool.size !== undefined) {
        toolSize = window.editor.currentTool.size;
      }

      switch (window.editor.currentTool.name) {
        case "brush":
          color = "#222";
          break;
        case "eraser":
          color = "#e53935";
          break;
        case "bucket":
          color = "#1976d2";
          break;
        case "eyedropper":
          color = "#43a047";
          break;
        case "select":
          color = "#00d4ff";
          break;
        default:
          color = "#ff9800";
      }
    }

    this.overlayCtx.strokeStyle = color;
    this.overlayCtx.lineWidth = 2;

    // Calculate hover outline size based on tool size
    const halfSize = Math.floor(toolSize / 2);
    const outlineSize = toolSize * this.zoomLevel;
    const outlineX = (x - halfSize) * this.zoomLevel;
    const outlineY = (y - halfSize) * this.zoomLevel;

    // Draw outline based on tool size - pixel-perfect circle
    if (toolSize === 1) {
      // Single pixel outline
      this.overlayCtx.strokeRect(
        x * this.zoomLevel + 1,
        y * this.zoomLevel + 1,
        this.zoomLevel - 2,
        this.zoomLevel - 2
      );
    } else {
      // Draw pixel-by-pixel circle outline that matches the brush pattern
      for (let dy = -halfSize; dy <= halfSize; dy++) {
        for (let dx = -halfSize; dx <= halfSize; dx++) {
          const pixelX = x + dx;
          const pixelY = y + dy;

          // Check if this pixel would be affected by the brush (same logic as brush tool)
          const distance = Math.sqrt(dx * dx + dy * dy);
          const isOnEdge =
            distance <= toolSize / 2 && distance > toolSize / 2 - 1;

          // Only draw outline for edge pixels and within sprite bounds
          if (
            isOnEdge &&
            pixelX >= 0 &&
            pixelX < this.currentSprite.width &&
            pixelY >= 0 &&
            pixelY < this.currentSprite.height
          ) {
            this.overlayCtx.strokeRect(
              pixelX * this.zoomLevel + 1,
              pixelY * this.zoomLevel + 1,
              this.zoomLevel - 2,
              this.zoomLevel - 2
            );
          }
        }
      }
    }

    this.overlayCtx.restore();
  }
}
