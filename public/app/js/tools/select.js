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
    this.scaleHandle = null;
    this.originalClipboard = null;
    this.rigidScaling = true;

    // NEW: Rotation properties
    this.isRotating = false;
    this.rotationAngle = 0;
    this.rotationCenter = null;

    // OPTIMIZATION: Throttle visual updates for large selections
    this._updateThrottleId = null;
    this._lastUpdateTime = 0;
    this._updateThrottleMs = 16; // ~60fps max
  }

  // Get scale handle at position
  // Get scale handle at position with improved tolerance for small selections
  _getScaleHandle(x, y) {
    if (!this.selection) return null;

    const handleSize = 8; // Should match CanvasManager handleSize
    const basePixelTolerance = Math.ceil(
      handleSize / (2 * this.editor.canvasManager.zoomLevel)
    );

    // For very small selections, reduce handle tolerance to allow dragging
    const selectionWidth = this.selection.right - this.selection.left + 1;
    const selectionHeight = this.selection.bottom - this.selection.top + 1;
    const isSmallSelection = selectionWidth <= 4 || selectionHeight <= 4;

    // Reduce tolerance for small selections to prioritize dragging over resizing
    const tolerance = isSmallSelection
      ? Math.max(1, Math.floor(basePixelTolerance * 0.6))
      : basePixelTolerance;

    const { left, top, right, bottom } = this.selection;

    // Check each corner with proper positioning
    const corners = [
      { spriteX: left, spriteY: top, type: "nw" },
      { spriteX: right + 1, spriteY: top, type: "ne" },
      { spriteX: left, spriteY: bottom + 1, type: "sw" },
      { spriteX: right + 1, spriteY: bottom + 1, type: "se" },
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

  // Check if position is inside selection bounds (for dragging)
  _isInsideSelection(x, y) {
    if (!this.selection) return false;

    return (
      x >= this.selection.left &&
      x <= this.selection.right &&
      y >= this.selection.top &&
      y <= this.selection.bottom
    );
  }

  // Check if we're over a rotation handle (if implemented in CanvasManager)
  _isOverRotationHandle(x, y) {
    if (!this.selection) return false;

    // Check if CanvasManager has rotation handle detection
    if (this.editor.canvasManager.isOverRotationHandle) {
      return this.editor.canvasManager.isOverRotationHandle(
        x,
        y,
        this.selection
      );
    }

    return false;
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
  // Modified onMouseDown - clear any existing selection display first
  // Modified onMouseDown - better handle priority for small selections
  onMouseDown(x, y, event) {
    if (!this.editor.currentSprite || !this.editor.layerManager) return;

    // Check if we have a selection and the click is outside it
    if (this.selection && this._isClickOutsideSelection(x, y)) {
      // Merge selection layer back to the layer below and clear selection
      if (this.selectionLayerIndex !== undefined) {
        this._mergeSelectionToLayerBelow();
      }
      this.clearSelection();
      this.updateSettingsUI();
      return;
    }

    // Priority 1: Check rotation handle (highest priority)
    if (this.selection && this._isOverRotationHandle(x, y)) {
      this.isRotating = true;
      this.rotationCenter = {
        x: (this.selection.left + this.selection.right + 1) / 2,
        y: (this.selection.top + this.selection.bottom + 1) / 2,
      };
      this._setCursor("alias");
      return;
    }

    // Priority 2: Check resize handles (but with reduced priority for small selections)
    if (this.selection) {
      const handle = this._getScaleHandle(x, y);
      const selectionWidth = this.selection.right - this.selection.left + 1;
      const selectionHeight = this.selection.bottom - this.selection.top + 1;
      const isSmallSelection = selectionWidth <= 4 || selectionHeight <= 4;

      // For small selections, only allow resizing if we're clearly on the handle edge
      // and not in the center area where dragging should take priority
      if (handle && (!isSmallSelection || this._isOnSelectionEdge(x, y))) {
        this.isScaling = true;
        this.scaleHandle = handle;
        this.originalSelection = { ...this.selection };
        this.originalClipboard = this._copyFromBounds(this.selection);

        // Clear the original content immediately when scaling starts
        this._deleteBounds(this.selection);
        this.editor.canvasManager.render();

        // Set appropriate resize cursor
        const cursor =
          handle === "nw" || handle === "se" ? "nw-resize" : "ne-resize";
        this._setCursor(cursor);
        return;
      }

      // Priority 3: Check dragging (inside selection)
      if (this._isInsideSelection(x, y)) {
        this.isDragging = true;
        this.dragOffset = { x, y };
        this.lastDragPosition = { x, y };
        this.originalSelection = { ...this.selection };

        // If we have a selection layer, use its pixels for dragging
        if (this.selectionLayerIndex !== undefined) {
          this.dragClipboard = this._copyFromBounds(
            this.selection,
            this.selectionLayerIndex
          );
          this._deleteBounds(this.selection, this.selectionLayerIndex);
        } else {
          this.dragClipboard = this._copyFromBounds(this.selection);
          this._deleteBounds(this.originalSelection);
        }

        this.editor.canvasManager.render();
        this.editor.canvasManager.showDraggedSelectionPreview(
          this.selection,
          this.dragClipboard
        );

        this._setCursor("move");
        return;
      }
    }

    // Start new selection
    this.isSelecting = true;
    this._setCursor("crosshair");
    this.editor.canvasManager.startSelection(x, y);
  }

  // Modified onMouseUp - works with layers
  onMouseUp(x, y, event) {
    if (!this.editor.currentSprite || !this.editor.layerManager) return;

    if (this.isRotating) {
      // Handle rotation release
      this.isRotating = false;
      this.rotationCenter = null;
      return;
    }

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
        this.editor.canvasManager.selection.bottom = this.selection.bottom;
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

        // NEW: Create a new layer for the selection and copy pixels to it
        this._createSelectionLayer();

        // Show handles for new selection
        this.editor.canvasManager.renderSelectionBox(this.selection);

        // Update settings UI immediately after selection is created
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

  // Check if position is on the edge of the selection (for resize handle priority)
  _isOnSelectionEdge(x, y) {
    if (!this.selection) return false;

    const { left, top, right, bottom } = this.selection;
    const edgeTolerance = 1; // How close to edge counts as "on edge"

    // Check if we're near any edge
    const nearLeftEdge = Math.abs(x - left) <= edgeTolerance;
    const nearRightEdge = Math.abs(x - (right + 1)) <= edgeTolerance;
    const nearTopEdge = Math.abs(y - top) <= edgeTolerance;
    const nearBottomEdge = Math.abs(y - (bottom + 1)) <= edgeTolerance;

    // We're on an edge if we're near a corner (both horizontal and vertical edges)
    return (nearLeftEdge || nearRightEdge) && (nearTopEdge || nearBottomEdge);
  }
  // Called when tool is deactivated
  onDeactivate() {
    this.clearSelection();
    this._setCursor("default"); // Reset cursor when tool is deactivated
  }

  // Create a new layer for the selection
  _createSelectionLayer() {
    if (!this.selection || !this.editor.layerManager) return;

    const currentLayer = this.editor.layerManager.getActiveLayer();
    if (!currentLayer) return;

    // Copy the selected pixels from the current layer
    const selectionClipboard = this._copyFromBounds(this.selection);

    // Check if selection contains any non-transparent pixels
    let hasVisiblePixels = false;
    for (let y = 0; y < selectionClipboard.height && !hasVisiblePixels; y++) {
      for (let x = 0; x < selectionClipboard.width && !hasVisiblePixels; x++) {
        if (selectionClipboard.pixels[y][x][3] > 0) {
          hasVisiblePixels = true;
        }
      }
    }

    // Only create a new layer if there are visible pixels to move
    if (hasVisiblePixels) {
      // Create a new layer above the current one
      const currentIndex = this.editor.layerManager.activeLayerIndex;
      const newLayer = this.editor.layerManager.addLayer(
        `Selection from ${currentLayer.name}`,
        currentIndex + 1
      );

      if (newLayer) {
        // Set the new layer as active
        this.editor.layerManager.setActiveLayer(currentIndex + 1);

        // Clear the new layer first
        this.editor.layerManager.clearLayer();

        // Paste the selection to the new layer
        this.editor.layerManager.setBatchMode(true);
        this._pasteClipboardAt(
          selectionClipboard,
          this.selection.left,
          this.selection.top
        );
        this.editor.layerManager.setBatchMode(false);

        // Clear the selection area from the original layer
        const originalLayerIndex = currentIndex;
        this._deleteBounds(this.selection, originalLayerIndex);

        // Store reference to the selection layer for future operations
        this.selectionLayerIndex = currentIndex + 1;

        // Update UI to reflect the new layer
        this.editor.updateUI();
      }
    }
  }

  // Check if a layer contains only transparent pixels
  _isLayerEmpty(layer) {
    if (!layer || !layer.pixels) return true;

    for (let y = 0; y < layer.pixels.length; y++) {
      for (let x = 0; x < layer.pixels[y].length; x++) {
        if (layer.pixels[y][x][3] > 0) {
          return false;
        }
      }
    }
    return true;
  }

  // Check if a click is outside the current selection
  _isClickOutsideSelection(x, y) {
    if (!this.selection) return true;

    return (
      x < this.selection.left ||
      x > this.selection.right ||
      y < this.selection.top ||
      y > this.selection.bottom
    );
  }

  // Merge selection layer back to the layer below
  _mergeSelectionToLayerBelow() {
    if (this.selectionLayerIndex === undefined) return false;

    const layerManager = this.editor.layerManager;
    const selectionLayer = layerManager.getLayer(this.selectionLayerIndex);

    if (!selectionLayer || this.selectionLayerIndex === 0) {
      // Can't merge if no selection layer or it's the bottom layer
      return false;
    }

    const targetLayerIndex = this.selectionLayerIndex - 1;
    const targetLayer = layerManager.getLayer(targetLayerIndex);

    if (!targetLayer || targetLayer.locked) {
      this.editor.uiManager?.showNotification(
        "Cannot merge: target layer is locked",
        "warning"
      );
      return false;
    }

    // Start batch operation for merging
    layerManager.startBatchOperation();

    try {
      // Merge pixels from selection layer to target layer
      for (let y = 0; y < layerManager.height; y++) {
        for (let x = 0; x < layerManager.width; x++) {
          const selectionPixel = selectionLayer.pixels[y][x];

          // Only merge non-transparent pixels
          if (selectionPixel[3] > 0) {
            const targetPixel = targetLayer.pixels[y][x];

            // If selection pixel is fully opaque, just copy it
            if (selectionPixel[3] === 255) {
              targetLayer.pixels[y][x] = [...selectionPixel];
            } else {
              // Alpha blend the pixels
              const srcAlpha = selectionPixel[3] / 255;
              const dstAlpha = targetPixel[3] / 255;
              const outAlpha = srcAlpha + dstAlpha * (1 - srcAlpha);

              if (outAlpha > 0) {
                targetLayer.pixels[y][x] = [
                  Math.round(
                    (selectionPixel[0] * srcAlpha +
                      targetPixel[0] * dstAlpha * (1 - srcAlpha)) /
                      outAlpha
                  ),
                  Math.round(
                    (selectionPixel[1] * srcAlpha +
                      targetPixel[1] * dstAlpha * (1 - srcAlpha)) /
                      outAlpha
                  ),
                  Math.round(
                    (selectionPixel[2] * srcAlpha +
                      targetPixel[2] * dstAlpha * (1 - srcAlpha)) /
                      outAlpha
                  ),
                  Math.round(outAlpha * 255),
                ];
              }
            }
          }
        }
      }

      // Remove the selection layer
      layerManager.deleteLayer(this.selectionLayerIndex);

      // Set the target layer as active
      layerManager.setActiveLayer(targetLayerIndex);

      // Clear selection state
      this.selectionLayerIndex = undefined;

      // End batch operation - this will save to history
      layerManager.endBatchOperation();

      // Update UI
      this.editor.updateUI();

      return true;
    } catch (error) {
      console.error("Error merging selection layer:", error);
      layerManager.endBatchOperation();
      return false;
    }
  }
  // LAYER-COMPATIBLE: Copy pixels from given bounds using LayerManager
  // LAYER-COMPATIBLE: Copy pixels from given bounds using LayerManager - ACTIVE LAYER ONLY
  // LAYER-COMPATIBLE: Copy pixels from given bounds using LayerManager - specified layer or active layer
  // OPTIMIZED: Faster copying for large selections
  _copyFromBounds(bounds, layerIndex = null) {
    const layerManager = this.editor.layerManager;
    const targetIndex =
      layerIndex !== null ? layerIndex : layerManager.activeLayerIndex;
    const targetLayer = layerManager.getLayer(targetIndex);

    if (!targetLayer) {
      return { width: 0, height: 0, pixels: [] };
    }

    const width = bounds.right - bounds.left + 1;
    const height = bounds.bottom - bounds.top + 1;
    const clipboard = { width, height, pixels: [] };

    // OPTIMIZATION: Pre-allocate array for large selections
    const selectionArea = width * height;
    
    if (selectionArea > 1000) {
      // For large selections, use optimized copying
      const transparentPixel = [0, 0, 0, 0];
      
      for (let y = 0; y < height; y++) {
        const srcY = bounds.top + y;
        const row = [];
        clipboard.pixels[y] = row;
        
        if (targetLayer.pixels[srcY]) {
          for (let x = 0; x < width; x++) {
            const srcX = bounds.left + x;
            const pixel = targetLayer.pixels[srcY][srcX];
            // Use slice() for better performance than spread operator
            row[x] = pixel ? pixel.slice() : transparentPixel.slice();
          }
        } else {
          // Fill with transparent pixels if row doesn't exist
          for (let x = 0; x < width; x++) {
            row[x] = transparentPixel.slice();
          }
        }
      }
    } else {
      // For small selections, use the original method
      for (let y = 0; y < height; y++) {
        clipboard.pixels[y] = [];
        for (let x = 0; x < width; x++) {
          const srcX = bounds.left + x;
          const srcY = bounds.top + y;
          // Use pixel from specified layer
          if (targetLayer.pixels[srcY] && targetLayer.pixels[srcY][srcX]) {
            clipboard.pixels[y][x] = [...targetLayer.pixels[srcY][srcX]];
          } else {
            clipboard.pixels[y][x] = [0, 0, 0, 0];
          }
        }
      }
    }
    
    return clipboard;
  }

  // LAYER-COMPATIBLE: Delete pixels in given bounds on active layer only
  // LAYER-COMPATIBLE: Delete pixels in given bounds on specified layer
  // OPTIMIZED: Uses typed arrays for large selections to reduce memory allocation
  _deleteBounds(bounds, layerIndex = null) {
    const layerManager = this.editor.layerManager;
    const targetIndex =
      layerIndex !== null ? layerIndex : layerManager.activeLayerIndex;
    const targetLayer = layerManager.getLayer(targetIndex);

    if (!targetLayer || targetLayer.locked) {
      return; // Can't modify locked layer
    }

    const transparentColor = [0, 0, 0, 0];

    // Enable batch mode for performance
    layerManager.setBatchMode(true);

    // OPTIMIZATION: Pre-calculate bounds to avoid repeated checks
    const startY = Math.max(0, bounds.top);
    const endY = Math.min(layerManager.height - 1, bounds.bottom);
    const startX = Math.max(0, bounds.left);
    const endX = Math.min(layerManager.width - 1, bounds.right);

    // OPTIMIZATION: For large selections, use a more efficient approach
    const selectionArea = (endY - startY + 1) * (endX - startX + 1);
    
    if (selectionArea > 1000) {
      // For large selections, batch the operations
      for (let y = startY; y <= endY; y++) {
        const row = targetLayer.pixels[y];
        if (row) {
          // Fill entire row segment at once
          for (let x = startX; x <= endX; x++) {
            row[x] = transparentColor.slice(); // Use slice() instead of spread for better performance
          }
        }
      }
    } else {
      // For small selections, use the original method
      for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
          if (targetLayer.pixels[y] && targetLayer.pixels[y][x]) {
            targetLayer.pixels[y][x] = [...transparentColor];
          }
        }
      }
    }

    // Disable batch mode and trigger update
    layerManager.setBatchMode(false);
    layerManager.notifyChange();
  }

  // LAYER-COMPATIBLE: Paste clipboard at position on active layer
  // OPTIMIZED: Faster pasting for large selections
  _pasteClipboardAt(clipboard, left, top) {
    const layerManager = this.editor.layerManager;
    const activeLayer = layerManager.getActiveLayer();

    if (!activeLayer || activeLayer.locked) {
      return; // Can't modify locked layer
    }

    // Enable batch mode for performance
    layerManager.setBatchMode(true);

    // OPTIMIZATION: Pre-calculate bounds
    const clipboardArea = clipboard.width * clipboard.height;
    const startY = Math.max(0, -top);
    const endY = Math.min(clipboard.height - 1, layerManager.height - 1 - top);
    const startX = Math.max(0, -left);
    const endX = Math.min(clipboard.width - 1, layerManager.width - 1 - left);

    if (clipboardArea > 1000) {
      // For large pastes, use optimized direct pixel access
      for (let py = startY; py <= endY; py++) {
        const destY = top + py;
        const destRow = activeLayer.pixels[destY];
        const srcRow = clipboard.pixels[py];
        
        if (destRow && srcRow) {
          for (let px = startX; px <= endX; px++) {
            const pixel = srcRow[px];
            if (pixel && pixel[3] > 0) {
              // Only paste non-transparent pixels
              const destX = left + px;
              destRow[destX] = pixel.slice();
            }
          }
        }
      }
    } else {
      // For small pastes, use the layer manager setPixel
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
    }

    // Disable batch mode and trigger update
    layerManager.setBatchMode(false);
  }

  // Handle mouse move event
  // Handle mouse move event with dynamic cursor changes
  onMouseMove(x, y, event) {
    if (this.isSelecting) {
      // OPTIMIZATION: Throttle selection updates for large canvases
      const now = performance.now();
      if (now - this._lastUpdateTime >= this._updateThrottleMs) {
        this.editor.canvasManager.updateSelection(x, y);
        this._lastUpdateTime = now;
      } else {
        // Schedule update if not already scheduled
        if (!this._updateThrottleId) {
          this._updateThrottleId = requestAnimationFrame(() => {
            this.editor.canvasManager.updateSelection(x, y);
            this._updateThrottleId = null;
            this._lastUpdateTime = performance.now();
          });
        }
      }
    } else if (this.selection) {
      // Update cursor based on hover position
      this._updateCursorForPosition(x, y);
    }
  }

  // Update cursor based on current hover position
  _updateCursorForPosition(x, y) {
    if (!this.selection) {
      this._setCursor("crosshair");
      return;
    }

    // Check rotation handle first (highest priority)
    if (this._isOverRotationHandle(x, y)) {
      this._setCursor("alias"); // or 'grab' for rotation
      return;
    }

    // Check resize handles
    const handle = this._getScaleHandle(x, y);
    if (handle) {
      switch (handle) {
        case "nw":
        case "se":
          this._setCursor("nw-resize");
          break;
        case "ne":
        case "sw":
          this._setCursor("ne-resize");
          break;
      }
      return;
    }

    // Check if inside selection for dragging
    if (this._isInsideSelection(x, y)) {
      this._setCursor("move");
      return;
    }

    // Outside selection
    this._setCursor("crosshair");
  }

  // Helper method to set cursor
  _setCursor(cursor) {
    const canvas = document.getElementById("main-canvas");
    const overlay = document.getElementById("overlay-canvas");

    if (canvas) canvas.style.cursor = cursor;
    if (overlay) overlay.style.cursor = cursor;
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
      this.editor.uiManager?.showNotification(
        "Invalid crop dimensions",
        "error"
      );
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

  // Strip selection to animation frames
  stripToAnimation() {
    if (
      !this.selection ||
      !this.editor.currentSprite ||
      !this.editor.layerManager
    ) {
      this.editor.uiManager?.showNotification(
        "No selection available",
        "warning"
      );
      return false;
    }

    // Use selection dimensions as frame size
    const frameWidth = this.selection.right - this.selection.left + 1;
    const frameHeight = this.selection.bottom - this.selection.top + 1;

    // Use entire sprite dimensions for calculation
    const spriteWidth = this.editor.currentSprite.width;
    const spriteHeight = this.editor.currentSprite.height;

    // Calculate how many frames we can extract from the entire sprite
    const framesX = Math.floor(spriteWidth / frameWidth);
    const framesY = Math.floor(spriteHeight / frameHeight);
    const totalFrames = framesX * framesY;

    if (totalFrames <= 1) {
      this.editor.uiManager?.showNotification(
        "Cannot create multiple frames with this frame size",
        "error"
      );
      return false;
    }

    // Use UI manager's custom confirm
    this.editor.uiManager.showCustomConfirm(
      `This will create ${totalFrames} frames (${framesX}×${framesY}) using ${frameWidth}×${frameHeight} frame size. Continue?`,
      () => {
        this.performStripToAnimation(
          frameWidth,
          frameHeight,
          framesX,
          framesY,
          totalFrames
        );
      }
    );

    return true;
  }

  // Separated logic for the actual stripping process
  performStripToAnimation(
    frameWidth,
    frameHeight,
    framesX,
    framesY,
    totalFrames
  ) {
    // Save current frame before starting
    if (this.editor.animationManager) {
      this.editor.animationManager.saveLayerManagerToCurrentFrame();
    }

    // CRITICAL: Get the sprite data BEFORE any resizing
    const originalSpriteData = [];
    for (let y = 0; y < this.editor.currentSprite.height; y++) {
      originalSpriteData[y] = [];
      for (let x = 0; x < this.editor.currentSprite.width; x++) {
        originalSpriteData[y][x] = this.editor.layerManager.getCompositePixel(
          x,
          y
        );
      }
    }

    // Now resize sprite to frame size
    this.editor.resizeCanvas(frameWidth, frameHeight);

    // Clear existing frames (keep first one but clear its content)
    const sprite = this.editor.currentSprite;
    sprite.frames = [sprite.frames[0]];
    this.editor.animationManager.currentFrameIndex = 0;

    // Extract frames from the original sprite data
    let frameIndex = 0;
    for (let row = 0; row < framesY; row++) {
      for (let col = 0; col < framesX; col++) {
        // Create new frame if not the first one
        if (frameIndex > 0) {
          this.editor.animationManager.addFrame();
          this.editor.animationManager.setCurrentFrame(frameIndex);
        }

        // Clear current frame
        this.editor.layerManager.clearLayer();

        // Copy pixels for this frame from original data
        const startX = col * frameWidth;
        const startY = row * frameHeight;

        this.editor.layerManager.setBatchMode(true);

        for (let y = 0; y < frameHeight; y++) {
          for (let x = 0; x < frameWidth; x++) {
            const sourceX = startX + x;
            const sourceY = startY + y;

            // Make sure we're within bounds of original sprite
            if (
              sourceY < originalSpriteData.length &&
              sourceX < originalSpriteData[sourceY].length
            ) {
              const pixel = originalSpriteData[sourceY][sourceX];
              if (pixel[3] > 0) {
                // Only copy non-transparent pixels
                this.editor.layerManager.setPixel(x, y, pixel);
              }
            }
          }
        }

        this.editor.layerManager.setBatchMode(false);

        // Save frame to storage
        if (this.editor.animationManager) {
          this.editor.animationManager.saveLayerManagerToCurrentFrame();
        }

        frameIndex++;
      }
    }

    // Mark sprite as animated
    sprite.isAnimated = true;

    // Go back to first frame
    this.editor.animationManager.setCurrentFrame(0);

    // Clear selection
    this.clearSelection();

    // Update UI
    this.editor.updateUI();

    // Save sprite
    this.editor.saveSprites();

    this.editor.uiManager?.showNotification(
      `Created ${totalFrames} animation frames (${frameWidth}×${frameHeight} each)`,
      "success"
    );
  }

  // Clear current selection
  // Clear current selection
  // Clear current selection
  clearSelection() {
    // If we have a selection layer, merge it back to the layer below
    if (this.selectionLayerIndex !== undefined) {
      const selectionLayer = this.editor.layerManager.getLayer(
        this.selectionLayerIndex
      );
      if (selectionLayer) {
        if (this._isLayerEmpty(selectionLayer)) {
          // If layer is empty, just delete it
          this.editor.layerManager.deleteLayer(this.selectionLayerIndex);
        } else {
          // If layer has content, merge it down
          this._mergeSelectionToLayerBelow();
        }
      }
      this.selectionLayerIndex = undefined;
    }

    this.selection = null;
    this.lastDragPosition = null;
    this.editor.canvasManager.endSelection();
    this.editor.canvasManager.clearOverlay();
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
  // Modified getSettingsHTML to include counter-clockwise rotation
  // Modified getSettingsHTML to include strip to animation
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
                Rigid
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
            <button class="btn btn-secondary btn-sm" id="rotate-cw-btn" ${
              !hasSelection || isLayerLocked ? "disabled" : ""
            }>
                <i class="fas fa-redo"></i>
            </button>
            <button class="btn btn-secondary btn-sm" id="rotate-ccw-btn" ${
              !hasSelection || isLayerLocked ? "disabled" : ""
            }>
                <i class="fas fa-undo"></i>
            </button>
            <button class="btn btn-secondary btn-sm" id="flip-h-btn" ${
              !hasSelection || isLayerLocked ? "disabled" : ""
            }>
                <i class="fas fa-arrows-alt-h"></i>
            </button>
            <button class="btn btn-secondary btn-sm" id="flip-v-btn" ${
              !hasSelection || isLayerLocked ? "disabled" : ""
            }>
                <i class="fas fa-arrows-alt-v"></i>
            </button>
        </div>
        
        <div class="setting-group">
            <button class="btn btn-secondary btn-sm" id="crop-btn" ${
              !hasSelection ? "disabled" : ""
            }>
                <i class="fas fa-crop-simple"></i>
            </button>
            <button class="btn btn-secondary btn-sm" id="strip-to-animation-btn" ${
              !hasSelection ? "disabled" : ""
            }>
                <i class="fas fa-film"></i>
            </button>
        </div>
    `;
  }

  // Initialize tool settings event listeners
  // Modified initializeSettings to handle both rotation buttons
  initializeSettings() {
    const copyBtn = document.getElementById("copy-btn");
    const cutBtn = document.getElementById("cut-btn");
    const pasteBtn = document.getElementById("paste-btn");
    const deleteBtn = document.getElementById("delete-btn");
    const clearSelectionBtn = document.getElementById("clear-selection-btn");
    const cropBtn = document.getElementById("crop-btn");
    const rigidScalingCb = document.getElementById("rigid-scaling-cb");

    // Updated button references
    const rotateCwBtn = document.getElementById("rotate-cw-btn");
    const rotateCcwBtn = document.getElementById("rotate-ccw-btn");
    const flipHBtn = document.getElementById("flip-h-btn");
    const flipVBtn = document.getElementById("flip-v-btn");

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

    if (cropBtn) {
      cropBtn.addEventListener("click", () => {
        this.editor.uiManager.showCustomConfirm(
          "Crop the sprite to the current selection? This cannot be undone.",
          () => {
            this.crop();
          }
        );
      });
    }

    if (rigidScalingCb) {
      rigidScalingCb.addEventListener("change", (e) => {
        this.rigidScaling = e.target.checked;
      });
    }

    // Updated rotation button event listeners
    if (rotateCwBtn) {
      rotateCwBtn.addEventListener("click", () => {
        this.rotateClockwise();
      });
    }

    if (rotateCcwBtn) {
      rotateCcwBtn.addEventListener("click", () => {
        this.rotateCounterClockwise();
      });
    }

    if (flipHBtn) {
      flipHBtn.addEventListener("click", () => {
        this.flipHorizontal();
      });
    }

    if (flipVBtn) {
      flipVBtn.addEventListener("click", () => {
        this.flipVertical();
      });
    }

    // Add this after the other button event listeners (around line 670):

    const stripToAnimationBtn = document.getElementById(
      "strip-to-animation-btn"
    );
    if (stripToAnimationBtn) {
      stripToAnimationBtn.addEventListener("click", () => {
        this.stripToAnimation();
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

  //ROTATION GO WHIRRR
  _rotateClipboard(clipboard, rotations) {
    if (rotations === 0) return clipboard;

    let result = clipboard;

    for (let r = 0; r < rotations; r++) {
      const rotated = {
        width: result.height,
        height: result.width,
        pixels: [],
      };

      for (let y = 0; y < rotated.height; y++) {
        rotated.pixels[y] = [];
        for (let x = 0; x < rotated.width; x++) {
          const srcX = y;
          const srcY = result.height - 1 - x;
          rotated.pixels[y][x] = result.pixels[srcY][srcX];
        }
      }
      result = rotated;
    }

    return result;
  }

  // Flip clipboard horizontally
  _flipClipboardHorizontal(clipboard) {
    const flipped = {
      width: clipboard.width,
      height: clipboard.height,
      pixels: [],
    };

    for (let y = 0; y < clipboard.height; y++) {
      flipped.pixels[y] = [];
      for (let x = 0; x < clipboard.width; x++) {
        const srcX = clipboard.width - 1 - x;
        flipped.pixels[y][x] = clipboard.pixels[y][srcX];
      }
    }

    return flipped;
  }

  // Flip clipboard vertically
  _flipClipboardVertical(clipboard) {
    const flipped = {
      width: clipboard.width,
      height: clipboard.height,
      pixels: [],
    };

    for (let y = 0; y < clipboard.height; y++) {
      flipped.pixels[y] = [];
      const srcY = clipboard.height - 1 - y;
      for (let x = 0; x < clipboard.width; x++) {
        flipped.pixels[y][x] = clipboard.pixels[srcY][x];
      }
    }

    return flipped;
  }

  // Rotate selection by 90 degrees clockwise
  rotateClockwise() {
    if (!this.selection || !this.editor.layerManager) return false;

    const clipboard = this._copyFromBounds(this.selection);
    const rotatedClipboard = this._rotateClipboard(clipboard, 1);

    // Start batch operation
    this.editor.layerManager.startBatchOperation();

    // Clear original selection
    this._deleteBounds(this.selection);

    // Calculate new selection bounds (rotated dimensions)
    const centerX = (this.selection.left + this.selection.right) / 2;
    const centerY = (this.selection.top + this.selection.bottom) / 2;
    const newWidth = rotatedClipboard.width;
    const newHeight = rotatedClipboard.height;

    this.selection = {
      left: Math.round(centerX - newWidth / 2),
      top: Math.round(centerY - newHeight / 2),
      right: Math.round(centerX - newWidth / 2) + newWidth - 1,
      bottom: Math.round(centerY - newHeight / 2) + newHeight - 1,
    };

    // Paste rotated content
    this._pasteClipboardAt(
      rotatedClipboard,
      this.selection.left,
      this.selection.top
    );

    // End batch operation
    this.editor.layerManager.endBatchOperation();

    // Update display
    this.editor.canvasManager.render();
    this.editor.canvasManager.renderSelectionBox(this.selection);
    this.updateSettingsUI();

    return true;
  }
  // Add counter-clockwise rotation method
  rotateCounterClockwise() {
    if (!this.selection || !this.editor.layerManager) return false;

    const clipboard = this._copyFromBounds(this.selection);
    const rotatedClipboard = this._rotateClipboard(clipboard, 3); // 3 rotations = 270° = -90°

    // Start batch operation
    this.editor.layerManager.startBatchOperation();

    // Clear original selection
    this._deleteBounds(this.selection);

    // Calculate new selection bounds (rotated dimensions)
    const centerX = (this.selection.left + this.selection.right) / 2;
    const centerY = (this.selection.top + this.selection.bottom) / 2;
    const newWidth = rotatedClipboard.width;
    const newHeight = rotatedClipboard.height;

    this.selection = {
      left: Math.round(centerX - newWidth / 2),
      top: Math.round(centerY - newHeight / 2),
      right: Math.round(centerX - newWidth / 2) + newWidth - 1,
      bottom: Math.round(centerY - newHeight / 2) + newHeight - 1,
    };

    // Paste rotated content
    this._pasteClipboardAt(
      rotatedClipboard,
      this.selection.left,
      this.selection.top
    );

    // End batch operation
    this.editor.layerManager.endBatchOperation();

    // Update display
    this.editor.canvasManager.render();
    this.editor.canvasManager.renderSelectionBox(this.selection);
    this.updateSettingsUI();

    return true;
  }

  // Flip selection horizontally
  flipHorizontal() {
    if (!this.selection || !this.editor.layerManager) return false;

    const clipboard = this._copyFromBounds(this.selection);
    const flippedClipboard = this._flipClipboardHorizontal(clipboard);

    // Start batch operation
    this.editor.layerManager.startBatchOperation();

    // Clear and paste flipped content
    this._deleteBounds(this.selection);
    this._pasteClipboardAt(
      flippedClipboard,
      this.selection.left,
      this.selection.top
    );

    // End batch operation
    this.editor.layerManager.endBatchOperation();

    // Update display
    this.editor.canvasManager.render();
    this.editor.canvasManager.renderSelectionBox(this.selection);

    return true;
  }

  // Flip selection vertically
  flipVertical() {
    if (!this.selection || !this.editor.layerManager) return false;

    const clipboard = this._copyFromBounds(this.selection);
    const flippedClipboard = this._flipClipboardVertical(clipboard);

    // Start batch operation
    this.editor.layerManager.startBatchOperation();

    // Clear and paste flipped content
    this._deleteBounds(this.selection);
    this._pasteClipboardAt(
      flippedClipboard,
      this.selection.left,
      this.selection.top
    );

    // End batch operation
    this.editor.layerManager.endBatchOperation();

    // Update display
    this.editor.canvasManager.render();
    this.editor.canvasManager.renderSelectionBox(this.selection);

    return true;
  }

  // Get tool cursor
  // Get tool cursor - now handles dynamic cursor changes
  getCursor() {
    // This method is mainly for fallback - the dynamic cursor is handled in onMouseMove
    if (this.selection && this.editor.canvasManager.lastPos) {
      const { x, y } = this.editor.canvasManager.lastPos;

      // Check rotation handle first
      if (this._isOverRotationHandle(x, y)) {
        return "alias";
      }

      // Check resize handles
      const handle = this._getScaleHandle(x, y);
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

      // Check if inside selection
      if (this._isInsideSelection(x, y)) {
        return "move";
      }
    }

    return "crosshair";
  }
}
