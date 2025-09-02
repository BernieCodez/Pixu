// Main Editor Class - Coordinates all components of the pixel editor
class PixelEditor {
    constructor() {
        // Core components
        this.canvasManager = null;
        this.uiManager = null;
        this.layerManager = null;
        this.storageManager = window.storageManager;
        
        // Editor state
        this.sprites = [];
        this.currentSprite = null;
        this.currentTool = null;
        this.previousTool = null;
        this.tools = {};
        
        // Color state
        this.primaryColor = [0, 0, 0, 255]; // Black
        this.secondaryColor = [255, 255, 255, 255]; // White
        
        // Settings
        this.settings = this.storageManager.loadSettings();
        
        this.initialize();
    }

    /**
     * Initialize the editor
     */
    initialize() {
        // Initialize canvas manager
        this.canvasManager = new CanvasManager('main-canvas', 'overlay-canvas');
        
        // Initialize layer manager
        if (window.LayerManager) {
            this.layerManager = new LayerManager('konva-container', 16, 16);
        }
        
        // Initialize tools
        this.initializeTools();
        
        // Initialize UI manager
        this.uiManager = new UIController(this);
        
        // Load sprites from storage
        this.loadSprites();
        
        // Set initial colors
        this.setPrimaryColor(this.hexToRgba(this.settings.primaryColor));
        this.setSecondaryColor(this.hexToRgba(this.settings.secondaryColor));
        
        // Set initial tool
        this.setCurrentTool('brush');
        
        // Create initial sprite if none exist
        if (this.sprites.length === 0) {
            this.createNewSprite();
        } else {
            this.setCurrentSprite(this.sprites[0]);
        }
        
        // Update UI
        this.updateUI();
        
        console.log('Pixel Editor initialized successfully!');
    }

    // Initialize all tools
    initializeTools() {
        this.tools = {
            brush: new BrushTool(this),
            eraser: new EraserTool(this),
            bucket: new BucketTool(this),
            select: new SelectTool(this),
            eyedropper: new EyedropperTool(this),
            brightness: new BrightnessTool(this)
        };

        // Set tool colors and settings from saved preferences
        this.updateToolColors();
        this.applyToolSettings();
    }

    // Apply saved tool settings
    applyToolSettings() {
        if (this.tools.brush) {
            this.tools.brush.setSize(this.settings.brushSize);
            this.tools.brush.setOpacity(this.settings.brushOpacity);
        }
        
        if (this.tools.bucket) {
            this.tools.bucket.setTolerance(this.settings.bucketTolerance);
        }
        
        if (this.tools.brightness) {
            this.tools.brightness.setIntensity(this.settings.brightnessIntensity);
        }
    }

    // Update tool colors when primary/secondary colors change
    updateToolColors() {
        Object.values(this.tools).forEach(tool => {
            if (tool.setColor) {
                tool.setColor(this.primaryColor);
            }
        });
    }

    // Set current tool
    setCurrentTool(toolName) {
        if (!this.tools[toolName]) {
            console.error(`Tool "${toolName}" not found`);
            return;
        }

        // Deactivate current tool if it has onDeactivate method
        if (this.currentTool && this.currentTool.onDeactivate) {
            this.currentTool.onDeactivate();
        }

        this.previousTool = this.currentTool;
        this.currentTool = this.tools[toolName];
        
        // Update cursor
        if (this.canvasManager.mainCanvas) {
            this.canvasManager.mainCanvas.style.cursor = this.currentTool.getCursor() || 'crosshair';
        }
        
        // Update tool colors
        this.updateToolColors();
        
        // Update UI
        this.uiManager.updateToolButtons();
        this.uiManager.updateToolSettings();
    }

    /**
     * Create a new sprite
     */
    createNewSprite(width = 16, height = 16, name = null) {
        const spriteName = name || `Sprite ${this.sprites.length + 1}`;
        const sprite = new Sprite(width, height, spriteName);
        
        this.sprites.push(sprite);
        this.setCurrentSprite(sprite);
        this.saveSprites();
        
        this.uiManager.showNotification(`Created new sprite: ${spriteName}`, 'success');
        return sprite;
    }

