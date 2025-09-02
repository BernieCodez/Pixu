// Storage Manager - Handles local storage operations for sprites
class StorageManager {
    constructor() {
        this.storageKey = 'pixel-editor-sprites';
        this.settingsKey = 'pixel-editor-settings';
    }

    // Save sprites to localStorage
    saveSprites(sprites) {
        try {
            const serializedSprites = sprites.map(sprite => ({
                id: sprite.id,
                name: sprite.name,
                width: sprite.width,
                height: sprite.height,
                pixels: sprite.getPixelArray(),
                createdAt: sprite.createdAt,
                modifiedAt: sprite.modifiedAt
            }));
            
            localStorage.setItem(this.storageKey, JSON.stringify(serializedSprites));
            return true;
        } catch (error) {
            console.error('Failed to save sprites:', error);
            return false;
        }
    }

    /**
     * Load sprites from localStorage
     */
    loadSprites() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (!data) return [];
            
            const sprites = JSON.parse(data);
            return sprites.map(spriteData => {
                const sprite = new Sprite(
                    spriteData.width,
                    spriteData.height,
                    spriteData.name,
                    spriteData.id
                );
                sprite.setPixelArray(spriteData.pixels);
                sprite.createdAt = spriteData.createdAt;
                sprite.modifiedAt = spriteData.modifiedAt;
                return sprite;
            });
        } catch (error) {
            console.error('Failed to load sprites:', error);
            return [];
        }
    }

    /**
     * Save user settings
     */
    saveSettings(settings) {
        try {
            localStorage.setItem(this.settingsKey, JSON.stringify(settings));
            return true;
        } catch (error) {
            console.error('Failed to save settings:', error);
            return false;
        }
    }

    /**
     * Load user settings
     */
    loadSettings() {
        try {
            const data = localStorage.getItem(this.settingsKey);
            if (!data) return this.getDefaultSettings();
            
            const settings = JSON.parse(data);
            return { ...this.getDefaultSettings(), ...settings };
        } catch (error) {
            console.error('Failed to load settings:', error);
            return this.getDefaultSettings();
        }
    }

    /**
     * Get default settings
     */
    getDefaultSettings() {
        return {
            brushSize: 1,
            brushOpacity: 100,
            bucketTolerance: 10,
            brightnessIntensity: 10,
            showGrid: false,
            zoomLevel: 1,
            primaryColor: '#000000',
            secondaryColor: '#ffffff',
            colorPalette: [
                '#000000', '#ffffff', '#ff0000', '#00ff00',
                '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
                '#800000', '#008000', '#000080', '#808000',
                '#800080', '#008080', '#c0c0c0', '#808080'
            ]
        };
    }

    /**
     * Clear all stored data
     */
    clearAll() {
        try {
            localStorage.removeItem(this.storageKey);
            localStorage.removeItem(this.settingsKey);
            return true;
        } catch (error) {
            console.error('Failed to clear storage:', error);
            return false;
        }
    }

    /**
     * Export sprites as JSON file
     */
    exportSprites(sprites) {
        try {
            const exportData = {
                version: '1.0',
                createdAt: new Date().toISOString(),
                sprites: sprites.map(sprite => ({
                    id: sprite.id,
                    name: sprite.name,
                    width: sprite.width,
                    height: sprite.height,
                    pixels: sprite.getPixelArray(),
                    createdAt: sprite.createdAt,
                    modifiedAt: sprite.modifiedAt
                }))
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pixel-editor-sprites-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            return true;
        } catch (error) {
            console.error('Failed to export sprites:', error);
            return false;
        }
    }

    /**
     * Import sprites from JSON file
     */
    async importSprites(file) {
        try {
            const text = await this.readFileAsText(file);
            const importData = JSON.parse(text);
            
            if (!importData.sprites || !Array.isArray(importData.sprites)) {
                throw new Error('Invalid sprite file format');
            }
            
            return importData.sprites.map(spriteData => {
                const sprite = new Sprite(
                    spriteData.width,
                    spriteData.height,
                    spriteData.name,
                    spriteData.id || Date.now() + Math.random()
                );
                sprite.setPixelArray(spriteData.pixels);
                sprite.createdAt = spriteData.createdAt || new Date().toISOString();
                sprite.modifiedAt = spriteData.modifiedAt || new Date().toISOString();
                return sprite;
            });
        } catch (error) {
            console.error('Failed to import sprites:', error);
            throw error;
        }
    }

    /**
     * Read file as text
     */
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    /**
     * Get storage usage information
     */
    getStorageUsage() {
        try {
            const sprites = localStorage.getItem(this.storageKey) || '';
            const settings = localStorage.getItem(this.settingsKey) || '';
            
            return {
                spritesSize: new Blob([sprites]).size,
                settingsSize: new Blob([settings]).size,
                totalSize: new Blob([sprites + settings]).size,
                totalSizeFormatted: this.formatBytes(new Blob([sprites + settings]).size)
            };
        } catch (error) {
            console.error('Failed to get storage usage:', error);
            return { spritesSize: 0, settingsSize: 0, totalSize: 0, totalSizeFormatted: '0 B' };
        }
    }

    /**
     * Format bytes to human readable string
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Create global instance
window.storageManager = new StorageManager();
