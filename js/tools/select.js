// Select Tool - For selecting rectangular areas (Layer-compatible version with crop)
class SelectTool {
  constructor(editor) {
    this.editor = editor;
    this.name = "select";
    this.isSelecting = false;
    this.selection = null;
    this.clipboard = null;
    this.isDragging = false;
    this.dragOffset = null;
    this.originalSelection = null;
    this.lastDragPosition = null;

    // Scaling properties
    this.isScaling = false;
    this.scaleHandle = null; // 'nw', 'ne', 'sw', 'se'
    this.originalClipboard = null;
    this.rigidScaling = true; // Default to rigid scaling
  }

  // Get scale handle at position
  _getScaleHandle(x, y) {
    if (!this.selection) return null;

    const handleSize = 8; // Should match CanvasManager handleSize
    const tolerance = Math.ceil(
      handleSize / (2 * this.editor.canvasManager.zoomLevel)
    ); // Convert screen pixels to sprite pixels
    const { left, top, right, bottom } = this.selection;

    // Check each corner with proper positioning
    const corners = [
      { spriteX: left, spriteY: top, type: "nw" },
      { spriteX: right + 1, spriteY: top, type: "ne" }, // +1 because handle is on the edge
      { spriteX: left, spriteY: bottom + 1, type: "sw" }, // +1 because handle is on the edge
      { spriteX: right + 1, spriteY: bottom + 1, type: "se" }, // +1 for both
    ];

    for (const corner of corners) {
      if (
        Math.abs(x - corner.spriteX) <= tolerance &&
        Math.abs(y - corner.spriteY) <= tolerance
      ) {
        return corner.type;
      }
    }

    return null;
  }

  // Handle scaling logic with layers
  _handleScaling(x, y) {
    const { left, top, right, bottom } = this.originalSelection;
    const originalWidth = right - left + 1;
    const originalHeight = bottom - top + 1;

    let newLeft = left,
      newTop = top,
      newRight = right,
      newBottom = bottom;

    // Calculate new bounds based on handle being dragged
    switch (this.scaleHandle) {
      case "nw":
        newLeft = x;
        newTop = y;
        break;
      case "ne":
        newRight = x;
        newTop = y;
        break;
      case "sw":
        newLeft = x;
        newBottom = y;
        break;
      case "se":
        newRight = x;
        newBottom = y;
        break;
    }

    // Ensure minimum size
    if (newRight <= newLeft) newRight = newLeft + 1;
    if (newBottom <= newTop) newBottom = newTop + 1;

    let newWidth = newRight - newLeft + 1;
    let newHeight = newBottom - newTop + 1;

    // Apply rigid scaling if enabled
    if (this.rigidScaling) {
      const scaleX = Math.max(1, Math.round(newWidth / originalWidth));
      const scaleY = Math.max(1, Math.round(newHeight / originalHeight));

      // Use the same scale for both dimensions (maintain aspect ratio)
      const scale = Math.max(scaleX, scaleY);

      switch (this.scaleHandle) {
        case "nw":
          newLeft = right - originalWidth * scale + 1;
          newTop = bottom - originalHeight * scale + 1;
          newRight = right;
          newBottom = bottom;
          break;
        case "ne":
          newLeft = left;
          newTop = bottom - originalHeight * scale + 1;
          newRight = left + originalWidth * scale - 1;
          newBottom = bottom;
          break;
        case "sw":
          newLeft = right - originalWidth * scale + 1;
          newTop = top;
          newRight = right;
          newBottom = top + originalHeight * scale - 1;
          break;
        case "se":
          newLeft = left;
          newTop = top;
          newRight = left + originalWidth * scale - 1;
          newBottom = top + originalHeight * scale - 1;
          break;
      }

      // Recalculate width and height based on rigid scaling
      newWidth = newRight - newLeft + 1;
      newHeight = newBottom - newTop + 1;
    }

    // Update selection bounds
    this.selection = {
      left: newLeft,
      top: newTop,
      right: newRight,
      bottom: newBottom,
    };

    // Create scaled clipboard
    const scaledClipboard = this._createScaledClipboard(
      this.originalClipboard,
      newWidth,
      newHeight
    );

    // Show preview
    this.editor.canvasManager.showDraggedSelectionPreview(
      this.selection,
      scaledClipboard
    );
  }

