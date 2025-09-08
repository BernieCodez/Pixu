// Eraser Tool - For erasing pixels (making them transparent)
class EraserTool {
    constructor(editor) {
        this.editor = editor;
        this.name = 'eraser';
        this.size = 1;
        this.isDrawing = false;
    }

    // Handle mouse down event
    onMouseDown(x, y, event) {
        if (!this.editor.layerManager) return;
        this.isDrawing = true;
        this.erasePixel(x, y);
    }

    // Handle mouse drag event
    onMouseDrag(x, y, lastX, lastY, event) {
        if (!this.editor.layerManager || !this.isDrawing) return;
        // Erase line from last position to current position
        this.eraseLine(lastX, lastY, x, y);
    }

    // Handle mouse up event
    onMouseUp(x, y, event) {
        if (!this.editor.layerManager || !this.isDrawing) return;
        this.isDrawing = false;
        // TODO: Implement layerManager history if needed
        this.editor.updateUI();
    }

    // Handle mouse move event (when not drawing)
    onMouseMove(x, y, event) {
        // Could show eraser preview here in the future
    }

    // Handle mouse leave event
    onMouseLeave(event) {
        if (this.isDrawing) {
            this.isDrawing = false;
            // TODO: Implement layerManager history if needed
            this.editor.updateUI();
        }
    }

    // Erase pixels at position
    erasePixel(x, y) {
        if (!this.editor.layerManager) return;
        const layerManager = this.editor.layerManager;
        const halfSize = Math.floor(this.size / 2);
        const transparentColor = [0, 0, 0, 0];
        for (let dy = -halfSize; dy <= halfSize; dy++) {
            for (let dx = -halfSize; dx <= halfSize; dx++) {
                const pixelX = x + dx;
                const pixelY = y + dy;
                if (pixelX >= 0 && pixelX < layerManager.width && pixelY >= 0 && pixelY < layerManager.height) {
                    if (this.size > 1) {
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        if (distance > this.size / 2) continue;
                    }
                    layerManager.setPixel(pixelX, pixelY, transparentColor);
                }
            }
        }
        this.editor.canvasManager.render();
    }

    // Erase a line between two points
    eraseLine(x1, y1, x2, y2) {
        // Use Bresenham's line algorithm for smooth erasing
        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1);
        const sx = x1 < x2 ? 1 : -1;
        const sy = y1 < y2 ? 1 : -1;
        let err = dx - dy;
        
        let x = x1;
        let y = y1;
        
        while (true) {
            this.erasePixel(x, y);
            
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
    }

    // Set eraser size
    setSize(size) {
        this.size = Math.max(1, Math.min(10, size));
    }

    // Get tool settings UI elements
    getSettingsHTML() {
        return `
            <div class="setting-group">
                <label for="eraser-size">Eraser Size:</label>
                <div class="slider-container">
                    <input type="range" id="eraser-size" min="1" max="10" value="${this.size}">
                    <span class="slider-value">${this.size}</span>
                </div>
            </div>
        `;
    }

    // Initialize tool settings event listeners
    initializeSettings() {
        const sizeSlider = document.getElementById('eraser-size');
        const sizeValue = sizeSlider.nextElementSibling;

        sizeSlider.addEventListener('input', (e) => {
            this.setSize(parseInt(e.target.value));
            sizeValue.textContent = this.size;
        });
    }

    // Get tool cursor
    getCursor() {
        return 'crosshair';
    }
}
