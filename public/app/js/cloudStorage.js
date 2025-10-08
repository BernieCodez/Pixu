// Cloud Storage Manager - Firestore integration for pixel art
class CloudStorageManager {
  constructor() {
    this.db = null;
    this.auth = null;
    this.initialized = false;
    this.syncEnabled = true;
    this.syncQueue = [];
    this.isSyncing = false;
    
    // Firestore has a 1MB document limit, so we'll chunk larger images
    this.MAX_CHUNK_SIZE = 900000; // ~900KB to be safe
    this.COMPRESSION_QUALITY = 0.75; // OPTIMIZED: Reduced from 0.92 to 0.75 for faster uploads
    
    // Progress tracking
    this.onProgress = null;
    
    // Check for OffscreenCanvas support
    this.supportsOffscreenCanvas = typeof OffscreenCanvas !== 'undefined';
  }

  async initialize(firebaseApp) {
    try {
      const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
      const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
      
      this.db = getFirestore(firebaseApp);
      this.auth = getAuth(firebaseApp);
      this.initialized = true;
      
      console.log('Cloud storage initialized');
      
      // Start sync queue processor
      this.processSyncQueue();
      
      return true;
    } catch (error) {
      console.error('Failed to initialize cloud storage:', error);
      return false;
    }
  }

  async saveSprite(sprite, userId) {
    if (!this.initialized || !userId) {
      console.warn('Cloud storage not available');
      return false;
    }

    try {
      // Convert sprite to canvas-based data URLs (more efficient than arrays)
      const spriteData = await this.spriteToCloudFormat(sprite);
      
      const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
      
      const spriteRef = doc(this.db, `users/${userId}/sprites/${sprite.id}`);
      
      // Check if we need to chunk the data
      const dataSize = JSON.stringify(spriteData).length;
      
      if (dataSize > this.MAX_CHUNK_SIZE) {
        return await this.saveChunkedSprite(sprite, userId, spriteData);
      }
      
      await setDoc(spriteRef, {
        ...spriteData,
        userId,
        updatedAt: serverTimestamp(),
        synced: true
      });
      
      console.log(`Sprite ${sprite.name} saved to cloud`);
      return true;
    } catch (error) {
      console.error('Failed to save sprite to cloud:', error);
      // Add to sync queue for retry
      this.addToSyncQueue({ type: 'save', sprite, userId });
      return false;
    }
  }

  async saveChunkedSprite(sprite, userId, spriteData) {
    try {
      const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
      
      // Save metadata
      const metaRef = doc(this.db, `users/${userId}/sprites/${sprite.id}`);
      await setDoc(metaRef, {
        id: sprite.id,
        name: sprite.name,
        width: sprite.width,
        height: sprite.height,
        frameCount: spriteData.frames.length,
        isAnimated: spriteData.isAnimated,
        createdAt: spriteData.createdAt,
        modifiedAt: spriteData.modifiedAt,
        userId,
        updatedAt: serverTimestamp(),
        chunked: true,
        synced: true
      });
      
      // Save each frame as a separate document
      for (let i = 0; i < spriteData.frames.length; i++) {
        const frameRef = doc(this.db, `users/${userId}/sprites/${sprite.id}/frames/${i}`);
        await setDoc(frameRef, {
          frameIndex: i,
          ...spriteData.frames[i],
          updatedAt: serverTimestamp()
        });
      }
      
      console.log(`Chunked sprite ${sprite.name} saved to cloud`);
      return true;
    } catch (error) {
      console.error('Failed to save chunked sprite:', error);
      return false;
    }
  }

