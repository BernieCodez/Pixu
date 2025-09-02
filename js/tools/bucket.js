// Bucket Fill Tool - For flood filling areas with color
class BucketTool {
    constructor(editor) {
        this.editor = editor;
        this.name = 'bucket';
        this.tolerance = 10;
        this.color = [0, 0, 0, 255]; // Black
    }

    // Handle mouse down event
    onMouseDown(x, y, event) {
        if (!this.editor.currentSprite) return;
        
        this.floodFill(x, y);
    }

    // Handle mouse drag event
    onMouseDrag(x, y, lastX, lastY, event) {
        // Bucket tool doesn't need drag functionality
    }

    // Handle mouse up event
    onMouseUp(x, y, event) {
        // Bucket fill is completed on mouse down
    }

    // Handle mouse move event
    onMouseMove(x, y, event) {
        // Could show fill preview here in the future
    }

    // Handle mouse leave event
    onMouseLeave(event) {
        // No action needed
    }

    // Perform flood fill at the specified position
    floodFill(startX, startY) {
        if (!this.editor.currentSprite) return;
        
        const sprite = this.editor.currentSprite;
        
        // Check bounds
        if (startX < 0 || startX >= sprite.width || startY < 0 || startY >= sprite.height) {
            return;
        }
        
        const targetColor = sprite.getPixel(startX, startY);
        const fillColor = [...this.color];
        
        // If the target color is the same as fill color, no need to fill
        if (this.colorsEqual(targetColor, fillColor)) {
            return;
        }
        
        // Perform flood fill using scanline algorithm
        this.scanlineFill(sprite, startX, startY, targetColor, fillColor);
        
        // Save to history and update UI
        sprite.saveToHistory();
        this.editor.canvasManager.render();
        this.editor.updateUI();
    }

    // Scanline flood fill algorithm
    scanlineFill(sprite, x, y, targetColor, fillColor) {
        const stack = [{x, y}];
        const visited = new Set();
        
        while (stack.length > 0) {
            const {x: currentX, y: currentY} = stack.pop();
            
            // Skip if out of bounds
            if (currentX < 0 || currentX >= sprite.width || currentY < 0 || currentY >= sprite.height) {
                continue;
            }
            
            // Skip if already visited
            const key = `${currentX},${currentY}`;
            if (visited.has(key)) {
                continue;
            }
            
            const currentColor = sprite.getPixel(currentX, currentY);
            
            // Skip if color doesn't match target within tolerance
            if (!this.colorMatches(currentColor, targetColor)) {
                continue;
            }
            
            visited.add(key);
            sprite.setPixel(currentX, currentY, fillColor);
            
            // Add neighboring pixels to stack
            stack.push({x: currentX + 1, y: currentY});
            stack.push({x: currentX - 1, y: currentY});
            stack.push({x: currentX, y: currentY + 1});
            stack.push({x: currentX, y: currentY - 1});
        }
    }

    // Check if two colors are equal
    colorsEqual(color1, color2) {
        return color1[0] === color2[0] && 
               color1[1] === color2[1] && 
               color1[2] === color2[2] && 
               color1[3] === color2[3];
    }

    // Check if color matches target color within tolerance
    colorMatches(color, targetColor) {
        // If tolerance is 0, colors must match exactly
        if (this.tolerance === 0) {
            return this.colorsEqual(color, targetColor);
        }
        
        // Calculate color distance using Euclidean distance in RGBA space
        const dr = color[0] - targetColor[0];
        const dg = color[1] - targetColor[1];
        const db = color[2] - targetColor[2];
        const da = color[3] - targetColor[3];
        
        const distance = Math.sqrt(dr * dr + dg * dg + db * db + da * da);
        const maxDistance = Math.sqrt(4 * 255 * 255); // Maximum possible distance
        const normalizedDistance = (distance / maxDistance) * 100;
        
        return normalizedDistance <= this.tolerance;
    }

    // Set tolerance level
    setTolerance(tolerance) {
        this.tolerance = Math.max(0, Math.min(100, tolerance));
    }

    // Set fill color
    setColor(color) {
        if (Array.isArray(color) && color.length >= 3) {
            this.color = [
                Math.max(0, Math.min(255, color[0])),
                Math.max(0, Math.min(255, color[1])),
                Math.max(0, Math.min(255, color[2])),
                color[3] !== undefined ? Math.max(0, Math.min(255, color[3])) : 255
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
        return result ? [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16),
            255
        ] : null;
    }

    // Get tool settings UI elements
    getSettingsHTML() {
        return `
            <div class="setting-group">
                <label for="bucket-tolerance">Tolerance:</label>
                <div class="slider-container">
                    <input type="range" id="bucket-tolerance" min="0" max="100" value="${this.tolerance}">
                    <span class="slider-value">${this.tolerance}</span>
                </div>
            </div>
        `;
    }

    // Initialize tool settings event listeners
    initializeSettings() {
        const toleranceSlider = document.getElementById('bucket-tolerance');
        const toleranceValue = toleranceSlider.nextElementSibling;

        toleranceSlider.addEventListener('input', (e) => {
            this.setTolerance(parseInt(e.target.value));
            toleranceValue.textContent = this.tolerance;
        });
    }

    // Get tool cursor
    getCursor() {
        return 'crosshair';
    }
}
