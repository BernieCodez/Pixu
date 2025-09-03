// Select Tool - For selecting rectangular areas
class SelectTool {
    constructor(editor) {
        this.editor = editor;
        this.name = 'select';
        this.isSelecting = false;
        this.selection = null;
        this.clipboard = null;
        this.isDragging = false;
        this.dragOffset = null;
        this.originalSelection = null;
        this.lastDragPosition = null; // Track last drag position to avoid unnecessary redraws
    }

    // Handle mouse down event
    onMouseDown(x, y, event) {
        if (!this.editor.currentSprite) return;
        // If there's an active selection and mouse is inside it, start dragging
        if (this.selection &&
            x >= this.selection.left && x <= this.selection.right &&
            y >= this.selection.top && y <= this.selection.bottom) {
            this.isDragging = true;
            this.dragOffset = { x, y };
            this.lastDragPosition = { x, y };
            // Store original selection bounds and clipboard for drag
            this.originalSelection = { ...this.selection };
            this.dragClipboard = this._copyFromBounds(this.selection);
            // Clear the original area immediately to show it's being moved
            this._deleteBounds(this.originalSelection);
            this.editor.canvasManager.render();
            // Show the preview at the current position
            this.editor.canvasManager.showDraggedSelectionPreview(this.selection, this.dragClipboard);
        } else {
            // Start new selection
            this.isSelecting = true;
            this.editor.canvasManager.startSelection(x, y);
        }
    }

    /// Handle mouse drag event
    onMouseDrag(x, y, lastX, lastY, event) {
        if (!this.editor.currentSprite) return;
        
        if (this.isDragging && this.selection) {
            console.log('Dragging at', x, y); // Debug line
            
            // Only update if position actually changed
            if (!this.lastDragPosition || 
                this.lastDragPosition.x !== x || 
                this.lastDragPosition.y !== y) {
                
                // Calculate new selection position
                const dx = x - this.dragOffset.x;
                const dy = y - this.dragOffset.y;
                const width = this.originalSelection.right - this.originalSelection.left;
                const height = this.originalSelection.bottom - this.originalSelection.top;
                this.selection.left = this.originalSelection.left + dx;
                this.selection.right = this.selection.left + width;
                this.selection.top = this.originalSelection.top + dy;
                this.selection.bottom = this.selection.top + height;
                
                console.log('New selection position:', this.selection); // Debug line
                
                // Update drag position and render preview
                this.lastDragPosition = { x, y };
                this.editor.canvasManager.showDraggedSelectionPreview(this.selection, this.dragClipboard);
            }
        } else if (this.isSelecting) {
            this.editor.canvasManager.updateSelection(x, y);
        }
    }

    // Handle mouse up event
    onMouseUp(x, y, event) {
        if (!this.editor.currentSprite) return;
        if (this.isDragging && this.selection && this.dragClipboard) {
            // Clear the preview
            this.editor.canvasManager.clearOverlay();
            
            // Paste clipboard at new selection position
            this._pasteClipboardAt(this.dragClipboard, this.selection.left, this.selection.top);
            
            // Reset drag state
            this.isDragging = false;
            this.dragOffset = null;
            this.originalSelection = null;
            this.dragClipboard = null;
            this.lastDragPosition = null;
            
            // Update CanvasManager selection state to match new selection
            if (this.editor.canvasManager.selection) {
                this.editor.canvasManager.selection.startX = this.selection.left;
                this.editor.canvasManager.selection.startY = this.selection.top;
                this.editor.canvasManager.selection.endX = this.selection.right;
                this.editor.canvasManager.selection.endY = this.selection.bottom;
                this.editor.canvasManager.selection.active = true;
            }
            
            // Redraw everything
            this.editor.canvasManager.render();
            this.editor.canvasManager.renderSelectionBox(this.selection);
            this.editor.currentSprite.saveToHistory();
            this.editor.updateUI();
        } else if (this.isSelecting) {
            this.isSelecting = false;
            this.selection = this.editor.canvasManager.getSelectionBounds();
            if (this.selection) {
                // Ensure selection is at least 1x1
                if (this.selection.left === this.selection.right) {
                    this.selection.right = this.selection.left;
                }
                if (this.selection.top === this.selection.bottom) {
                    this.selection.bottom = this.selection.top;
                }
            }
        }
    }
    
