// Sprite Class - Represents a pixel art sprite
class Sprite {
  constructor(width, height, name = "Untitled", id = null, layers = null) {
    this.id = id || Date.now() + Math.random();
    this.name = name;
    this.width = width;
    this.height = height;
    this.createdAt = new Date().toISOString();
    this.modifiedAt = new Date().toISOString();

    // Frames
    this.frames = []; // Array of frames for animation
    this.isAnimated = false; // Flag to indicate if sprite has multiple frames

    // Layers support: if layers provided, use them, else create one default layer
    if (Array.isArray(layers) && layers.length > 0) {
      this.layers = layers.map((layer, idx) => this._initLayer(layer, idx));
    } else {
      this.layers = [this._createDefaultLayer()];
    }

    // Ensure frames are initialized immediately from layers to avoid "empty frames" races
    // (Important when sprites are created/imported and saved quickly)
    if (!this.frames || this.frames.length === 0) {
      this.initializeFrames();
    }

    // For backward compatibility, keep pixels as reference to first layer (now from frames)
    // Prefer frame-based data if available
if (this.frames && this.frames.length > 0 && this.frames[0].layers && this.frames[0].layers.length > 0) {
  // Normal path: prefer frames
  this.layers = this.frames[0].layers;
  this.pixels = this.layers[0].pixels;
  this.useTypedArray = !!this.layers[0].useTypedArray;
} else if (this.layers && this.layers.length > 0) {
  // Fallback for legacy sprites that only had .layers
  this.pixels = this.layers[0].pixels;
  this.useTypedArray = this.layers[0].useTypedArray;
} else {
  // Absolute fallback
  this.layers = [this._createDefaultLayer()];
  this.pixels = this.layers[0].pixels;
  this.useTypedArray = this.layers[0].useTypedArray;
}


    // Optimized history for large sprites
    this.history = [];
    this.historyIndex = -1;
    this.maxHistorySize = width * height > 100000 ? 10 : 50;

    this.onChange = null;

    // Defer initial history push slightly to avoid saving incomplete external state
    // but still record initial state for undo.
    setTimeout(() => {
      try {
        this.saveToHistory();
      } catch (e) {
        // swallow to avoid breaking initialization
        console.warn("saveToHistory failed during Sprite init:", e);
      }
    }, 0);
  }

  // Helper to initialize a layer from raw data or object
  _initLayer(layer, idx) {
    if (layer && typeof layer === "object" && layer.pixels) {
      // Layer object - always use TypedArray for better performance
      let pixels;
      
      if (layer.pixels instanceof Uint8Array) {
        // Already a TypedArray, just clone it
        pixels = new Uint8Array(layer.pixels);
      } else if (Array.isArray(layer.pixels)) {
        // Convert 2D or flattened array to TypedArray
        if (Array.isArray(layer.pixels[0])) {
          // 2D array - convert to TypedArray
          pixels = new Uint8Array(this.width * this.height * 4);
          for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
              const index = (y * this.width + x) * 4;
              const pixel = layer.pixels[y]?.[x] || [0, 0, 0, 0];
              pixels[index] = pixel[0] || 0;     // R
              pixels[index + 1] = pixel[1] || 0; // G
              pixels[index + 2] = pixel[2] || 0; // B
              pixels[index + 3] = pixel[3] || 0; // A
            }
          }
        } else {
          // Flat array - convert to TypedArray
          pixels = new Uint8Array(layer.pixels);
        }
      } else {
        // Create empty TypedArray
        pixels = new Uint8Array(this.width * this.height * 4);
      }
      
