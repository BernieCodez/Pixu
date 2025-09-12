// Animation Manager - Handles frame-based animation for sprites
class AnimationManager {
  constructor(editor) {
    this.editor = editor;
    this.isPlaying = false;
    this.currentFrameIndex = 0;
    this.animationInterval = null;
    this.frameRate = 12; // FPS
    this.playbackMode = 'loop'; // 'loop', 'once', 'pingpong'
    this.direction = 1; // 1 for forward, -1 for reverse
  }

  // Get the current sprite (which now contains multiple frames)
  getCurrentSprite() {
    return this.editor.currentSprite;
  }

  // Get current frame from current sprite
  getCurrentFrame() {
    const sprite = this.getCurrentSprite();
    if (!sprite || !sprite.frames || sprite.frames.length === 0) {
      return null;
    }
    return sprite.frames[this.currentFrameIndex] || sprite.frames[0];
  }

  // Set current frame index
  setCurrentFrame(index) {
  const sprite = this.getCurrentSprite();
  if (!sprite || !sprite.frames) return false;

  // Save current frame before switching
  this.saveLayerManagerToCurrentFrame();

  const clampedIndex = Math.max(0, Math.min(index, sprite.frames.length - 1));
  this.currentFrameIndex = clampedIndex;
  
  // Load the frame into the layer manager
  this.loadFrameIntoLayerManager(sprite.frames[clampedIndex]);
  
  // Update UI
  this.editor.updateUI();
  return true;
}

  // Load a frame's layers into the layer manager
  loadFrameIntoLayerManager(frame) {
  if (!frame || !this.editor.layerManager) return;

  // Prevent history saving during frame loading
  this.editor.layerManager._restoring = true;

  try {
    // Validate frame data
    if (!frame.layers || !Array.isArray(frame.layers) || frame.layers.length === 0) {
      console.warn('Frame has no valid layers, creating default layer');
      frame.layers = [{
        id: Date.now() + Math.random(),
        name: 'Background',
        visible: true,
        opacity: 1,
        pixels: this.createEmptyPixelArray(frame.width, frame.height),
        locked: false,
        blendMode: 'normal'
      }];
    }

    // Clear existing layers and load frame layers
    this.editor.layerManager.layers = frame.layers.map(layerData => ({
      id: layerData.id || Date.now() + Math.random(),
      name: layerData.name || 'Layer',
      visible: layerData.visible !== false,
      opacity: typeof layerData.opacity === 'number' ? layerData.opacity : 1,
      pixels: this.validateAndCopyPixels(layerData.pixels, frame.width, frame.height),
      locked: layerData.locked || false,
      blendMode: layerData.blendMode || 'normal'
    }));

    // Set active layer index
    this.editor.layerManager.activeLayerIndex = Math.min(
      Math.max(0, frame.activeLayerIndex || 0),
      this.editor.layerManager.layers.length - 1
    );

    // Update layer manager dimensions
    this.editor.layerManager.width = frame.width;
    this.editor.layerManager.height = frame.height;

    // Mark as dirty and update
    this.editor.layerManager.compositeDirty = true;
    this.editor.layerManager.compositeCache = null;

  } catch (error) {
    console.error('Error loading frame into layer manager:', error);
    
    // Create fallback layer if loading fails
    this.editor.layerManager.layers = [{
      id: Date.now() + Math.random(),
      name: 'Background',
      visible: true,
      opacity: 1,
      pixels: this.createEmptyPixelArray(frame.width || 16, frame.height || 16),
      locked: false,
      blendMode: 'normal'
    }];
    
    this.editor.layerManager.activeLayerIndex = 0;
  } finally {
    this.editor.layerManager._restoring = false;
  }

  // Trigger render
  if (this.editor.canvasManager) {
    this.editor.canvasManager.render();
  }
}
validateAndCopyPixels(pixels, width, height) {
  if (!Array.isArray(pixels)) {
    console.warn('Invalid pixel data, creating empty array');
    return this.createEmptyPixelArray(width, height);
  }

  // Check if pixels array has correct dimensions
  if (pixels.length !== height) {
    console.warn(`Pixel height mismatch: expected ${height}, got ${pixels.length}`);
    return this.createEmptyPixelArray(width, height);
  }

  // Validate and copy each row
  const validatedPixels = [];
  for (let y = 0; y < height; y++) {
    validatedPixels[y] = [];
    
    if (!Array.isArray(pixels[y]) || pixels[y].length !== width) {
      console.warn(`Pixel row ${y} invalid, filling with transparent pixels`);
      for (let x = 0; x < width; x++) {
        validatedPixels[y][x] = [0, 0, 0, 0];
      }
      continue;
    }

    for (let x = 0; x < width; x++) {
      const pixel = pixels[y][x];
      if (!Array.isArray(pixel) || pixel.length !== 4) {
        validatedPixels[y][x] = [0, 0, 0, 0];
      } else {
        validatedPixels[y][x] = [...pixel];
      }
    }
  }

  return validatedPixels;
}
  // Save current layer manager state to current frame
  saveLayerManagerToCurrentFrame() {
    const sprite = this.getCurrentSprite();
    const frame = this.getCurrentFrame();
    if (!sprite || !frame || !this.editor.layerManager) return;

    // Update the current frame with layer manager data
    frame.layers = this.editor.layerManager.layers.map(layer => ({
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      opacity: layer.opacity,
      pixels: layer.pixels.map(row => row.map(pixel => [...pixel])),
      locked: layer.locked,
      blendMode: layer.blendMode
    }));

    frame.activeLayerIndex = this.editor.layerManager.activeLayerIndex;

    // Mark sprite as modified
    sprite.modifiedAt = new Date().toISOString();

    // Save to storage immediately when frame data changes
    if (window.storageManager) {
      window.storageManager.saveSprite(sprite).catch(error => {
        console.error('Failed to save frame to storage:', error);
      });
    }
  }