    // Helper: copy pixels from given bounds
    _copyFromBounds(bounds) {
        const sprite = this.editor.currentSprite;
        const width = bounds.right - bounds.left + 1;
        const height = bounds.bottom - bounds.top + 1;
        const clipboard = { width, height, pixels: [] };
        for (let y = 0; y < height; y++) {
            clipboard.pixels[y] = [];
            for (let x = 0; x < width; x++) {
                const srcX = bounds.left + x;
                const srcY = bounds.top + y;
                clipboard.pixels[y][x] = sprite.getPixel(srcX, srcY);
            }
        }
        return clipboard;
    }

    // Helper: delete pixels in given bounds
    _deleteBounds(bounds) {
        const sprite = this.editor.currentSprite;
        const transparentColor = [0, 0, 0, 0];
        for (let y = bounds.top; y <= bounds.bottom; y++) {
            for (let x = bounds.left; x <= bounds.right; x++) {
                if (x >= 0 && x < sprite.width && y >= 0 && y < sprite.height) {
                    sprite.setPixel(x, y, transparentColor);
                }
            }
        }
    }

    // Helper: paste clipboard at position
    _pasteClipboardAt(clipboard, left, top) {
        const sprite = this.editor.currentSprite;
        for (let py = 0; py < clipboard.height; py++) {
            for (let px = 0; px < clipboard.width; px++) {
                const destX = left + px;
                const destY = top + py;
                if (destX >= 0 && destX < sprite.width && destY >= 0 && destY < sprite.height) {
                    const pixel = clipboard.pixels[py][px];
                    if (pixel[3] > 0) {
                        sprite.setPixel(destX, destY, pixel);
                    }
                }
            }
        }
    }

    // Handle mouse move event
    onMouseMove(x, y, event) {
        // Update selection preview if selecting
        if (this.isSelecting) {
            this.editor.canvasManager.updateSelection(x, y);
        }
    }

    // Handle mouse leave event
    onMouseLeave(event) {
        // Complete selection if we're in the middle of selecting
        if (this.isSelecting) {
            this.isSelecting = false;
            this.selection = this.editor.canvasManager.getSelectionBounds();
        }
        // Reset drag position tracking
        this.lastDragPosition = null;
    }

    // Copy selected area to clipboard
    copy() {
        if (!this.selection || !this.editor.currentSprite) return false;
        
        const sprite = this.editor.currentSprite;
        const width = this.selection.right - this.selection.left + 1;
                this.editor.canvasManager.clearDraggedSelection();
        const height = this.selection.bottom - this.selection.top + 1;
        
        this.clipboard = {
            width,
            height,
            pixels: []
        };
        
        // Copy pixels from selection
        for (let y = 0; y < height; y++) {
            this.clipboard.pixels[y] = [];
            for (let x = 0; x < width; x++) {
                const srcX = this.selection.left + x;
                const srcY = this.selection.top + y;
                this.clipboard.pixels[y][x] = sprite.getPixel(srcX, srcY);
            }
        }
        
        return true;
    }

    // Cut selected area to clipboard
    cut() {
        if (!this.copy()) return false;
        
        this.delete();
        return true;
    }

    // Paste from clipboard at current selection or top-left
    paste(x = 0, y = 0) {
        if (!this.clipboard || !this.editor.currentSprite) return false;
        
        const sprite = this.editor.currentSprite;
        
        // Use selection position if available, otherwise use provided coordinates
        const startX = this.selection ? this.selection.left : x;
        const startY = this.selection ? this.selection.top : y;
        
        // Paste pixels
        for (let py = 0; py < this.clipboard.height; py++) {
            for (let px = 0; px < this.clipboard.width; px++) {
                const destX = startX + px;
                const destY = startY + py;
                
                // Only paste if within bounds
                if (destX >= 0 && destX < sprite.width && destY >= 0 && destY < sprite.height) {
                    const pixel = this.clipboard.pixels[py][px];
                    // Only paste non-transparent pixels
                    if (pixel[3] > 0) {
                        sprite.setPixel(destX, destY, pixel);
                    }
                }
            }
        }
        
        // Update canvas and save to history
        this.editor.canvasManager.render();
        sprite.saveToHistory();
        this.editor.updateUI();
        
        return true;
    }

    // Delete selected area (make transparent)
    delete() {
        if (!this.selection || !this.editor.currentSprite) return false;
        
        const sprite = this.editor.currentSprite;
        const transparentColor = [0, 0, 0, 0];
        
        // Clear selection area
        for (let y = this.selection.top; y <= this.selection.bottom; y++) {
            for (let x = this.selection.left; x <= this.selection.right; x++) {
                if (x >= 0 && x < sprite.width && y >= 0 && y < sprite.height) {
                    sprite.setPixel(x, y, transparentColor);
                }
            }
        }
        
        // Update canvas and save to history
        this.editor.canvasManager.render();
        sprite.saveToHistory();
        this.editor.updateUI();
        
        return true;
    }

