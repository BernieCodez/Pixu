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
  // New method: Render scale handles at selection corners
  renderScaleHandles(selection) {
    if (!selection) return;

    const handleSize = 8; // Size of the handle squares in screen pixels
    const handles = [
      { x: selection.left, y: selection.top, type: "nw" }, // Topleft
      { x: selection.right + 1, y: selection.top, type: "ne" }, // Topright
      { x: selection.left, y: selection.bottom + 1, type: "sw" }, // bottom left
      { x: selection.right + 1, y: selection.bottom + 1, type: "se" }, // bottom right
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
  // New method: Check if position is over a scale handle
  isOverScaleHandle(x, y, selection) {
    if (!selection) return null;

    const handleSize = 8;
    const tolerance = handleSize / 2;

    const handles = [
      { x: selection.left, y: selection.top, type: "nw" },
      { x: selection.right + 1, y: selection.top, type: "ne" }, // Fixed: added + 1
      { x: selection.left, y: selection.bottom + 1, type: "sw" }, // Fixed: added + 1
      { x: selection.right + 1, y: selection.bottom + 1, type: "se" }, // Fixed: added + 1
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

    // Add panning state
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.panStartOffset = { x: 0, y: 0 };
    this.panOffset = { x: 0, y: 0 }; // Make sure this is explicitly set to {x:0, y:0}

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

  /**
   * Start panning
   */
  startPan(screenX, screenY) {
    this.isPanning = true;
    this.panStart = { x: screenX, y: screenY };
    // Capture the current pan offset at the exact moment panning starts
    this.panStartOffset = {
      x: this.panOffset.x || 0,
      y: this.panOffset.y || 0,
    };
    this.mainCanvas.style.cursor = "grabbing";
  }

  updatePan(screenX, screenY) {
    if (!this.isPanning) return;

    // Calculate the delta movement
    const deltaX = screenX - this.panStart.x;
    const deltaY = screenY - this.panStart.y;

    // Apply the delta to the starting offset
    this.panOffset = {
      x: this.panStartOffset.x + deltaX,
      y: this.panStartOffset.y + deltaY,
    };

    // Compose transform properly - preserve existing transforms and add pan
    const transform = `translate(-50%, -50%) translate(${this.panOffset.x}px, ${this.panOffset.y}px)`;
    this.mainCanvas.style.transform = transform;
    this.overlayCanvas.style.transform = transform;
  }
  /**
   * End panning
   */
  endPan() {
    this.isPanning = false;
    this.mainCanvas.style.cursor = "";
  }

  /**
   * Reset pan to center
   */
  resetPan() {
    this.panOffset = { x: 0, y: 0 };
    this.panStartOffset = { x: 0, y: 0 };
    this.isPanning = false;

    // Reset to just the centering transform, removing pan
    this.mainCanvas.style.transform = "translate(-50%, -50%)";
    this.overlayCanvas.style.transform = "translate(-50%, -50%)";
    this.mainCanvas.style.cursor = "";
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

    if (window.editor && window.editor.layerManager) {
      this.layerManager = window.editor.layerManager;
    }

    // Reset pan when sprite changes to avoid coordinate issues
    this.resetPan();

    // Always update canvas size to match sprite dimensions
    this.mainCanvas.width = sprite.width * this.zoomLevel;
    this.mainCanvas.height = sprite.height * this.zoomLevel;
    this.overlayCanvas.width = sprite.width * this.zoomLevel;
    this.overlayCanvas.height = sprite.height * this.zoomLevel;
    this.mainCanvas.style.width = `${sprite.width * this.zoomLevel}px`;
    this.mainCanvas.style.height = `${sprite.height * this.zoomLevel}px`;
    this.overlayCanvas.style.width = `${sprite.width * this.zoomLevel}px`;
    this.overlayCanvas.style.height = `${sprite.height * this.zoomLevel}px`;

    this.render();
    this.updateCanvasData();
  }

  /**
   * Debug function to continuously monitor pan state
   */
  startPanDebug() {
    if (this.debugInterval) {
      clearInterval(this.debugInterval);
    }

    this.debugInterval = setInterval(() => {
      const mainRect = this.mainCanvas.getBoundingClientRect();
      const overlayRect = this.overlayCanvas.getBoundingClientRect();

      console.log("Pan Debug:", {
        panOffset: this.panOffset,
        panStartOffset: this.panStartOffset,
        isPanning: this.isPanning,
        mainCanvasRect: {
          left: mainRect.left,
          top: mainRect.top,
          width: mainRect.width,
          height: mainRect.height,
          transform: this.mainCanvas.style.transform,
        },
        overlayCanvasRect: {
          left: overlayRect.left,
          top: overlayRect.top,
          width: overlayRect.width,
          height: overlayRect.height,
          transform: this.overlayCanvas.style.transform,
        },
        // Show the difference from expected center position
        expectedCenter: {
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        },
        actualCenter: {
          x: mainRect.left + mainRect.width / 2,
          y: mainRect.top + mainRect.height / 2,
        },
      });
    }, 100);
  }

  /**
   * Stop pan debugging
   */
  stopPanDebug() {
    if (this.debugInterval) {
      clearInterval(this.debugInterval);
      this.debugInterval = null;
    }
  }

  /**
   * Render the current sprite to canvas
   */
  /**
   * Render the current sprite to canvas with optimizations
   */
  // Replace the existing render() method in CanvasManager
  render() {
    if (!this.currentSprite) {
      this.clearCanvas();
      return;
    }

    // Clear canvas
    this.mainCtx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);

    // Use layer manager if available
    if (window.editor && window.editor.layerManager) {
      this.renderWithLayers();
    } else {
      // Fallback to original rendering
      this.renderTransparencyBackground();
      this.renderSprite();
    }

    // Render grid if enabled
    if (this.showGrid && this.zoomLevel >= 4) {
      this.renderGrid();
    }
  }

  // Add new method for layer-based rendering
  renderWithLayers() {
    // Render checkerboard background
    this.renderTransparencyBackground();

    // Get composite image data from layer manager
    const imageData = window.editor.layerManager.getCompositeImageData();

    // Use createImageBitmap for better performance if available
    if (
      window.createImageBitmap &&
      this.currentSprite.width * this.currentSprite.height > 10000
    ) {
      createImageBitmap(imageData).then((bitmap) => {
        this.mainCtx.imageSmoothingEnabled = false;
        this.mainCtx.drawImage(
          bitmap,
          0,
          0,
          imageData.width,
          imageData.height,
          0,
          0,
          this.mainCanvas.width,
          this.mainCanvas.height
        );
        bitmap.close();
      });
    } else {
      // Create temporary canvas for scaling
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = imageData.width;
      tempCanvas.height = imageData.height;
      const tempCtx = tempCanvas.getContext("2d");
      tempCtx.putImageData(imageData, 0, 0);

      // Disable smoothing for pixel-perfect scaling
      this.mainCtx.imageSmoothingEnabled = false;

      // Draw scaled composite
      this.mainCtx.drawImage(
        tempCanvas,
        0,
        0,
        imageData.width,
        imageData.height,
        0,
        0,
        this.mainCanvas.width,
        this.mainCanvas.height
      );
    }
  }
  /**
   * Optimized rendering for large sprites using ImageData
   */
  renderLargeSprite() {
    const imageData = this.mainCtx.createImageData(
      this.mainCanvas.width,
      this.mainCanvas.height
    );
    const data = imageData.data;

    // Render checkerboard background
    for (let canvasY = 0; canvasY < this.mainCanvas.height; canvasY++) {
      for (let canvasX = 0; canvasX < this.mainCanvas.width; canvasX++) {
        const spriteX = Math.floor(canvasX / this.zoomLevel);
        const spriteY = Math.floor(canvasY / this.zoomLevel);
        const pixelIndex = (canvasY * this.mainCanvas.width + canvasX) * 4;

        // Checkerboard background
        const isChecker = (Math.floor(spriteX) + Math.floor(spriteY)) % 2 === 1;
        const bgColor = isChecker ? 224 : 255; // #e0e0e0 or #ffffff

        if (
          spriteX >= 0 &&
          spriteX < this.currentSprite.width &&
          spriteY >= 0 &&
          spriteY < this.currentSprite.height
        ) {
          const [r, g, b, a] = this.currentSprite.getPixel(spriteX, spriteY);

          if (a > 0) {
            // Alpha blend with background
            const alpha = a / 255;
            data[pixelIndex] = r * alpha + bgColor * (1 - alpha);
            data[pixelIndex + 1] = g * alpha + bgColor * (1 - alpha);
            data[pixelIndex + 2] = b * alpha + bgColor * (1 - alpha);
            data[pixelIndex + 3] = 255;
          } else {
            // Just background
            data[pixelIndex] = bgColor;
            data[pixelIndex + 1] = bgColor;
            data[pixelIndex + 2] = bgColor;
            data[pixelIndex + 3] = 255;
          }
        } else {
          // Outside sprite bounds
          data[pixelIndex] = bgColor;
          data[pixelIndex + 1] = bgColor;
          data[pixelIndex + 2] = bgColor;
          data[pixelIndex + 3] = 255;
        }
      }
    }

    this.mainCtx.putImageData(imageData, 0, 0);
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
  /**
   * Optimized sprite rendering with viewport culling
   */
  renderSprite() {
    // For very large sprites, only render visible pixels
    if (
      this.currentSprite.width * this.currentSprite.height > 50000 &&
      this.viewport
    ) {
      const startX = Math.max(0, Math.floor(this.viewport.x / this.zoomLevel));
      const endX = Math.min(
        this.currentSprite.width,
        Math.ceil((this.viewport.x + this.viewport.width) / this.zoomLevel)
      );
      const startY = Math.max(0, Math.floor(this.viewport.y / this.zoomLevel));
      const endY = Math.min(
        this.currentSprite.height,
        Math.ceil((this.viewport.y + this.viewport.height) / this.zoomLevel)
      );

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
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
    } else {
      // Original rendering for smaller sprites
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
  /**
   * Convert screen coordinates to sprite coordinates
   */
  screenToSprite(screenX, screenY) {
    const rect = this.mainCanvas.getBoundingClientRect();
    // Account for pan offset when converting coordinates
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
    this.updateZoomDisplay(); // Add this line
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
   * Set viewport for large canvas optimization
   */
  setViewport(x, y, width, height) {
    this.viewport = { x, y, width, height };
  }

  /**
   * Check if a pixel is in the current viewport
   */
  isInViewport(x, y) {
    if (!this.viewport) return true;

    const screenX = x * this.zoomLevel;
    const screenY = y * this.zoomLevel;

    return (
      screenX >= this.viewport.x - this.zoomLevel &&
      screenX <= this.viewport.x + this.viewport.width + this.zoomLevel &&
      screenY >= this.viewport.y - this.zoomLevel &&
      screenY <= this.viewport.y + this.viewport.height + this.zoomLevel
    );
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
    this.mainCanvas.addEventListener("mousedown", (e) => {
      const pos = this.screenToSprite(e.clientX, e.clientY);

      // Handle middle mouse button for panning
      if (e.button === 1) {
        // Middle mouse button
        e.preventDefault();
        this.startPan(e.clientX, e.clientY);
        return;
      }

      this.isDrawing = true;
      this.lastPos = pos;

      if (window.editor && window.editor.currentTool) {
        window.editor.currentTool.onMouseDown(pos.x, pos.y, e);
      }
    });
    this.mainCanvas.addEventListener("mousemove", (e) => {
      // Handle panning
      if (this.isPanning) {
        this.updatePan(e.clientX, e.clientY);
        return;
      }

      const pos = this.screenToSprite(e.clientX, e.clientY);

      // Update mouse coordinates display
      this.updateMouseCoordinates(pos.x, pos.y); // Add this line

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

    // Mouse events on main canvas

    this.mainCanvas.addEventListener("mouseup", (e) => {
      // Handle middle mouse button release
      if (e.button === 1) {
        this.endPan();
        return;
      }

      const pos = this.screenToSprite(e.clientX, e.clientY);
      this.isDrawing = false;

      if (window.editor && window.editor.currentTool) {
        window.editor.currentTool.onMouseUp(pos.x, pos.y, e);
      }
    });

    this.mainCanvas.addEventListener("mouseleave", (e) => {
      this.isDrawing = false;
      this.endPan(); // Stop panning if mouse leaves canvas

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
        case "r":
          if (!e.ctrlKey && !e.metaKey) {
            this.resetPan(); // Reset pan with 'R' key
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

    // Disable smoothing for pixel-perfect scaling
    thumbnailCtx.imageSmoothingEnabled = false;

    // Initialize with first frame
    this.renderThumbnailFrame(thumbnailCtx, sprite, 0, size);

    // Add animation support if sprite has multiple frames
    if (sprite.frames && sprite.frames.length > 1) {
      this.setupThumbnailAnimation(thumbnailCanvas, thumbnailCtx, sprite, size);
    }

    return thumbnailCanvas;
  }
  renderThumbnailFrame(ctx, sprite, frameIndex, size) {
    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Get frame data
    let frameData;
    if (sprite.frames && sprite.frames[frameIndex]) {
      frameData = sprite.frames[frameIndex];
    } else {
      // Fallback to sprite pixel data for non-animated sprites
      frameData = {
        width: sprite.width,
        height: sprite.height,
        layers: [
          {
            visible: true,
            opacity: 1,
            pixels: sprite.getPixelArray
              ? sprite.getPixelArray()
              : this.getSpritePixelArray(sprite),
          },
        ],
      };
    }

    // Calculate scale to fit sprite in thumbnail while maintaining aspect ratio
    const scale = Math.min(size / frameData.width, size / frameData.height);
    const scaledWidth = frameData.width * scale;
    const scaledHeight = frameData.height * scale;
    const offsetX = (size - scaledWidth) / 2;
    const offsetY = (size - scaledHeight) / 2;

    // Render checkerboard background for transparency
    this.renderThumbnailBackground(
      ctx,
      offsetX,
      offsetY,
      scaledWidth,
      scaledHeight,
      scale
    );

    // Render all visible layers for this frame
    for (const layer of frameData.layers) {
      if (!layer.visible) continue;

      const layerOpacity = layer.opacity || 1;

      for (let y = 0; y < frameData.height; y++) {
        for (let x = 0; x < frameData.width; x++) {
          const pixel = layer.pixels[y] && layer.pixels[y][x];
          if (!pixel) continue;

          const [r, g, b, a] = pixel;
          if (a > 0) {
            const finalAlpha = (a / 255) * layerOpacity;
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${finalAlpha})`;

            // Use Math.ceil for scale to avoid gaps in scaled pixels
            const pixelWidth = Math.ceil(scale);
            const pixelHeight = Math.ceil(scale);

            ctx.fillRect(
              offsetX + x * scale,
              offsetY + y * scale,
              pixelWidth,
              pixelHeight
            );
          }
        }
      }
    }
  }

  getSpritePixelArray(sprite) {
    const pixels = [];
    for (let y = 0; y < sprite.height; y++) {
      pixels[y] = [];
      for (let x = 0; x < sprite.width; x++) {
        pixels[y][x] = sprite.getPixel ? sprite.getPixel(x, y) : [0, 0, 0, 0];
      }
    }
    return pixels;
  }

  /**
   * Create thumbnail with custom frame rate for animation
   */
  createThumbnailWithFrameRate(sprite, size = 64, frameRate = 12) {
    const thumbnail = this.createThumbnail(sprite, size);

    // Override the frame rate for this specific thumbnail
    if (sprite.frames && sprite.frames.length > 1) {
      const originalEnter = thumbnail.onmouseenter;
      thumbnail.onmouseenter = function (e) {
        // Custom animation logic with specific frame rate
        let currentFrame = 0;
        let animationInterval = null;

        const frameTime = 1000 / frameRate;
        animationInterval = setInterval(() => {
          currentFrame = (currentFrame + 1) % sprite.frames.length;
          // Re-render with new frame
          const ctx = this.getContext("2d");
          window.editor.canvasManager.renderThumbnailFrame(
            ctx,
            sprite,
            currentFrame,
            size
          );
        }, frameTime);

        this._customInterval = animationInterval;
      };

      thumbnail.onmouseleave = function (e) {
        if (this._customInterval) {
          clearInterval(this._customInterval);
          this._customInterval = null;
        }
        // Reset to first frame
        const ctx = this.getContext("2d");
        window.editor.canvasManager.renderThumbnailFrame(ctx, sprite, 0, size);
      };
    }

    return thumbnail;
  }

  /**
   * Batch create thumbnails for multiple sprites (optimized for sprite lists)
   */
  createThumbnailBatch(sprites, size = 64, callback) {
    const thumbnails = [];
    let processed = 0;

    const processBatch = () => {
      const batchSize = 5; // Process 5 thumbnails per frame to avoid blocking UI
      const endIndex = Math.min(processed + batchSize, sprites.length);

      for (let i = processed; i < endIndex; i++) {
        thumbnails[i] = this.createThumbnail(sprites[i], size);
      }

      processed = endIndex;

      if (processed < sprites.length) {
        // Schedule next batch
        requestAnimationFrame(processBatch);
      } else {
        // All done, call callback
        if (callback) callback(thumbnails);
      }
    };

    // Start processing
    requestAnimationFrame(processBatch);

    return thumbnails; // Returns array that will be populated asynchronously
  }

  renderThumbnailBackground(ctx, offsetX, offsetY, width, height, scale) {
    const checkerSize = Math.max(2, scale);

    // Fill with white background first
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(offsetX, offsetY, width, height);

    // Add checkerboard pattern
    ctx.fillStyle = "#e0e0e0";
    const checkersX = Math.ceil(width / checkerSize);
    const checkersY = Math.ceil(height / checkerSize);

    for (let cy = 0; cy < checkersY; cy++) {
      for (let cx = 0; cx < checkersX; cx++) {
        if ((cx + cy) % 2 === 1) {
          ctx.fillRect(
            offsetX + cx * checkerSize,
            offsetY + cy * checkerSize,
            checkerSize,
            checkerSize
          );
        }
      }
    }
  }

  /**
   * Setup hover animation for thumbnail
   */
  setupThumbnailAnimation(canvas, ctx, sprite, size) {
    let animationInterval = null;
    let currentFrame = 0;
    let isAnimating = false;

    // Mouse enter - start animation
    canvas.addEventListener("mouseenter", () => {
      if (isAnimating) return;

      isAnimating = true;
      currentFrame = 0;

      // Calculate frame rate (default to 12 FPS, but use animation manager's rate if available)
      let frameRate = 12;
      if (window.editor && window.editor.animationManager) {
        frameRate = window.editor.animationManager.frameRate;
      }

      const frameTime = 1000 / frameRate;

      animationInterval = setInterval(() => {
        currentFrame = (currentFrame + 1) % sprite.frames.length;
        this.renderThumbnailFrame(ctx, sprite, currentFrame, size);
      }, frameTime);
    });

    // Mouse leave - stop animation and return to first frame
    canvas.addEventListener("mouseleave", () => {
      if (animationInterval) {
        clearInterval(animationInterval);
        animationInterval = null;
      }

      isAnimating = false;
      currentFrame = 0;
      this.renderThumbnailFrame(ctx, sprite, 0, size);
    });

    // Add visual indication that this thumbnail is animated
    this.addAnimationIndicator(canvas, ctx, size);
  }

  /**
   * Add small indicator to show this thumbnail has animation
   */
  addAnimationIndicator(canvas, ctx, size) {
    // Draw small play icon in bottom-right corner
    const iconSize = Math.max(8, size / 8);
    const margin = 2;
    const x = size - iconSize - margin;
    const y = size - iconSize - margin;

    // Semi-transparent background
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(x - 1, y - 1, iconSize + 2, iconSize + 2);

    // White play triangle
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(x + 1, y + 1);
    ctx.lineTo(x + iconSize - 1, y + iconSize / 2);
    ctx.lineTo(x + 1, y + iconSize - 1);
    ctx.closePath();
    ctx.fill();
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
        case "brightness":
          color = "#ffd900ff";
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
  // Update canvas data display
  updateCanvasData() {
    this.updateZoomDisplay();
    this.updateFrameDisplay();
    this.updateCanvasDimensions();
  }

  // Update zoom display
  updateZoomDisplay() {
    const zoomElement = document.getElementById("current-zoom");
    if (zoomElement) {
      zoomElement.textContent = `Zoom: ${this.zoomLevel}x`;
    }
  }

  // Update frame display
  updateFrameDisplay() {
    const frameElement = document.getElementById("current-frame");
    if (frameElement && this.currentSprite) {
      let currentFrame = 1;
      let totalFrames = 1;

      if (this.currentSprite.frames && this.currentSprite.frames.length > 0) {
        totalFrames = this.currentSprite.frames.length;

        // Get current frame from animation manager if available
        if (window.editor && window.editor.animationManager) {
          currentFrame = window.editor.animationManager.currentFrameIndex + 1;
        }
      }

      frameElement.textContent = `Frame: ${currentFrame}/${totalFrames}`;
    }
  }

  // Update canvas dimensions display
  updateCanvasDimensions() {
    const dimensionsElement = document.getElementById("canvas-dimensions");
    if (dimensionsElement && this.currentSprite) {
      dimensionsElement.textContent = `Canvas: ${this.currentSprite.width} x ${this.currentSprite.height}`;
    }
  }

  // Update mouse coordinates display
  updateMouseCoordinates(x, y) {
    const coordsElement = document.getElementById("mouse-coordinates");
    if (coordsElement) {
      if (
        x !== null &&
        y !== null &&
        this.currentSprite &&
        x >= 0 &&
        x < this.currentSprite.width &&
        y >= 0 &&
        y < this.currentSprite.height
      ) {
        coordsElement.textContent = `Cursor X & Y: (${x}, ${y})`;
      } else {
        coordsElement.textContent = `Cursor X & Y: (--, --)`;
      }
    }
  }
}
