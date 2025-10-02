// Main Application Entry Point
// Initializes the Pixel Editor when the DOM is loaded

// Global editor instance
let editor = null;

// Initialize the application
function initializeApp() {
    try {
        console.log('Initializing Pixel Editor...');
        
        // Check if all required elements exist
        const requiredElements = [
            'main-canvas',
            'overlay-canvas',
            'sprites-list',
            'tool-settings'
        ];
        
        const missingElements = requiredElements.filter(id => !document.getElementById(id));
        
        if (missingElements.length > 0) {
            console.error('Missing required elements:', missingElements);
            showErrorMessage('Missing required UI elements. Please check the HTML structure.');
            return;
        }
        
        // Create global editor instance
        editor = new PixelEditor();
        window.editor = editor; // Make it globally accessible for debugging
        
        // Set up error handling
        setupErrorHandling();
        
        // Set up performance monitoring
        setupPerformanceMonitoring();
        
        // Show welcome message
        showWelcomeMessage();
        
        console.log('Pixel Editor initialized successfully!');
        console.log('Editor instance available as window.editor');
        
    } catch (error) {
        console.error('Failed to initialize Pixel Editor:', error);
        showErrorMessage('Failed to initialize the editor. Please refresh the page and try again.');
    }
}

// Setup global error handling
function setupErrorHandling() {
    window.addEventListener('error', (event) => {
        console.error('Global error:', event.error);
        
        if (editor && editor.uiController) {
            editor.uiController.showNotification('An error occurred. Check the console for details.', 'error');
        }
    });
    
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
        
        if (editor && editor.uiController) {
            editor.uiController.showNotification('An async error occurred. Check the console for details.', 'error');
        }
    });
}

// Setup performance monitoring
// In the setupPerformanceMonitoring function, replace the localStorage monitoring section:
function setupPerformanceMonitoring() {
    // Monitor memory usage (if available)
    if ('memory' in performance) {
        setInterval(() => {
            const memory = performance.memory;
            if (memory.usedJSHeapSize > memory.totalJSHeapSize * 0.9) {
                console.warn('High memory usage detected:', {
                    used: `${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB`,
                    total: `${Math.round(memory.totalJSHeapSize / 1024 / 1024)}MB`
                });
            }
        }, 10000); // Check every 10 seconds
    }
    
    // Monitor IndexedDB storage usage
    setInterval(async () => {
        if (editor && editor.storageManager) {
            try {
                const usage = await editor.storageManager.getStorageUsage();
                if (usage.totalSize > 50 * 1024 * 1024) { // 50MB
                    console.warn('High IndexedDB usage:', usage.totalSizeFormatted);
                }
            } catch (error) {
                console.warn('Could not check storage usage:', error);
            }
        }
    }, 30000); // Check every 30 seconds
}

// Show welcome message
function showWelcomeMessage() {
    if (editor && editor.uiController) {
        setTimeout(() => {
            editor.uiController.showNotification('Welcome to Pixel Editor! Press H for help.', 'success');
        }, 1000);
    }
}