    // Fill selected area with color
    fill(color) {
        if (!this.selection || !this.editor.currentSprite) return false;
        
        const sprite = this.editor.currentSprite;
        
        // Fill selection area
        for (let y = this.selection.top; y <= this.selection.bottom; y++) {
            for (let x = this.selection.left; x <= this.selection.right; x++) {
                if (x >= 0 && x < sprite.width && y >= 0 && y < sprite.height) {
                    sprite.setPixel(x, y, color);
                }
            }
        }
        
        // Update canvas and save to history
        this.editor.canvasManager.render();
        sprite.saveToHistory();
        this.editor.updateUI();
        
        return true;
    }

    // Clear current selection
    clearSelection() {
        this.selection = null;
        this.lastDragPosition = null; // Reset drag tracking
        this.editor.canvasManager.endSelection();
    }

    // Called when tool is deactivated
    onDeactivate() {
        // Clear selection when switching away from select tool
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
            area: (this.selection.right - this.selection.left + 1) * (this.selection.bottom - this.selection.top + 1)
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
        const selectionInfo = this.getSelectionInfo();
        const hasSelection = this.hasSelection();
        const hasClipboard = this.hasClipboard();
        
        return `
            <div class="setting-group">
                <label>Selection:</label>
                <div class="selection-info">
                    ${selectionInfo ? 
                        `${selectionInfo.width}×${selectionInfo.height} at (${selectionInfo.x}, ${selectionInfo.y})` : 
                        'No selection'
                    }
                </div>
            </div>
            <div class="setting-group">
                <div class="button-group">
                    <button class="btn btn-secondary btn-sm" id="copy-btn" ${!hasSelection ? 'disabled' : ''}>
                        <i class="fas fa-copy"></i> Copy
                    </button>
                    <button class="btn btn-secondary btn-sm" id="cut-btn" ${!hasSelection ? 'disabled' : ''}>
                        <i class="fas fa-cut"></i> Cut
                    </button>
                    <button class="btn btn-secondary btn-sm" id="paste-btn" ${!hasClipboard ? 'disabled' : ''}>
                        <i class="fas fa-paste"></i> Paste
                    </button>
                </div>
            </div>
            <div class="setting-group">
                <div class="button-group">
                    <button class="btn btn-secondary btn-sm" id="delete-btn" ${!hasSelection ? 'disabled' : ''}>
                        <i class="fas fa-trash"></i> Delete
                    </button>
                    <button class="btn btn-secondary btn-sm" id="clear-selection-btn" ${!hasSelection ? 'disabled' : ''}>
                        <i class="fas fa-times"></i> Clear
                    </button>
                </div>
            </div>
        `;
    }

    // Initialize tool settings event listeners
    initializeSettings() {
        const copyBtn = document.getElementById('copy-btn');
        const cutBtn = document.getElementById('cut-btn');
        const pasteBtn = document.getElementById('paste-btn');
        const deleteBtn = document.getElementById('delete-btn');
        const clearSelectionBtn = document.getElementById('clear-selection-btn');

        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                this.copy();
                this.updateSettingsUI();
            });
        }

        if (cutBtn) {
            cutBtn.addEventListener('click', () => {
                this.cut();
                this.updateSettingsUI();
            });
        }

        if (pasteBtn) {
            pasteBtn.addEventListener('click', () => {
                this.paste();
                this.updateSettingsUI();
            });
        }

        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                this.delete();
                this.updateSettingsUI();
            });
        }

        if (clearSelectionBtn) {
            clearSelectionBtn.addEventListener('click', () => {
                this.clearSelection();
                this.updateSettingsUI();
            });
        }

        // Listen for keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (this.editor.currentTool === this && !e.target.matches('input, textarea')) {
                switch (e.key.toLowerCase()) {
                    case 'c':
                        if (e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            this.copy();
                            this.updateSettingsUI();
                        }
                        break;
                    case 'x':
                        if (e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            this.cut();
                            this.updateSettingsUI();
                        }
                        break;
                    case 'v':
                        if (e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            this.paste();
                            this.updateSettingsUI();
                        }
                        break;
                    case 'delete':
                    case 'backspace':
                        e.preventDefault();
                        this.delete();
                        this.updateSettingsUI();
                        break;
                    case 'escape':
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
        return 'crosshair';
    }
}