    // Set current sprite
    setCurrentSprite(sprite) {
        this.currentSprite = sprite;
        this.canvasManager.setSprite(sprite);
        this.updateUI();
    }

    // Duplicate sprite
    duplicateSprite(sprite) {
        const duplicate = sprite.clone();
        this.sprites.push(duplicate);
        this.setCurrentSprite(duplicate);
        this.saveSprites();
        
        this.uiManager.showNotification(`Duplicated sprite: ${duplicate.name}`, 'success');
        return duplicate;
    }

    // Delete sprite
    deleteSprite(index) {
        // Validate index
        if (index < 0 || index >= this.sprites.length) {
            this.uiManager.showNotification('Invalid sprite index', 'error');
            return false;
        }

        // Check if this is the last sprite
        if (this.sprites.length <= 1) {
            this.uiManager.showNotification('Cannot delete the last sprite', 'error');
            return false;
        }

        const spriteName = this.sprites[index].name;
        const deletedSprite = this.sprites[index];
        
        // Remove sprite from array
        this.sprites.splice(index, 1);
        
        // If deleted sprite was current, switch to another
        if (deletedSprite === this.currentSprite) {
            const newIndex = Math.min(index, this.sprites.length - 1);
            this.setCurrentSprite(this.sprites[newIndex]);
        }
        
        this.saveSprites();
        this.uiManager.showNotification(`Deleted sprite: ${spriteName}`, 'success');
        return true;
    }

    /**
     * Resize current canvas
     */
    resizeCanvas(width, height, maintainAspectRatio = false) {
        if (!this.currentSprite) return false;

        this.currentSprite.resize(width, height, maintainAspectRatio);
        this.canvasManager.updateCanvasSize();
        this.saveSprites();
        this.updateUI();
        
        this.uiManager.showNotification(`Canvas resized to ${width}×${height}`, 'success');
        return true;
    }

    // Set primary color
    setPrimaryColor(color) {
        this.primaryColor = [...color];
        this.updateToolColors();
        this.saveSettings();
    }

    // Set secondary color
    setSecondaryColor(color) {
        this.secondaryColor = [...color];
        this.saveSettings();
    }

    // Update color UI elements
    updateColorUI() {
        this.uiManager.updateColorDisplay();
    }

    /**
     * Undo last action
     */
    undo() {
        if (this.currentSprite && this.currentSprite.undo()) {
            this.canvasManager.render();
            this.updateUI();
            this.uiManager.showNotification('Undone', 'info');
            return true;
        }
        return false;
    }

    /**
     * Redo last undone action
     */
    redo() {
        if (this.currentSprite && this.currentSprite.redo()) {
            this.canvasManager.render();
            this.updateUI();
            this.uiManager.showNotification('Redone', 'info');
            return true;
        }
        return false;
    }

    /**
     * Save sprites to storage
     */
    saveSprites() {
        const success = this.storageManager.saveSprites(this.sprites);
        if (!success) {
            this.uiManager.showNotification('Failed to save sprites', 'error');
        }
        return success;
    }

    /**
     * Load sprites from storage
     */
    loadSprites() {
        const loadedSprites = this.storageManager.loadSprites();
        this.sprites = loadedSprites;
        
        if (this.sprites.length > 0) {
            this.setCurrentSprite(this.sprites[0]);
        }
        
        return this.sprites.length;
    }