// Show error message
function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #ff6b6b;
        color: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        max-width: 400px;
        text-align: center;
        font-family: system-ui, -apple-system, sans-serif;
    `;
    errorDiv.innerHTML = `
        <h3 style="margin: 0 0 10px 0;">Initialization Error</h3>
        <p style="margin: 0 0 15px 0;">${message}</p>
        <button onclick="location.reload()" style="
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.3);
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
        ">Reload Page</button>
    `;
    
    document.body.appendChild(errorDiv);
}

// Keyboard shortcuts help
function showKeyboardHelp() {
    const helpContent = `
        <h3>Pixel Editor - Keyboard Shortcuts</h3>
        <div style="text-align: left; line-height: 1.6;">
            <h4>Tools:</h4>
            <ul style="margin: 0; padding-left: 20px;">
                <li><strong>B</strong> - Brush Tool</li>
                <li><strong>E</strong> - Eraser Tool</li>
                <li><strong>G</strong> - Bucket Fill Tool</li>
                <li><strong>M</strong> - Select Tool</li>
                <li><strong>I</strong> - Eyedropper Tool</li>
                <li><strong>L</strong> - Brightness Tool</li>
                <li><strong>Space</strong> - Temporary Eyedropper</li>
            </ul>
            
            <h4>Actions:</h4>
            <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Ctrl+Z</strong> - Undo</li>
                <li><strong>Ctrl+Y / Ctrl+Shift+Z</strong> - Redo</li>
                <li><strong>Ctrl+N</strong> - New Sprite</li>
                <li><strong>Ctrl+S</strong> - Save</li>
                <li><strong>Ctrl+E</strong> - Export SVG</li>
            </ul>
            
            <h4>View:</h4>
            <ul style="margin: 0; padding-left: 20px;">
                <li><strong>G</strong> - Toggle Grid</li>
                <li><strong>Ctrl/Cmd + Plus</strong> - Zoom In</li>
                <li><strong>Ctrl/Cmd + Minus</strong> - Zoom Out</li>
            </ul>
            
            <h4>Selection (Select Tool):</h4>
            <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Ctrl+C</strong> - Copy</li>
                <li><strong>Ctrl+X</strong> - Cut</li>
                <li><strong>Ctrl+V</strong> - Paste</li>
                <li><strong>Delete/Backspace</strong> - Delete Selection</li>
                <li><strong>Escape</strong> - Clear Selection</li>
            </ul>
        </div>
    `;
    
    const helpModal = document.createElement('div');
    helpModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(5px);
    `;
    
    const helpDialog = document.createElement('div');
    helpDialog.style.cssText = `
        background: #2d2d2d;
        color: white;
        padding: 30px;
        border-radius: 12px;
        max-width: 500px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        font-family: system-ui, -apple-system, sans-serif;
        position: relative;
    `;
    
    helpDialog.innerHTML = helpContent + `
        <button onclick="this.closest('.help-modal').remove()" style="
            position: absolute;
            top: 15px;
            right: 15px;
            background: none;
            border: none;
            color: #ccc;
            font-size: 24px;
            cursor: pointer;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
        ">×</button>
        <div style="text-align: center; margin-top: 20px;">
            <button onclick="this.closest('.help-modal').remove()" style="
                background: #00d4ff;
                color: #1a1a1a;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 500;
            ">Got it!</button>
        </div>
    `;
    
    helpModal.className = 'help-modal';
    helpModal.appendChild(helpDialog);
    
    // Close on outside click
    helpModal.addEventListener('click', (e) => {
        if (e.target === helpModal) {
            helpModal.remove();
        }
    });
    
    document.body.appendChild(helpModal);
}

// Debug utilities
function setupDebugUtilities() {
    // Make debug functions globally available
    window.debugPixelEditor = {
        getEditor: () => editor,
        getStats: () => editor ? editor.getStats() : null,
        exportSprites: () => editor ? editor.exportAllSprites() : null,
        reset: () => editor ? editor.reset() : null,
        showHelp: showKeyboardHelp
    };
    
    // Add debug keyboard shortcut
    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'h' && !e.ctrlKey && !e.metaKey && !e.target.matches('input, textarea')) {
            showKeyboardHelp();
        }
    });
    
    console.log('Debug utilities loaded. Use window.debugPixelEditor for debugging.');
}

// Check browser compatibility
function checkBrowserCompatibility() {
    const requiredFeatures = {
        'Canvas API': !!window.CanvasRenderingContext2D,
        'Local Storage': !!window.localStorage,
        'File API': !!window.File,
        'Blob API': !!window.Blob,
        'URL.createObjectURL': !!window.URL?.createObjectURL
    };
    
    const missingFeatures = Object.entries(requiredFeatures)
        .filter(([name, supported]) => !supported)
        .map(([name]) => name);
    
    if (missingFeatures.length > 0) {
        console.error('Browser compatibility issues:', missingFeatures);
        showErrorMessage(`Your browser is missing required features: ${missingFeatures.join(', ')}. Please use a modern browser.`);
        return false;
    }
    
    return true;
}

