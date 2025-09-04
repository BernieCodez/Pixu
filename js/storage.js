// Storage Manager - Handles IndexedDB operations for sprites
class StorageManager {
  constructor() {
    this.dbName = "PixelEditorDB";
    this.dbVersion = 1;
    this.spritesStore = "sprites";
    this.settingsStore = "settings";
    this.db = null;
    this.initPromise = this.initDB();
  }

  /**
   * Initialize IndexedDB
   */
  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error("Failed to open IndexedDB:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create sprites object store
        if (!db.objectStoreNames.contains(this.spritesStore)) {
          const spritesStore = db.createObjectStore(this.spritesStore, {
            keyPath: "id",
          });
          spritesStore.createIndex("name", "name", { unique: false });
          spritesStore.createIndex("createdAt", "createdAt", { unique: false });
        }

        // Create settings object store
        if (!db.objectStoreNames.contains(this.settingsStore)) {
          db.createObjectStore(this.settingsStore, { keyPath: "key" });
        }
      };
    });
  }

  /**
   * Ensure database is initialized
   */
  async ensureDB() {
    if (!this.db) {
      await this.initPromise;
    }
    return this.db;
  }

  /**
   * Save sprites to IndexedDB
   */
  async saveSprites(sprites) {
    try {
      await this.ensureDB();

      const transaction = this.db.transaction([this.spritesStore], "readwrite");
      const store = transaction.objectStore(this.spritesStore);

      // Clear existing sprites first
      await new Promise((resolve, reject) => {
        const clearRequest = store.clear();
        clearRequest.onsuccess = () => resolve();
        clearRequest.onerror = () => reject(clearRequest.error);
      });

      // Add all sprites in sequence to avoid transaction timeout
      for (const sprite of sprites) {
        const spriteData = {
          id: sprite.id,
          name: sprite.name,
          width: sprite.width,
          height: sprite.height,
          pixels: sprite.getPixelArray(),
          createdAt: sprite.createdAt,
          modifiedAt: sprite.modifiedAt,
        };

        await new Promise((resolve, reject) => {
          const request = store.add(spriteData);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }

      return true;
    } catch (error) {
      console.error("Failed to save sprites:", error);
      return false;
    }
  }

  /**
   * Save a single sprite to IndexedDB
   */
  async saveSprite(sprite) {
    try {
      await this.ensureDB();

      const transaction = this.db.transaction([this.spritesStore], "readwrite");
      const store = transaction.objectStore(this.spritesStore);

      const spriteData = {
        id: sprite.id,
        name: sprite.name,
        width: sprite.width,
        height: sprite.height,
        pixels: sprite.getPixelArray(),
        createdAt: sprite.createdAt,
        modifiedAt: sprite.modifiedAt,
      };

      return new Promise((resolve, reject) => {
        const request = store.put(spriteData);
        request.onsuccess = () => resolve(true);
        request.onerror = () => {
          console.error("Failed to save sprite:", request.error);
          resolve(false);
        };
      });
    } catch (error) {
      console.error("Failed to save sprite:", error);
      return false;
    }
  }

  /**
   * Load sprites from IndexedDB
   */
  async loadSprites() {
    try {
      await this.ensureDB();

      const transaction = this.db.transaction([this.spritesStore], "readonly");
      const store = transaction.objectStore(this.spritesStore);

      return new Promise((resolve, reject) => {
        const request = store.getAll();

        request.onsuccess = () => {
          const spritesData = request.result;
          const sprites = spritesData.map((spriteData) => {
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
          resolve(sprites);
        };

        request.onerror = () => {
          console.error("Failed to load sprites:", request.error);
          resolve([]);
        };
      });
    } catch (error) {
      console.error("Failed to load sprites:", error);
      return [];
    }
  }

  /**
   * Delete a sprite from IndexedDB
   */
  async deleteSprite(spriteId) {
    try {
      await this.ensureDB();

      const transaction = this.db.transaction([this.spritesStore], "readwrite");
      const store = transaction.objectStore(this.spritesStore);

      return new Promise((resolve, reject) => {
        const request = store.delete(spriteId);
        request.onsuccess = () => resolve(true);
        request.onerror = () => {
          console.error("Failed to delete sprite:", request.error);
          resolve(false);
        };
      });
    } catch (error) {
      console.error("Failed to delete sprite:", error);
      return false;
    }
  }

  /**
   * Clear all sprites from IndexedDB
   */
  async clearSprites() {
    try {
      await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(
          [this.spritesStore],
          "readwrite"
        );
        const store = transaction.objectStore(this.spritesStore);
        const request = store.clear();

        request.onsuccess = () => resolve(true);
        request.onerror = () => {
          console.error("Failed to clear sprites:", request.error);
          resolve(false);
        };
      });
    } catch (error) {
      console.error("Failed to clear sprites:", error);
      return false;
    }
  }

  /**
   * Save user settings to IndexedDB
   */
  // In the saveSettings method, ensure we're not storing Promise objects:
  async saveSettings(settings) {
    try {
      await this.ensureDB();

      // Deep clone settings to avoid Promise references
      const cleanSettings = JSON.parse(JSON.stringify(settings));

      const transaction = this.db.transaction(
        [this.settingsStore],
        "readwrite"
      );
      const store = transaction.objectStore(this.settingsStore);

      const settingsData = {
        key: "userSettings",
        data: cleanSettings,
      };

      return new Promise((resolve, reject) => {
        const request = store.put(settingsData);
        request.onsuccess = () => resolve(true);
        request.onerror = () => {
          console.error("Failed to save settings:", request.error);
          resolve(false);
        };
      });
    } catch (error) {
      console.error("Failed to save settings:", error);
      return false;
    }
  }
  // Also add a cleanup method to handle async operations safely:
  async cleanup() {
    // Wait for any pending operations
    if (this.initPromise) {
      try {
        await this.initPromise;
      } catch (error) {
        console.warn("Init promise cleanup error:", error);
      }
    }

    this.close();
  }
  /**
   * Load user settings from IndexedDB
   */
  async loadSettings() {
    try {
      await this.ensureDB();

      const transaction = this.db.transaction([this.settingsStore], "readonly");
      const store = transaction.objectStore(this.settingsStore);

      return new Promise((resolve, reject) => {
        const request = store.get("userSettings");

        request.onsuccess = () => {
          if (request.result && request.result.data) {
            const settings = {
              ...this.getDefaultSettings(),
              ...request.result.data,
            };
            resolve(settings);
          } else {
            resolve(this.getDefaultSettings());
          }
        };

        request.onerror = () => {
          console.error("Failed to load settings:", request.error);
          resolve(this.getDefaultSettings());
        };
      });
    } catch (error) {
      console.error("Failed to load settings:", error);
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
      primaryColor: "#000000",
      secondaryColor: "#ffffff",
      colorPalette: [
        "#000000",
        "#ffffff",
        "#ff0000",
        "#00ff00",
        "#0000ff",
        "#ffff00",
        "#ff00ff",
        "#00ffff",
        "#800000",
        "#008000",
        "#000080",
        "#808000",
        "#800080",
        "#008080",
        "#c0c0c0",
        "#808080",
      ],
    };
  }

  /**
   * Clear all stored data
   */
  async clearAll() {
    try {
      await this.ensureDB();

      const transaction = this.db.transaction(
        [this.spritesStore, this.settingsStore],
        "readwrite"
      );
      const spritesStore = transaction.objectStore(this.spritesStore);
      const settingsStore = transaction.objectStore(this.settingsStore);

      const clearSprites = new Promise((resolve, reject) => {
        const request = spritesStore.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      const clearSettings = new Promise((resolve, reject) => {
        const request = settingsStore.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      await Promise.all([clearSprites, clearSettings]);
      return true;
    } catch (error) {
      console.error("Failed to clear storage:", error);
      return false;
    }
  }

  /**
   * Export sprites as JSON file
   */
  async exportSprites(sprites) {
    try {
      const exportData = {
        version: "1.0",
        createdAt: new Date().toISOString(),
        sprites: sprites.map((sprite) => ({
          id: sprite.id,
          name: sprite.name,
          width: sprite.width,
          height: sprite.height,
          pixels: sprite.getPixelArray(),
          createdAt: sprite.createdAt,
          modifiedAt: sprite.modifiedAt,
        })),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pixel-editor-sprites-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return true;
    } catch (error) {
      console.error("Failed to export sprites:", error);
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
        throw new Error("Invalid sprite file format");
      }

      return importData.sprites.map((spriteData) => {
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
      console.error("Failed to import sprites:", error);
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
  async getStorageUsage() {
    try {
      const sprites = await this.loadSprites();
      const settings = await this.loadSettings();

      const spritesSize = new Blob([JSON.stringify(sprites)]).size;
      const settingsSize = new Blob([JSON.stringify(settings)]).size;
      const totalSize = spritesSize + settingsSize;

      return {
        spritesSize,
        settingsSize,
        totalSize,
        totalSizeFormatted: this.formatBytes(totalSize),
        spriteCount: sprites.length,
      };
    } catch (error) {
      console.error("Failed to get storage usage:", error);
      return {
        spritesSize: 0,
        settingsSize: 0,
        totalSize: 0,
        totalSizeFormatted: "0 B",
        spriteCount: 0,
      };
    }
  }

  /**
   * Format bytes to human readable string
   */
  formatBytes(bytes) {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * Get database connection status
   */
  isConnected() {
    return this.db !== null;
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Create global instance
// Update the global instance creation to handle initialization better:
// Replace the last line with:
(async () => {
  window.storageManager = new StorageManager();
  try {
    await window.storageManager.initPromise;
    console.log("Storage manager initialized successfully");
  } catch (error) {
    console.error("Storage manager initialization failed:", error);
  }
})();
