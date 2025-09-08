// Storage Manager - Optimized for large sprites
class StorageManager {
  constructor() {
    this.dbName = "PixelEditorDB";
    this.dbVersion = 2; // Increment for schema changes
    this.spritesStore = "sprites";
    this.settingsStore = "settings";
    this.db = null;
    this.initPromise = this.initDB();

    // Compression and chunking for large sprites
    this.compressionThreshold = 100000; // Pixels threshold for compression
    this.chunkSize = 50000; // Size of chunks for very large sprites
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

        // Create or upgrade sprites object store
        if (!db.objectStoreNames.contains(this.spritesStore)) {
          const spritesStore = db.createObjectStore(this.spritesStore, {
            keyPath: "id",
          });
          spritesStore.createIndex("name", "name", { unique: false });
          spritesStore.createIndex("createdAt", "createdAt", { unique: false });
          spritesStore.createIndex("size", "size", { unique: false }); // Add size index
        }

        // Create settings object store
        if (!db.objectStoreNames.contains(this.settingsStore)) {
          db.createObjectStore(this.settingsStore, { keyPath: "key" });
        }

        // Add chunks store for very large sprites
        if (!db.objectStoreNames.contains("spriteChunks")) {
          const chunksStore = db.createObjectStore("spriteChunks", {
            keyPath: ["spriteId", "chunkIndex"],
          });
          chunksStore.createIndex("spriteId", "spriteId", { unique: false });
        }
      };
    });
  }

  // Compress pixel data for large sprites
  compressPixelData(pixels) {
    // Simple run-length encoding for transparent areas
    if (!Array.isArray(pixels)) return pixels;

    const compressed = [];
    let currentRun = null;
    let runLength = 0;

    for (let y = 0; y < pixels.length; y++) {
      for (let x = 0; x < pixels[y].length; x++) {
        const pixel = pixels[y][x];
        const isTransparent = pixel[3] === 0;

        if (currentRun === null) {
          currentRun = {
            transparent: isTransparent,
            pixels: isTransparent ? [] : [pixel],
          };
          runLength = 1;
        } else if (
          currentRun.transparent === isTransparent &&
          runLength < 65535
        ) {
          if (!isTransparent) {
            currentRun.pixels.push(pixel);
          }
          runLength++;
        } else {
          // Save current run
          if (currentRun.transparent) {
            compressed.push({ type: "transparent", count: runLength });
          } else {
            compressed.push({ type: "pixels", pixels: currentRun.pixels });
          }

          // Start new run
          currentRun = {
            transparent: isTransparent,
            pixels: isTransparent ? [] : [pixel],
          };
          runLength = 1;
        }
      }
    }

    // Save final run
    if (currentRun) {
      if (currentRun.transparent) {
        compressed.push({ type: "transparent", count: runLength });
      } else {
        compressed.push({ type: "pixels", pixels: currentRun.pixels });
      }
    }

    return compressed;
  }

  // Decompress pixel data
  decompressPixelData(compressed, width, height) {
    if (!Array.isArray(compressed) || compressed.length === 0)
      return compressed;

    const pixels = [];
    let x = 0,
      y = 0;

    // Initialize array
    for (let row = 0; row < height; row++) {
      pixels[row] = [];
    }

    for (const run of compressed) {
      if (run.type === "transparent") {
        for (let i = 0; i < run.count; i++) {
          pixels[y][x] = [0, 0, 0, 0];
          x++;
          if (x >= width) {
            x = 0;
            y++;
          }
        }
      } else if (run.type === "pixels") {
        for (const pixel of run.pixels) {
          pixels[y][x] = pixel;
          x++;
          if (x >= width) {
            x = 0;
            y++;
          }
        }
      }
    }

    return pixels;
  }

  // Save large sprite in chunks if necessary
  async saveLargeSprite(sprite) {
    const pixelCount = sprite.width * sprite.height;

    if (pixelCount <= this.chunkSize) {
      return this.saveRegularSprite(sprite);
    }

    // Save sprite metadata
    const spriteData = {
      id: sprite.id,
      name: sprite.name,
      width: sprite.width,
      height: sprite.height,
      createdAt: sprite.createdAt,
      modifiedAt: sprite.modifiedAt,
      size: pixelCount,
      chunked: true,
      chunkCount: Math.ceil(pixelCount / this.chunkSize),
    };

    await this.ensureDB();

    // Save metadata
    const transaction = this.db.transaction([this.spritesStore], "readwrite");
    const store = transaction.objectStore(this.spritesStore);
    await new Promise((resolve, reject) => {
      const request = store.put(spriteData);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Save chunks
    const pixels = sprite.getPixelArray();
    const flatPixels = pixels.flat();

    for (let i = 0; i < flatPixels.length; i += this.chunkSize) {
      const chunk = flatPixels.slice(i, i + this.chunkSize);
      const chunkIndex = Math.floor(i / this.chunkSize);

      await this.saveChunk(sprite.id, chunkIndex, chunk);
    }

    return true;
  }

  // Save regular sized sprite with optional compression
  // Save regular sized sprite with optional compression
  async saveRegularSprite(sprite) {
    await this.ensureDB();

    // CRITICAL FIX: Always save layers data, not just pixels
    let layersData = sprite.getLayersData();
    let compressed = false;

    // Optionally compress each layer if large enough
    if (sprite.width * sprite.height > this.compressionThreshold) {
      layersData = layersData.map((layer) => {
        if (
          Array.isArray(layer.pixels) &&
          layer.pixels.length === sprite.height
        ) {
          return {
            ...layer,
            pixels: this.compressPixelData(layer.pixels),
            compressed: true,
          };
        }
        return layer;
      });
      compressed = true;
    }

    const spriteData = {
      id: sprite.id,
      name: sprite.name,
      width: sprite.width,
      height: sprite.height,
      layers: layersData, // SAVE LAYERS DATA
      createdAt: sprite.createdAt,
      modifiedAt: sprite.modifiedAt,
      size: sprite.width * sprite.height,
      compressed: compressed,
      chunked: false,
    };

    const transaction = this.db.transaction([this.spritesStore], "readwrite");
    const store = transaction.objectStore(this.spritesStore);
    return new Promise((resolve, reject) => {
      const request = store.put(spriteData);
      request.onsuccess = () => resolve(true);
      request.onerror = () => {
        console.error("Failed to save sprite:", request.error);
        resolve(false);
      };
    });
  }

  // Save a chunk of sprite data
  async saveChunk(spriteId, chunkIndex, chunkData) {
    await this.ensureDB();

    const transaction = this.db.transaction(["spriteChunks"], "readwrite");
    const store = transaction.objectStore("spriteChunks");

    const chunkRecord = {
      spriteId: spriteId,
      chunkIndex: chunkIndex,
      data: chunkData,
    };

    return new Promise((resolve, reject) => {
      const request = store.put(chunkRecord);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Load chunks for a large sprite
  async loadChunks(spriteId, chunkCount) {
    await this.ensureDB();

    const transaction = this.db.transaction(["spriteChunks"], "readonly");
    const store = transaction.objectStore("spriteChunks");
    const index = store.index("spriteId");

    return new Promise((resolve, reject) => {
      const request = index.getAll(spriteId);

      request.onsuccess = () => {
        const chunks = request.result.sort(
          (a, b) => a.chunkIndex - b.chunkIndex
        );
        const flatPixels = chunks.map((chunk) => chunk.data).flat();
        resolve(flatPixels);
      };

      request.onerror = () => {
        console.error("Failed to load chunks:", request.error);
        resolve([]);
      };
    });
  }

  // Optimized sprite saving with automatic chunking/compression
  async saveSprite(sprite) {
    try {
      const pixelCount = sprite.width * sprite.height;

      if (pixelCount > this.chunkSize) {
        return await this.saveLargeSprite(sprite);
      } else {
        return await this.saveRegularSprite(sprite);
      }
    } catch (error) {
      console.error("Failed to save sprite:", error);
      return false;
    }
  }

  // Optimized batch sprite saving
  async saveSprites(sprites) {
    try {
      await this.ensureDB();

      // Process in batches based on sprite sizes
      const smallSprites = sprites.filter((s) => s.width * s.height <= 10000);
      const mediumSprites = sprites.filter(
        (s) =>
          s.width * s.height > 10000 && s.width * s.height <= this.chunkSize
      );
      const largeSprites = sprites.filter(
        (s) => s.width * s.height > this.chunkSize
      );

      // Clear existing sprites first
      await this.clearSprites();

      // Save small sprites in larger batches
      if (smallSprites.length > 0) {
        await this.saveBatch(smallSprites, 10);
      }

      // Save medium sprites in smaller batches
      if (mediumSprites.length > 0) {
        await this.saveBatch(mediumSprites, 3);
      }

      // Save large sprites individually with progress
      for (const sprite of largeSprites) {
        await this.saveLargeSprite(sprite);
        // Allow other operations to process
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      return true;
    } catch (error) {
      console.error("Failed to save sprites:", error);
      return false;
    }
  }

  // Save sprites in batches
  async saveBatch(sprites, batchSize) {
    for (let i = 0; i < sprites.length; i += batchSize) {
      const batch = sprites.slice(i, i + batchSize);

      const transaction = this.db.transaction([this.spritesStore], "readwrite");
      const store = transaction.objectStore(this.spritesStore);

      await new Promise((resolve, reject) => {
        let completed = 0;

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);

        for (const sprite of batch) {
          const spriteData = {
            id: sprite.id,
            name: sprite.name,
            width: sprite.width,
            height: sprite.height,
            pixels: sprite.getPixelArray(),
            createdAt: sprite.createdAt,
            modifiedAt: sprite.modifiedAt,
            size: sprite.width * sprite.height,
            compressed: false,
            chunked: false,
          };

          store.put(spriteData);
        }
      });

      // Allow other operations between batches
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  // Optimized sprite loading with decompression/chunk assembly
  // Update the loadSprites method to handle missing layer data better
  // Update the loadSprites method to handle missing layer data better
  async loadSprites() {
    try {
      await this.ensureDB();
      const transaction = this.db.transaction([this.spritesStore], "readonly");
      const store = transaction.objectStore(this.spritesStore);
      return new Promise(async (resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = async () => {
          const spritesData = request.result;
          const sprites = [];
          for (const spriteData of spritesData) {
            try {
              let layersData = spriteData.layers;

              // Enhanced backward compatibility - FIX THE LAYER LOADING
              if (!Array.isArray(layersData) || layersData.length === 0) {
                if (spriteData.pixels) {
                  // Old format: single pixel array
                  layersData = [
                    {
                      name: "Layer 1",
                      visible: true,
                      opacity: 1,
                      pixels: spriteData.pixels,
                      useTypedArray:
                        spriteData.useTypedArray ||
                        spriteData.width * spriteData.height > 50000,
                    },
                  ];
                } else {
                  // Create empty layer if no data
                  layersData = [
                    {
                      name: "Layer 1",
                      visible: true,
                      opacity: 1,
                      pixels: this.createEmptyPixelArray(
                        spriteData.width,
                        spriteData.height
                      ),
                      useTypedArray:
                        spriteData.width * spriteData.height > 50000,
                    },
                  ];
                }
              }

              // Decompress layers if needed
              if (Array.isArray(layersData)) {
                layersData = layersData.map((layer) => {
                  let pixels = layer.pixels;
                  if (layer.compressed && Array.isArray(pixels)) {
                    pixels = this.decompressPixelData(
                      pixels,
                      spriteData.width,
                      spriteData.height
                    );
                  }
                  return {
                    ...layer,
                    pixels,
                  };
                });
              }

              const sprite = new Sprite(
                spriteData.width,
                spriteData.height,
                spriteData.name,
                spriteData.id,
                layersData // Pass the layers data to constructor
              );
              sprite.createdAt = spriteData.createdAt;
              sprite.modifiedAt = spriteData.modifiedAt;
              sprites.push(sprite);
            } catch (error) {
              console.error("Failed to load sprite:", spriteData.id, error);
              // Create a fallback sprite with minimal data
              try {
                const fallbackSprite = new Sprite(
                  spriteData.width || 32,
                  spriteData.height || 32,
                  spriteData.name || "Corrupted Sprite"
                );
                sprites.push(fallbackSprite);
              } catch (fallbackError) {
                console.error(
                  "Failed to create fallback sprite:",
                  fallbackError
                );
              }
            }
          }
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

  // Add this helper method to StorageManager
  createEmptyPixelArray(width, height) {
    const pixels = [];
    for (let y = 0; y < height; y++) {
      pixels[y] = [];
      for (let x = 0; x < width; x++) {
        pixels[y][x] = [0, 0, 0, 0];
      }
    }
    return pixels;
  }

  // Reconstruct 2D array from flat array
  reconstruct2DArray(flatPixels, width, height) {
    const pixels = [];
    let index = 0;

    for (let y = 0; y < height; y++) {
      pixels[y] = [];
      for (let x = 0; x < width; x++) {
        pixels[y][x] = flatPixels[index];
        index++;
      }
    }

    return pixels;
  }

  // Delete sprite and its chunks
  async deleteSprite(spriteId) {
    try {
      await this.ensureDB();

      const transaction = this.db.transaction(
        [this.spritesStore, "spriteChunks"],
        "readwrite"
      );
      const spritesStore = transaction.objectStore(this.spritesStore);
      const chunksStore = transaction.objectStore("spriteChunks");

      return new Promise((resolve, reject) => {
        // Delete sprite metadata
        const spriteRequest = spritesStore.delete(spriteId);

        // Delete associated chunks
        const chunksIndex = chunksStore.index("spriteId");
        const chunksRequest = chunksIndex.openCursor(spriteId);

        chunksRequest.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };

        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => {
          console.error("Failed to delete sprite:", transaction.error);
          resolve(false);
        };
      });
    } catch (error) {
      console.error("Failed to delete sprite:", error);
      return false;
    }
  }

  // Clear all sprites and chunks
  async clearSprites() {
    try {
      await this.ensureDB();

      const transaction = this.db.transaction(
        [this.spritesStore, "spriteChunks"],
        "readwrite"
      );
      const spritesStore = transaction.objectStore(this.spritesStore);
      const chunksStore = transaction.objectStore("spriteChunks");

      return new Promise((resolve, reject) => {
        const clearSprites = spritesStore.clear();
        const clearChunks = chunksStore.clear();

        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => {
          console.error("Failed to clear sprites:", transaction.error);
          resolve(false);
        };
      });
    } catch (error) {
      console.error("Failed to clear sprites:", error);
      return false;
    }
  }

  // Enhanced cleanup method
  async cleanup() {
    if (this.initPromise) {
      try {
        await this.initPromise;
      } catch (error) {
        console.warn("Init promise cleanup error:", error);
      }
    }

    // Clear any large caches
    if (this.renderCache) {
      this.renderCache.clear();
    }

    this.close();
  }

  // Keep all other existing methods unchanged...
  async ensureDB() {
    if (!this.db) {
      await this.initPromise;
    }
    return this.db;
  }

  // Enhanced storage usage calculation
  async getStorageUsage() {
    try {
      const sprites = await this.loadSprites();
      const settings = await this.loadSettings();

      let totalSize = 0;
      let largestSprite = 0;

      for (const sprite of sprites) {
        const spriteSize = sprite.width * sprite.height * 4; // 4 bytes per pixel
        totalSize += spriteSize;
        largestSprite = Math.max(largestSprite, spriteSize);
      }

      const settingsSize = new Blob([JSON.stringify(settings)]).size;
      const grandTotal = totalSize + settingsSize;

      return {
        spritesSize: totalSize,
        settingsSize: settingsSize,
        totalSize: grandTotal,
        totalSizeFormatted: this.formatBytes(grandTotal),
        spriteCount: sprites.length,
        largestSpriteSize: this.formatBytes(largestSprite),
        averageSpriteSize:
          sprites.length > 0
            ? this.formatBytes(totalSize / sprites.length)
            : "0 B",
      };
    } catch (error) {
      console.error("Failed to get storage usage:", error);
      return {
        spritesSize: 0,
        settingsSize: 0,
        totalSize: 0,
        totalSizeFormatted: "0 B",
        spriteCount: 0,
        largestSpriteSize: "0 B",
        averageSpriteSize: "0 B",
      };
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  isConnected() {
    return this.db !== null;
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // Add missing methods from original StorageManager
  async saveSettings(settings) {
    try {
      await this.ensureDB();

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

  async clearAll() {
    try {
      await this.ensureDB();

      const transaction = this.db.transaction(
        [this.spritesStore, this.settingsStore, "spriteChunks"],
        "readwrite"
      );
      const spritesStore = transaction.objectStore(this.spritesStore);
      const settingsStore = transaction.objectStore(this.settingsStore);
      const chunksStore = transaction.objectStore("spriteChunks");

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => {
          console.error("Failed to clear storage:", transaction.error);
          resolve(false);
        };

        spritesStore.clear();
        settingsStore.clear();
        chunksStore.clear();
      });
    } catch (error) {
      console.error("Failed to clear storage:", error);
      return false;
    }
  }

  async exportSprites(sprites) {
    try {
      const exportData = {
        version: "2.0",
        createdAt: new Date().toISOString(),
        sprites: sprites.map((sprite) => ({
          id: sprite.id,
          name: sprite.name,
          width: sprite.width,
          height: sprite.height,
          layers: sprite.getLayersData(),
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

  async importSprites(file) {
    try {
      const text = await this.readFileAsText(file);
      const importData = JSON.parse(text);
      if (!importData.sprites || !Array.isArray(importData.sprites)) {
        throw new Error("Invalid sprite file format");
      }
      return importData.sprites.map((spriteData) => {
        let layersData = spriteData.layers;
        if (!Array.isArray(layersData) && spriteData.pixels) {
          layersData = [
            {
              name: "Layer 1",
              visible: true,
              opacity: 1,
              pixels: spriteData.pixels,
              useTypedArray:
                spriteData.useTypedArray ||
                spriteData.width * spriteData.height > 50000,
            },
          ];
        }
        const sprite = new Sprite(
          spriteData.width,
          spriteData.height,
          spriteData.name,
          spriteData.id || Date.now() + Math.random(),
          layersData
        );
        sprite.createdAt = spriteData.createdAt || new Date().toISOString();
        sprite.modifiedAt = spriteData.modifiedAt || new Date().toISOString();
        return sprite;
      });
    } catch (error) {
      console.error("Failed to import sprites:", error);
      throw error;
    }
  }

  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }
}

// Fixed global instance creation
window.storageManager = new StorageManager();

// Export for module systems
if (typeof module !== "undefined" && module.exports) {
  module.exports = StorageManager;
}
