// Sprite Class - Represents a pixel art sprite
class Sprite {
    constructor(width, height, name = 'Untitled', id = null) {
        this.id = id || Date.now() + Math.random();
        this.name = name;
        this.width = width;
        this.height = height;
        this.createdAt = new Date().toISOString();
        this.modifiedAt = new Date().toISOString();
        
        // Initialize pixel data as 2D array of RGBA values
        this.pixels = this.createEmptyPixelArray();
        
        // History for undo/redo
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
        
        // Save initial state
        this.saveToHistory();
    }

    // Create empty pixel array filled with transparent pixels
    createEmptyPixelArray() {
        const pixels = [];
        for (let y = 0; y < this.height; y++) {
            pixels[y] = [];
            for (let x = 0; x < this.width; x++) {
                pixels[y][x] = [0, 0, 0, 0]; // Transparent black
            }
        }
        return pixels;
    }

    // Get pixel at specific coordinates
    getPixel(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return [0, 0, 0, 0]; // Return transparent for out of bounds
        }
        return [...this.pixels[y][x]]; // Return copy to prevent mutation
    }

    // Set pixel at specific coordinates
    setPixel(x, y, color) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return false; // Out of bounds
        }
        
        // Ensure color is in correct format [r, g, b, a]
        if (!Array.isArray(color) || color.length !== 4) {
            console.error('Invalid color format:', color);
            return false;
        }
        
        this.pixels[y][x] = [...color];
        this.modifiedAt = new Date().toISOString();
        return true;
    }

    // Get the entire pixel array
    getPixelArray() {
        return this.pixels.map(row => row.map(pixel => [...pixel]));
    }

    // Set the entire pixel array
    setPixelArray(pixels) {
        if (!Array.isArray(pixels) || pixels.length !== this.height) {
            console.error('Invalid pixel array dimensions');
            return false;
        }
        
        for (let y = 0; y < this.height; y++) {
            if (!Array.isArray(pixels[y]) || pixels[y].length !== this.width) {
                console.error('Invalid pixel array row at', y);
                return false;
            }
        }
        
        this.pixels = pixels.map(row => row.map(pixel => [...pixel]));
        this.modifiedAt = new Date().toISOString();
        return true;
    }

    // Resize the sprite
    resize(newWidth, newHeight, maintainAspectRatio = false) {
        if (maintainAspectRatio) {
            const aspectRatio = this.width / this.height;
            if (newWidth / newHeight > aspectRatio) {
                newWidth = Math.round(newHeight * aspectRatio);
            } else {
                newHeight = Math.round(newWidth / aspectRatio);
            }
        }

        const newPixels = [];
        for (let y = 0; y < newHeight; y++) {
            newPixels[y] = [];
            for (let x = 0; x < newWidth; x++) {
                if (x < this.width && y < this.height) {
                    // Copy existing pixel
                    newPixels[y][x] = [...this.pixels[y][x]];
                } else {
                    // Fill new areas with transparent pixels
                    newPixels[y][x] = [0, 0, 0, 0];
                }
            }
        }

        this.width = newWidth;
        this.height = newHeight;
        this.pixels = newPixels;
        this.modifiedAt = new Date().toISOString();
        
        this.saveToHistory();
        return true;
    }

    // Clear all pixels (make transparent)
    clear() {
        this.pixels = this.createEmptyPixelArray();
        this.modifiedAt = new Date().toISOString();
        this.saveToHistory();
    }

    // Fill entire sprite with a color
    fill(color) {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.pixels[y][x] = [...color];
            }
        }
        this.modifiedAt = new Date().toISOString();
        this.saveToHistory();
    }

    // Save current state to history for undo/redo
    saveToHistory() {
        // Remove any future history if we're not at the end
        if (this.historyIndex < this.history.length - 1) {
            this.history.splice(this.historyIndex + 1);
        }

        // Add current state to history
        const state = {
            pixels: this.getPixelArray(),
            width: this.width,
            height: this.height,
            timestamp: Date.now()
        };

        this.history.push(state);
        this.historyIndex++;

        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
            this.historyIndex--;
        }
    }

    /**
     * Undo last action
     */
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const state = this.history[this.historyIndex];
            this.restoreFromState(state);
            return true;
        }
        return false;
    }

    /**
     * Redo next action
     */
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const state = this.history[this.historyIndex];
            this.restoreFromState(state);
            return true;
        }
        return false;
    }

    /**
     * Restore sprite from a history state
     */
    restoreFromState(state) {
        this.width = state.width;
        this.height = state.height;
        this.pixels = state.pixels.map(row => row.map(pixel => [...pixel]));
        this.modifiedAt = new Date().toISOString();
    }

    /**
     * Check if undo is available
     */
    canUndo() {
        return this.historyIndex > 0;
    }

    /**
     * Check if redo is available
     */
    canRedo() {
        return this.historyIndex < this.history.length - 1;
    }

    /**
     * Create a copy of this sprite
     */
    clone(newName = null) {
        const copy = new Sprite(this.width, this.height, newName || `${this.name} Copy`);
        copy.setPixelArray(this.getPixelArray());
        return copy;
    }

    /**
     * Convert sprite to ImageData for canvas rendering
     */
    toImageData() {
        const imageData = new ImageData(this.width, this.height);
        const data = imageData.data;

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const pixelIndex = (y * this.width + x) * 4;
                const [r, g, b, a] = this.pixels[y][x];
                
                data[pixelIndex] = r;     // Red
                data[pixelIndex + 1] = g; // Green
                data[pixelIndex + 2] = b; // Blue
                data[pixelIndex + 3] = a; // Alpha
            }
        }

        return imageData;
    }

    /**
     * Create sprite from ImageData
     */
    static fromImageData(imageData, name = 'Imported Sprite') {
        const sprite = new Sprite(imageData.width, imageData.height, name);
        const data = imageData.data;

        for (let y = 0; y < imageData.height; y++) {
            for (let x = 0; x < imageData.width; x++) {
                const pixelIndex = (y * imageData.width + x) * 4;
                const r = data[pixelIndex];
                const g = data[pixelIndex + 1];
                const b = data[pixelIndex + 2];
                const a = data[pixelIndex + 3];
                
                sprite.setPixel(x, y, [r, g, b, a]);
            }
        }

        sprite.saveToHistory();
        return sprite;
    }

    /**
     * Export sprite as SVG string
     */
    toSVG() {
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}" style="image-rendering: pixelated;">`;
        svg += '<g shape-rendering="crispEdges">';

        let hasVisiblePixels = false;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const [r, g, b, a] = this.pixels[y][x];
                
                // Only include non-transparent pixels
                if (a > 0) {
                    hasVisiblePixels = true;
                    if (a === 255) {
                        // Fully opaque pixels
                        const color = `rgb(${r},${g},${b})`;
                        svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="${color}"/>`;
                    } else {
                        // Semi-transparent pixels
                        const opacity = (a / 255).toFixed(3);
                        const color = `rgba(${r},${g},${b},${opacity})`;
                        svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="${color}"/>`;
                    }
                }
            }
        }

        // If no visible pixels, add a transparent pixel to ensure valid SVG
        if (!hasVisiblePixels) {
            svg += '<rect x="0" y="0" width="1" height="1" fill="rgba(0,0,0,0)"/>';
        }

        svg += '</g></svg>';
        return svg;
    }

    /**
     * Get sprite statistics
     */
    getStats() {
        let transparentPixels = 0;
        let opaquePixels = 0;
        const colorCounts = new Map();

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const [r, g, b, a] = this.pixels[y][x];
                
                if (a === 0) {
                    transparentPixels++;
                } else {
                    opaquePixels++;
                    const colorKey = `${r},${g},${b},${a}`;
                    colorCounts.set(colorKey, (colorCounts.get(colorKey) || 0) + 1);
                }
            }
        }

        return {
            width: this.width,
            height: this.height,
            totalPixels: this.width * this.height,
            transparentPixels,
            opaquePixels,
            uniqueColors: colorCounts.size,
            colorCounts: Object.fromEntries(colorCounts),
            createdAt: this.createdAt,
            modifiedAt: this.modifiedAt
        };
    }
}