      return {
        name: layer.name || `Layer ${idx + 1}`,
        visible: layer.visible !== false,
        opacity: typeof layer.opacity === "number" ? layer.opacity : 1,
        pixels,
        useTypedArray: true, // Always use TypedArray
      };
    } else {
      // Raw pixel array or empty layer
      let pixels = new Uint8Array(this.width * this.height * 4);
      
      if (Array.isArray(layer)) {
        // Convert raw array to TypedArray
        for (let y = 0; y < this.height; y++) {
          for (let x = 0; x < this.width; x++) {
            const index = (y * this.width + x) * 4;
            const pixel = layer[y]?.[x] || [0, 0, 0, 0];
            pixels[index] = pixel[0] || 0;     // R
            pixels[index + 1] = pixel[1] || 0; // G
            pixels[index + 2] = pixel[2] || 0; // B
            pixels[index + 3] = pixel[3] || 0; // A
          }
        }
      }
      
      return {
        name: `Layer ${idx + 1}`,
        visible: true,
        opacity: 1,
        pixels,
        useTypedArray: true, // Always use TypedArray
      };
    }
  }

  _createDefaultLayer() {
    // Always use TypedArray for better performance regardless of size
    const pixels = new Uint8Array(this.width * this.height * 4);
    // Fill with transparent pixels (RGBA: 0,0,0,0)
    pixels.fill(0);
    
    return {
      name: "Layer 1",
      visible: true,
      opacity: 1,
      pixels,
      useTypedArray: true,
    };
  }

  // Add this method to initialize frames for backward compatibility
  initializeFrames() {
  if (!this.frames || this.frames.length === 0) {
    // Build layersData from this.layers if available and valid
    let layersData = [];

    if (this.layers && Array.isArray(this.layers) && this.layers.length > 0) {
      layersData = this.layers.map((layer, idx) => {
        // CRITICAL FIX: Validate layer pixel data before processing
        let pixels;
        
        // Check for TypedArray first
        if (layer.useTypedArray && layer.pixels instanceof Uint8Array) {
          // Keep as TypedArray - no need to convert
          pixels = layer.pixels;
        } else if (!layer.pixels) {
          console.warn(`Layer ${idx} has no pixel data, creating empty array`);
          pixels = this.createEmptyPixelArray();
        } else if (Array.isArray(layer.pixels)) {
          // CRITICAL FIX: Deep validation of 2D pixel array
          try {
            pixels = layer.pixels.map((row, y) => {
              if (!Array.isArray(row)) {
                console.warn(`Layer ${idx} row ${y} is not an array, creating empty row`);
                return new Array(this.width).fill().map(() => [0, 0, 0, 0]);
              }
              return row.map((px, x) => {
                if (!Array.isArray(px) || px.length !== 4) {
                  console.warn(`Layer ${idx} pixel at ${x},${y} is invalid, using transparent`);
                  return [0, 0, 0, 0];
                }
                return [...px];
              });
            });
          } catch (error) {
            console.error(`Failed to process layer ${idx} pixels:`, error);
            pixels = this.createEmptyPixelArray();
          }
        } else {
          pixels = this.createEmptyPixelArray();
        }

        return {
          id: layer.id || Date.now() + Math.random() + idx,
          name: layer.name || `Layer ${idx + 1}`,
          visible: layer.visible !== false,
          opacity: typeof layer.opacity === "number" ? layer.opacity : 1,
          pixels: pixels,
          locked: layer.locked || false,
          blendMode: layer.blendMode || "normal",
          useTypedArray: pixels instanceof Uint8Array || !!layer.useTypedArray,
        };
      });
    } else {
      // fallback to a clean single layer
      layersData = [
        {
          id: Date.now() + Math.random(),
          name: "Layer 1",
          visible: true,
          opacity: 1,
          pixels: this.createEmptyPixelArray(),
          locked: false,
          blendMode: "normal",
          useTypedArray: false,
        },
      ];
    }

    // Create initial frame with validated data
    this.frames = [
      {
        id: Date.now() + Math.random(),
        name: "Frame 1",
        width: this.width,
        height: this.height,
        activeLayerIndex: 0,
        layers: layersData,
      },
    ];
  }

  return this.frames;
}

  // Add method to get current frame (for backward compatibility)
  getCurrentFrame() {
    if (this.frames.length === 0) {
      this.initializeFrames();
    }
    return this.frames[0];
  }

  createEmptyPixelArray() {
    // Always use TypedArray for better performance
    const pixels = new Uint8Array(this.width * this.height * 4);
    // All values default to 0, so no need to initialize
    return pixels;
  }
  
  // Helper to convert index to x,y coordinates
  _indexToCoords(index) {
    const pixelIndex = Math.floor(index / 4);
    const x = pixelIndex % this.width;
    const y = Math.floor(pixelIndex / this.width);
    return [x, y];
  }
  
  // Helper to convert x,y coordinates to TypedArray index
  _coordsToIndex(x, y) {
    return (y * this.width + x) * 4;
  }
  
  // Helper to get a pixel from TypedArray
  getPixel(pixels, x, y) {
    const index = (y * this.width + x) * 4;
    return [
      pixels[index],
      pixels[index + 1], 
      pixels[index + 2], 
      pixels[index + 3]
    ];
  }
  
  // Helper to set a pixel in TypedArray
  setPixel(pixels, x, y, color) {
    const index = (y * this.width + x) * 4;
    pixels[index] = color[0] || 0;
    pixels[index + 1] = color[1] || 0; 
    pixels[index + 2] = color[2] || 0;
    pixels[index + 3] = color[3] || 0;
  }

  // Get pixel at specific coordinates
  // Get composited pixel at (x, y) from all visible layers
  getPixel(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return [0, 0, 0, 0];
    }
    // Composite visible layers (simple alpha over)
    let result = [0, 0, 0, 0];
    for (const layer of this.layers) {
      if (!layer.visible) continue;
      let pixel;
      if (layer.useTypedArray) {
        const index = (y * this.width + x) * 4;
        pixel = [
          layer.pixels[index],
          layer.pixels[index + 1],
          layer.pixels[index + 2],
          layer.pixels[index + 3],
        ];
      } else {
        pixel = [...layer.pixels[y][x]];
      }
      // Alpha compositing
      if (pixel[3] === 0) continue;
      if (result[3] === 0) {
        result = pixel.slice();
      } else {
        // Simple alpha over
        const alpha = (pixel[3] / 255) * layer.opacity;
        const outAlpha = result[3] / 255;
        const newAlpha = alpha + outAlpha * (1 - alpha);
        if (newAlpha > 0) {
          result[0] = Math.round(
            (pixel[0] * alpha + result[0] * outAlpha * (1 - alpha)) / newAlpha
          );
          result[1] = Math.round(
            (pixel[1] * alpha + result[1] * outAlpha * (1 - alpha)) / newAlpha
          );
          result[2] = Math.round(
            (pixel[2] * alpha + result[2] * outAlpha * (1 - alpha)) / newAlpha
          );
          result[3] = Math.round(newAlpha * 255);
        }
      }
    }
    return result;
  }
  // Add this method to load from LayerManager
  loadFromLayerManager(layerManager) {
    // Initialize frames if needed
    if (this.frames.length === 0) {
      this.initializeFrames();
    }

    // Update the current frame (assuming single frame for now)
    const currentFrame = this.getCurrentFrame();
    currentFrame.width = layerManager.width;
    currentFrame.height = layerManager.height;
    currentFrame.activeLayerIndex = layerManager.activeLayerIndex;
    currentFrame.layers = layerManager.layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      opacity: layer.opacity,
      pixels: layer.pixels.map((row) => row.map((pixel) => [...pixel])),
      locked: layer.locked,
      blendMode: layer.blendMode,
    }));

    // Update sprite dimensions
    this.width = layerManager.width;
    this.height = layerManager.height;

    // Update main layers for backward compatibility
    this.layers = currentFrame.layers;

    // Trigger change callback
    if (this.onChange) {
      this.onChange(this);
    }
  }

  // Add this method to export to LayerManager
  toLayerManager() {
    const layerManager = new LayerManager(this.width, this.height);

    // Clear default layer
    layerManager.layers = [];

    // Convert sprite layers to LayerManager format
    layerManager.layers = this.layers.map((layer) => {
      let pixels;
      if (layer.useTypedArray) {
        // Convert TypedArray back to 2D array
        pixels = [];
        for (let y = 0; y < this.height; y++) {
          pixels[y] = [];
          for (let x = 0; x < this.width; x++) {
            const index = (y * this.width + x) * 4;
            pixels[y][x] = [
              layer.pixels[index],
              layer.pixels[index + 1],
              layer.pixels[index + 2],
              layer.pixels[index + 3],
            ];
          }
        }
      } else {
        pixels = layer.pixels.map((row) => row.map((pixel) => [...pixel]));
      }

      return {
        id: Date.now() + Math.random(),
        name: layer.name,
        visible: layer.visible !== false,
        opacity: typeof layer.opacity === "number" ? layer.opacity : 1,
        pixels: pixels,
        locked: false,
        blendMode: "normal",
      };
    });

    layerManager.activeLayerIndex = 0;
    return layerManager;
  }
  // Set pixel at specific coordinates
  // Set pixel in a specific layer (default: first layer)
  setPixel(x, y, color, layerIndex = 0) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return false;
    }
    if (!Array.isArray(color) || color.length !== 4) {
      console.error("Invalid color format:", color);
      return false;
    }
    const layer = this.layers[layerIndex] || this.layers[0];
    if (layer.useTypedArray) {
      const index = (y * this.width + x) * 4;
      layer.pixels[index] = color[0];
      layer.pixels[index + 1] = color[1];
      layer.pixels[index + 2] = color[2];
      layer.pixels[index + 3] = color[3];
    } else {
      layer.pixels[y][x] = [...color];
    }
    this.modifiedAt = new Date().toISOString();
    if (typeof this.onChange === "function") {
      this.onChange(this);
    }
    return true;
  }

  // Batch pixel updates for better performance
  // Batch pixel updates for a layer
  setPixels(pixelUpdates, layerIndex = 0) {
    if (!Array.isArray(pixelUpdates)) return false;
    const startTime = performance.now();
    let updateCount = 0;
    for (const update of pixelUpdates) {
      const { x, y, color } = update;
      if (this.setPixel(x, y, color, layerIndex)) {
        updateCount++;
      }
      if (performance.now() - startTime > 16) {
        break;
      }
    }
    return updateCount;
  }

  // Get the entire pixel array
  // Optimized pixel array access
  // Get composited pixel array (all layers)
  getPixelArray() {
    const result = [];
    for (let y = 0; y < this.height; y++) {
      result[y] = [];
      for (let x = 0; x < this.width; x++) {
        result[y][x] = this.getPixel(x, y);
      }
    }
    return result;
  }

  // Get raw pixel arrays for all layers (for saving)
  getLayersData() {
    // Don't call initializeFrames here to avoid circular dependency
    if (this.frames && this.frames.length > 0) {
      // Return layers from current frame
      const currentFrame = this.frames[0]; // Use first frame as current
      return currentFrame.layers || [];
    }

    // Fallback: return current layers if frames don't exist
    if (this.layers && Array.isArray(this.layers)) {
      return this.layers.map((layer) => ({
        id: layer.id || Date.now() + Math.random(),
        name: layer.name || "Layer",
        visible: layer.visible !== false,
        opacity: typeof layer.opacity === "number" ? layer.opacity : 1,
        pixels: layer.useTypedArray
          ? this.convertTypedArrayTo2D(layer.pixels)
          : layer.pixels.map((row) => row.map((pixel) => [...pixel])),
        locked: layer.locked || false,
        blendMode: layer.blendMode || "normal",
      }));
    }

    return [];
  }

  // Set layers from raw data
  setLayersData(layersData) {
    // Initialize frames if needed
    if (this.frames.length === 0) {
      this.initializeFrames();
    }

    // Set layers in current frame
    const currentFrame = this.getCurrentFrame();
    currentFrame.layers = layersData.map((layerData) => ({
      id: layerData.id || Date.now() + Math.random(),
      name: layerData.name,
      visible: layerData.visible !== false,
      opacity: typeof layerData.opacity === "number" ? layerData.opacity : 1,
      pixels: layerData.useTypedArray
        ? this.convertTypedArrayTo2D(layerData.pixels)
        : layerData.pixels.map((row) => row.map((pixel) => [...pixel])),
      locked: layerData.locked || false,
      blendMode: layerData.blendMode || "normal",
    }));

    // Update main layers for backward compatibility
    this.layers = currentFrame.layers.map((layer) => ({
      ...layer,
      pixels: layer.pixels.map((row) => row.map((pixel) => [...pixel])),
    }));

    // Update pixel reference for backward compatibility
    this.pixels = this.layers[0].pixels;
    this.useTypedArray = false; // Set to false since we converted from typed array

    this.modifiedAt = new Date().toISOString();
  }

  // Add method to add frame to sprite
  addFrame(frame) {
    if (this.frames.length === 0) {
      this.initializeFrames();
    }

    this.frames.push(frame);
    this.isAnimated = this.frames.length > 1;
  }

  // Add method to get frame count
  getFrameCount() {
    if (this.frames.length === 0) {
      this.initializeFrames();
    }
    return this.frames.length;
  }

  // Optimized pixel array setting
  // Set first layer's pixels (for backward compatibility)
  setPixelArray(pixels) {
    if (!Array.isArray(pixels) || pixels.length !== this.height) {
      console.error("Invalid pixel array dimensions");
      return false;
    }
    const layer = this.layers[0];
    if (layer.useTypedArray) {
      let index = 0;
      for (let y = 0; y < this.height; y++) {
        if (!Array.isArray(pixels[y]) || pixels[y].length !== this.width) {
          console.error("Invalid pixel array row at", y);
          return false;
        }
        for (let x = 0; x < this.width; x++) {
          const pixel = pixels[y][x];
          layer.pixels[index] = pixel[0];
          layer.pixels[index + 1] = pixel[1];
          layer.pixels[index + 2] = pixel[2];
          layer.pixels[index + 3] = pixel[3];
          index += 4;
        }
      }
    } else {
      layer.pixels = pixels.map((row) => row.map((pixel) => [...pixel]));
    }
    this.pixels = layer.pixels;
    this.useTypedArray = layer.useTypedArray;
    this.modifiedAt = new Date().toISOString();
    if (typeof this.onChange === "function") {
      this.onChange(this);
    }
    return true;
  }

  // Resize the sprite
  // Modified resize method with nearest neighbor scaling
  resize(newWidth, newHeight, maintainAspectRatio = false) {
    if (maintainAspectRatio) {
      const aspectRatio = this.width / this.height;
      if (newWidth / newHeight > aspectRatio) {
        newWidth = Math.round(newHeight * aspectRatio);
      } else {
        newHeight = Math.round(newWidth / aspectRatio);
      }
    }

    // Store original dimensions and pixels for scaling
    const oldWidth = this.width;
    const oldHeight = this.height;

    // Determine if we should use typed arrays for the new size
    const shouldUseTypedArray = newWidth * newHeight > 50000;

    // Process each layer with nearest neighbor scaling
    for (let layerIndex = 0; layerIndex < this.layers.length; layerIndex++) {
      const layer = this.layers[layerIndex];

      if (shouldUseTypedArray) {
        const newPixels = new Uint8Array(newWidth * newHeight * 4);

        // Nearest neighbor scaling for typed array
        for (let y = 0; y < newHeight; y++) {
          for (let x = 0; x < newWidth; x++) {
            // Map new coordinates to old coordinates using nearest neighbor
            const srcX = Math.floor((x / newWidth) * oldWidth);
            const srcY = Math.floor((y / newHeight) * oldHeight);

            // Clamp to bounds
            const clampedSrcX = Math.min(srcX, oldWidth - 1);
            const clampedSrcY = Math.min(srcY, oldHeight - 1);

            // Get original pixel
            let srcPixel;
            if (layer.useTypedArray) {
              const srcIndex = (clampedSrcY * oldWidth + clampedSrcX) * 4;
              srcPixel = [
                layer.pixels[srcIndex],
                layer.pixels[srcIndex + 1],
                layer.pixels[srcIndex + 2],
                layer.pixels[srcIndex + 3],
              ];
            } else {
              srcPixel = layer.pixels[clampedSrcY][clampedSrcX];
            }

            // Set new pixel
            const newIndex = (y * newWidth + x) * 4;
            newPixels[newIndex] = srcPixel[0];
            newPixels[newIndex + 1] = srcPixel[1];
            newPixels[newIndex + 2] = srcPixel[2];
            newPixels[newIndex + 3] = srcPixel[3];
          }
        }

        layer.pixels = newPixels;
        layer.useTypedArray = true;
      } else {
        const newPixels = [];

        // Nearest neighbor scaling for 2D array
        for (let y = 0; y < newHeight; y++) {
          newPixels[y] = [];
          for (let x = 0; x < newWidth; x++) {
            // Map new coordinates to old coordinates using nearest neighbor
            const srcX = Math.floor((x / newWidth) * oldWidth);
            const srcY = Math.floor((y / newHeight) * oldHeight);

            // Clamp to bounds
            const clampedSrcX = Math.min(srcX, oldWidth - 1);
            const clampedSrcY = Math.min(srcY, oldHeight - 1);

            // Get original pixel
            let srcPixel;
            if (layer.useTypedArray) {
              const srcIndex = (clampedSrcY * oldWidth + clampedSrcX) * 4;
              srcPixel = [
                layer.pixels[srcIndex],
                layer.pixels[srcIndex + 1],
                layer.pixels[srcIndex + 2],
                layer.pixels[srcIndex + 3],
              ];
            } else {
              srcPixel = [...layer.pixels[clampedSrcY][clampedSrcX]];
            }

            newPixels[y][x] = srcPixel;
          }
        }

        layer.pixels = newPixels;
        layer.useTypedArray = false;
      }
    }

    // Update sprite dimensions
    this.width = newWidth;
    this.height = newHeight;

    // Update backward compatibility reference to first layer
    this.pixels = this.layers[0].pixels;
    this.useTypedArray = this.layers[0].useTypedArray;

    this.modifiedAt = new Date().toISOString();
    this.saveToHistory();

    if (typeof this.onChange === "function") {
      this.onChange(this);
    }
    return true;
  }

  // Clear all pixels (make transparent)
  clear() {
    if (this.useTypedArray) {
      this.pixels.fill(0);
    } else {
      this.pixels = this.createEmptyPixelArray();
    }

    this.modifiedAt = new Date().toISOString();
    this.saveToHistory();
    if (typeof this.onChange === "function") {
      this.onChange(this);
    }
  }

  // Optimized fill method
  fill(color) {
    if (this.useTypedArray) {
      for (let i = 0; i < this.pixels.length; i += 4) {
        this.pixels[i] = color[0];
        this.pixels[i + 1] = color[1];
        this.pixels[i + 2] = color[2];
        this.pixels[i + 3] = color[3];
      }
    } else {
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          this.pixels[y][x] = [...color];
        }
      }
    }

    this.modifiedAt = new Date().toISOString();
    this.saveToHistory();
    if (typeof this.onChange === "function") {
      this.onChange(this);
    }
  }

  // Save current state to history for undo/redo
  // Optimized history saving for large sprites
  saveToHistory() {
    // For very large sprites, compress history or save less frequently
    const totalPixels = this.width * this.height;

    if (totalPixels > 500000) {
      // Only save history every few operations for very large sprites
      if (this.historySaveCounter && this.historySaveCounter % 5 !== 0) {
        this.historySaveCounter++;
        return;
      }
      this.historySaveCounter = (this.historySaveCounter || 0) + 1;
    }

    // Remove future history if we're not at the end
    if (this.historyIndex < this.history.length - 1) {
      this.history.splice(this.historyIndex + 1);
    }

    // Create compressed state for large sprites
    const state = {
      width: this.width,
      height: this.height,
      timestamp: Date.now(),
    };

    // For large sprites, store as compressed Uint8Array
    if (this.useTypedArray) {
      state.pixels = new Uint8Array(this.pixels);
    } else {
      state.pixels = this.getPixelArray();
    }

    this.history.push(state);
    this.historyIndex++;

    // Limit history size based on sprite size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.historyIndex--;
    }
  }

  /**
   * Undo last action
   */
  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const state = this.history[this.historyIndex];
      this.restoreFromState(state);
      return true;
    }
    return false;
  }

  /**
   * Redo next action
   */
  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      const state = this.history[this.historyIndex];
      this.restoreFromState(state);
      return true;
    }
    return false;
  }

  /**
   * Restore sprite from a history state
   */
  restoreFromState(state) {
    this.width = state.width;
    this.height = state.height;

    if (state.pixels instanceof Uint8Array) {
      this.pixels = new Uint8Array(state.pixels);
      this.useTypedArray = true;
    } else {
      this.pixels = state.pixels.map((row) => row.map((pixel) => [...pixel]));
      this.useTypedArray = false;
    }

    this.modifiedAt = new Date().toISOString();
  }

  /**
   * Check if undo is available
   */
  canUndo() {
    return this.historyIndex > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo() {
    return this.historyIndex < this.history.length - 1;
  }

  /**
   * Create a copy of this sprite
   */
  // Add this improved clone method to the Sprite class (replace the existing clone method)

  /**
   * Create a deep copy of this sprite with all frames and layers
   */
  clone(newName = null) {
    const copy = new Sprite(
      this.width,
      this.height,
      newName || `${this.name} Copy`
    );

    // Initialize frames if they don't exist on the original sprite
    if (!this.frames || this.frames.length === 0) {
      this.initializeFrames();
    }

    // Deep copy all frames
    copy.frames = this.frames.map((frame, frameIndex) => ({
      id: Date.now() + Math.random() + frameIndex, // Ensure unique ID
      name: frame.name,
      width: frame.width,
      height: frame.height,
      activeLayerIndex: frame.activeLayerIndex,
      layers: frame.layers.map((layer, layerIndex) => ({
        id: Date.now() + Math.random() + frameIndex + layerIndex, // Ensure unique ID
        name: layer.name,
        visible: layer.visible,
        opacity: layer.opacity,
        locked: layer.locked || false,
        blendMode: layer.blendMode || "normal",
        pixels: layer.pixels.map((row) => row.map((pixel) => [...pixel])), // Deep copy pixels
      })),
    }));

    // Set animation properties
    copy.isAnimated = this.isAnimated;

    // For backward compatibility, also copy the main layers reference
    copy.layers = copy.frames[0].layers.map((layer) => ({
      ...layer,
      pixels: layer.pixels.map((row) => row.map((pixel) => [...pixel])),
    }));

    // Set pixel reference to first layer for backward compatibility
    copy.pixels = copy.layers[0].pixels;
    copy.useTypedArray = false;

    // Copy metadata
    copy.createdAt = new Date().toISOString(); // New creation time for copy
    copy.modifiedAt = new Date().toISOString();

    // Save initial history state
    copy.saveToHistory();

    return copy;
  }
  getRegion(x, y, width, height) {
    const region = [];
    const endX = Math.min(x + width, this.width);
    const endY = Math.min(y + height, this.height);

    for (let py = y; py < endY; py++) {
      const row = [];
      for (let px = x; px < endX; px++) {
        row.push(this.getPixel(px, py));
      }
      region.push(row);
    }

    return region;
  }

  // Set region of pixels efficiently
  setRegion(x, y, pixelData) {
    if (!Array.isArray(pixelData) || pixelData.length === 0) return false;

    for (let py = 0; py < pixelData.length; py++) {
      if (!Array.isArray(pixelData[py])) continue;

      for (let px = 0; px < pixelData[py].length; px++) {
        this.setPixel(x + px, y + py, pixelData[py][px]);
      }
    }

    return true;
  }

  /**
   * Convert sprite to ImageData for canvas rendering
   */
  // Composite all layers to ImageData
  toImageData() {
    const imageData = new ImageData(this.width, this.height);
    const data = imageData.data;
    let index = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const [r, g, b, a] = this.getPixel(x, y);
        data[index] = r;
        data[index + 1] = g;
        data[index + 2] = b;
        data[index + 3] = a;
        index += 4;
      }
    }
    return imageData;
  }

  /**
   * Create sprite from ImageData
   */
  static fromImageData(imageData, name = "Imported Sprite") {
    const sprite = new Sprite(imageData.width, imageData.height, name);
    const layer = sprite.layers[0];
    if (layer.useTypedArray) {
      layer.pixels.set(imageData.data);
    } else {
      const data = imageData.data;
      let index = 0;
      for (let y = 0; y < imageData.height; y++) {
        for (let x = 0; x < imageData.width; x++) {
          layer.pixels[y][x] = [
            data[index],
            data[index + 1],
            data[index + 2],
            data[index + 3],
          ];
          index += 4;
        }
      }
    }
    sprite.pixels = layer.pixels;
    sprite.useTypedArray = layer.useTypedArray;
    sprite.saveToHistory();
    return sprite;
  }

  /**
   * Export sprite as SVG string
   */
  toSVG() {
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}" style="image-rendering: pixelated;">`;
    svg += '<g shape-rendering="crispEdges">';
    let hasVisiblePixels = false;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const [r, g, b, a] = this.getPixel(x, y);
        if (a > 0) {
          hasVisiblePixels = true;
          if (a === 255) {
            const color = `rgb(${r},${g},${b})`;
            svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="${color}"/>`;
          } else {
            const opacity = (a / 255).toFixed(3);
            const color = `rgba(${r},${g},${b},${opacity})`;
            svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="${color}"/>`;
          }
        }
      }
    }
    if (!hasVisiblePixels) {
      svg += '<rect x="0" y="0" width="1" height="1" fill="rgba(0,0,0,0)"/>';
    }
    svg += "</g></svg>";
    return svg;
  }

  // Add this method to the Sprite class
  convertTypedArrayTo2D(typedArray) {
    const pixels = [];
    let index = 0;

    for (let y = 0; y < this.height; y++) {
      pixels[y] = [];
      for (let x = 0; x < this.width; x++) {
        pixels[y][x] = [
          typedArray[index],
          typedArray[index + 1],
          typedArray[index + 2],
          typedArray[index + 3],
        ];
        index += 4;
      }
    }

    return pixels;
  }

  /**
   * Get sprite statistics
   */
  getStats() {
    let transparentPixels = 0;
    let opaquePixels = 0;
    const colorCounts = new Map();
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const [r, g, b, a] = this.getPixel(x, y);
        if (a === 0) {
          transparentPixels++;
        } else {
          opaquePixels++;
          const colorKey = `${r},${g},${b},${a}`;
          colorCounts.set(colorKey, (colorCounts.get(colorKey) || 0) + 1);
        }
      }
    }
    if (this.frames.length === 0) {
      this.initializeFrames();
    }

    return {
      id: this.id,
      name: this.name,
      width: this.width,
      height: this.height,
      createdAt: this.createdAt, // Fixed: was this.created
      modifiedAt: this.modifiedAt, // Fixed: was this.modified
      transparentPixels,
      opaquePixels,
      uniqueColors: colorCounts.size,
      totalPixels: this.width * this.height,
      frames: this.frames,
      isAnimated: this.isAnimated,
      // Keep backward compatibility
      pixels: this.getPixelArray(),
      layers: this.layers,
    };
  }
}
