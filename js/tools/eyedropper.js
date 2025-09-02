// Eyedropper Tool - For picking colors from the canvas
class EyedropperTool {
    constructor(editor) {
        this.editor = editor;
        this.name = 'eyedropper';
    }

    // Handle mouse down event
    onMouseDown(x, y, event) {
        if (!this.editor.currentSprite) return;
        
        this.pickColor(x, y, event);
    }

    // Handle mouse drag event
    onMouseDrag(x, y, lastX, lastY, event) {
        if (!this.editor.currentSprite) return;
        
        // Allow color picking while dragging
        this.pickColor(x, y, event);
    }

    // Handle mouse up event
    onMouseUp(x, y, event) {
        // Color picking is completed on mouse down
    }

    // Handle mouse move event
    onMouseMove(x, y, event) {
        // Show color preview at cursor position
        this.showColorPreview(x, y);
    }

    // Handle mouse leave event
    onMouseLeave(event) {
        this.hideColorPreview();
    }

    // Pick color from the specified position
    pickColor(x, y, event) {
        if (!this.editor.currentSprite) return;
        
        const sprite = this.editor.currentSprite;
        
        // Check bounds
        if (x < 0 || x >= sprite.width || y < 0 || y >= sprite.height) {
            return;
        }
        
        const pickedColor = sprite.getPixel(x, y);
        
        // Determine if this is primary or secondary color pick
        const isPrimaryPick = !event.shiftKey && !event.button === 2; // Left click without shift
        
        if (isPrimaryPick) {
            // Set as primary color
            this.editor.setPrimaryColor(pickedColor);
        } else {
            // Set as secondary color
            this.editor.setSecondaryColor(pickedColor);
        }
        
        // Update color picker and UI
        this.editor.updateColorUI();
        
        // Provide visual feedback
        this.showPickedColorFeedback(x, y, pickedColor, isPrimaryPick);
    }

    // Show color preview at cursor position
    showColorPreview(x, y) {
        if (!this.editor.currentSprite) return;
        
        const sprite = this.editor.currentSprite;
        
        // Check bounds
        if (x < 0 || x >= sprite.width || y < 0 || y >= sprite.height) {
            this.hideColorPreview();
            return;
        }
        
        const color = sprite.getPixel(x, y);
        const hexColor = this.rgbaToHex(color);
        
        // Create or update preview element
        let preview = document.getElementById('eyedropper-preview');
        if (!preview) {
            preview = document.createElement('div');
            preview.id = 'eyedropper-preview';
            preview.className = 'eyedropper-preview';
            document.body.appendChild(preview);
        }
        
        // Position preview near cursor
        const canvasRect = this.editor.canvasManager.mainCanvas.getBoundingClientRect();
        const screenPos = this.editor.canvasManager.spriteToScreen(x, y);
        
        preview.style.left = `${screenPos.x + 20}px`;
        preview.style.top = `${screenPos.y - 30}px`;
        preview.style.backgroundColor = hexColor;
        preview.textContent = hexColor.toUpperCase();
        preview.style.display = 'block';
        
        // Add transparency indication
        if (color[3] === 0) {
            preview.textContent = 'Transparent';
            preview.style.backgroundColor = 'transparent';
            preview.style.border = '2px dashed #666';
            preview.style.color = '#fff';
        } else {
            preview.style.border = '2px solid #333';
            preview.style.color = this.getContrastColor(color);
        }
    }

    // Hide color preview
    hideColorPreview() {
        const preview = document.getElementById('eyedropper-preview');
        if (preview) {
            preview.style.display = 'none';
        }
    }