  // Create scaled clipboard
  _createScaledClipboard(originalClipboard, newWidth, newHeight) {
    const scaledClipboard = {
      width: newWidth,
      height: newHeight,
      pixels: [],
    };

    const scaleX = originalClipboard.width / newWidth;
    const scaleY = originalClipboard.height / newHeight;

    for (let y = 0; y < newHeight; y++) {
      scaledClipboard.pixels[y] = [];
      for (let x = 0; x < newWidth; x++) {
        const srcX = Math.floor(x * scaleX);
        const srcY = Math.floor(y * scaleY);

        // Clamp to bounds
        const clampedX = Math.min(srcX, originalClipboard.width - 1);
        const clampedY = Math.min(srcY, originalClipboard.height - 1);

        scaledClipboard.pixels[y][x] =
          originalClipboard.pixels[clampedY][clampedX];
      }
    }

    return scaledClipboard;
  }

  // Modified onMouseDown - now works with layers
  onMouseDown(x, y, event) {
    if (!this.editor.currentSprite || !this.editor.layerManager) return;

    // Check if clicking on a scale handle
    if (this.selection) {
      const handle = this._getScaleHandle(x, y);
      if (handle) {
        this.isScaling = true;
        this.scaleHandle = handle;
        this.originalSelection = { ...this.selection };
        this.originalClipboard = this._copyFromBounds(this.selection);

        // Clear the original content immediately when scaling starts
        this._deleteBounds(this.selection);
        this.editor.canvasManager.render();

        return;
      }

      // Check if clicking inside selection for dragging
      if (
        x >= this.selection.left &&
        x <= this.selection.right &&
        y >= this.selection.top &&
        y <= this.selection.bottom
      ) {
        this.isDragging = true;
        this.dragOffset = { x, y };
        this.lastDragPosition = { x, y };
        this.originalSelection = { ...this.selection };
        this.dragClipboard = this._copyFromBounds(this.selection);
        this._deleteBounds(this.originalSelection);
        this.editor.canvasManager.render();
        this.editor.canvasManager.showDraggedSelectionPreview(
          this.selection,
          this.dragClipboard
        );
        return;
      }
    }

    // Start new selection
    this.isSelecting = true;
    this.editor.canvasManager.startSelection(x, y);
  }

  // Modified onMouseUp - works with layers
  onMouseUp(x, y, event) {
    if (!this.editor.currentSprite || !this.editor.layerManager) return;

    if (this.isScaling && this.selection && this.originalClipboard) {
      // Start batch operation for scaling
      this.editor.layerManager.startBatchOperation();

      // Clear the preview
      this.editor.canvasManager.clearOverlay();

      // Create final scaled clipboard
      const newWidth = this.selection.right - this.selection.left + 1;
      const newHeight = this.selection.bottom - this.selection.top + 1;
      const scaledClipboard = this._createScaledClipboard(
        this.originalClipboard,
        newWidth,
        newHeight
      );

      // Paste scaled content
      this._pasteClipboardAt(
        scaledClipboard,
        this.selection.left,
        this.selection.top
      );

      // Reset scaling state
      this.isScaling = false;
      this.scaleHandle = null;
      this.originalClipboard = null;

      // End batch operation - this will save to history
      this.editor.layerManager.endBatchOperation();

      // Update CanvasManager selection state
      if (this.editor.canvasManager.selection) {
        this.editor.canvasManager.selection.startX = this.selection.left;
        this.editor.canvasManager.selection.startY = this.selection.top;
        this.editor.canvasManager.selection.endX = this.selection.right;
        this.editor.canvasManager.selection.endY = this.selection.bottom;
        this.editor.canvasManager.selection.active = true;
      }

      // Redraw everything and show handles
      this.editor.canvasManager.render();
      this.editor.canvasManager.renderSelectionBox(this.selection);
      this.editor.updateUI();
    } else if (this.isDragging && this.selection && this.dragClipboard) {
      // Start batch operation for dragging
      this.editor.layerManager.startBatchOperation();

      // Handle regular dragging
      this.editor.canvasManager.clearOverlay();
      this._pasteClipboardAt(
        this.dragClipboard,
        this.selection.left,
        this.selection.top
      );

      this.isDragging = false;
      this.dragOffset = null;
      this.originalSelection = null;
      this.dragClipboard = null;
      this.lastDragPosition = null;

      // End batch operation - this will save to history
      this.editor.layerManager.endBatchOperation();

      if (this.editor.canvasManager.selection) {
        this.editor.canvasManager.selection.startX = this.selection.left;
        this.editor.canvasManager.selection.startY = this.selection.top;
        this.editor.canvasManager.selection.endX = this.selection.right;
        this.editor.canvasManager.selection.endY = this.selection.bottom;
        this.editor.canvasManager.selection.active = true;
      }

      // Redraw everything and show handles
      this.editor.canvasManager.render();
      this.editor.canvasManager.renderSelectionBox(this.selection);
      this.editor.updateUI();
    } else if (this.isSelecting) {
      this.isSelecting = false;
      this.selection = this.editor.canvasManager.getSelectionBounds();
      if (this.selection) {
        if (this.selection.left === this.selection.right) {
          this.selection.right = this.selection.left;
        }
        if (this.selection.top === this.selection.bottom) {
          this.selection.bottom = this.selection.top;
        }

        // Show handles for new selection
        this.editor.canvasManager.renderSelectionBox(this.selection);
        
        // CRITICAL FIX: Update settings UI immediately after selection is created
        this.updateSettingsUI();
      }
    }
  }

