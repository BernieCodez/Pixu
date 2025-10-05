// Canvas-Based Storage Manager - Optimized for large pixel art
class CanvasStorageManager {
  constructor() {
    this.dbName = "PixelEditorDB_v3";
    this.dbVersion = 3;
    this.spritesStore = "sprites";
    this.settingsStore = "settings";
    this.canvasStore = "canvasData"; // New store for canvas blobs
    this.db = null;
    this.initPromise = this.initDB();
    
    // Canvas pool for reuse
    this.canvasPool = [];
    this.maxPoolSize = 5;
  }

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

        // Create sprites metadata store
        if (!db.objectStoreNames.contains(this.spritesStore)) {
          const spritesStore = db.createObjectStore(this.spritesStore, {
            keyPath: "id",
          });
          spritesStore.createIndex("name", "name", { unique: false });
          spritesStore.createIndex("modifiedAt", "modifiedAt", { unique: false });
          spritesStore.createIndex("size", "size", { unique: false });
        }

        // Create settings store
        if (!db.objectStoreNames.contains(this.settingsStore)) {
          db.createObjectStore(this.settingsStore, { keyPath: "key" });
        }

        // Create canvas data store for binary blobs
        if (!db.objectStoreNames.contains(this.canvasStore)) {
          const canvasStore = db.createObjectStore(this.canvasStore, {
            keyPath: ["spriteId", "frameIndex", "layerIndex"],
          });
          canvasStore.createIndex("spriteId", "spriteId", { unique: false });
        }
      };
    });
  }

  // Get or create canvas from pool
  getCanvas(width, height) {
    let canvas = this.canvasPool.pop();
    if (!canvas) {
      canvas = document.createElement('canvas');
    }
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  // Return canvas to pool
  returnCanvas(canvas) {
    if (this.canvasPool.length < this.maxPoolSize) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.canvasPool.push(canvas);
    }
  }

  // Convert layer pixels to canvas blob (much more efficient)
  async layerToBlob(layer, width, height) {
    const canvas = this.getCanvas(width, height);
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    
    if (layer.useTypedArray && layer.pixels instanceof Uint8Array) {
      data.set(layer.pixels);
    } else if (Array.isArray(layer.pixels)) {
      let index = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const pixel = layer.pixels[y]?.[x] || [0, 0, 0, 0];
          data[index++] = pixel[0];
          data[index++] = pixel[1];
          data[index++] = pixel[2];
          data[index++] = pixel[3];
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Convert to blob (compressed)
    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, 'image/png', 0.92);
    });
    
    this.returnCanvas(canvas);
    return blob;
  }

  // Convert blob back to pixel array
  async blobToPixels(blob, width, height, useTypedArray = false) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      
      img.onload = () => {
        const canvas = this.getCanvas(width, height);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        let pixels;
        if (useTypedArray) {
          pixels = new Uint8Array(data);
        } else {
          pixels = [];
          let index = 0;
          for (let y = 0; y < height; y++) {
            pixels[y] = [];
            for (let x = 0; x < width; x++) {
              pixels[y][x] = [
                data[index++],
                data[index++],
                data[index++],
                data[index++]
              ];
            }
          }
        }
        
        this.returnCanvas(canvas);
        URL.revokeObjectURL(url);
        resolve(pixels);
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(useTypedArray ? new Uint8Array(width * height * 4) : []);
      };
      
      img.src = url;
    });
  }

  async saveSprite(sprite) {
    try {
      await this.ensureDB();

      if (!sprite.frames || sprite.frames.length === 0) {
        sprite.initializeFrames();
      }

      // Always update modifiedAt before saving
      sprite.modifiedAt = Date.now();

      // Save sprite metadata
      const metadata = {
        id: sprite.id,
        name: sprite.name,
        width: sprite.width,
        height: sprite.height,
        frameCount: sprite.frames.length,
        isAnimated: sprite.frames.length > 1,
        createdAt: sprite.createdAt,
        modifiedAt: sprite.modifiedAt,
        size: sprite.width * sprite.height,
      };

      // Convert all layers to blobs BEFORE starting transaction
      const canvasDataArray = [];
      for (let frameIndex = 0; frameIndex < sprite.frames.length; frameIndex++) {
        const frame = sprite.frames[frameIndex];
        
        for (let layerIndex = 0; layerIndex < frame.layers.length; layerIndex++) {
          const layer = frame.layers[layerIndex];
          const blob = await this.layerToBlob(layer, frame.width, frame.height);
          
          canvasDataArray.push({
            spriteId: sprite.id,
            frameIndex,
            layerIndex,
            layerId: layer.id,
            layerName: layer.name,
            visible: layer.visible,
            opacity: layer.opacity,
            locked: layer.locked || false,
            blendMode: layer.blendMode || 'normal',
            blob
          });
        }
      }

      // Now start transaction and put all data synchronously
      const transaction = this.db.transaction(
        [this.spritesStore, this.canvasStore],
        "readwrite"
      );
      const spritesStore = transaction.objectStore(this.spritesStore);
      const canvasStore = transaction.objectStore(this.canvasStore);

      // Save metadata
      spritesStore.put(metadata);

      // Save all canvas data
      for (const canvasData of canvasDataArray) {
        canvasStore.put(canvasData);
      }

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => {
          console.log(`Sprite ${sprite.name} saved (canvas-based)`);
          resolve(true);
        };
        transaction.onerror = () => {
          console.error('Transaction failed:', transaction.error);
          reject(transaction.error);
        };
        transaction.onabort = () => {
          console.error('Transaction aborted:', transaction.error);
          reject(transaction.error);
        };
      });
    } catch (error) {
      console.error('Failed to save sprite:', error);
      return false;
    }
  }

  async loadSprite(spriteId) {
    try {
      await this.ensureDB();

      const transaction = this.db.transaction(
        [this.spritesStore, this.canvasStore],
        "readonly"
      );
      const spritesStore = transaction.objectStore(this.spritesStore);
      const canvasStore = transaction.objectStore(this.canvasStore);

      // Load metadata
      const metadata = await new Promise((resolve, reject) => {
        const request = spritesStore.get(spriteId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (!metadata) {
        return null;
      }

      // Load canvas data
      const canvasIndex = canvasStore.index('spriteId');
      const canvasData = await new Promise((resolve, reject) => {
        const request = canvasIndex.getAll(spriteId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      // Reconstruct sprite
      const frames = [];
      const useTypedArray = metadata.width * metadata.height > 50000;

      // Group canvas data by frame
      const frameMap = new Map();
      for (const layerData of canvasData) {
        if (!frameMap.has(layerData.frameIndex)) {
          frameMap.set(layerData.frameIndex, []);
        }
        frameMap.get(layerData.frameIndex).push(layerData);
      }

      // Convert blobs back to pixels
      for (let i = 0; i < metadata.frameCount; i++) {
        const frameLayers = frameMap.get(i) || [];
        frameLayers.sort((a, b) => a.layerIndex - b.layerIndex);

        const layers = [];
        for (const layerData of frameLayers) {
          const pixels = await this.blobToPixels(
            layerData.blob,
            metadata.width,
            metadata.height,
            useTypedArray
          );

          layers.push({
            id: layerData.layerId,
            name: layerData.layerName,
            visible: layerData.visible,
            opacity: layerData.opacity,
            locked: layerData.locked,
            blendMode: layerData.blendMode,
            pixels,
            useTypedArray
          });
        }

        frames.push({
          id: Date.now() + Math.random() + i,
          name: `Frame ${i + 1}`,
          width: metadata.width,
          height: metadata.height,
          activeLayerIndex: 0,
          layers
        });
      }

      const sprite = new Sprite(
        metadata.width,
        metadata.height,
        metadata.name,
        metadata.id
      );

      sprite.frames = frames;
      sprite.createdAt = metadata.createdAt;
      sprite.modifiedAt = metadata.modifiedAt;

      return sprite;
    } catch (error) {
      console.error('Failed to load sprite:', error);
      return null;
    }
  }

  async loadSprites() {
    try {
      await this.ensureDB();
      
      const transaction = this.db.transaction([this.spritesStore], "readonly");
      const store = transaction.objectStore(this.spritesStore);
      const index = store.index('modifiedAt');

      const metadataList = await new Promise((resolve, reject) => {
        const request = index.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      // Load sprites in parallel (limit to 5 at a time to avoid memory issues)
      const sprites = [];
      const batchSize = 5;
      
      for (let i = 0; i < metadataList.length; i += batchSize) {
        const batch = metadataList.slice(i, i + batchSize);
        const batchSprites = await Promise.all(
          batch.map(meta => this.loadSprite(meta.id))
        );
        sprites.push(...batchSprites.filter(s => s !== null));
      }

      return sprites;
    } catch (error) {
      console.error('Failed to load sprites:', error);
      return [];
    }
  }

  async saveSprites(sprites) {
    try {
      if (!sprites || sprites.length === 0) return true;

      // Always save all sprites, even in import mode
      let successCount = 0;
      for (const sprite of sprites) {
        try {
          const success = await this.saveSprite(sprite);
          if (success) successCount++;
        } catch (error) {
          console.error(`Failed to save sprite ${sprite.name}:`, error);
        }
      }

      console.log(`Successfully saved ${successCount}/${sprites.length} sprites (canvas-based)`);
      return successCount === sprites.length;
    } catch (error) {
      console.error('Failed to save sprites:', error);
      return false;
    }
  }

  async deleteSprite(spriteId) {
    try {
      await this.ensureDB();

      const transaction = this.db.transaction(
        [this.spritesStore, this.canvasStore],
        "readwrite"
      );
      const spritesStore = transaction.objectStore(this.spritesStore);
      const canvasStore = transaction.objectStore(this.canvasStore);

      // Delete metadata
      spritesStore.delete(spriteId);

      // Delete all canvas data for this sprite
      const canvasIndex = canvasStore.index('spriteId');
      const canvasRequest = canvasIndex.openCursor(spriteId);

      canvasRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      console.error('Failed to delete sprite:', error);
      return false;
    }
  }

  async clearSprites() {
    try {
      await this.ensureDB();

      const transaction = this.db.transaction(
        [this.spritesStore, this.canvasStore],
        "readwrite"
      );
      const spritesStore = transaction.objectStore(this.spritesStore);
      const canvasStore = transaction.objectStore(this.canvasStore);

      return new Promise((resolve, reject) => {
        spritesStore.clear();
        canvasStore.clear();

        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      console.error('Failed to clear sprites:', error);
      return false;
    }
  }

  async ensureDB() {
    if (!this.db) {
      await this.initPromise;
    }
    return this.db;
  }

  // Settings methods (unchanged)
  async saveSettings(settings) {
    try {
      await this.ensureDB();

      const transaction = this.db.transaction([this.settingsStore], "readwrite");
      const store = transaction.objectStore(this.settingsStore);

      return new Promise((resolve, reject) => {
        const request = store.put({ key: 'userSettings', data: settings });
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
      return false;
    }
  }

  async loadSettings() {
    try {
      await this.ensureDB();

      const transaction = this.db.transaction([this.settingsStore], "readonly");
      const store = transaction.objectStore(this.settingsStore);

      return new Promise((resolve, reject) => {
        const request = store.get('userSettings');
        request.onsuccess = () => {
          const result = request.result;
          resolve(result ? result.data : this.getDefaultSettings());
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
      return this.getDefaultSettings();
    }
  }

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
        "#000000", "#ffffff", "#ff0000", "#00ff00",
        "#0000ff", "#ffff00", "#ff00ff", "#00ffff",
        "#800000", "#008000", "#000080", "#808000",
        "#800080", "#008080", "#c0c0c0", "#808080",
      ],
    };
  }

  async getStorageUsage() {
    try {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage,
        quota: estimate.quota,
        usedFormatted: this.formatBytes(estimate.usage),
        quotaFormatted: this.formatBytes(estimate.quota),
        percentUsed: ((estimate.usage / estimate.quota) * 100).toFixed(2)
      };
    } catch (error) {
      console.error('Failed to get storage usage:', error);
      return null;
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.canvasPool = [];
  }
}

// Global instance
window.canvasStorageManager = new CanvasStorageManager();
console.log('✓ CanvasStorageManager initialized');

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CanvasStorageManager;
}
