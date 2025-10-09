// Lightweight Layer Manager - Canvas-based implementation for better performance
class LayerManager {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.layers = [];
    this.activeLayerIndex = 0;
    this.onChange = null;

    // Performance optimizations
    this.compositeDirty = true;
    this.compositeCache = null;
    this.batchMode = false;
    this.pendingUpdates = false;

    // History system
    this.history = [];
    this.historyIndex = -1;
    const pixelCount = width * height;
    // Use patch-based history for large sprites, full snapshots for small ones
    this.usePatchHistory = pixelCount > 10000;
    this.maxHistorySize = pixelCount > 100000 ? 20 : 50;
    this._changedPixels = null; // Track changes during batch operations

    this.createDefaultLayer();
    this.saveToHistory(); // Save initial state
  }

  // Save current state to history
  saveToHistory() {
    // Remove future history if we're not at the end
    if (this.historyIndex < this.history.length - 1) {
      this.history.splice(this.historyIndex + 1);
    }

    // OPTIMIZATION: Use patch-based history for large sprites
    if (this.usePatchHistory && this._changedPixels && this._changedPixels.size > 0) {
      // Only save changed pixels (patch)
      const patch = {
        type: 'patch',
        timestamp: Date.now(),
        activeLayerIndex: this.activeLayerIndex,
        changes: Array.from(this._changedPixels).map(key => {
          const [layerIdx, x, y] = key.split(',').map(Number);
          const layer = this.layers[layerIdx];
          let color = [0, 0, 0, 0];
          if (layer) {
            if (layer.useTypedArray) {
              color = this._getPixel(layer.pixels, x, y);
            } else if (layer.pixels[y] && layer.pixels[y][x]) {
              color = [...layer.pixels[y][x]];
            }
          }
          return {
            layerIdx,
            x,
            y,
            color
          };
        })
      };
      this.history.push(patch);
      this._changedPixels.clear();
    } else {
      // Full snapshot for small sprites or first save
      const state = {
        type: 'snapshot',
        width: this.width,
        height: this.height,
        activeLayerIndex: this.activeLayerIndex,
        timestamp: Date.now(),
        layers: this.layers.map((layer) => {
          // Handle both TypedArrays and nested arrays
          let pixelsCopy;
          
          if (layer.useTypedArray) {
            // For TypedArrays, create a clone
            pixelsCopy = new Uint8Array(layer.pixels);
          } else if (Array.isArray(layer.pixels)) {
            // For 2D arrays, deep copy
            pixelsCopy = layer.pixels.map((row) => 
              Array.isArray(row) ? row.map((pixel) => 
                Array.isArray(pixel) ? [...pixel] : [0, 0, 0, 0]
              ) : []
            );
          } else {
            // Fallback for any other case
            pixelsCopy = new Uint8Array(this.width * this.height * 4);
          }
          
          return {
            id: layer.id,
            name: layer.name,
            visible: layer.visible,
            opacity: layer.opacity,
            locked: layer.locked,
            blendMode: layer.blendMode,
            pixels: pixelsCopy,
            useTypedArray: layer.useTypedArray
          };
        }),
      };
      this.history.push(state);
    }

    this.historyIndex++;

    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.historyIndex--;
    }
  }

  // Undo last action
  undo() {
    if (this.historyIndex > 0) {
      const currentState = this.history[this.historyIndex];
      this.historyIndex--;
      const targetState = this.history[this.historyIndex];
      this.restoreFromState(targetState, currentState);
      return true;
    }
    return false;
  }

  // Redo next action
  redo() {
    if (this.historyIndex < this.history.length - 1) {
      const currentState = this.history[this.historyIndex];
      this.historyIndex++;
      const targetState = this.history[this.historyIndex];
      this.restoreFromState(targetState, currentState);
      return true;
    }
    return false;
  }

  // Restore from history state (optimized for patches)
  restoreFromState(state, reverseFrom = null) {
    // Prevent saving to history during restore
    this._restoring = true;

    if (state.type === 'patch') {
      // Apply patch changes
      this.activeLayerIndex = state.activeLayerIndex;
      
      // Reverse previous patch if moving backward
      if (reverseFrom && reverseFrom.type === 'patch') {
        for (const change of reverseFrom.changes) {
          const layer = this.layers[change.layerIdx];
          if (layer && layer.pixels) {
            if (layer.useTypedArray) {
              this._setPixel(layer.pixels, change.x, change.y, change.color);
            } else if (layer.pixels[change.y]) {
              layer.pixels[change.y][change.x] = [...change.color];
            }
          }
        }
      }
    } else {
      // Full snapshot restore
      this.width = state.width;
      this.height = state.height;
      this.activeLayerIndex = state.activeLayerIndex;

      // Deep copy layers from state
      this.layers = state.layers.map((layerData) => {
        // Handle both TypedArrays and nested arrays for restoration
        let pixelsCopy;
        
        if (layerData.useTypedArray) {
          // For TypedArrays, create a clone
          pixelsCopy = new Uint8Array(layerData.pixels);
        } else if (Array.isArray(layerData.pixels)) {
          // For 2D arrays, deep copy
          if (Array.isArray(layerData.pixels[0])) {
            pixelsCopy = layerData.pixels.map((row) => 
              Array.isArray(row) ? row.map((pixel) => 
                Array.isArray(pixel) ? [...pixel] : [0, 0, 0, 0]
              ) : []
            );
          } else {
            // It might be a flattened array
            pixelsCopy = new Uint8Array(layerData.pixels);
          }
        } else {
          // Fallback for any other case
          pixelsCopy = new Uint8Array(this.width * this.height * 4);
        }
        
        return {
          id: layerData.id,
          name: layerData.name,
          visible: layerData.visible,
          opacity: layerData.opacity,
          locked: layerData.locked || false,
          blendMode: layerData.blendMode || "normal",
          pixels: pixelsCopy,
          useTypedArray: layerData.useTypedArray
        };
      });
    }

    this.compositeDirty = true;
    this.compositeCache = null;

    this._restoring = false;
    this.notifyChange();
  }

  // Check if undo is available
  canUndo() {
    return this.historyIndex > 0;
  }

  // Check if redo is available
  canRedo() {
    return this.historyIndex < this.history.length - 1;
  }

  // Add to LayerManager - for tools to batch pixel operations and save once
  startBatchOperation() {
    this.setBatchMode(true);
    // Track changed pixels for patch-based history
    if (this.usePatchHistory) {
      this._changedPixels = new Set();
    }
  }

  endBatchOperation() {
    this.setBatchMode(false);
    this.saveToHistory();
    if (window.editor && window.editor.uiController) {
      window.editor.uiController.updateCanvasColorsPalette();
    }
  }

  createDefaultLayer() {
    this.addLayer("Background");
  }

  addLayer(name = null, insertAt = null) {
    const layerName = name || `Layer ${this.layers.length + 1}`;

    // Create layer data structure
    const layerData = {
      id: Date.now() + Math.random(),
      name: layerName,
      visible: true,
      opacity: 1,
      pixels: this.createEmptyPixelArray(),
      locked: false,
      blendMode: "normal", // For future blend mode support
      useTypedArray: true  // Always use TypedArray for better performance
    };

    // Insert at specific position or at the end
    if (insertAt !== null && insertAt >= 0 && insertAt <= this.layers.length) {
      this.layers.splice(insertAt, 0, layerData);
      if (insertAt <= this.activeLayerIndex) {
        this.activeLayerIndex++;
      }
    } else {
      this.layers.push(layerData);
      this.activeLayerIndex = this.layers.length - 1;
    }

    this.notifyChange();
    this.saveToHistory(); // Add this
    this.notifyChange();
    return layerData;
  }

  createEmptyPixelArray() {
    // Always use TypedArray for better performance
    return new Uint8Array(this.width * this.height * 4);
  }
  
  // Helper to convert coordinates to pixel index in TypedArray
  _coordsToIndex(x, y) {
    return (y * this.width + x) * 4;
  }
  
  // Helper to get a pixel from TypedArray
  _getPixel(pixels, x, y) {
    const index = this._coordsToIndex(x, y);
    return [
      pixels[index],
      pixels[index + 1], 
      pixels[index + 2], 
      pixels[index + 3]
    ];
  }
  
  // Helper to set a pixel in TypedArray
  _setPixel(pixels, x, y, color) {
    const index = this._coordsToIndex(x, y);
    pixels[index] = color[0] || 0;
    pixels[index + 1] = color[1] || 0; 
    pixels[index + 2] = color[2] || 0;
    pixels[index + 3] = color[3] || 0;
  }

  deleteLayer(index) {
    if (this.layers.length <= 1) {
      return false; // Can't delete the last layer
    }

    if (index < 0 || index >= this.layers.length) {
      return false; // Invalid index
    }

    // Remove from array
    this.layers.splice(index, 1);

    // Adjust active layer index
    if (this.activeLayerIndex >= this.layers.length) {
      this.activeLayerIndex = this.layers.length - 1;
    } else if (this.activeLayerIndex > index) {
      this.activeLayerIndex--;
    }

    this.notifyChange();
    this.saveToHistory(); // Add this
    this.notifyChange();
    return true;
  }

  duplicateLayer(index) {
    if (index < 0 || index >= this.layers.length) {
      return null;
    }

    const sourceLayer = this.layers[index];
    const newLayer = this.addLayer(`${sourceLayer.name} Copy`, index + 1);

    // Deep copy pixel data
    newLayer.pixels = sourceLayer.pixels.map((row) =>
      row.map((pixel) => [...pixel])
    );

    // Copy properties
    newLayer.opacity = sourceLayer.opacity;
    newLayer.visible = sourceLayer.visible;
    newLayer.blendMode = sourceLayer.blendMode;

    this.notifyChange();
    this.saveToHistory(); // Add this
    this.notifyChange();
    return newLayer;
  }

  moveLayer(fromIndex, toIndex) {
    if (
      fromIndex < 0 ||
      fromIndex >= this.layers.length ||
      toIndex < 0 ||
      toIndex >= this.layers.length ||
      fromIndex === toIndex
    ) {
      return false;
    }

    const layer = this.layers.splice(fromIndex, 1)[0];
    this.layers.splice(toIndex, 0, layer);

    // Update active layer index
    if (this.activeLayerIndex === fromIndex) {
      this.activeLayerIndex = toIndex;
    } else if (
      fromIndex < this.activeLayerIndex &&
      toIndex >= this.activeLayerIndex
    ) {
      this.activeLayerIndex--;
    } else if (
      fromIndex > this.activeLayerIndex &&
      toIndex <= this.activeLayerIndex
    ) {
      this.activeLayerIndex++;
    }

    this.notifyChange();
    this.saveToHistory(); // Add this
    this.notifyChange();
    return true;
  }

  setLayerVisibility(index, visible) {
    if (index < 0 || index >= this.layers.length) {
      return false;
    }

    this.layers[index].visible = visible;
    this.notifyChange();
    return true;
  }

  setLayerOpacity(index, opacity) {
    if (index < 0 || index >= this.layers.length) {
      return false;
    }

    this.layers[index].opacity = Math.max(0, Math.min(1, opacity));
    this.notifyChange();
    return true;
  }

  setLayerName(index, name) {
    if (index < 0 || index >= this.layers.length || !name.trim()) {
      return false;
    }

    this.layers[index].name = name.trim();
    this.notifyChange(); // CRITICAL: This must be called
    return true;
  }

  setLayerLocked(index, locked) {
    if (index < 0 || index >= this.layers.length) {
      return false;
    }

    this.layers[index].locked = locked;
    this.notifyChange();
    return true;
  }

  setActiveLayer(index) {
    if (index < 0 || index >= this.layers.length) {
      return false;
    }

    this.activeLayerIndex = index;
    this.notifyChange();
    return true;
  }

  getActiveLayer() {
    return this.layers[this.activeLayerIndex] || null;
  }

  getLayer(index) {
    return this.layers[index] || null;
  }

  setPixel(x, y, color, layerIndex = null) {
    const targetIndex =
      layerIndex !== null ? layerIndex : this.activeLayerIndex;
    const layer = this.layers[targetIndex];

    if (!layer || layer.locked) {
      return false;
    }

    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return false;
    }

    // Track changed pixels for patch-based history
    if (this.usePatchHistory && this._changedPixels && this.batchMode) {
      const key = `${targetIndex},${x},${y}`;
      if (!this._changedPixels.has(key)) {
        this._changedPixels.add(key);
      }
    }

    // Update pixel data - handle both TypedArrays and 2D arrays
    if (layer.useTypedArray || layer.pixels instanceof Uint8Array) {
      this._setPixel(layer.pixels, x, y, color);
    } else if (Array.isArray(layer.pixels) && Array.isArray(layer.pixels[y])) {
      layer.pixels[y][x] = [...color];
    } else {
      console.error('Invalid pixel data structure', layer.pixels);
      return false;
    }

    // OPTIMIZATION: Mark dirty region for selective redraw
    if (window.editor && window.editor.canvasManager) {
      window.editor.canvasManager.markDirtyRegion(x, y, 1, 1);
    }

    // Mark composite as dirty so it re-renders
    this.compositeDirty = true;

    if (this.batchMode) {
      this.pendingUpdates = true;
      // Force immediate render even in batch mode for visual feedback
      if (window.editor && window.editor.canvasManager) {
        window.editor.canvasManager.render();
      }
    } else {
      this.notifyChange();
    }
    return true;
  }

  getPixel(x, y, layerIndex = null) {
    const targetIndex =
      layerIndex !== null ? layerIndex : this.activeLayerIndex;
    const layer = this.layers[targetIndex];

    if (!layer || x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return [0, 0, 0, 0];
    }

    // Handle both TypedArrays and 2D arrays
    if (layer.useTypedArray || layer.pixels instanceof Uint8Array) {
      return this._getPixel(layer.pixels, x, y);
    } else if (Array.isArray(layer.pixels) && layer.pixels[y] && Array.isArray(layer.pixels[y][x])) {
      return [...layer.pixels[y][x]];
    } else {
      console.error('Invalid pixel data structure', layer.pixels);
      return [0, 0, 0, 0];
    }
  }

  // Get composite pixel at position (all visible layers combined)
  getCompositePixel(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return [0, 0, 0, 0];
    }

    let result = [0, 0, 0, 0];

    // Composite from bottom layer to top
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      if (!layer.visible) continue;

      // Handle both TypedArrays and 2D arrays
      let layerPixel;
      if (layer.useTypedArray || layer.pixels instanceof Uint8Array) {
        layerPixel = this._getPixel(layer.pixels, x, y);
      } else if (Array.isArray(layer.pixels) && layer.pixels[y]) {
        layerPixel = layer.pixels[y][x] || [0, 0, 0, 0];
      } else {
        layerPixel = [0, 0, 0, 0];
      }
      
      const [lr, lg, lb, la] = layerPixel;

      if (la === 0) continue; // Skip transparent pixels

      const layerAlpha = (la / 255) * layer.opacity;

      if (result[3] === 0) {
        // First non-transparent pixel
        result = [lr, lg, lb, la * layer.opacity];
      } else {
        // Alpha blend
        const resultAlpha = result[3] / 255;
        const combinedAlpha = layerAlpha + resultAlpha * (1 - layerAlpha);

        if (combinedAlpha > 0) {
          result[0] =
            (lr * layerAlpha + result[0] * resultAlpha * (1 - layerAlpha)) /
            combinedAlpha;
          result[1] =
            (lg * layerAlpha + result[1] * resultAlpha * (1 - layerAlpha)) /
            combinedAlpha;
          result[2] =
            (lb * layerAlpha + result[2] * resultAlpha * (1 - layerAlpha)) /
            combinedAlpha;
          result[3] = combinedAlpha * 255;
        }
      }
    }

    return result.map((c) => Math.round(c));
  }
  markRegionDirty(x, y, width, height) {
    if (!this.dirtyRegions) {
      this.dirtyRegions = [];
    }

    this.dirtyRegions.push({
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: Math.min(width, this.width - x),
      height: Math.min(height, this.height - y),
    });
  }

  // Generate composite ImageData for the entire canvas - optimized for TypedArrays
  getCompositeImageData() {
    // Use cache if available and not dirty
    if (this.compositeCache && !this.compositeDirty) {
      return this.compositeCache;
    }
    
    const imageData = new ImageData(this.width, this.height);
    const data = imageData.data;
    
    // Fast path for when there's only one visible layer with full opacity
    const visibleLayers = this.layers.filter(layer => layer.visible && layer.opacity > 0);
    
    if (visibleLayers.length === 1 && visibleLayers[0].opacity === 1) {
      const layer = visibleLayers[0];
      
      if (layer.useTypedArray) {
        // Direct copy for TypedArrays - extremely fast
        data.set(layer.pixels);
      } else {
        // Convert 2D array to flat array
        for (let y = 0; y < this.height; y++) {
          for (let x = 0; x < this.width; x++) {
            const index = (y * this.width + x) * 4;
            const pixel = layer.pixels[y][x];
            
            data[index] = pixel[0];     // R
            data[index + 1] = pixel[1]; // G
            data[index + 2] = pixel[2]; // B
            data[index + 3] = pixel[3]; // A
          }
        }
      }
    } else {
      // Multiple layers need compositing
      for (let i = 0; i < data.length; i += 4) {
        let [r, g, b, a] = [0, 0, 0, 0]; // Start with transparent black
        
        // Loop through layers from bottom to top
        for (let li = 0; li < visibleLayers.length; li++) {
          const layer = visibleLayers[li];
          if (!layer.visible || layer.opacity === 0) continue;
          
          let sr, sg, sb, sa;
          
          if (layer.useTypedArray) {
            sr = layer.pixels[i];
            sg = layer.pixels[i + 1];
            sb = layer.pixels[i + 2];
            sa = layer.pixels[i + 3];
          } else {
            // For 2D arrays, convert index to coordinates
            const pixelIndex = Math.floor(i / 4);
            const x = pixelIndex % this.width;
            const y = Math.floor(pixelIndex / this.width);
            
            if (!layer.pixels[y] || !layer.pixels[y][x]) continue;
            
            const pixel = layer.pixels[y][x];
            sr = pixel[0];
            sg = pixel[1];
            sb = pixel[2];
            sa = pixel[3];
          }
          
          // Apply layer opacity
          sa = sa * layer.opacity / 255;
          
          // Skip transparent pixels
          if (sa === 0) continue;
          
          // Alpha compositing formula
          const da = a / 255; // destination alpha
          const newAlpha = sa + da * (1 - sa);
          
          if (newAlpha > 0) {
            r = Math.round((sr * sa + r * da * (1 - sa)) / newAlpha);
            g = Math.round((sg * sa + g * da * (1 - sa)) / newAlpha);
            b = Math.round((sb * sa + b * da * (1 - sa)) / newAlpha);
            a = Math.round(newAlpha * 255);
          }
        }
        
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = a;
      }
    }
    
    // Cache the result
    this.compositeCache = imageData;
    this.compositeDirty = false;
    
    return imageData;
  }

  // Add to LayerManager class - optimized composite rendering
  getCompositeImageDataOptimized() {
    // Use cached result if no layers have changed
    if (this.compositeCache && !this.compositeDirty) {
      return this.compositeCache;
    }

    const canvas = document.createElement("canvas");
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext("2d");
    const imageData = ctx.createImageData(this.width, this.height);
    const data = imageData.data;

    // Only composite visible layers
    const visibleLayers = this.layers.filter((layer) => layer.visible);

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const index = (y * this.width + x) * 4;
        let result = [0, 0, 0, 0];

        // Composite visible layers only
        for (let i = 0; i < visibleLayers.length; i++) {
          const layer = visibleLayers[i];
          const layerPixel = layer.pixels[y][x];
          const [lr, lg, lb, la] = layerPixel;

          if (la === 0) continue;

          const layerAlpha = (la / 255) * layer.opacity;

          if (result[3] === 0) {
            result = [lr, lg, lb, la * layer.opacity];
          } else {
            const resultAlpha = result[3] / 255;
            const combinedAlpha = layerAlpha + resultAlpha * (1 - layerAlpha);

            if (combinedAlpha > 0) {
              result[0] =
                (lr * layerAlpha + result[0] * resultAlpha * (1 - layerAlpha)) /
                combinedAlpha;
              result[1] =
                (lg * layerAlpha + result[1] * resultAlpha * (1 - layerAlpha)) /
                combinedAlpha;
              result[2] =
                (lb * layerAlpha + result[2] * resultAlpha * (1 - layerAlpha)) /
                combinedAlpha;
              result[3] = combinedAlpha * 255;
            }
          }
        }

        data[index] = Math.round(result[0]);
        data[index + 1] = Math.round(result[1]);
        data[index + 2] = Math.round(result[2]);
        data[index + 3] = Math.round(result[3]);
      }
    }

    this.compositeCache = imageData;
    this.compositeDirty = false;
    return imageData;
  }
  // In LayerManager, add batch mode
  setBatchMode(enabled) {
    this.batchMode = enabled;
    if (!enabled && this.pendingUpdates) {
      this.notifyChange();
      this.pendingUpdates = false;
    }
  }

  // Modified notifyChange
  // Optimized notifyChange:
  // Optimized notifyChange - prevent infinite loops and history during restore
  notifyChange() {
    if (this.batchMode || this._restoring || this._preventSaveLoop) {
      if (!this._restoring && !this._preventSaveLoop) {
        this.pendingUpdates = true;
      }
      return;
    }

    this.compositeDirty = true;

    // Save layer changes back to sprite
    if (
      !this.saving &&
      window.editor &&
      typeof window.editor.saveLayersToSprite === "function"
    ) {
      this.saving = true;
      window.editor.saveLayersToSprite();
      this.saving = false;
    }

    if (this.onChange) {
      // Use requestAnimationFrame to batch updates
      if (!this.updateScheduled) {
        this.updateScheduled = true;
        requestAnimationFrame(() => {
          this.onChange(this);
          this.updateScheduled = false;
        });
      }
    }
  }

  // Resize all layers - optimized for TypedArrays
  resize(newWidth, newHeight, useNearestNeighbor = false) {
    const oldWidth = this.width;
    const oldHeight = this.height;

    this.width = newWidth;
    this.height = newHeight;

    this.layers.forEach((layer) => {
      // Always create a TypedArray for the new pixels
      const newPixels = new Uint8Array(newWidth * newHeight * 4);
      
      if (useNearestNeighbor && oldWidth > 0 && oldHeight > 0) {
        // Nearest neighbor scaling
        if (layer.useTypedArray) {
          // Fast path for TypedArrays
          for (let y = 0; y < newHeight; y++) {
            for (let x = 0; x < newWidth; x++) {
              // Map new coordinates to old coordinates using nearest neighbor
              const srcX = Math.floor((x / newWidth) * oldWidth);
              const srcY = Math.floor((y / newHeight) * oldHeight);
              
              // Get indices
              const newIndex = (y * newWidth + x) * 4;
              const oldIndex = (srcY * oldWidth + srcX) * 4;
              
              // Copy pixel values
              newPixels[newIndex] = layer.pixels[oldIndex] || 0;         // R
              newPixels[newIndex + 1] = layer.pixels[oldIndex + 1] || 0; // G
              newPixels[newIndex + 2] = layer.pixels[oldIndex + 2] || 0; // B
              newPixels[newIndex + 3] = layer.pixels[oldIndex + 3] || 0; // A
            }
          }
        } else {
          // Fallback for legacy 2D arrays
          for (let y = 0; y < newHeight; y++) {
            for (let x = 0; x < newWidth; x++) {
              // Map new coordinates to old coordinates using nearest neighbor
              const srcX = Math.floor((x / newWidth) * oldWidth);
              const srcY = Math.floor((y / newHeight) * oldHeight);

              // Clamp to bounds
              const clampedSrcX = Math.min(Math.max(srcX, 0), oldWidth - 1);
              const clampedSrcY = Math.min(Math.max(srcY, 0), oldHeight - 1);

              // Get new pixel index
              const newIndex = (y * newWidth + x) * 4;
              
              // Copy pixel from source
              if (layer.pixels[clampedSrcY] && layer.pixels[clampedSrcY][clampedSrcX]) {
                const pixel = layer.pixels[clampedSrcY][clampedSrcX];
                newPixels[newIndex] = pixel[0] || 0;
                newPixels[newIndex + 1] = pixel[1] || 0;
                newPixels[newIndex + 2] = pixel[2] || 0;
                newPixels[newIndex + 3] = pixel[3] || 0;
              }
            }
          }
        }
      } else {
        // Simple crop/extend behavior
        if (layer.useTypedArray) {
          // Fast path for TypedArrays - copy existing pixels directly
          for (let y = 0; y < Math.min(oldHeight, newHeight); y++) {
            for (let x = 0; x < Math.min(oldWidth, newWidth); x++) {
              const newIndex = (y * newWidth + x) * 4;
              const oldIndex = (y * oldWidth + x) * 4;
              
              // Copy each channel
              newPixels[newIndex] = layer.pixels[oldIndex] || 0;
              newPixels[newIndex + 1] = layer.pixels[oldIndex + 1] || 0;
              newPixels[newIndex + 2] = layer.pixels[oldIndex + 2] || 0;
              newPixels[newIndex + 3] = layer.pixels[oldIndex + 3] || 0;
            }
          }
        } else {
          // Fallback for 2D arrays
          for (let y = 0; y < Math.min(oldHeight, newHeight); y++) {
            for (let x = 0; x < Math.min(oldWidth, newWidth); x++) {
              const newIndex = (y * newWidth + x) * 4;
              
              if (layer.pixels[y] && layer.pixels[y][x]) {
                const pixel = layer.pixels[y][x];
                newPixels[newIndex] = pixel[0] || 0;
                newPixels[newIndex + 1] = pixel[1] || 0;
                newPixels[newIndex + 2] = pixel[2] || 0;
                newPixels[newIndex + 3] = pixel[3] || 0;
              }
            }
          }
        }
      }
      
      // Update layer with new pixels and set flag for TypedArray
      layer.pixels = newPixels;
      layer.useTypedArray = true;
    });

    // Mark composite as dirty
    this.compositeDirty = true;
    this.compositeCache = null;

    // Save to history after resize
    this.saveToHistory();

    this.notifyChange();
  }

  // Clear a layer
  clearLayer(index = null) {
    const targetIndex = index !== null ? index : this.activeLayerIndex;
    const layer = this.layers[targetIndex];

    if (!layer || layer.locked) {
      return false;
    }

    layer.pixels = this.createEmptyPixelArray();
    this.notifyChange();
    return true;
  }

  // Fill a layer with a color
  fillLayer(color, index = null) {
    const targetIndex = index !== null ? index : this.activeLayerIndex;
    const layer = this.layers[targetIndex];

    if (!layer || layer.locked) {
      return false;
    }

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        layer.pixels[y][x] = [...color];
      }
    }

    this.notifyChange();
    return true;
  }

  // Merge layer down
  // Replace the existing mergeDown method with this improved version:
  mergeDown(index) {
    if (index <= 0 || index >= this.layers.length) {
      return false; // Can't merge bottom layer or invalid index
    }

    const upperLayer = this.layers[index];
    const lowerLayer = this.layers[index - 1];

    if (lowerLayer.locked) {
      return false;
    }

    // Store the name for notification
    const upperLayerName = upperLayer.name;
    const lowerLayerName = lowerLayer.name;

    // Start batch operation to prevent multiple history saves
    this.startBatchOperation();

    try {
      // Merge pixels with proper alpha blending
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          const upperPixel = upperLayer.pixels[y][x];
          const lowerPixel = lowerLayer.pixels[y][x];

          // Skip transparent upper pixels
          if (upperPixel[3] === 0) {
            continue;
          }

          // If upper pixel is fully opaque, just copy it
          if (upperPixel[3] === 255 && upperLayer.opacity === 1) {
            lowerLayer.pixels[y][x] = [...upperPixel];
            continue;
          }

          // Alpha blend the pixels
          const upperAlpha = (upperPixel[3] / 255) * upperLayer.opacity;
          const lowerAlpha = lowerPixel[3] / 255;

          const combinedAlpha = upperAlpha + lowerAlpha * (1 - upperAlpha);

          if (combinedAlpha > 0) {
            const invUpperAlpha = 1 - upperAlpha;

            lowerLayer.pixels[y][x] = [
              Math.round(
                (upperPixel[0] * upperAlpha +
                  lowerPixel[0] * lowerAlpha * invUpperAlpha) /
                  combinedAlpha
              ),
              Math.round(
                (upperPixel[1] * upperAlpha +
                  lowerPixel[1] * lowerAlpha * invUpperAlpha) /
                  combinedAlpha
              ),
              Math.round(
                (upperPixel[2] * upperAlpha +
                  lowerPixel[2] * lowerAlpha * invUpperAlpha) /
                  combinedAlpha
              ),
              Math.round(combinedAlpha * 255),
            ];
          }
        }
      }

      // Update the merged layer name
      lowerLayer.name = `${lowerLayerName} + ${upperLayerName}`;

      // Remove upper layer
      this.layers.splice(index, 1);

      // Adjust active layer index
      if (this.activeLayerIndex >= index) {
        this.activeLayerIndex = Math.max(0, this.activeLayerIndex - 1);
      }

      this.endBatchOperation(); // This will save to history
      return true;
    } catch (error) {
      console.error("Error during layer merge:", error);
      this.endBatchOperation();
      return false;
    }
  }

  // Export layer as sprite
  exportLayerAsSprite(index = null) {
    const targetIndex = index !== null ? index : this.activeLayerIndex;
    const layer = this.layers[targetIndex];

    if (!layer) return null;

    // Create a new sprite with the layer data
    const sprite = new Sprite(this.width, this.height, layer.name);
    
    // Handle both TypedArrays and nested arrays
    if (layer.useTypedArray) {
      // Clone the TypedArray
      const pixelsCopy = new Uint8Array(layer.pixels);
      sprite.pixels = pixelsCopy;
      sprite.useTypedArray = true;
    } else {
      // Convert nested arrays to flat TypedArray (optimize for newer sprites)
      const pixelData = new Uint8Array(this.width * this.height * 4);
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          if (layer.pixels[y] && layer.pixels[y][x]) {
            const pixel = layer.pixels[y][x];
            const index = (y * this.width + x) * 4;
            pixelData[index] = pixel[0] || 0;
            pixelData[index + 1] = pixel[1] || 0;
            pixelData[index + 2] = pixel[2] || 0;
            pixelData[index + 3] = pixel[3] || 0;
          }
        }
      }
      sprite.pixels = pixelData;
      sprite.useTypedArray = true;
    }
    return sprite;
  }

  // Load from sprite
  loadFromSprite(sprite, replaceAll = true) {
    if (replaceAll) {
      this.layers = [];
      this.activeLayerIndex = 0;
    }

    // Resize if necessary
    if (sprite.width !== this.width || sprite.height !== this.height) {
      this.resize(sprite.width, sprite.height);
    }

    const layer = this.addLayer(sprite.name || "Imported Layer");
    const spritePixels = sprite.getPixelArray();

    layer.pixels = spritePixels.map((row) => row.map((pixel) => [...pixel]));
    this.notifyChange();

    return layer;
  }

  // Get layer statistics
  getLayerStats(index = null) {
    const targetIndex = index !== null ? index : this.activeLayerIndex;
    const layer = this.layers[targetIndex];

    if (!layer) return null;

    let transparentPixels = 0;
    let opaquePixels = 0;
    let semiTransparentPixels = 0;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const alpha = layer.pixels[y][x][3];
        if (alpha === 0) {
          transparentPixels++;
        } else if (alpha === 255) {
          opaquePixels++;
        } else {
          semiTransparentPixels++;
        }
      }
    }

    return {
      name: layer.name,
      visible: layer.visible,
      opacity: layer.opacity,
      locked: layer.locked,
      transparentPixels,
      opaquePixels,
      semiTransparentPixels,
      totalPixels: this.width * this.height,
    };
  }

  // Set change callback
  setOnChange(callback) {
    this.onChange = callback;
  }

  // Notify change
  // Modify the LayerManager's notifyChange method to trigger canvas color palette updates:

  notifyChange() {
    if (this.batchMode || this._restoring || this._preventSaveLoop) {
      if (!this._restoring && !this._preventSaveLoop) {
        this.pendingUpdates = true;
      }
      return;
    }

    this.compositeDirty = true;

    // CRITICAL FIX: Don't save during sprite operations that could corrupt other sprites
    const editor = window.editor;
    if (
      !this.saving &&
      editor &&
      !editor._importingSprite &&
      !editor._switchingSprites &&
      !editor._savingLayers &&
      !editor._loadingFrame &&
      typeof editor.saveLayersToSprite === "function"
    ) {
      this.saving = true;
      try {
        editor.saveLayersToSprite();
      } catch (error) {
        console.error("Error in saveLayersToSprite:", error);
      } finally {
        this.saving = false;
      }
    }

    // Trigger canvas color palette update
    if (
      editor &&
      editor.uiController &&
      typeof editor.uiController.updateCanvasColorsPalette === "function"
    ) {
      // Debounce the canvas color update to avoid excessive recalculation
      if (this._canvasColorUpdateTimeout) {
        clearTimeout(this._canvasColorUpdateTimeout);
      }
      this._canvasColorUpdateTimeout = setTimeout(() => {
        editor.uiController.updateCanvasColorsPalette();
      }, 100); // 100ms debounce
    }

    if (this.onChange) {
      // Use requestAnimationFrame to batch updates
      if (!this.updateScheduled) {
        this.updateScheduled = true;
        requestAnimationFrame(() => {
          this.onChange(this);
          this.updateScheduled = false;
        });
      }
    }
  }

  // Also add a method to force immediate canvas color update when needed:
  forceCanvasColorUpdate() {
    const editor = window.editor;
    if (
      editor &&
      editor.uiController &&
      typeof editor.uiController.updateCanvasColorsPalette === "function"
    ) {
      editor.uiController.updateCanvasColorsPalette();
    }
  }

  // Get serializable data
  serialize() {
    return {
      width: this.width,
      height: this.height,
      activeLayerIndex: this.activeLayerIndex,
      layers: this.layers.map((layer) => ({
        id: layer.id,
        name: layer.name,
        visible: layer.visible,
        opacity: layer.opacity,
        locked: layer.locked,
        blendMode: layer.blendMode,
        pixels: layer.pixels,
      })),
    };
  }

  // Load from serialized data
  deserialize(data) {
    this.width = data.width;
    this.height = data.height;
    this.activeLayerIndex = data.activeLayerIndex;
    this.layers = data.layers.map((layerData) => ({
      id: layerData.id,
      name: layerData.name,
      visible: layerData.visible,
      opacity: layerData.opacity,
      locked: layerData.locked || false,
      blendMode: layerData.blendMode || "normal",
      pixels: layerData.pixels,
    }));

    this.notifyChange();
  }
  // Add to LayerManager class - save to sprite format
  toSprite(spriteName = "Layered Sprite") {
    const sprite = new Sprite(this.width, this.height, spriteName);

    // Convert layers to sprite format
    const layersData = this.layers.map((layer) => ({
      name: layer.name,
      visible: layer.visible,
      opacity: layer.opacity,
      pixels: layer.pixels.map((row) => row.map((pixel) => [...pixel])),
      useTypedArray: false,
    }));

    sprite.setLayersData(layersData);
    return sprite;
  }

  // Add to LayerManager class - load from sprite
  fromSprite(sprite) {
    // CRITICAL FIX: Validate sprite before processing
    if (!sprite || !sprite.width || !sprite.height) {
      console.error("Invalid sprite data in fromSprite");
      return;
    }

    this.width = sprite.width;
    this.height = sprite.height;

    // CRITICAL FIX: Get layers data with proper validation
    let layersData;
    try {
      layersData = sprite.getLayersData();
    } catch (error) {
      console.error("Failed to get layers data from sprite:", error);
      // Create fallback layer
      layersData = [
        {
          name: "Layer 1",
          visible: true,
          opacity: 1,
          pixels: this.createEmptyPixelArray(),
          useTypedArray: false,
        },
      ];
    }

    // CRITICAL FIX: Validate layers data
    if (!Array.isArray(layersData) || layersData.length === 0) {
      console.warn("No valid layers data, creating default layer");
      layersData = [
        {
          name: "Layer 1",
          visible: true,
          opacity: 1,
          pixels: this.createEmptyPixelArray(),
          useTypedArray: false,
        },
      ];
    }

    // CRITICAL FIX: Process and validate each layer
    this.layers = layersData.map((layerData, index) => {
      let pixels;

      // Handle different pixel data formats
      if (layerData.useTypedArray && layerData.pixels) {
        try {
          pixels = this.convertTypedArrayTo2D(layerData.pixels);
        } catch (error) {
          console.error("Failed to convert TypedArray:", error);
          pixels = this.createEmptyPixelArray();
        }
      } else if (Array.isArray(layerData.pixels)) {
        // Validate 2D array structure
        pixels = this.validatePixelArray(layerData.pixels);
      } else {
        console.warn(`Layer ${index} has invalid pixel data, creating empty`);
        pixels = this.createEmptyPixelArray();
      }

      return {
        id: Date.now() + Math.random() + index,
        name: layerData.name || `Layer ${index + 1}`,
        visible: layerData.visible !== false,
        opacity: typeof layerData.opacity === "number" ? layerData.opacity : 1,
        pixels: pixels,
        locked: false,
        blendMode: "normal",
      };
    });

    // Ensure we have at least one layer
    if (this.layers.length === 0) {
      console.warn("No layers created, adding default layer");
      this.layers.push({
        id: Date.now() + Math.random(),
        name: "Layer 1",
        visible: true,
        opacity: 1,
        pixels: this.createEmptyPixelArray(),
        locked: false,
        blendMode: "normal",
      });
    }

    // CRITICAL FIX: Validate active layer index
    this.activeLayerIndex = Math.min(
      Math.max(0, this.activeLayerIndex || 0),
      this.layers.length - 1
    );

    // CRITICAL FIX: Mark composite as dirty and clear cache
    this.compositeDirty = true;
    this.compositeCache = null;

    // CRITICAL FIX: Force immediate change notification without saving back to sprite
    this._preventSaveLoop = true;
    if (this.onChange) {
      this.onChange(this);
    }
    this._preventSaveLoop = false;

    console.log(`LayerManager loaded ${this.layers.length} layers from sprite`);
  }

  // Add this helper method to LayerManager for pixel validation
  validatePixelArray(pixels) {
    if (!Array.isArray(pixels) || pixels.length !== this.height) {
      console.warn("Invalid pixel array structure, creating empty");
      return this.createEmptyPixelArray();
    }

    // Validate each row
    const validatedPixels = [];
    for (let y = 0; y < this.height; y++) {
      if (!Array.isArray(pixels[y]) || pixels[y].length !== this.width) {
        console.warn(`Invalid pixel row ${y}, filling with empty pixels`);
        validatedPixels[y] = [];
        for (let x = 0; x < this.width; x++) {
          validatedPixels[y][x] = [0, 0, 0, 0];
        }
      } else {
        validatedPixels[y] = [];
        for (let x = 0; x < this.width; x++) {
          const pixel = pixels[y][x];
          if (Array.isArray(pixel) && pixel.length === 4) {
            // Deep copy and validate pixel values
            validatedPixels[y][x] = [
              Math.max(0, Math.min(255, Math.round(pixel[0]) || 0)),
              Math.max(0, Math.min(255, Math.round(pixel[1]) || 0)),
              Math.max(0, Math.min(255, Math.round(pixel[2]) || 0)),
              Math.max(0, Math.min(255, Math.round(pixel[3]) || 0)),
            ];
          } else {
            validatedPixels[y][x] = [0, 0, 0, 0];
          }
        }
      }
    }

    return validatedPixels;
  }

  // Helper method for TypedArray conversion
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
}

// Make LayerManager globally available
window.LayerManager = LayerManager;