  onMouseDrag(x, y, lastX, lastY, event) {
    if (!this.editor.currentSprite || !this.editor.layerManager) return;

    if (this.isScaling && this.selection && this.originalClipboard) {
      this._handleScaling(x, y);
    } else if (this.isDragging && this.selection) {
      // Only update if position actually changed
      if (
        !this.lastDragPosition ||
        this.lastDragPosition.x !== x ||
        this.lastDragPosition.y !== y
      ) {
        // Calculate new selection position
        const dx = x - this.dragOffset.x;
        const dy = y - this.dragOffset.y;
        const width =
          this.originalSelection.right - this.originalSelection.left;
        const height =
          this.originalSelection.bottom - this.originalSelection.top;
        this.selection.left = this.originalSelection.left + dx;
        this.selection.right = this.selection.left + width;
        this.selection.top = this.originalSelection.top + dy;
        this.selection.bottom = this.selection.top + height;

        this.lastDragPosition = { x, y };
        this.editor.canvasManager.showDraggedSelectionPreview(
          this.selection,
          this.dragClipboard
        );
      }
    } else if (this.isSelecting) {
      this.editor.canvasManager.updateSelection(x, y);
    }
  }

  // LAYER-COMPATIBLE: Copy pixels from given bounds using LayerManager
  // LAYER-COMPATIBLE: Copy pixels from given bounds using LayerManager - ACTIVE LAYER ONLY
  _copyFromBounds(bounds) {
    const layerManager = this.editor.layerManager;
    const activeLayer = layerManager.getActiveLayer();

    if (!activeLayer) {
      return { width: 0, height: 0, pixels: [] };
    }

    const width = bounds.right - bounds.left + 1;
    const height = bounds.bottom - bounds.top + 1;
    const clipboard = { width, height, pixels: [] };

    for (let y = 0; y < height; y++) {
      clipboard.pixels[y] = [];
      for (let x = 0; x < width; x++) {
        const srcX = bounds.left + x;
        const srcY = bounds.top + y;
        // Use pixel from active layer only, not composite
        clipboard.pixels[y][x] = layerManager.getPixel(srcX, srcY);
      }
    }
    return clipboard;
  }

  // LAYER-COMPATIBLE: Delete pixels in given bounds on active layer only
  _deleteBounds(bounds) {
    const layerManager = this.editor.layerManager;
    const activeLayer = layerManager.getActiveLayer();

    if (!activeLayer || activeLayer.locked) {
      return; // Can't modify locked layer
    }

    const transparentColor = [0, 0, 0, 0];

    // Enable batch mode for performance
    layerManager.setBatchMode(true);

    for (let y = bounds.top; y <= bounds.bottom; y++) {
      for (let x = bounds.left; x <= bounds.right; x++) {
        if (
          x >= 0 &&
          x < layerManager.width &&
          y >= 0 &&
          y < layerManager.height
        ) {
          layerManager.setPixel(x, y, transparentColor);
        }
      }
    }

    // Disable batch mode and trigger update
    layerManager.setBatchMode(false);
  }