    // Show visual feedback when color is picked
    showPickedColorFeedback(x, y, color, isPrimary) {
        // Create ripple effect at pick position
        const canvasRect = this.editor.canvasManager.mainCanvas.getBoundingClientRect();
        const screenPos = this.editor.canvasManager.spriteToScreen(x, y);
        
        const ripple = document.createElement('div');
        ripple.className = 'color-pick-ripple';
        ripple.style.position = 'fixed';
        ripple.style.left = `${screenPos.x}px`;
        ripple.style.top = `${screenPos.y}px`;
        ripple.style.width = '20px';
        ripple.style.height = '20px';
        ripple.style.borderRadius = '50%';
        ripple.style.border = `3px solid ${isPrimary ? '#00d4ff' : '#ff6b00'}`;
        ripple.style.backgroundColor = 'transparent';
        ripple.style.transform = 'translate(-50%, -50%) scale(0)';
        ripple.style.animation = 'colorPickRipple 0.6s ease-out';
        ripple.style.pointerEvents = 'none';
        ripple.style.zIndex = '10000';
        
        document.body.appendChild(ripple);
        
        // Remove ripple after animation
        setTimeout(() => {
            if (ripple.parentNode) {
                ripple.parentNode.removeChild(ripple);
            }
        }, 600);
        
        // Add ripple animation CSS if not exists
        if (!document.getElementById('eyedropper-styles')) {
            const style = document.createElement('style');
            style.id = 'eyedropper-styles';
            style.textContent = `
                .eyedropper-preview {
                    position: fixed;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: bold;
                    z-index: 10000;
                    pointer-events: none;
                    font-family: monospace;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                    display: none;
                }
                
                @keyframes colorPickRipple {
                    0% {
                        transform: translate(-50%, -50%) scale(0);
                        opacity: 1;
                    }
                    100% {
                        transform: translate(-50%, -50%) scale(2);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Convert RGBA color to hex string
    rgbaToHex(rgba) {
        const [r, g, b, a] = rgba;
        
        if (a === 0) return 'transparent';
        
        const toHex = (n) => {
            const hex = Math.round(n).toString(16).padStart(2, '0');
            return hex;
        };
        
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    // Get contrasting color (black or white) for text
    getContrastColor(rgba) {
        const [r, g, b] = rgba;
        // Calculate relative luminance
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? '#000000' : '#ffffff';
    }

    // Get color information at position
    getColorInfo(x, y) {
        if (!this.editor.currentSprite) return null;
        
        const sprite = this.editor.currentSprite;
        
        // Check bounds
        if (x < 0 || x >= sprite.width || y < 0 || y >= sprite.height) {
            return null;
        }
        
        const [r, g, b, a] = sprite.getPixel(x, y);
        
        return {
            rgba: [r, g, b, a],
            hex: this.rgbaToHex([r, g, b, a]),
            isTransparent: a === 0,
            position: { x, y }
        };
    }

    // Get tool settings UI elements
    getSettingsHTML() {
        return `
            <div class="setting-group">
                <label>Instructions:</label>
                <div class="tool-instructions">
                    <p><strong>Left click:</strong> Pick primary color</p>
                    <p><strong>Shift + click:</strong> Pick secondary color</p>
                    <p><strong>Right click:</strong> Pick secondary color</p>
                </div>
            </div>
            <div class="setting-group">
                <label>Color Information:</label>
                <div class="color-info" id="eyedropper-info">
                    Hover over pixels to see color info
                </div>
            </div>
        `;
    }

    // Initialize tool settings event listeners
    initializeSettings() {
        // Add right-click support for secondary color picking
        this.editor.canvasManager.mainCanvas.addEventListener('contextmenu', (e) => {
            if (this.editor.currentTool === this) {
                e.preventDefault();
                const pos = this.editor.canvasManager.screenToSprite(e.clientX, e.clientY);
                const mockEvent = { shiftKey: true, button: 2 };
                this.pickColor(pos.x, pos.y, mockEvent);
            }
        });
        
        // Update color info display on mouse move
        this.editor.canvasManager.mainCanvas.addEventListener('mousemove', (e) => {
            if (this.editor.currentTool === this) {
                const pos = this.editor.canvasManager.screenToSprite(e.clientX, e.clientY);
                this.updateColorInfo(pos.x, pos.y);
            }
        });
    }

    // Update color information display
    updateColorInfo(x, y) {
        const infoElement = document.getElementById('eyedropper-info');
        if (!infoElement) return;
        
        const colorInfo = this.getColorInfo(x, y);
        
        if (colorInfo) {
            const { rgba, hex, isTransparent, position } = colorInfo;
            
            if (isTransparent) {
                infoElement.innerHTML = `
                    <div>Position: (${position.x}, ${position.y})</div>
                    <div>Color: Transparent</div>
                `;
            } else {
                infoElement.innerHTML = `
                    <div>Position: (${position.x}, ${position.y})</div>
                    <div>Hex: ${hex.toUpperCase()}</div>
                    <div>RGBA: (${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${rgba[3]})</div>
                `;
            }
        } else {
            infoElement.innerHTML = 'Out of bounds';
        }
    }

    // Get tool cursor
    getCursor() {
        return 'crosshair';
    }
}
