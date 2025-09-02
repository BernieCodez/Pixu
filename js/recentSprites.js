// Recent Sprites Manager - Handles persistent folder access for sprites
class RecentSpritesManager {
    constructor(editor) {
        this.editor = editor;
        this.dirHandle = null;
        this.dbName = "pixelEditorDB";
        this.dbVersion = 1;
        this.storeName = "fileHandles";
        
        this.setupEventListeners();
        this.initializeDatabase();
    }

    // Initialize IndexedDB for storing file handles
    async initializeDatabase() {
        try {
            await this.loadStoredDirectoryHandle();
        } catch (error) {
            console.error('Failed to initialize recent sprites:', error);
        }
    }

    // Get IndexedDB instance
    async getDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };
        });
    }

    // Save directory handle to IndexedDB
    async saveDirectoryHandle(handle) {
        try {
            const db = await this.getDatabase();
            const transaction = db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            return new Promise((resolve, reject) => {
                const request = store.put(handle, 'spritesDirectory');
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Failed to save directory handle:', error);
            throw error;
        }
    }

    // Load directory handle from IndexedDB
    async loadDirectoryHandle() {
        try {
            const db = await this.getDatabase();
            const transaction = db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            
            return new Promise((resolve, reject) => {
                const request = store.get('spritesDirectory');
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Failed to load directory handle:', error);
            return null;
        }
    }

    // Load stored directory handle and check permissions
    async loadStoredDirectoryHandle() {
        const storedHandle = await this.loadDirectoryHandle();
        
        if (storedHandle) {
            try {
                // Check if we still have permission
                const permission = await storedHandle.queryPermission({ mode: 'readwrite' });
                
                if (permission === 'granted') {
                    this.dirHandle = storedHandle;
                    await this.loadRecentSprites();
                } else if (permission === 'prompt') {
                    // Try to request permission
                    const requestResult = await storedHandle.requestPermission({ mode: 'readwrite' });
                    if (requestResult === 'granted') {
                        this.dirHandle = storedHandle;
                        await this.loadRecentSprites();
                    }
                }
            } catch (error) {
                console.warn('Stored directory handle is no longer valid:', error);
                // Clear invalid handle
                await this.clearStoredHandle();
            }
        }
        
        this.updateUI();
    }

    // Clear stored directory handle
    async clearStoredHandle() {
        try {
            const db = await this.getDatabase();
            const transaction = db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            return new Promise((resolve, reject) => {
                const request = store.delete('spritesDirectory');
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Failed to clear stored handle:', error);
        }
    }

    // Setup event listeners
    setupEventListeners() {
        const pickFolderBtn = document.getElementById('pick-folder');
        if (pickFolderBtn) {
            pickFolderBtn.addEventListener('click', () => this.pickSpritesFolder());
            console.log('Pick folder button event listener added');
        } else {
            console.warn('Pick folder button not found');
        }
    }

    // Pick sprites folder
    async pickSpritesFolder() {
        console.log('pickSpritesFolder called');
        
        try {
            // Check if File System Access API is supported
            if (!('showDirectoryPicker' in window)) {
                console.log('showDirectoryPicker not supported');
                this.showUnsupportedMessage();
                return;
            }

            console.log('Calling showDirectoryPicker...');
            this.dirHandle = await window.showDirectoryPicker({
                mode: 'readwrite'
            });
            
            // Save handle for persistence
            await this.saveDirectoryHandle(this.dirHandle);
            
            // Request persistent storage
            if ('storage' in navigator && 'persist' in navigator.storage) {
                await navigator.storage.persist();
            }
            
            // Load sprites from the selected folder
            await this.loadRecentSprites();
            
            this.editor.uiManager.showNotification('Sprites folder selected successfully!', 'success');
            
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Failed to pick folder:', error);
                this.editor.uiManager.showNotification('Failed to select folder', 'error');
            }
        }
    }

    // Load recent sprites from the selected folder
    async loadRecentSprites() {
        if (!this.dirHandle) return;

        try {
            const sprites = [];
            
            for await (const entry of this.dirHandle.values()) {
                if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.svg')) {
                    try {
                        const file = await entry.getFile();
                        const url = URL.createObjectURL(file);
                        
                        sprites.push({
                            name: entry.name.replace('.svg', ''),
                            url: url,
                            file: file,
                            handle: entry,
                            size: `${file.size}B`,
                            modified: new Date(file.lastModified).toLocaleDateString()
                        });
                    } catch (error) {
                        console.warn(`Failed to load sprite: ${entry.name}`, error);
                    }
                }
            }
            
            // Sort by modified date (newest first)
            sprites.sort((a, b) => new Date(b.file.lastModified) - new Date(a.file.lastModified));
            
            this.displayRecentSprites(sprites);
            
        } catch (error) {
            console.error('Failed to load recent sprites:', error);
            this.editor.uiManager.showNotification('Failed to load sprites from folder', 'error');
        }
    }

    // Display recent sprites in the UI
    displayRecentSprites(sprites) {
        const container = document.getElementById('recent-sprites');
        if (!container) return;

        container.innerHTML = '';

        if (sprites.length === 0) {
            container.innerHTML = `
                <div class="no-sprites-message">
                    <i class="fas fa-image"></i>
                    <p>No SVG sprites found</p>
                    <p class="help-text">Save some sprites to see them here</p>
                </div>
            `;
            return;
        }

        sprites.forEach(sprite => {
            const spriteElement = document.createElement('div');
            spriteElement.className = 'recent-sprite-item';
            spriteElement.title = `${sprite.name} (${sprite.size})`;
            
            spriteElement.innerHTML = `
                <img src="${sprite.url}" alt="${sprite.name}" loading="lazy">
                <div class="recent-sprite-info">
                    <div class="recent-sprite-name">${sprite.name}</div>
                    <div class="recent-sprite-size">${sprite.modified}</div>
                </div>
            `;
            
            // Add click handler to load sprite
            spriteElement.addEventListener('click', () => {
                this.loadSpriteFromFile(sprite);
            });
            
            container.appendChild(spriteElement);
        });
    }

    // Load sprite from file into editor
    async loadSpriteFromFile(spriteInfo) {
        try {
            const svgText = await spriteInfo.file.text();
            
            // Parse SVG and convert to sprite
            const sprite = await this.parseSVGToSprite(svgText, spriteInfo.name);
            
            // Check if sprite with same name already exists
            const existingIndex = this.editor.sprites.findIndex(s => s.name === sprite.name);
            
            if (existingIndex !== -1) {
                // Replace existing sprite
                this.editor.sprites[existingIndex] = sprite;
                this.editor.setCurrentSprite(sprite);
                this.editor.uiManager.showNotification(`Replaced sprite: ${spriteInfo.name}`, 'success');
            } else {
                // Add new sprite to current session
                this.editor.sprites.push(sprite);
                this.editor.setCurrentSprite(sprite);
                this.editor.uiManager.showNotification(`Loaded sprite: ${spriteInfo.name}`, 'success');
            }
            
            this.editor.updateUI();
            
        } catch (error) {
            console.error('Failed to load sprite:', error);
            this.editor.uiManager.showNotification(`Failed to load sprite: ${spriteInfo.name}`, 'error');
        }
    }

    // Parse SVG text to create a Sprite object
    async parseSVGToSprite(svgText, name) {
        return new Promise((resolve, reject) => {
            try {
                // Create a temporary image to render the SVG
                const img = new Image();
                const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(svgBlob);
                
                img.onload = () => {
                    try {
                        // Create temporary canvas to rasterize SVG
                        const tempCanvas = document.createElement('canvas');
                        const tempCtx = tempCanvas.getContext('2d');
                        tempCanvas.width = img.naturalWidth || img.width || 32;
                        tempCanvas.height = img.naturalHeight || img.height || 32;
                        
                        tempCtx.drawImage(img, 0, 0);
                        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                        
                        const sprite = Sprite.fromImageData(imageData, name);
                        
                        URL.revokeObjectURL(url);
                        resolve(sprite);
                    } catch (error) {
                        URL.revokeObjectURL(url);
                        reject(error);
                    }
                };
                
                img.onerror = () => {
                    URL.revokeObjectURL(url);
                    reject(new Error('Failed to load SVG image'));
                };
                
                img.src = url;
                
            } catch (error) {
                reject(error);
            }
        });
    }

    // Save current sprite to the selected folder
    async saveCurrentSpriteToFolder() {
        if (!this.dirHandle || !this.editor.currentSprite) {
            this.editor.uiManager.showNotification('No folder selected or no current sprite', 'error');
            return;
        }

        try {
            const sprite = this.editor.currentSprite;
            const svgString = sprite.toSVG();
            const fileName = `${sprite.name}.svg`;
            
            const fileHandle = await this.dirHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            
            await writable.write(svgString);
            await writable.close();
            
            // Reload recent sprites to show the new file
            await this.loadRecentSprites();
            
            this.editor.uiManager.showNotification(`Saved sprite: ${fileName}`, 'success');
            
        } catch (error) {
            console.error('Failed to save sprite to folder:', error);
            this.editor.uiManager.showNotification('Failed to save sprite to folder', 'error');
        }
    }

    // Show unsupported browser message
    showUnsupportedMessage() {
        const container = document.getElementById('recent-sprites');
        if (container) {
            container.innerHTML = `
                <div class="no-sprites-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Feature not supported</p>
                    <p class="help-text">Your browser doesn't support the File System Access API. Try Chrome 86+</p>
                </div>
            `;
        }
    }

    // Update UI based on current state
    updateUI() {
        const pickFolderBtn = document.getElementById('pick-folder');
        const container = document.getElementById('recent-sprites');
        
        if (!this.dirHandle) {
            if (container && !('showDirectoryPicker' in window)) {
                this.showUnsupportedMessage();
            } else if (container) {
                container.innerHTML = `
                    <div class="no-sprites-message">
                        <i class="fas fa-folder-open"></i>
                        <p>No sprites folder selected</p>
                        <p class="help-text">Pick a folder to save and load sprites</p>
                    </div>
                `;
            }
            
            if (pickFolderBtn) {
                pickFolderBtn.innerHTML = '<i class="fas fa-folder-open"></i> Pick Sprites Folder';
            }
        } else {
            if (pickFolderBtn) {
                pickFolderBtn.innerHTML = '<i class="fas fa-sync"></i> Refresh Sprites';
                pickFolderBtn.onclick = () => this.loadRecentSprites();
            }
        }
    }
}

// Make RecentSpritesManager globally available
window.RecentSpritesManager = RecentSpritesManager;