  // LAYER-COMPATIBLE: Paste clipboard at position on active layer
  _pasteClipboardAt(clipboard, left, top) {
    const layerManager = this.editor.layerManager;
    const activeLayer = layerManager.getActiveLayer();

    if (!activeLayer || activeLayer.locked) {
      return; // Can't modify locked layer
    }

    // Enable batch mode for performance
    layerManager.setBatchMode(true);

    for (let py = 0; py < clipboard.height; py++) {
      for (let px = 0; px < clipboard.width; px++) {
        const destX = left + px;
        const destY = top + py;
        if (
          destX >= 0 &&
          destX < layerManager.width &&
          destY >= 0 &&
          destY < layerManager.height
        ) {
          const pixel = clipboard.pixels[py][px];
          if (pixel[3] > 0) {
            // Only paste non-transparent pixels
            layerManager.setPixel(destX, destY, pixel);
          }
        }
      }
    }

    // Disable batch mode and trigger update
    layerManager.setBatchMode(false);
  }

  // Handle mouse move event
  onMouseMove(x, y, event) {
    if (this.isSelecting) {
      this.editor.canvasManager.updateSelection(x, y);
    }
  }

  // Handle mouse leave event
  onMouseLeave(event) {
    if (this.isSelecting) {
      this.isSelecting = false;
      this.selection = this.editor.canvasManager.getSelectionBounds();
    }
    this.lastDragPosition = null;
  }

  // LAYER-COMPATIBLE: Copy selected area to clipboard
  // LAYER-COMPATIBLE: Copy selected area to clipboard - ACTIVE LAYER ONLY
  copy() {
    if (!this.selection || !this.editor.layerManager) return false;

    const layerManager = this.editor.layerManager;
    const activeLayer = layerManager.getActiveLayer();

    if (!activeLayer) return false;

    const width = this.selection.right - this.selection.left + 1;
    const height = this.selection.bottom - this.selection.top + 1;

    this.editor.canvasManager.clearDraggedSelection();

    this.clipboard = {
      width,
      height,
      pixels: [],
    };

    // Copy pixels from active layer only
    for (let y = 0; y < height; y++) {
      this.clipboard.pixels[y] = [];
      for (let x = 0; x < width; x++) {
        const srcX = this.selection.left + x;
        const srcY = this.selection.top + y;
        this.clipboard.pixels[y][x] = layerManager.getPixel(srcX, srcY);
      }
    }

    return true;
  }

  // Cut selected area to clipboard
  cut() {
    if (!this.copy()) return false;

    // Start batch operation for cutting
    this.editor.layerManager.startBatchOperation();

    this.delete();

    // End batch operation - this will save to history
    this.editor.layerManager.endBatchOperation();

    return true;
  }

  // LAYER-COMPATIBLE: Paste from clipboard
  paste(x = 0, y = 0) {
    if (!this.clipboard || !this.editor.layerManager) return false;

    const layerManager = this.editor.layerManager;
    const activeLayer = layerManager.getActiveLayer();

    if (!activeLayer || activeLayer.locked) {
      console.warn("Cannot paste: active layer is locked or doesn't exist");
      return false;
    }

    // Start batch operation for pasting
    layerManager.startBatchOperation();

    // Use selection position if available, otherwise use provided coordinates
    const startX = this.selection ? this.selection.left : x;
    const startY = this.selection ? this.selection.top : y;

    // Paste pixels
    for (let py = 0; py < this.clipboard.height; py++) {
      for (let px = 0; px < this.clipboard.width; px++) {
        const destX = startX + px;
        const destY = startY + py;

        // Only paste if within bounds
        if (
          destX >= 0 &&
          destX < layerManager.width &&
          destY >= 0 &&
          destY < layerManager.height
        ) {
          const pixel = this.clipboard.pixels[py][px];
          // Only paste non-transparent pixels
          if (pixel[3] > 0) {
            layerManager.setPixel(destX, destY, pixel);
          }
        }
      }
    }

    // End batch operation - this will save to history
    layerManager.endBatchOperation();

    // Update canvas
    this.editor.canvasManager.render();
    this.editor.updateUI();

    return true;
  }