  initializeSpriteFrames(sprite) {
  if (!sprite.frames || sprite.frames.length === 0) {
    // Get current layers from layer manager or sprite
    let layersData;
    
    if (sprite.layers && Array.isArray(sprite.layers)) {
      layersData = sprite.layers;
    } else if (sprite.getLayersData && typeof sprite.getLayersData === 'function') {
      layersData = sprite.getLayersData();
    } else {
      // Create default layer from sprite pixels
      const pixels = sprite.getPixelArray();
      layersData = [{
        id: Date.now() + Math.random(),
        name: 'Background',
        visible: true,
        opacity: 1,
        pixels: pixels,
        locked: false,
        blendMode: 'normal'
      }];
    }

    // Create initial frame
    sprite.frames = [{
      id: Date.now() + Math.random(),
      name: 'Frame 1',
      width: sprite.width,
      height: sprite.height,
      activeLayerIndex: 0,
      layers: layersData
    }];
  }

  return sprite.frames;
}

  // Add a new frame
  addFrame(insertAfter = null) {
  const sprite = this.getCurrentSprite();
  if (!sprite) return null;

  // Save current frame state before creating new one
  this.saveLayerManagerToCurrentFrame();

  // Initialize frames array if it doesn't exist
  if (!sprite.frames) {
    sprite.frames = [];
  }

  // Create new frame
  const newFrame = this.createEmptyFrame(sprite.width, sprite.height);
  newFrame.name = `Frame ${sprite.frames.length + 1}`;

  // Insert frame
  const insertIndex = insertAfter !== null ? insertAfter + 1 : sprite.frames.length;
  sprite.frames.splice(insertIndex, 0, newFrame);

  // Update current frame index
  this.currentFrameIndex = insertIndex;

  // Load new frame into layer manager
  this.loadFrameIntoLayerManager(newFrame);

  // Mark sprite as modified and save
  sprite.modifiedAt = new Date().toISOString();
  
  // Update UI and save to storage
  this.editor.updateUI();
  
  // Save immediately to storage
  if (window.storageManager) {
    window.storageManager.saveSprite(sprite).then(success => {
      if (!success) {
        console.error('Failed to save new frame to storage');
      }
    });
  }

  return newFrame;
}

// Duplicate current frame - Enhanced storage integration  
duplicateFrame() {
  const sprite = this.getCurrentSprite();
  const currentFrame = this.getCurrentFrame();
  if (!sprite || !currentFrame) return null;

  // Save current layer manager state to frame before duplicating
  this.saveLayerManagerToCurrentFrame();

  // Create duplicate
  const duplicateFrame = {
    id: Date.now() + Math.random(),
    name: `${currentFrame.name} Copy`,
    width: currentFrame.width,
    height: currentFrame.height,
    activeLayerIndex: currentFrame.activeLayerIndex,
    layers: currentFrame.layers.map(layer => ({
      id: Date.now() + Math.random(),
      name: layer.name,
      visible: layer.visible,
      opacity: layer.opacity,
      pixels: layer.pixels.map(row => row.map(pixel => [...pixel])),
      locked: layer.locked,
      blendMode: layer.blendMode
    }))
  };

  // Insert after current frame
  sprite.frames.splice(this.currentFrameIndex + 1, 0, duplicateFrame);
  this.currentFrameIndex++;

  // Load duplicate frame
  this.loadFrameIntoLayerManager(duplicateFrame);

  // Mark sprite as modified
  sprite.modifiedAt = new Date().toISOString();

  // Update UI and save to storage
  this.editor.updateUI();
  
  // Save immediately to storage
  if (window.storageManager) {
    window.storageManager.saveSprite(sprite).then(success => {
      if (!success) {
        console.error('Failed to save duplicated frame to storage');
      }
    });
  }

  return duplicateFrame;
}

// Delete frame - Enhanced storage integration
deleteFrame(frameIndex = null) {
  const sprite = this.getCurrentSprite();
  if (!sprite || !sprite.frames) return false;

  const indexToDelete = frameIndex !== null ? frameIndex : this.currentFrameIndex;
  
  // Don't delete the last frame
  if (sprite.frames.length <= 1) {
    return false;
  }

  // Remove frame
  sprite.frames.splice(indexToDelete, 1);

  // Adjust current frame index
  if (this.currentFrameIndex >= sprite.frames.length) {
    this.currentFrameIndex = sprite.frames.length - 1;
  } else if (this.currentFrameIndex > indexToDelete) {
    this.currentFrameIndex--;
  }

  // Load current frame
  this.loadFrameIntoLayerManager(sprite.frames[this.currentFrameIndex]);

  // Mark sprite as modified
  sprite.modifiedAt = new Date().toISOString();

  // Update UI and save to storage
  this.editor.updateUI();
  
  // Save immediately to storage
  if (window.storageManager) {
    window.storageManager.saveSprite(sprite).then(success => {
      if (!success) {
        console.error('Failed to save after frame deletion');
      }
    });
  }

  return true;
}

// Move frame - Enhanced storage integration
moveFrame(fromIndex, toIndex) {
  const sprite = this.getCurrentSprite();
  if (!sprite || !sprite.frames) return false;

  if (fromIndex < 0 || fromIndex >= sprite.frames.length ||
      toIndex < 0 || toIndex >= sprite.frames.length ||
      fromIndex === toIndex) {
    return false;
  }

  // Save current frame state before moving
  this.saveLayerManagerToCurrentFrame();

  // Move frame
  const frame = sprite.frames.splice(fromIndex, 1)[0];
  sprite.frames.splice(toIndex, 0, frame);

  // Update current frame index
  if (this.currentFrameIndex === fromIndex) {
    this.currentFrameIndex = toIndex;
  } else if (fromIndex < this.currentFrameIndex && toIndex >= this.currentFrameIndex) {
    this.currentFrameIndex--;
  } else if (fromIndex > this.currentFrameIndex && toIndex <= this.currentFrameIndex) {
    this.currentFrameIndex++;
  }

  // Mark sprite as modified
  sprite.modifiedAt = new Date().toISOString();

  // Update UI and save to storage
  this.editor.updateUI();
  
  // Save immediately to storage
  if (window.storageManager) {
    window.storageManager.saveSprite(sprite).then(success => {
      if (!success) {
        console.error('Failed to save after frame move');
      }
    });
  }

  return true;
}