  async loadSprite(spriteId, userId) {
    if (!this.initialized || !userId) {
      return null;
    }

    try {
      const { doc, getDoc, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
      
      const spriteRef = doc(this.db, `users/${userId}/sprites/${spriteId}`);
      const spriteSnap = await getDoc(spriteRef);
      
      if (!spriteSnap.exists()) {
        return null;
      }
      
      const spriteData = spriteSnap.data();
      
      // Check if chunked
      if (spriteData.chunked) {
        return await this.loadChunkedSprite(spriteId, userId, spriteData);
      }
      
      // Convert cloud format back to Sprite object
      return await this.cloudFormatToSprite(spriteData);
    } catch (error) {
      console.error('Failed to load sprite from cloud:', error);
      return null;
    }
  }

  async loadChunkedSprite(spriteId, userId, metadata) {
    try {
      const { collection, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
      
      const framesRef = collection(this.db, `users/${userId}/sprites/${spriteId}/frames`);
      const framesQuery = query(framesRef, orderBy('frameIndex'));
      const framesSnap = await getDocs(framesQuery);
      
      const frames = [];
      framesSnap.forEach(doc => {
        frames.push(doc.data());
      });
      
      const spriteData = {
        ...metadata,
        frames
      };
      
      return await this.cloudFormatToSprite(spriteData);
    } catch (error) {
      console.error('Failed to load chunked sprite:', error);
      return null;
    }
  }

  async loadAllSprites(userId) {
    if (!this.initialized || !userId) {
      console.warn('Cloud storage not initialized or no userId');
      return [];
    }

    try {
      const { collection, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
      
      const spritesRef = collection(this.db, `users/${userId}/sprites`);
      const spritesQuery = query(spritesRef, orderBy('modifiedAt', 'desc'));
      const spritesSnap = await getDocs(spritesQuery);
      
      console.log(`Found ${spritesSnap.docs.length} sprite documents in Firestore`);
      
      const sprites = [];
      let successCount = 0;
      let failCount = 0;
      
      for (const doc of spritesSnap.docs) {
        try {
          const spriteData = doc.data();
          console.log(`Loading sprite ${doc.id}:`, spriteData.name, `chunked: ${spriteData.chunked}`);
          
          let sprite = null;
          
          if (spriteData.chunked) {
            sprite = await this.loadChunkedSprite(doc.id, userId, spriteData);
          } else {
            sprite = await this.cloudFormatToSprite(spriteData);
          }
          
          if (sprite) {
            sprites.push(sprite);
            successCount++;
            console.log(`✓ Successfully loaded sprite: ${sprite.name}`);
          } else {
            failCount++;
            console.warn(`✗ Failed to load sprite ${doc.id}: conversion returned null`);
          }
        } catch (error) {
          failCount++;
          console.error(`✗ Error loading sprite ${doc.id}:`, error);
        }
      }
      
      console.log(`Loaded ${successCount} sprites successfully, ${failCount} failed`);
      return sprites;
    } catch (error) {
      console.error('Failed to load sprites from cloud:', error);
      return [];
    }
  }

  async deleteSprite(spriteId, userId) {
    if (!this.initialized || !userId) {
      return false;
    }

    try {
      const { doc, deleteDoc, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
      
      // Delete main document
      const spriteRef = doc(this.db, `users/${userId}/sprites/${spriteId}`);
      await deleteDoc(spriteRef);
      
      // Delete chunks if they exist
      const framesRef = collection(this.db, `users/${userId}/sprites/${spriteId}/frames`);
      const framesSnap = await getDocs(framesRef);
      
      const deletePromises = [];
      framesSnap.forEach(doc => {
        deletePromises.push(deleteDoc(doc.ref));
      });
      
      await Promise.all(deletePromises);
      
      console.log(`Sprite ${spriteId} deleted from cloud`);
      return true;
    } catch (error) {
      console.error('Failed to delete sprite from cloud:', error);
      return false;
    }
  }

  // OPTIMIZATION: Convert layer to data URL using OffscreenCanvas when available
  async layerToDataURL(layer, width, height) {
    // Use OffscreenCanvas for non-blocking async processing
    if (this.supportsOffscreenCanvas) {
      try {
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');
        
        // Draw pixels to canvas
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;
        
        if (layer.useTypedArray && layer.pixels instanceof Uint8Array) {
          // Direct copy for typed arrays
          data.set(layer.pixels);
        } else if (Array.isArray(layer.pixels)) {
          // Convert 2D array to typed array
          let index = 0;
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const pixel = layer.pixels[y][x];
              data[index++] = pixel[0];
              data[index++] = pixel[1];
              data[index++] = pixel[2];
              data[index++] = pixel[3];
            }
          }
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        // Convert to blob (async, non-blocking)
        const blob = await canvas.convertToBlob({
          type: 'image/png',
          quality: this.COMPRESSION_QUALITY
        });
        
        // Convert blob to data URL
        return await this.blobToDataURL(blob);
      } catch (error) {
        console.warn('OffscreenCanvas failed, falling back to regular canvas:', error);
        // Fall through to regular canvas
      }
    }
    
    // Fallback: Use regular canvas (synchronous, blocking)
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    // Draw pixels to canvas
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    
    if (layer.useTypedArray && layer.pixels instanceof Uint8Array) {
      // Direct copy for typed arrays
      data.set(layer.pixels);
    } else if (Array.isArray(layer.pixels)) {
      // Convert 2D array to typed array
      let index = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const pixel = layer.pixels[y][x];
          data[index++] = pixel[0];
          data[index++] = pixel[1];
          data[index++] = pixel[2];
          data[index++] = pixel[3];
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Convert to data URL (PNG compression)
    return canvas.toDataURL('image/png', this.COMPRESSION_QUALITY);
  }

  // Helper to convert blob to data URL
  blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Convert sprite to efficient cloud storage format using canvas data URLs
  // OPTIMIZED: Now uses OffscreenCanvas for async processing when available
  async spriteToCloudFormat(sprite) {
    const frames = [];
    
    // Calculate total layers for progress tracking
    const totalLayers = sprite.frames.reduce((sum, frame) => sum + frame.layers.length, 0);
    let processedLayers = 0;
    
    for (const frame of sprite.frames) {
      const layers = [];
      
      for (const layer of frame.layers) {
        // OPTIMIZATION: Use OffscreenCanvas for async processing when available
        const dataURL = await this.layerToDataURL(layer, frame.width, frame.height);
        
        layers.push({
          id: layer.id,
          name: layer.name,
          visible: layer.visible,
          opacity: layer.opacity,
          locked: layer.locked || false,
          blendMode: layer.blendMode || 'normal',
          dataURL // Much more efficient than pixel arrays
        });
        
        // Progress tracking
        processedLayers++;
        if (this.onProgress) {
          this.onProgress({ current: processedLayers, total: totalLayers });
        }
      }
      
      frames.push({
        id: frame.id,
        name: frame.name,
        width: frame.width,
        height: frame.height,
        activeLayerIndex: frame.activeLayerIndex,
        layers
      });
    }
    
    return {
      id: sprite.id,
      name: sprite.name,
      width: sprite.width,
      height: sprite.height,
      frames,
      isAnimated: sprite.frames.length > 1,
      createdAt: sprite.createdAt,
      modifiedAt: sprite.modifiedAt
    };
  }

  // Convert cloud format back to Sprite object
  async cloudFormatToSprite(data) {
    try {
      // Validate data
      if (!data || !data.id || !data.width || !data.height) {
        console.error('Invalid sprite data:', data);
        return null;
      }

      // Handle missing frames
      if (!data.frames || !Array.isArray(data.frames) || data.frames.length === 0) {
        console.warn(`Sprite ${data.name} has no frames, creating default frame`);
        
        // Create sprite with default frame
        const sprite = new Sprite(
          data.width,
          data.height,
          data.name || 'Untitled',
          data.id
        );
        
        sprite.createdAt = data.createdAt || new Date().toISOString();
        sprite.modifiedAt = data.modifiedAt || new Date().toISOString();
        
        return sprite;
      }

      const frames = [];
      
      for (const frameData of data.frames) {
        try {
          const layers = [];
          
          if (!frameData.layers || frameData.layers.length === 0) {
            console.warn(`Frame ${frameData.name} has no layers, creating default`);
            // Create default layer
            layers.push({
              id: Date.now() + Math.random(),
              name: 'Layer 1',
              visible: true,
              opacity: 1,
              locked: false,
              blendMode: 'normal',
              pixels: this.createEmptyPixelArray(data.width, data.height),
              useTypedArray: data.width * data.height > 50000
            });
          } else {
            for (const layerData of frameData.layers) {
              try {
                // Load image from data URL
                const pixels = await this.dataURLToPixelArray(
                  layerData.dataURL,
                  frameData.width,
                  frameData.height
                );
                
                layers.push({
                  id: layerData.id || Date.now() + Math.random(),
                  name: layerData.name || 'Layer',
                  visible: layerData.visible !== false,
                  opacity: typeof layerData.opacity === 'number' ? layerData.opacity : 1,
                  locked: layerData.locked || false,
                  blendMode: layerData.blendMode || 'normal',
                  pixels,
                  useTypedArray: frameData.width * frameData.height > 50000
                });
              } catch (error) {
                console.error(`Failed to load layer ${layerData.name}:`, error);
              }
            }
          }
          
          frames.push({
            id: frameData.id || Date.now() + Math.random(),
            name: frameData.name || 'Frame',
            width: frameData.width || data.width,
            height: frameData.height || data.height,
            activeLayerIndex: frameData.activeLayerIndex || 0,
            layers
          });
        } catch (error) {
          console.error(`Failed to load frame ${frameData.name}:`, error);
        }
      }
      
      if (frames.length === 0) {
        console.error('No frames loaded for sprite', data.name);
        return null;
      }

      const sprite = new Sprite(
        data.width,
        data.height,
        data.name || 'Untitled',
        data.id
      );
      
      sprite.frames = frames;
      sprite.createdAt = data.createdAt || new Date().toISOString();
      sprite.modifiedAt = data.modifiedAt || new Date().toISOString();
      
      return sprite;
    } catch (error) {
      console.error('Failed to convert cloud format to sprite:', error);
      return null;
    }
  }

  createEmptyPixelArray(width, height) {
    if (width * height > 50000) {
      return new Uint8Array(width * height * 4);
    }
    
    const pixels = [];
    for (let y = 0; y < height; y++) {
      pixels[y] = [];
      for (let x = 0; x < width; x++) {
        pixels[y][x] = [0, 0, 0, 0];
      }
    }
    return pixels;
  }

  async dataURLToPixelArray(dataURL, width, height) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // Use typed array for large images
        if (width * height > 50000) {
          resolve(new Uint8Array(data));
        } else {
          // Convert to 2D array for smaller images
          const pixels = [];
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
          resolve(pixels);
        }
      };
      img.src = dataURL;
    });
  }

  // Sync queue management
  addToSyncQueue(operation) {
    this.syncQueue.push(operation);
  }

  async processSyncQueue() {
    if (this.isSyncing || this.syncQueue.length === 0) {
      setTimeout(() => this.processSyncQueue(), 5000);
      return;
    }

    this.isSyncing = true;

    while (this.syncQueue.length > 0) {
      const operation = this.syncQueue.shift();

      try {
        if (operation.type === 'save') {
          await this.saveSprite(operation.sprite, operation.userId);
        } else if (operation.type === 'delete') {
          await this.deleteSprite(operation.spriteId, operation.userId);
        }
      } catch (error) {
        console.error('Failed to process sync operation:', error);
        // Re-add to queue if failed
        this.syncQueue.push(operation);
        break;
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isSyncing = false;
    setTimeout(() => this.processSyncQueue(), 5000);
  }

  setSyncEnabled(enabled) {
    this.syncEnabled = enabled;
    if (enabled) {
      this.processSyncQueue();
    }
  }
}

// Global instance
window.cloudStorage = new CloudStorageManager();
console.log('✓ CloudStorageManager initialized');

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CloudStorageManager;
}