  // LAYER-COMPATIBLE: Delete selected area on active layer
  delete() {
    if (!this.selection || !this.editor.layerManager) return false;

    const layerManager = this.editor.layerManager;
    const activeLayer = layerManager.getActiveLayer();

    if (!activeLayer || activeLayer.locked) {
      console.warn("Cannot delete: active layer is locked or doesn't exist");
      return false;
    }

    const transparentColor = [0, 0, 0, 0];

    // Start batch operation for deleting
    layerManager.startBatchOperation();

    // Clear selection area
    for (let y = this.selection.top; y <= this.selection.bottom; y++) {
      for (let x = this.selection.left; x <= this.selection.right; x++) {
        if (
          x >= 0 &&
          x < layerManager.width &&
          y >= 0 &&
          y < layerManager.height
        ) {
          layerManager.setPixel(x, y, transparentColor);
        }
      }
    }

    // End batch operation - this will save to history
    layerManager.endBatchOperation();

    // Update canvas
    this.editor.canvasManager.render();
    this.editor.updateUI();

    return true;
  }

  // LAYER-COMPATIBLE: Fill selected area with color on active layer
  fill(color) {
    if (!this.selection || !this.editor.layerManager) return false;

    const layerManager = this.editor.layerManager;
    const activeLayer = layerManager.getActiveLayer();

    if (!activeLayer || activeLayer.locked) {
      console.warn("Cannot fill: active layer is locked or doesn't exist");
      return false;
    }

    // Start batch operation for filling
    layerManager.startBatchOperation();

    // Fill selection area
    for (let y = this.selection.top; y <= this.selection.bottom; y++) {
      for (let x = this.selection.left; x <= this.selection.right; x++) {
        if (
          x >= 0 &&
          x < layerManager.width &&
          y >= 0 &&
          y < layerManager.height
        ) {
          layerManager.setPixel(x, y, color);
        }
      }
    }

    // End batch operation - this will save to history
    layerManager.endBatchOperation();

    // Update canvas
    this.editor.canvasManager.render();
    this.editor.updateUI();

    return true;
  }

  // NEW: Crop sprite to selection bounds
  crop() {
    if (!this.selection || !this.editor.currentSprite) {
      console.warn("Cannot crop: no selection or current sprite");
      return false;
    }

    const newWidth = this.selection.right - this.selection.left + 1;
    const newHeight = this.selection.bottom - this.selection.top + 1;

    // Validate crop dimensions
    if (newWidth <= 0 || newHeight <= 0) {
      this.editor.uiManager?.showNotification("Invalid crop dimensions", "error");
      return false;
    }

    // Use the editor's cropToSelection method
    const success = this.editor.cropToSelection(this.selection);
    
    if (success) {
      // Clear selection after successful crop
      this.clearSelection();
      this.updateSettingsUI();
      return true;
    }
    
    return false;
  }

  // Clear current selection
  clearSelection() {
    this.selection = null;
    this.lastDragPosition = null;
    this.editor.canvasManager.endSelection();
  }

  // Called when tool is deactivated
  onDeactivate() {
    this.clearSelection();
  }

  // Get selection info
  getSelectionInfo() {
    if (!this.selection) return null;

    return {
      x: this.selection.left,
      y: this.selection.top,
      width: this.selection.right - this.selection.left + 1,
      height: this.selection.bottom - this.selection.top + 1,
      area:
        (this.selection.right - this.selection.left + 1) *
        (this.selection.bottom - this.selection.top + 1),
    };
  }

  // Check if there's an active selection
  hasSelection() {
    return this.selection !== null;
  }

  // Check if there's content in clipboard
  hasClipboard() {
    return this.clipboard !== null;
  }