    /**
     * Save settings to storage
     */
    saveSettings() {
        this.settings.primaryColor = this.rgbaToHex(this.primaryColor);
        this.settings.secondaryColor = this.rgbaToHex(this.secondaryColor);
        
        // Save tool settings
        if (this.tools.brush) {
            this.settings.brushSize = this.tools.brush.size;
            this.settings.brushOpacity = this.tools.brush.opacity;
        }
        
        if (this.tools.bucket) {
            this.settings.bucketTolerance = this.tools.bucket.tolerance;
        }
        
        if (this.tools.brightness) {
            this.settings.brightnessIntensity = this.tools.brightness.intensity;
        }
        
        this.settings.showGrid = this.canvasManager.showGrid;
        this.settings.zoomLevel = this.canvasManager.zoomLevel;
        
        this.storageManager.saveSettings(this.settings);
    }

    /**
     * Import file (PNG, SVG, JSON)
     */
    async importFile(file) {
        try {
            const fileType = file.type.toLowerCase();
            const fileName = file.name.toLowerCase();
            
            if (fileType.includes('image') || fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
                // Import image file
                const sprite = await this.canvasManager.importFromImage(file);
                this.sprites.push(sprite);
                this.setCurrentSprite(sprite);
                this.saveSprites();
                
                this.uiManager.showNotification(`Imported image: ${file.name}`, 'success');
                
            } else if (fileName.endsWith('.svg')) {
                // Import SVG file
                await this.importSVG(file);
                
            } else if (fileName.endsWith('.json')) {
                // Import sprite data
                const importedSprites = await this.storageManager.importSprites(file);
                this.sprites.push(...importedSprites);
                
                if (importedSprites.length > 0) {
                    this.setCurrentSprite(importedSprites[0]);
                }
                
                this.saveSprites();
                this.uiManager.showNotification(`Imported ${importedSprites.length} sprites`, 'success');
                
            } else {
                throw new Error('Unsupported file format');
            }
            
        } catch (error) {
            console.error('Import failed:', error);
            this.uiManager.showNotification(`Import failed: ${error.message}`, 'error');
        }
    }