  // Create empty frame
  createEmptyFrame(width, height) {
    return {
      id: Date.now() + Math.random(),
      name: 'Frame 1',
      width: width,
      height: height,
      activeLayerIndex: 0,
      layers: [{
        id: Date.now() + Math.random(),
        name: 'Background',
        visible: true,
        opacity: 1,
        pixels: this.createEmptyPixelArray(width, height),
        locked: false,
        blendMode: 'normal'
      }]
    };
  }

  // Create empty pixel array
  createEmptyPixelArray(width, height) {
    const pixels = [];
    for (let y = 0; y < height; y++) {
      pixels[y] = [];
      for (let x = 0; x < width; x++) {
        pixels[y][x] = [0, 0, 0, 0]; // Transparent
      }
    }
    return pixels;
  }

  // Play animation
  play() {
    const sprite = this.getCurrentSprite();
    if (!sprite || !sprite.frames || sprite.frames.length <= 1) return;

    if (this.isPlaying) return;

    this.isPlaying = true;
    const frameTime = 1000 / this.frameRate;

    this.animationInterval = setInterval(() => {
      const sprite = this.getCurrentSprite();
      if (!sprite || !sprite.frames || sprite.frames.length <= 1) {
        this.stop();
        return;
      }

      // Calculate next frame based on playback mode
      let nextFrame = this.currentFrameIndex;

      if (this.playbackMode === 'loop') {
        nextFrame = (this.currentFrameIndex + this.direction + sprite.frames.length) % sprite.frames.length;
      } else if (this.playbackMode === 'once') {
        nextFrame = this.currentFrameIndex + this.direction;
        if (nextFrame >= sprite.frames.length || nextFrame < 0) {
          this.stop();
          return;
        }
      } else if (this.playbackMode === 'pingpong') {
        nextFrame = this.currentFrameIndex + this.direction;
        if (nextFrame >= sprite.frames.length) {
          this.direction = -1;
          nextFrame = sprite.frames.length - 2;
        } else if (nextFrame < 0) {
          this.direction = 1;
          nextFrame = 1;
        }
      }

      this.setCurrentFrame(nextFrame);
    }, frameTime);
  }

