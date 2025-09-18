I'll add rotation and flip functionality to your selection tool. Here are the modifications:

**In CanvasManager class, add these new methods:**

```javascript
// New method: Render rotation handle above selection
renderRotationHandle(selection) {
  if (!selection) return;

  const centerX = (selection.left + selection.right + 1) / 2;
  const handleY = selection.top - 2; // 2 pixels above selection
  const handleRadius = 6;

  // Don't draw if handle would be off-screen
  if (handleY < 0) return;

  const screenX = centerX * this.zoomLevel;
  const screenY = handleY * this.zoomLevel;

  this.overlayCtx.setLineDash([]);

  // Draw connection line from selection to handle
  this.overlayCtx.strokeStyle = "#00d4ff";
  this.overlayCtx.lineWidth = 1;
  this.overlayCtx.beginPath();
  this.overlayCtx.moveTo(screenX, (selection.top * this.zoomLevel));
  this.overlayCtx.lineTo(screenX, screenY);
  this.overlayCtx.stroke();

  // Draw circular rotation handle
  this.overlayCtx.fillStyle = "#ffffff";
  this.overlayCtx.strokeStyle = "#00d4ff";
  this.overlayCtx.lineWidth = 2;
  this.overlayCtx.beginPath();
  this.overlayCtx.arc(screenX, screenY, handleRadius, 0, Math.PI * 2);
  this.overlayCtx.fill();
  this.overlayCtx.stroke();

  // Draw rotation icon inside handle
  this.overlayCtx.strokeStyle = "#00d4ff";
  this.overlayCtx.lineWidth = 1.5;
  this.overlayCtx.beginPath();
  this.overlayCtx.arc(screenX, screenY, 3, 0, Math.PI * 1.5);
  this.overlayCtx.stroke();
  
  // Draw arrow
  this.overlayCtx.beginPath();
  this.overlayCtx.moveTo(screenX + 2, screenY - 2);
  this.overlayCtx.lineTo(screenX + 1, screenY - 3);
  this.overlayCtx.lineTo(screenX + 3, screenY - 3);
  this.overlayCtx.stroke();
}

// New method: Check if position is over rotation handle
isOverRotationHandle(x, y, selection) {
  if (!selection) return false;

  const centerX = (selection.left + selection.right + 1) / 2;
  const handleY = selection.top - 2;
  
  if (handleY < 0) return false;

  const handleRadius = 6;
  const tolerance = handleRadius / this.zoomLevel;

  const screenX = centerX;
  const screenY = handleY;

  return Math.sqrt(Math.pow(x - screenX, 2) + Math.pow(y - screenY, 2)) <= tolerance;
}
```

**Update the renderSelectionBox method in CanvasManager:**

```javascript
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
  
  // Draw rotation handle
  this.renderRotationHandle(selection);
}
```

**In SelectTool class, add these new properties in constructor:**

```javascript
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
}
```

**Add these new methods to SelectTool class:**

```javascript
// Rotate clipboard by 90-degree increments
_rotateClipboard(clipboard, rotations) {
  if (rotations === 0) return clipboard;

  let result = clipboard;
  
  for (let r = 0; r < rotations; r++) {
    const rotated = {
      width: result.height,
      height: result.width,
      pixels: []
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
    pixels: []
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
    pixels: []
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
    bottom: Math.round(centerY - newHeight / 2) + newHeight - 1
  };

  // Paste rotated content
  this._pasteClipboardAt(rotatedClipboard, this.selection.left, this.selection.top);

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
  this._pasteClipboardAt(flippedClipboard, this.selection.left, this.selection.top);

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
  this._pasteClipboardAt(flippedClipboard, this.selection.left, this.selection.top);

  // End batch operation
  this.editor.layerManager.endBatchOperation();

  // Update display
  this.editor.canvasManager.render();
  this.editor.canvasManager.renderSelectionBox(this.selection);

  return true;
}
```

**Update the onMouseDown method in SelectTool:**

```javascript
onMouseDown(x, y, event) {
  if (!this.editor.currentSprite || !this.editor.layerManager) return;

  // Check if clicking on rotation handle
  if (this.selection && this.editor.canvasManager.isOverRotationHandle(x, y, this.selection)) {
    this.isRotating = true;
    this.rotationCenter = {
      x: (this.selection.left + this.selection.right + 1) / 2,
      y: (this.selection.top + this.selection.bottom + 1) / 2
    };
    return;
  }

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
```

**Update the onMouseUp method in SelectTool:**

```javascript
onMouseUp(x, y, event) {
  if (!this.editor.currentSprite || !this.editor.layerManager) return;

  if (this.isRotating) {
    // Handle rotation release
    this.isRotating = false;
    this.rotationCenter = null;
    return;
  }

  // ... rest of existing onMouseUp code remains the same
}
```

**Update the getSettingsHTML method in SelectTool:**

