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
    this.maxHistorySize = 50;

    this.createDefaultLayer();
    this.saveToHistory(); // Save initial state
  }

  // Save current state to history
  saveToHistory() {
    // Remove future history if we're not at the end
    if (this.historyIndex < this.history.length - 1) {
      this.history.splice(this.historyIndex + 1);
    }

    // Create deep copy of current state
    const state = {
      width: this.width,
      height: this.height,
      activeLayerIndex: this.activeLayerIndex,
      timestamp: Date.now(),
      layers: this.layers.map((layer) => ({
        id: layer.id,
        name: layer.name,
        visible: layer.visible,
        opacity: layer.opacity,
        locked: layer.locked,
        blendMode: layer.blendMode,
        pixels: layer.pixels.map((row) => row.map((pixel) => [...pixel])),
      })),
    };

    this.history.push(state);
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
      this.historyIndex--;
      const state = this.history[this.historyIndex];
      this.restoreFromState(state);
      return true;
    }
    return false;
  }

  // Redo next action
  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      const state = this.history[this.historyIndex];
      this.restoreFromState(state);
      return true;
    }
    return false;
  }

  // Restore from history state
  restoreFromState(state) {
    // Prevent saving to history during restore
    this._restoring = true;

    this.width = state.width;
    this.height = state.height;
    this.activeLayerIndex = state.activeLayerIndex;

    // Deep copy layers from state
    this.layers = state.layers.map((layerData) => ({
      id: layerData.id,
      name: layerData.name,
      visible: layerData.visible,
      opacity: layerData.opacity,
      locked: layerData.locked || false,
      blendMode: layerData.blendMode || "normal",
      pixels: layerData.pixels.map((row) => row.map((pixel) => [...pixel])),
    }));

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
    const pixels = [];
    for (let y = 0; y < this.height; y++) {
      pixels[y] = [];
      for (let x = 0; x < this.width; x++) {
        pixels[y][x] = [0, 0, 0, 0]; // Transparent
      }
    }
    return pixels;
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

    // Update pixel data
    layer.pixels[y][x] = [...color];

    // OPTIMIZATION: Mark dirty region for selective redraw
    if (window.editor && window.editor.canvasManager) {
      window.editor.canvasManager.markDirtyRegion(x, y, 1, 1);
    }

    if (this.batchMode) {
      this.pendingUpdates = true;
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

    return [...layer.pixels[y][x]];
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

      const layerPixel = layer.pixels[y][x];
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

  // Generate composite ImageData for the entire canvas
  getCompositeImageData() {
    const canvas = document.createElement("canvas");
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext("2d");
    const imageData = ctx.createImageData(this.width, this.height);
    const data = imageData.data;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const [r, g, b, a] = this.getCompositePixel(x, y);
        const index = (y * this.width + x) * 4;

        data[index] = r;
        data[index + 1] = g;
        data[index + 2] = b;
        data[index + 3] = a;
      }
    }

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

  // Resize all layers
  resize(newWidth, newHeight, useNearestNeighbor = false) {
    const oldWidth = this.width;
    const oldHeight = this.height;

    this.width = newWidth;
    this.height = newHeight;

    this.layers.forEach((layer) => {
      if (useNearestNeighbor && oldWidth > 0 && oldHeight > 0) {
        // Nearest neighbor scaling
        const newPixels = [];

        for (let y = 0; y < newHeight; y++) {
          newPixels[y] = [];
          for (let x = 0; x < newWidth; x++) {
            // Map new coordinates to old coordinates using nearest neighbor
            const srcX = Math.floor((x / newWidth) * oldWidth);
            const srcY = Math.floor((y / newHeight) * oldHeight);

            // Clamp to bounds
            const clampedSrcX = Math.min(Math.max(srcX, 0), oldWidth - 1);
            const clampedSrcY = Math.min(Math.max(srcY, 0), oldHeight - 1);

            // Copy pixel from source
            if (
              clampedSrcY < layer.pixels.length &&
              clampedSrcX < layer.pixels[clampedSrcY].length
            ) {
              newPixels[y][x] = [...layer.pixels[clampedSrcY][clampedSrcX]];
            } else {
              newPixels[y][x] = [0, 0, 0, 0]; // Transparent fallback
            }
          }
        }

        layer.pixels = newPixels;
      } else {
        // Original crop/extend behavior
        const newPixels = this.createEmptyPixelArray();

        // Copy existing pixels
        for (let y = 0; y < Math.min(oldHeight, newHeight); y++) {
          for (let x = 0; x < Math.min(oldWidth, newWidth); x++) {
            if (y < layer.pixels.length && x < layer.pixels[y].length) {
              newPixels[y][x] = [...layer.pixels[y][x]];
            }
          }
        }

        layer.pixels = newPixels;
      }
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

    const sprite = new Sprite(this.width, this.height, layer.name);
    sprite.setPixelArray(
      layer.pixels.map((row) => row.map((pixel) => [...pixel]))
    );
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