// Application startup sequence
function startApp() {
    console.log('Starting Pixel Editor...');
    
    // Check browser compatibility
    if (!checkBrowserCompatibility()) {
        return;
    }
    
    // Show loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'loading-indicator';
    loadingIndicator.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 20px;
        border-radius: 8px;
        z-index: 10000;
        text-align: center;
        font-family: system-ui, -apple-system, sans-serif;
    `;
    loadingIndicator.innerHTML = `
        <div style="margin-bottom: 10px;">Loading...</div>
        <div>Loading Pixel Editor...</div>
    `;
    document.body.appendChild(loadingIndicator);
    
    // Initialize app after DOM is fully loaded
    setTimeout(() => {
        initializeApp();
        setupDebugUtilities();
        
        // Remove loading indicator
        const indicator = document.getElementById('loading-indicator');
        if (indicator) {
            indicator.remove();
        }
    }, 500);
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}

// Sprite name editing logic
document.addEventListener('DOMContentLoaded', function() {

    // Initialize frame controls after editor is ready
    if (editor && editor.uiController) {
        editor.uiController.setupFrameControls();
    }
    
    // Ensure sprites have frame data for backward compatibility
    if (editor && editor.sprites) {
        editor.sprites.forEach(sprite => {
            if (!sprite.frames || sprite.frames.length === 0) {
                sprite.initializeFrames();
            }
        });
    }
    
    const nameDisplay = document.getElementById('sprite-name-display');
    const editBtn = document.getElementById('edit-sprite-name');
    let currentName = nameDisplay ? nameDisplay.textContent : 'Untitled';

    function enableEdit() {
        if (!nameDisplay) return;
        // Create input
        let spriteName = (window.editor && window.editor.currentSprite && window.editor.currentSprite.name) ? window.editor.currentSprite.name : currentName;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = spriteName;
        input.className = 'sprite-name-input';
        input.style.width = (spriteName.length * 10 + 40) + 'px';
        nameDisplay.replaceWith(input);
        editBtn.style.display = 'none';
        input.focus();

        function finishEdit() {
            let newName = input.value.trim() || 'Untitled';
            currentName = newName;
            // Restore display
            nameDisplay.textContent = newName;
            input.replaceWith(nameDisplay);
            editBtn.style.display = '';
            // Update sprite name in editor if needed
            if (window.editor && window.editor.currentSprite) {
                window.editor.currentSprite.name = newName;
                // Save sprites to persist name change
                if (window.editor.saveSprites) {
                    window.editor.saveSprites();
                }
                // Ensure current sprite is set to trigger sidebar update
                if (window.editor.setCurrentSprite) {
                    window.editor.setCurrentSprite(window.editor.currentSprite);
                }
                // Update sidebar and header using UIController
                if (window.editor.uiController) {
                    window.editor.uiController.updateHeaderSpriteName();
                    window.editor.uiController.updateSpritesList(); // Force sidebar rerender
                }
            }
        }

        input.addEventListener('blur', finishEdit);
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                input.blur();
            } else if (e.key === 'Escape') {
                input.value = currentName;
                input.blur();
            }
        });
    }

    if (editBtn) {
        editBtn.addEventListener('click', enableEdit);
    }

    // Listen for sprite change and update name display
    function updateSpriteNameFromCurrent() {
        if (window.editor && window.editor.currentSprite) {
            const sprite = window.editor.currentSprite;
            currentName = sprite.name || 'Untitled';
            if (nameDisplay) nameDisplay.textContent = currentName;
        }
    }

    // Patch setCurrentSprite to update header name
    if (window.editor) {
        const origSetCurrentSprite = window.editor.setCurrentSprite;
        window.editor.setCurrentSprite = function(sprite) {
            const result = origSetCurrentSprite.call(this, sprite);
            updateSpriteNameFromCurrent();
            return result;
        };
        // Initial update
        updateSpriteNameFromCurrent();
    } else {
        // If editor not ready, listen for it
        document.addEventListener('editor-ready', updateSpriteNameFromCurrent);
    }
});