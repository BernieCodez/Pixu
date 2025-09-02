// Canvas Manager - Handles canvas rendering and interactions
class CanvasManager {
    constructor(mainCanvasId, overlayCanvasId) {
        this.mainCanvas = document.getElementById(mainCanvasId);
        this.overlayCanvas = document.getElementById(overlayCanvasId);
        this.mainCtx = this.mainCanvas.getContext('2d');
        this.overlayCtx = this.overlayCanvas.getContext('2d');
        
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
            endY: 0
        };
        
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
        this.mainCtx.fillStyle = '#ffffff';
        this.mainCtx.fillRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
        
        this.mainCtx.fillStyle = '#e0e0e0';
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
        this.mainCtx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
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
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
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
            y: Math.floor(canvasY / this.zoomLevel)
        };
    }

    /**
     * Convert sprite coordinates to screen coordinates
     */
    spriteToScreen(spriteX, spriteY) {
        const rect = this.mainCanvas.getBoundingClientRect();
        return {
            x: rect.left + spriteX * this.zoomLevel,
            y: rect.top + spriteY * this.zoomLevel
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
        
        const startX = Math.min(this.selection.startX, this.selection.endX) * this.zoomLevel;
        const startY = Math.min(this.selection.startY, this.selection.endY) * this.zoomLevel;
        const endX = Math.max(this.selection.startX, this.selection.endX) * this.zoomLevel;
        const endY = Math.max(this.selection.startY, this.selection.endY) * this.zoomLevel;
        
        this.overlayCtx.strokeStyle = '#00d4ff';
        this.overlayCtx.lineWidth = 2;
        this.overlayCtx.setLineDash([5, 5]);
        this.overlayCtx.strokeRect(startX, startY, endX - startX + this.zoomLevel, endY - startY + this.zoomLevel);
        
        this.overlayCtx.fillStyle = 'rgba(0, 212, 255, 0.1)';
        this.overlayCtx.fillRect(startX, startY, endX - startX + this.zoomLevel, endY - startY + this.zoomLevel);
    }

    /**
     * Clear overlay canvas
     */
    clearOverlay() {
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
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
            bottom: Math.max(this.selection.startY, this.selection.endY)
        };
    }

    /**
     * Export canvas as image
     */
    exportAsImage(format = 'png') {
        if (!this.currentSprite) return null;
        
        // Create temporary canvas with actual sprite size
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
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
                    const tempCanvas = document.createElement('canvas');
                    const tempCtx = tempCanvas.getContext('2d');
                    tempCanvas.width = img.width;
                    tempCanvas.height = img.height;
                    
                    tempCtx.drawImage(img, 0, 0);
                    const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
                    
                    const sprite = Sprite.fromImageData(imageData, file.name.replace(/\.[^/.]+$/, ""));
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
        this.mainCanvas.addEventListener('mousedown', (e) => {
            const pos = this.screenToSprite(e.clientX, e.clientY);
            this.isDrawing = true;
            this.lastPos = pos;
            
            if (window.editor && window.editor.currentTool) {
                window.editor.currentTool.onMouseDown(pos.x, pos.y, e);
            }
        });

        this.mainCanvas.addEventListener('mousemove', (e) => {
            const pos = this.screenToSprite(e.clientX, e.clientY);
            
            if (window.editor && window.editor.currentTool) {
                if (this.isDrawing) {
                    window.editor.currentTool.onMouseDrag(pos.x, pos.y, this.lastPos.x, this.lastPos.y, e);
                } else {
                    window.editor.currentTool.onMouseMove(pos.x, pos.y, e);
                }
            }
            
            this.lastPos = pos;
        });

        this.mainCanvas.addEventListener('mouseup', (e) => {
            const pos = this.screenToSprite(e.clientX, e.clientY);
            this.isDrawing = false;
            
            if (window.editor && window.editor.currentTool) {
                window.editor.currentTool.onMouseUp(pos.x, pos.y, e);
            }
        });

        this.mainCanvas.addEventListener('mouseleave', (e) => {
            this.isDrawing = false;
            
            if (window.editor && window.editor.currentTool) {
                window.editor.currentTool.onMouseLeave(e);
            }
        });

        // Context menu prevention
        this.mainCanvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName.toLowerCase() === 'input') return;
            
            switch (e.key.toLowerCase()) {
                case 'g':
                    if (!e.ctrlKey && !e.metaKey) {
                        this.toggleGrid();
                    }
                    break;
                case '=':
                case '+':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.zoomIn();
                    }
                    break;
                case '-':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.zoomOut();
                    }
                    break;
            }
        });
    }

    /**
     * Create thumbnail canvas for sprite
     */
    createThumbnail(sprite, size = 64) {
        const thumbnailCanvas = document.createElement('canvas');
        const thumbnailCtx = thumbnailCanvas.getContext('2d');
        thumbnailCanvas.width = size;
        thumbnailCanvas.height = size;
        
        // Calculate scale to fit sprite in thumbnail while maintaining aspect ratio
        const scale = Math.min(size / sprite.width, size / sprite.height);
        const scaledWidth = sprite.width * scale;
        const scaledHeight = sprite.height * scale;
        const offsetX = (size - scaledWidth) / 2;
        const offsetY = (size - scaledHeight) / 2;
        
        // Render checkerboard background
        thumbnailCtx.fillStyle = '#ffffff';
        thumbnailCtx.fillRect(offsetX, offsetY, scaledWidth, scaledHeight);
        
        thumbnailCtx.fillStyle = '#e0e0e0';
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
}