  // Get tool settings UI elements
  getSettingsHTML() {
    const hasSelection = this.hasSelection();
    const hasClipboard = this.hasClipboard();
    const activeLayer = this.editor.layerManager?.getActiveLayer();
    const isLayerLocked = activeLayer?.locked || false;

    return `
          ${
            isLayerLocked
              ? `<div class="setting-group">
                  <div class="warning-message">
                      <i class="fas fa-lock"></i> Layer locked
                  </div>
               </div>`
              : ""
          }
          
          <div class="setting-group">
              <label>
                  <input type="checkbox" id="rigid-scaling-cb" ${
                    this.rigidScaling ? "checked" : ""
                  }>
                  Rigid Scaling
              </label>
          </div>
          
          <div class="setting-group">
              <button class="btn btn-secondary btn-sm" id="copy-btn" ${
                !hasSelection ? "disabled" : ""
              }>
                  <i class="fas fa-copy"></i>
              </button>
              <button class="btn btn-secondary btn-sm" id="cut-btn" ${
                !hasSelection || isLayerLocked ? "disabled" : ""
              }>
                  <i class="fas fa-cut"></i>
              </button>
              <button class="btn btn-secondary btn-sm" id="paste-btn" ${
                !hasClipboard || isLayerLocked ? "disabled" : ""
              }>
                  <i class="fas fa-paste"></i>
              </button>
              <button class="btn btn-secondary btn-sm" id="delete-btn" ${
                !hasSelection || isLayerLocked ? "disabled" : ""
              }>
                  <i class="fas fa-trash"></i>
              </button>
              <button class="btn btn-secondary btn-sm" id="clear-selection-btn" ${
                !hasSelection ? "disabled" : ""
              }>
                  <i class="fas fa-times"></i>
              </button>
          </div>
          
          <div class="setting-group">
              <button class="btn btn-primary btn-sm" id="crop-btn" ${
                !hasSelection ? "disabled" : ""
              }>
                  <i class="fas fa-crop"></i> Crop to Selection
              </button>
          </div>
      `;
  }

  // Initialize tool settings event listeners
  initializeSettings() {
    const copyBtn = document.getElementById("copy-btn");
    const cutBtn = document.getElementById("cut-btn");
    const pasteBtn = document.getElementById("paste-btn");
    const deleteBtn = document.getElementById("delete-btn");
    const clearSelectionBtn = document.getElementById("clear-selection-btn");
    const cropBtn = document.getElementById("crop-btn");
    const rigidScalingCb = document.getElementById("rigid-scaling-cb");

    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        this.copy();
        this.updateSettingsUI();
      });
    }

    if (cutBtn) {
      cutBtn.addEventListener("click", () => {
        this.cut();
        this.updateSettingsUI();
      });
    }

    if (pasteBtn) {
      pasteBtn.addEventListener("click", () => {
        this.paste();
        this.updateSettingsUI();
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => {
        this.delete();
        this.updateSettingsUI();
      });
    }

    if (clearSelectionBtn) {
      clearSelectionBtn.addEventListener("click", () => {
        this.clearSelection();
        this.updateSettingsUI();
      });
    }

    // NEW: Crop button event listener
    if (cropBtn) {
      cropBtn.addEventListener("click", () => {
        if (confirm("Crop the sprite to the current selection? This cannot be undone.")) {
          this.crop();
        }
      });
    }

    if (rigidScalingCb) {
      rigidScalingCb.addEventListener("change", (e) => {
        this.rigidScaling = e.target.checked;
      });
    }

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (
        this.editor.currentTool === this &&
        !e.target.matches("input, textarea")
      ) {
        const activeLayer = this.editor.layerManager?.getActiveLayer();
        const isLayerLocked = activeLayer?.locked || false;

        switch (e.key.toLowerCase()) {
          case "c":
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              this.copy();
              this.updateSettingsUI();
            }
            break;
          case "x":
            if ((e.ctrlKey || e.metaKey) && !isLayerLocked) {
              e.preventDefault();
              this.cut();
              this.updateSettingsUI();
            }
            break;
          case "v":
            if ((e.ctrlKey || e.metaKey) && !isLayerLocked) {
              e.preventDefault();
              this.paste();
              this.updateSettingsUI();
            }
            break;
          case "delete":
          case "backspace":
            if (!isLayerLocked) {
              e.preventDefault();
              this.delete();
              this.updateSettingsUI();
            }
            break;
          case "escape":
            this.clearSelection();
            this.updateSettingsUI();
            break;
        }
      }
    });
  }

  // Update settings UI
  updateSettingsUI() {
    if (this.editor.currentTool === this) {
      this.editor.updateToolSettings();
    }
  }

  // Get tool cursor
  getCursor() {
    if (this.selection) {
      const handle = this._getScaleHandle(
        this.editor.canvasManager.lastPos?.x || 0,
        this.editor.canvasManager.lastPos?.y || 0
      );
      if (handle) {
        switch (handle) {
          case "nw":
          case "se":
            return "nw-resize";
          case "ne":
          case "sw":
            return "ne-resize";
        }
      }
    }
    return "crosshair";
  }
}