    /**
     * Import SVG file
     */
    async importSVG(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    // Create temporary image element
                    const img = new Image();
                    const svgBlob = new Blob([e.target.result], { type: 'image/svg+xml' });
                    const url = URL.createObjectURL(svgBlob);
                    
                    img.onload = () => {
                        // Create temporary canvas to rasterize SVG
                        const tempCanvas = document.createElement('canvas');
                        const tempCtx = tempCanvas.getContext('2d');
                        tempCanvas.width = img.width || 32;
                        tempCanvas.height = img.height || 32;
                        
                        tempCtx.drawImage(img, 0, 0);
                        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                        
                        const sprite = Sprite.fromImageData(imageData, file.name.replace(/\.[^/.]+$/, ""));
                        this.sprites.push(sprite);
                        this.setCurrentSprite(sprite);
                        this.saveSprites();
                        
                        URL.revokeObjectURL(url);
                        this.uiManager.showNotification(`Imported SVG: ${file.name}`, 'success');
                        resolve(sprite);
                    };
                    
                    img.onerror = () => {
                        URL.revokeObjectURL(url);
                        reject(new Error('Failed to load SVG'));
                    };
                    
                    img.src = url;
                    
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Export current sprite as SVG - direct download
     */
    exportAsSVG() {
        if (!this.currentSprite) {
            alert('No sprite to export');
            return;
        }

        try {
            const svgString = this.currentSprite.toSVG();
            const blob = new Blob([svgString], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.currentSprite.name}.svg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            
            console.log(`Exported SVG: ${this.currentSprite.name}.svg`);
            
        } catch (error) {
            console.error('Export failed:', error);
            alert(`Export failed: ${error.message}`);
        }
    }

    /**
     * Export current sprite as PNG with current zoom scale
     */
    exportAsPNG() {
        if (!this.currentSprite) {
            this.uiManager.showNotification('No sprite to export', 'error');
            return;
        }

        try {
            // Get current zoom from canvas manager
            const currentScale = this.canvasManager.scale;
            const scaledWidth = this.currentSprite.width * currentScale;
            const scaledHeight = this.currentSprite.height * currentScale;
            
            // Create a temporary canvas for export
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = scaledWidth;
            exportCanvas.height = scaledHeight;
            const exportCtx = exportCanvas.getContext('2d');
            
            // Disable image smoothing for pixel art
            exportCtx.imageSmoothingEnabled = false;
            exportCtx.mozImageSmoothingEnabled = false;
            exportCtx.webkitImageSmoothingEnabled = false;
            exportCtx.msImageSmoothingEnabled = false;
            
            // Draw the sprite pixels at the current scale
            for (let y = 0; y < this.currentSprite.height; y++) {
                for (let x = 0; x < this.currentSprite.width; x++) {
                    const pixel = this.currentSprite.getPixel(x, y);
                    const [r, g, b, a] = pixel;
                    
                    if (a > 0) { // Only draw non-transparent pixels
                        exportCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
                        exportCtx.fillRect(
                            x * currentScale, 
                            y * currentScale, 
                            currentScale, 
                            currentScale
                        );
                    }
                }
            }
            
            // Convert to blob and download
            const self = this;
            exportCanvas.toBlob((blob) => {
                if (!blob) {
                    console.error('Failed to create blob from canvas');
                    alert('Failed to export PNG. Please try again.');
                    return;
                }
                
                try {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${self.currentSprite.name}_${scaledWidth}x${scaledHeight}.png`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    
                    console.log(`Exported PNG: ${self.currentSprite.name}_${scaledWidth}x${scaledHeight}.png`);
                } catch (error) {
                    console.error('Failed to create download URL:', error);
                    alert('Failed to export PNG. Please try again.');
                }
            }, 'image/png');
            
        } catch (error) {
            console.error('PNG Export failed:', error);
            this.uiManager.showNotification(`PNG Export failed: ${error.message}`, 'error');
        }
    }

    /**
     * Export all sprites as JSON
     */
    exportAllSprites() {
        try {
            this.storageManager.exportSprites(this.sprites);
            this.uiManager.showNotification(`Exported ${this.sprites.length} sprites`, 'success');
        } catch (error) {
            console.error('Export failed:', error);
            this.uiManager.showNotification(`Export failed: ${error.message}`, 'error');
        }
    }

    /**
     * Update all UI components
     */
    updateUI() {
        this.uiManager.updateAll();
    }

    /**
     * Update tool settings UI
     */
    updateToolSettings() {
        this.uiManager.updateToolSettings();
    }

    /**
     * Convert hex color to RGBA array
     */
    hexToRgba(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16),
            255
        ] : [0, 0, 0, 255];
    }

    /**
     * Convert RGBA array to hex color
     */
    rgbaToHex(rgba) {
        const [r, g, b] = rgba;
        const toHex = (n) => Math.round(n).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    /**
     * Get editor statistics
     */
    getStats() {
        const totalPixels = this.sprites.reduce((sum, sprite) => sum + sprite.width * sprite.height, 0);
        const storageUsage = this.storageManager.getStorageUsage();
        
        return {
            totalSprites: this.sprites.length,
            totalPixels,
            currentSprite: this.currentSprite ? {
                name: this.currentSprite.name,
                dimensions: `${this.currentSprite.width}×${this.currentSprite.height}`,
                stats: this.currentSprite.getStats()
            } : null,
            storageUsage,
            currentTool: this.currentTool?.name
        };
    }

    /**
     * Clear all data (reset editor)
     */
    reset() {
        if (confirm('Are you sure you want to clear all sprites and reset the editor? This cannot be undone.')) {
            this.sprites = [];
            this.storageManager.clearAll();
            this.createNewSprite();
            this.updateUI();
            
            this.uiManager.showNotification('Editor reset successfully', 'success');
        }
    }

    /**
     * Get current sprite as data URL
     */
    getCurrentSpriteDataURL() {
        if (!this.currentSprite) return null;
        return this.canvasManager.exportAsImage();
    }
}

// Make PixelEditor globally available
window.PixelEditor = PixelEditor;