  // Stop animation
  stop() {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }
    this.isPlaying = false;
    this.direction = 1; // Reset direction for pingpong mode
  }

  // Set frame rate
  setFrameRate(fps) {
    this.frameRate = Math.max(1, Math.min(60, fps));

    // Restart animation with new frame rate if playing
    if (this.isPlaying) {
      this.stop();
      this.play();
    }
  }

  // Set playback mode
  setPlaybackMode(mode) {
    if (['loop', 'once', 'pingpong'].includes(mode)) {
      this.playbackMode = mode;
    }
  }

  // Get frame count
  getFrameCount() {
    const sprite = this.getCurrentSprite();
    return sprite && sprite.frames ? sprite.frames.length : 0;
  }

  saveCurrentFrameToStorage() {
  const sprite = this.getCurrentSprite();
  if (!sprite) return Promise.resolve(false);

  this.saveLayerManagerToCurrentFrame();
  
  if (window.storageManager) {
    return window.storageManager.saveSprite(sprite);
  }
  
  return Promise.resolve(false);
}

// Add method to save all frames at once (for bulk operations)
saveAllFramesToStorage() {
  const sprite = this.getCurrentSprite();
  if (!sprite || !window.storageManager) return Promise.resolve(false);

  // Save current frame state first
  this.saveLayerManagerToCurrentFrame();
  
  return window.storageManager.saveSprite(sprite);
}

  // Get frame thumbnail as ImageData
  getFrameThumbnail(frameIndex, thumbnailSize = 64) {
    const sprite = this.getCurrentSprite();
    if (!sprite || !sprite.frames || !sprite.frames[frameIndex]) return null;

    const frame = sprite.frames[frameIndex];
    const canvas = document.createElement('canvas');
    canvas.width = thumbnailSize;
    canvas.height = thumbnailSize;
    const ctx = canvas.getContext('2d');

    // Calculate scaling to fit thumbnail
    const scale = Math.min(thumbnailSize / frame.width, thumbnailSize / frame.height);
    const scaledWidth = frame.width * scale;
    const scaledHeight = frame.height * scale;
    const offsetX = (thumbnailSize - scaledWidth) / 2;
    const offsetY = (thumbnailSize - scaledHeight) / 2;

    // Render frame layers
    for (const layer of frame.layers) {
      if (!layer.visible) continue;

      for (let y = 0; y < frame.height; y++) {
        for (let x = 0; x < frame.width; x++) {
          const [r, g, b, a] = layer.pixels[y][x];
          if (a > 0) {
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${(a / 255) * layer.opacity})`;
            ctx.fillRect(
              offsetX + x * scale,
              offsetY + y * scale,
              scale,
              scale
            );
          }
        }
      }
    }

    return ctx.getImageData(0, 0, thumbnailSize, thumbnailSize);
  }
}

// Make AnimationManager globally available
window.AnimationManager = AnimationManager;