```javascript
getSettingsHTML() {
  const hasSelection = this.hasSelection();
  const hasClipboard = this.hasClipboard();
  const activeLayer = this.editor.layerManager?.getActiveLayer();
  const isLayerLocked = activeLayer?.locked || false;

  return `
        ${isLayerLocked
          ? `<div class="setting-group">
                <div class="warning-message">
                    <i class="fas fa-lock"></i> Layer locked
                </div>
             </div>`
          : ""
        }
        
        <div class="setting-group">
            <label>
                <input type="checkbox" id="rigid-scaling-cb" ${this.rigidScaling ? "checked" : ""}>
                Rigid Scaling
            </label>
        </div>
        
        <div class="setting-group">
            <button class="btn btn-secondary btn-sm" id="copy-btn" ${!hasSelection ? "disabled" : ""}>
                <i class="fas fa-copy"></i>
            </button>
            <button class="btn btn-secondary btn-sm" id="cut-btn" ${!hasSelection || isLayerLocked ? "disabled" : ""}>
                <i class="fas fa-cut"></i>
            </button>
            <button class="btn btn-secondary btn-sm" id="paste-btn" ${!hasClipboard || isLayerLocked ? "disabled" : ""}>
                <i class="fas fa-paste"></i>
            </button>
            <button class="btn btn-secondary btn-sm" id="delete-btn" ${!hasSelection || isLayerLocked ? "disabled" : ""}>
                <i class="fas fa-trash"></i>
            </button>
            <button class="btn btn-secondary btn-sm" id="clear-selection-btn" ${!hasSelection ? "disabled" : ""}>
                <i class="fas fa-times"></i>
            </button>
        </div>
        
        <div class="setting-group">
            <button class="btn btn-secondary btn-sm" id="rotate-btn" ${!hasSelection || isLayerLocked ? "disabled" : ""}>
                <i class="fas fa-redo"></i>
            </button>
            <button class="btn btn-secondary btn-sm" id="flip-h-btn" ${!hasSelection || isLayerLocked ? "disabled" : ""}>
                <i class="fas fa-arrows-alt-h"></i>
            </button>
            <button class="btn btn-secondary btn-sm" id="flip-v-btn" ${!hasSelection || isLayerLocked ? "disabled" : ""}>
                <i class="fas fa-arrows-alt-v"></i>
            </button>
        </div>
        
        <div class="setting-group">
            <button class="btn btn-primary btn-sm" id="crop-btn" ${!hasSelection ? "disabled" : ""}>
                <i class="fas fa-crop"></i> Crop to Selection
            </button>
        </div>
    `;
}
```

**Update the initializeSettings method in SelectTool:**

```javascript
initializeSettings() {
  const copyBtn = document.getElementById("copy-btn");
  const cutBtn = document.getElementById("cut-btn");
  const pasteBtn = document.getElementById("paste-btn");
  const deleteBtn = document.getElementById("delete-btn");
  const clearSelectionBtn = document.getElementById("clear-selection-btn");
  const cropBtn = document.getElementById("crop-btn");
  const rigidScalingCb = document.getElementById("rigid-scaling-cb");
  
  // NEW: Get new button references
  const rotateBtn = document.getElementById("rotate-btn");
  const flipHBtn = document.getElementById("flip-h-btn");
  const flipVBtn = document.getElementById("flip-v-btn");

  // ... existing button event listeners remain the same ...

  // NEW: Add event listeners for new buttons
  if (rotateBtn) {
    rotateBtn.addEventListener("click", () => {
      this.rotateClockwise();
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

  // ... rest of existing event listeners and keyboard shortcuts remain the same ...

  // Add rotation keyboard shortcut to existing keydown listener
  document.addEventListener("keydown", (e) => {
    if (
      this.editor.currentTool === this &&
      !e.target.matches("input, textarea")
    ) {
      const activeLayer = this.editor.layerManager?.getActiveLayer();
      const isLayerLocked = activeLayer?.locked || false;

      switch (e.key.toLowerCase()) {
        // ... existing cases remain the same ...
        case "r":
          if (!e.ctrlKey && !e.metaKey && !isLayerLocked && this.hasSelection()) {
            e.preventDefault();
            this.rotateClockwise();
          }
          break;
        case "h":
          if (!e.ctrlKey && !e.metaKey && !isLayerLocked && this.hasSelection()) {
            e.preventDefault();
            this.flipHorizontal();
          }
          break;
        case "v":
          if (!e.ctrlKey && !e.metaKey && !isLayerLocked && this.hasSelection()) {
            e.preventDefault();
            this.flipVertical();
          }
          break;
      }
    }
  });
}
```

This implementation adds:

1. **Rotation handle**: A circular handle that appears above selections with a rotation icon
2. **90-degree rotation**: Click the rotate button or press 'R' to rotate clockwise by 90 degrees
3. **Horizontal flip**: Click the horizontal arrows button or press 'H'
4. **Vertical flip**: Click the vertical arrows button or press 'V'
5. **Visual feedback**: The rotation handle shows a connection line and rotation icon
6. **Proper positioning**: The rotation handle adjusts based on zoom level and doesn't appear if it would be off-screen

The rotation is constrained to 90-degree increments to maintain pixel-perfect results, which is ideal for pixel art. The flip operations work instantly and maintain the selection bounds.