// Main Editor Class - Coordinates all components of the pixel editor
class PixelEditor {
  constructor() {
    // Core components
    this.canvasManager = null;
    this.uiManager = null;
    this.layerManager = null;
    this.animationManager = new AnimationManager(this);
    // Prioritize hybridStorage over legacy storageManager
    if (window.hybridStorage) {
      this.storageManager = window.hybridStorage;
      console.log('✅ Constructor: Using HybridStorageManager');
    } else if (window.storageManager) {
      this.storageManager = window.storageManager;
      console.warn('⚠️ Constructor: HybridStorage not available, using legacy StorageManager');
    } else {
      console.warn(
        "No storage manager found during PixelEditor construction. Will retry during initialization."
      );
      this.storageManager = null;
    }

    // Editor state
    this.sprites = []; // Initialize as empty array
    this.currentSprite = null;
    this.currentTool = null;
    this.previousTool = null;
    this.tools = {};

    // Color state
    this.primaryColor = [0, 0, 0, 255]; // Black
    this.secondaryColor = [255, 255, 255, 255]; // White

    // Settings - will be loaded async
    this.settings = null;

    this.initialize().catch((error) => {
      console.error("Failed to initialize editor:", error);
    });

    this.debouncedSave = this.debounce(async (sprite) => {
      await this.saveSpriteWithSync(sprite);
    }, 500); // Save after 500ms of inactivity
  }
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Helper method to save sprite with cloud sync
   */
  async saveSpriteWithSync(sprite) {
    if (!this.storageManager || typeof this.storageManager.saveSprite !== 'function') {
      return false;
    }
    
    const userId = window.currentUser ? window.currentUser.uid : null;
    const saveOptions = userId ? { syncToCloud: true, userId } : { syncToCloud: false };
    
    return await this.storageManager.saveSprite(sprite, saveOptions);
  }

  /**
   * Initialize the editor
   */
  // Update the initialize method to set up layer manager callback correctly
  // Update the initialize method to set up layer manager callback correctly
  async initialize() {
    // Initialize canvas manager
    this.canvasManager = new CanvasManager("main-canvas", "overlay-canvas");

    // Initialize layer manager BEFORE loading settings
    this.layerManager = new LayerManager(16, 16);
    this.animationManager = new AnimationManager(this);

    // Set up layer change callback AFTER layer manager is created
    this.layerManager.setOnChange(() => {
      if (this.canvasManager) {
        this.canvasManager.render();
      }
      this.updateUI();
    });

    // Verify storage manager is available
    console.log('🔍 Initialize: Storage system check');
    console.log('  this.storageManager:', this.storageManager ? this.storageManager.constructor.name : 'Missing');
    
    if (!this.storageManager) {
      throw new Error(
        "Storage system is not available. Make sure hybridStorage.js is loaded before editor.js."
      );
    }
    
    // Warn if using legacy storage
    if (this.storageManager.constructor.name === 'StorageManager') {
      console.error('❌ CRITICAL: Using legacy StorageManager instead of HybridStorageManager!');
      console.error('   This will cause sprites to load from the wrong database.');
      console.error('   Check that hybridStorage.js loaded before storage.js');
    } else {
      console.log('✅ Initialize: Using', this.storageManager.constructor.name);
    }

    // Load settings AFTER initializing layer manager
    this.settings = await this.storageManager.loadSettings();

    // Initialize tools (now that settings are loaded)
    this.initializeTools();

    // Initialize UI manager
    this.uiManager = new UIController(this);

    // Load sprites from storage (now async)
    await this.loadSprites();

    // Set initial colors with proper alpha handling
    const primaryColorHex = this.settings.primaryColor || "#000000";
    const secondaryColorHex = this.settings.secondaryColor || "#FFFFFF";

    // Convert hex to RGBA with full opacity by default
    this.setPrimaryColor(this.hexToRgba(primaryColorHex, 255));
    this.setSecondaryColor(this.hexToRgba(secondaryColorHex, 255));

    // Set initial tool
    this.setCurrentTool("brush");

    // Create initial sprite if none exist
    if (this.sprites.length === 0) {
      this.createNewSprite();
    } else {
      this.setCurrentSprite(this.sprites[0]);
      // Force render after setting current sprite
      setTimeout(() => {
        if (this.canvasManager) {
          this.canvasManager.render();
        }
      }, 0);
    }

    // Update UI
    this.updateUI();

    console.log(
      "Pixel Editor initialized successfully with transparency support!"
    );
  }

  // Initialize all tools
  initializeTools() {
    this.tools = {
      brush: new BrushTool(this),
      eraser: new EraserTool(this),
      bucket: new BucketTool(this),
      select: new SelectTool(this),
      eyedropper: new EyedropperTool(this),
      brightness: new BrightnessTool(this),
      smoothsharpen: new SmoothSharpenTool(this), // Add this line
      shape: new ShapeTool(this), // Add this line
      miscellaneous: new MiscellaneousTool(this),
    };

    // Set tool colors and settings from saved preferences
    this.updateToolColors();
    this.applyToolSettings();
  }

  // Replace the syncSpriteWithLayers method in PixelEditor
  syncSpriteWithLayers() {
    if (!this.currentSprite || !this.layerManager) return;

    // Resize layer manager if needed
    if (
      this.layerManager.width !== this.currentSprite.width ||
      this.layerManager.height !== this.currentSprite.height
    ) {
      this.layerManager.resize(
        this.currentSprite.width,
        this.currentSprite.height
      );
    }

    // Load sprite layers into layer manager
    if (this.currentSprite.layers && this.currentSprite.layers.length > 0) {
      // Sprite has layer data, load it into layer manager
      this.layerManager.fromSprite(this.currentSprite);
    } else {
      // No layer data, create from main pixels (backward compatibility)
      if (this.layerManager.layers.length === 1) {
        const activeLayer = this.layerManager.getActiveLayer();
        activeLayer.pixels = this.currentSprite.getPixelArray();
        this.layerManager.notifyChange();
      }
    }
  }

  // Add this new method to save layer changes back to sprite
  // Also fix the saveLayersToSprite method to prevent corruption
  saveLayersToSprite() {
    if (!this.currentSprite || !this.layerManager || !this.animationManager)
      return;

    // Don't save during sprite switching or import
    if (this._switchingSprites || this._importingSprite) {
      return;
    }

    // CRITICAL FIX: Only save if LayerManager has valid data
    const activeLayer = this.layerManager.getActiveLayer();
    if (
      !activeLayer ||
      !activeLayer.pixels ||
      activeLayer.pixels.length === 0
    ) {
      console.warn("LayerManager has no valid data to save, skipping");
      return;
    }

    // CRITICAL FIX: Prevent recursive saves during import
    if (this._savingLayers) {
      console.log("Already saving layers, preventing recursion");
      return;
    }

    this._savingLayers = true;

    try {
      // Save current layer state to current frame
      this.animationManager.saveLayerManagerToCurrentFrame();

      // Mark sprite as modified
      this.currentSprite.modifiedAt = new Date().toISOString();

      // Trigger auto-save with delay to prevent conflicts
      if (this.debouncedSave) {
        this.debouncedSave(this.currentSprite);
      }
    } catch (error) {
      console.error("Error saving layers to sprite:", error);
    } finally {
      this._savingLayers = false;
    }
  }

  createNewAnimatedSprite(
    width = 16,
    height = 16,
    name = null,
    frameCount = 1
  ) {
    const sprite = this.createNewSprite(width, height, name);

    // Add additional frames if requested
    for (let i = 1; i < frameCount; i++) {
      this.animationManager.addFrame();
    }

    sprite.isAnimated = frameCount > 1;
    return sprite;
  }

  // Replace the setCurrentSprite method
  setCurrentSprite(sprite) {
    // Save current frame if switching sprites
    if (
      this.currentSprite &&
      this.animationManager &&
      !this._switchingSprites
    ) {
      this.animationManager.saveLayerManagerToCurrentFrame();
    }

    this._switchingSprites = true;

    this.currentSprite = sprite;
    if (sprite) {
      sprite.onChange = (s) => this.debouncedSave(s);

      // CRITICAL FIX: Validate and initialize frames before proceeding
      if (!sprite.frames || sprite.frames.length === 0) {
        console.log("Sprite has no frames, initializing...");
        sprite.initializeFrames();
      }

      // CRITICAL FIX: Validate frame data integrity
      if (
        sprite.frames[0] &&
        (!sprite.frames[0].layers || sprite.frames[0].layers.length === 0)
      ) {
        console.warn("Frame has no layers, reinitializing sprite structure");
        sprite.initializeFrames();
      }

      // CRITICAL FIX: Validate pixel data exists and is valid
      const firstFrame = sprite.frames[0];
      if (firstFrame && firstFrame.layers && firstFrame.layers[0]) {
        const firstLayer = firstFrame.layers[0];
        if (
          !firstLayer.pixels ||
          !Array.isArray(firstLayer.pixels) ||
          firstLayer.pixels.length === 0
        ) {
          console.warn(
            "Layer has no valid pixel data, creating empty pixel array"
          );
          firstLayer.pixels = sprite.createEmptyPixelArray();
        }
      }

      // Validate sprite has pixel data for backward compatibility
      if (!sprite.pixels || sprite.pixels.length === 0) {
        if (
          sprite.frames &&
          sprite.frames[0] &&
          sprite.frames[0].layers &&
          sprite.frames[0].layers[0] &&
          sprite.frames[0].layers[0].pixels
        ) {
          sprite.pixels = sprite.frames[0].layers[0].pixels;
        } else {
          sprite.pixels = sprite.createEmptyPixelArray();
        }
      }

      // Load first frame into animation manager and layer manager
      if (this.animationManager) {
        this.animationManager.currentFrameIndex = 0;
        const frameToLoad = sprite.frames[0];
        this.animationManager.loadFrameIntoLayerManager(frameToLoad);
      }
    }

    // Set sprite in canvas manager
    if (this.canvasManager) {
      this.canvasManager.setSprite(sprite);
    }

    this._switchingSprites = false;

    // Force immediate render
    if (this.canvasManager) {
      this.canvasManager.render();
    }

    // Save to history after sprite is loaded
    setTimeout(() => {
      if (this.layerManager && !this._switchingSprites) {
        const activeLayer = this.layerManager.getActiveLayer();
        if (
          activeLayer &&
          activeLayer.pixels &&
          activeLayer.pixels.length > 0
        ) {
          this.layerManager.saveToHistory();
        }
      }
    }, 100);

    this.updateUI();
    this.uiManager.updateCanvasColorsPalette();
  }

  // Update saveLayersToSprite to check for sprite switching
  saveLayersToSprite() {
    if (!this.currentSprite || !this.layerManager || !this.animationManager)
      return;

    // Don't save during sprite switching or import
    if (this._switchingSprites || this._importingSprite) {
      return;
    }

    // Only save if LayerManager has valid data
    const activeLayer = this.layerManager.getActiveLayer();
    if (
      !activeLayer ||
      !activeLayer.pixels ||
      activeLayer.pixels.length === 0
    ) {
      console.warn("LayerManager has no valid data to save, skipping");
      return;
    }

    // Prevent recursive saves
    if (this._savingLayers) {
      return;
    }

    this._savingLayers = true;

    try {
      // Save current layer state to current frame
      this.animationManager.saveLayerManagerToCurrentFrame();

      // Mark sprite as modified
      this.currentSprite.modifiedAt = new Date().toISOString();

      // Trigger auto-save
      if (this.debouncedSave) {
        this.debouncedSave(this.currentSprite);
      }
    } catch (error) {
      console.error("Error saving layers to sprite:", error);
    } finally {
      this._savingLayers = false;
    }
  }

  // Add this helper method to PixelEditor class
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

  // Apply saved tool settings
  // Apply saved tool settings
  // Update applyToolSettings to remove opacity settings
  applyToolSettings() {
    if (!this.settings) {
      console.warn("Settings not loaded, skipping tool settings application");
      return;
    }

    if (this.tools.brush) {
      this.tools.brush.setSize(this.settings.brushSize);
      // REMOVED: this.tools.brush.setOpacity(this.settings.brushOpacity);
    }

    if (this.tools.bucket) {
      this.tools.bucket.setTolerance(this.settings.bucketTolerance);
    }

    if (this.tools.brightness) {
      this.tools.brightness.setIntensity(this.settings.brightnessIntensity);
    }

    if (this.tools.smoothsharpen) {
      this.tools.smoothsharpen.setIntensity(
        this.settings.smoothSharpenIntensity || 50
      );
      this.tools.smoothsharpen.setSize(this.settings.smoothSharpenSize || 3);
      this.tools.smoothsharpen.setMode(
        this.settings.smoothSharpenMode || "smooth"
      );
    }
  }

  // Update tool colors when primary/secondary colors change
  updateToolColors() {
    Object.values(this.tools).forEach((tool) => {
      if (tool.setColor) {
        tool.setColor([...this.primaryColor]); // Pass a copy to avoid mutation
      }
      if (tool.setSecondaryColor) {
        tool.setSecondaryColor([...this.secondaryColor]);
      }
    });
  }

  blendColors(baseColor, overlayColor) {
    const [br, bg, bb, ba] = baseColor;
    const [or, og, ob, oa] = overlayColor;

    const baseAlpha = ba / 255;
    const overlayAlpha = oa / 255;

    // Alpha compositing formula
    const outputAlpha = overlayAlpha + baseAlpha * (1 - overlayAlpha);

    if (outputAlpha === 0) {
      return [0, 0, 0, 0];
    }

    const outputRed =
      (or * overlayAlpha + br * baseAlpha * (1 - overlayAlpha)) / outputAlpha;
    const outputGreen =
      (og * overlayAlpha + bg * baseAlpha * (1 - overlayAlpha)) / outputAlpha;
    const outputBlue =
      (ob * overlayAlpha + bb * baseAlpha * (1 - overlayAlpha)) / outputAlpha;

    return [
      Math.round(outputRed),
      Math.round(outputGreen),
      Math.round(outputBlue),
      Math.round(outputAlpha * 255),
    ];
  }

  // Set current tool
  setCurrentTool(toolName) {
    if (!this.tools[toolName]) {
      console.error(`Tool "${toolName}" not found`);
      return;
    }

    // Deactivate current tool if it has onDeactivate method
    if (this.currentTool && this.currentTool.onDeactivate) {
      this.currentTool.onDeactivate();
    }

    this.previousTool = this.currentTool;
    this.currentTool = this.tools[toolName];

    // alert(toolName);
    if (this.currentTool != "eyedropper") {
      //run hideColorPreview() from eyedropper class
      if (this.tools.eyedropper && this.tools.eyedropper.hideColorPreview) {
        this.tools.eyedropper.hideColorPreview();
      }
    }

    // Update cursor
    if (this.canvasManager.mainCanvas) {
      this.canvasManager.mainCanvas.style.cursor =
        this.currentTool.getCursor() || "crosshair";
    }

    // Update tool colors
    this.updateToolColors();

    // Update UI
    this.uiManager.updateToolButtons();
    this.uiManager.updateToolSettings();
  }

  /**
   * Create a new sprite
   */
  createNewSprite(width = 16, height = 16, name = null) {
    const spriteName = name || `Sprite ${this.sprites.length + 1}`;
    const sprite = new Sprite(width, height, spriteName);
    // Set up auto-save callback
    sprite.onChange = (s) => {
      this.saveSpriteWithSync(s);
    };
    this.sprites.push(sprite);
    this.setCurrentSprite(sprite);
    this.saveSprites();
    this.uiManager.showNotification(
      `Created new sprite: ${spriteName}`,
      "success"
    );
    return sprite;
  }

  // Set current sprite

  /**
   * Create optimized canvas setup for large sprites
   */
  setupLargeCanvasHandling() {
    // Limit initial zoom for very large sprites
    if (
      this.currentSprite &&
      this.currentSprite.width * this.currentSprite.height > 100000
    ) {
      const maxDimension = Math.max(
        this.currentSprite.width,
        this.currentSprite.height
      );
      const optimalZoom = Math.max(1, Math.floor(800 / maxDimension));
      this.canvasManager.setZoom(optimalZoom);
    }
  }

  // Duplicate sprite
  // Replace the duplicateSprite method in PixelEditor class

  // Duplicate sprite - Enhanced to handle frames and layers
  duplicateSprite(sprite) {
    // Save current frame state before duplicating
    if (this.currentSprite === sprite && this.animationManager) {
      this.animationManager.saveLayerManagerToCurrentFrame();
    }

    const duplicate = sprite.clone();
    this.sprites.push(duplicate);
    this.setCurrentSprite(duplicate);
    this.saveSprites();

    this.uiManager.showNotification(
      `Duplicated sprite: ${
        duplicate.name
      } (${duplicate.getFrameCount()} frames, ${
        duplicate.layers.length
      } layers)`,
      "success"
    );
    return duplicate;
  }

  // Delete sprite
  async deleteSprite(index) {
    // Validate index
    if (index < 0 || index >= this.sprites.length) {
      this.uiManager.showNotification("Invalid sprite index", "error");
      return false;
    }

    // Check if this is the last sprite
    if (this.sprites.length <= 1) {
      // Prevent deletion if it's the last sprite
      this.createNewSprite(16, 16, "Sprite 1");
    }

    const spriteName = this.sprites[index].name;
    const deletedSprite = this.sprites[index];
    const deletedSpriteId = deletedSprite.id;

    // Remove sprite from array
    this.sprites.splice(index, 1);

    // If deleted sprite was current, switch to another
    if (deletedSprite === this.currentSprite) {
      const newIndex = Math.min(index, this.sprites.length - 1);
      this.setCurrentSprite(this.sprites[newIndex]);
    }

    // Save sprites and delete from cloud
    await this.saveSprites();
    
    // Delete from cloud storage if user is logged in
    if (window.currentUser && window.hybridStorage) {
      try {
        await window.hybridStorage.deleteSprite(deletedSpriteId, {
          deleteFromCloud: true,
          userId: window.currentUser.uid
        });
        console.log(`Deleted sprite ${spriteName} from cloud`);
      } catch (error) {
        console.error('Failed to delete sprite from cloud:', error);
      }
    }
    
    this.uiManager.showNotification(`Deleted sprite: ${spriteName}`, "success");
    return true;
  }

  // Move sprite - INSERT behavior
  moveSprite(fromIndex, toIndex) {
    // Allow toIndex to be at sprites.length (insert at end)
    if (
      fromIndex < 0 ||
      fromIndex >= this.sprites.length ||
      toIndex < 0 ||
      toIndex > this.sprites.length ||
      fromIndex === toIndex
    ) {
      return false;
    }

    // INSERT behavior: Remove from old position and insert at new position
    const sprite = this.sprites.splice(fromIndex, 1)[0];
    
    // Adjust toIndex if necessary (when moving down, the index shifts after removal)
    const insertIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
    this.sprites.splice(insertIndex, 0, sprite);

    // Update current sprite reference if needed
    if (this.currentSprite === sprite) {
      // Current sprite moved, it's still current but at a new index
      // No need to change the reference, just update the UI
    }

    // Save and update UI
    this.saveSprites();
    this.updateUI();
    
    return true;
  }

  /**
   * Resize current canvas
   */
  resizeCanvas(width, height, maintainAspectRatio = false) {
    if (!this.currentSprite) return false;

    // Handle aspect ratio
    if (maintainAspectRatio) {
      const aspectRatio = this.currentSprite.width / this.currentSprite.height;
      if (width / height > aspectRatio) {
        width = Math.round(height * aspectRatio);
      } else {
        height = Math.round(width / aspectRatio);
      }
    }

    // Step 1: Resize using LayerManager with nearest neighbor
    this.layerManager.resize(width, height, true); // true for nearest neighbor

    // Step 2: Update sprite dimensions
    this.currentSprite.width = width;
    this.currentSprite.height = height;

    // Step 3: CRITICAL - Update frames with the resized data
    this.updateSpriteFramesFromLayerManager();

    // Step 4: Update canvas size
    this.canvasManager.updateCanvasSize();

    // Step 5: Save and update UI
    this.saveSprites();
    this.updateUI();

    this.uiManager.showNotification(
      `Canvas resized to ${width}×${height}`,
      "success"
    );
    return true;
  }

  // In PixelEditor class - replace updateSpriteFramesFromLayerManager method
  updateSpriteFramesFromLayerManager() {
    if (!this.currentSprite || !this.layerManager) return;

    // CRITICAL FIX: Don't update frames if LayerManager has no valid data
    const activeLayer = this.layerManager.getActiveLayer();
    if (
      !activeLayer ||
      !activeLayer.pixels ||
      activeLayer.pixels.length === 0
    ) {
      console.warn(
        "LayerManager has no valid pixel data, skipping frame update"
      );
      return;
    }

    // Ensure frames exist
    if (!this.currentSprite.frames || this.currentSprite.frames.length === 0) {
      this.currentSprite.initializeFrames();
    }

    // CRITICAL FIX: Get the current frame (or create if animation manager exists)
    let frameIndex = 0;
    if (
      this.animationManager &&
      typeof this.animationManager.currentFrameIndex === "number"
    ) {
      frameIndex = this.animationManager.currentFrameIndex;
    }

    // Ensure we have a frame at the current index
    if (!this.currentSprite.frames[frameIndex]) {
      console.warn(`Frame ${frameIndex} doesn't exist, using frame 0`);
      frameIndex = 0;
    }

    const currentFrame = this.currentSprite.frames[frameIndex];
    if (!currentFrame) {
      console.error("No frame available to update");
      return;
    }

    // Update frame dimensions
    currentFrame.width = this.layerManager.width;
    currentFrame.height = this.layerManager.height;
    currentFrame.activeLayerIndex = this.layerManager.activeLayerIndex;

    // CRITICAL FIX: Deep copy LayerManager data to frame, with validation
    currentFrame.layers = this.layerManager.layers.map((layer, index) => {
      // Validate layer has pixel data
      if (
        !layer.pixels ||
        !Array.isArray(layer.pixels) ||
        layer.pixels.length === 0
      ) {
        console.warn(`Layer ${index} has no pixel data during frame update`);
        return {
          id: layer.id || Date.now() + Math.random(),
          name: layer.name || `Layer ${index + 1}`,
          visible: layer.visible !== false,
          opacity: layer.opacity || 1,
          pixels: this.createEmptyPixelArray(
            this.layerManager.width,
            this.layerManager.height
          ),
          locked: layer.locked || false,
          blendMode: layer.blendMode || "normal",
        };
      }

      // Deep copy the pixel data
      return {
        id: layer.id || Date.now() + Math.random(),
        name: layer.name || `Layer ${index + 1}`,
        visible: layer.visible !== false,
        opacity: layer.opacity || 1,
        pixels: layer.pixels.map((row) => {
          if (!Array.isArray(row)) {
            console.warn("Invalid pixel row detected, creating empty row");
            return new Array(this.layerManager.width)
              .fill()
              .map(() => [0, 0, 0, 0]);
          }
          return row.map((pixel) => {
            if (!Array.isArray(pixel) || pixel.length !== 4) {
              return [0, 0, 0, 0];
            }
            return [...pixel];
          });
        }),
        locked: layer.locked || false,
        blendMode: layer.blendMode || "normal",
      };
    });

    // CRITICAL FIX: Update sprite layers for backward compatibility - but only if we have valid data
    if (
      currentFrame.layers &&
      currentFrame.layers.length > 0 &&
      currentFrame.layers[0].pixels
    ) {
      this.currentSprite.layers = currentFrame.layers.map((layer) => ({
        ...layer,
        pixels: layer.pixels.map((row) => row.map((pixel) => [...pixel])),
        useTypedArray: false,
      }));

      // Update main pixel reference for backward compatibility
      this.currentSprite.pixels = this.currentSprite.layers[0].pixels;
      this.currentSprite.useTypedArray = false;
    }

    // Mark as modified
    this.currentSprite.modifiedAt = new Date().toISOString();
  }

  // Add this method to your PixelEditor class
  // This should be inserted in the PixelEditor class after the resizeCanvas method

  /**
   * Crop current sprite to selection bounds
   */
  async cropToSelection(selection) {
    if (!this.currentSprite || !this.layerManager || !selection) {
      console.warn("Cannot crop: missing sprite, layer manager, or selection");
      return false;
    }

    const newWidth = selection.right - selection.left + 1;
    const newHeight = selection.bottom - selection.top + 1;

    // Validate crop dimensions
    if (newWidth <= 0 || newHeight <= 0) {
      this.uiManager?.showNotification("Invalid crop dimensions", "error");
      return false;
    }

    // Ensure selection is within sprite bounds
    if (
      selection.left < 0 ||
      selection.top < 0 ||
      selection.right >= this.currentSprite.width ||
      selection.bottom >= this.currentSprite.height
    ) {
      this.uiManager?.showNotification(
        "Selection extends outside sprite bounds",
        "error"
      );
      return false;
    }

    try {
      // CRITICAL FIX: Save current frame to sprite before cropping
      if (this.animationManager) {
        this.animationManager.saveLayerManagerToCurrentFrame();
      }

      // Start batch operation to prevent multiple history entries
      this.layerManager.startBatchOperation();

      // Crop all frames in the sprite
      if (this.currentSprite.frames && this.currentSprite.frames.length > 0) {
        this.currentSprite.frames.forEach((frame) => {
          // Update frame dimensions
          frame.width = newWidth;
          frame.height = newHeight;

          // Crop each layer in the frame
          frame.layers.forEach((layer) => {
            const newPixels = [];

            for (let y = 0; y < newHeight; y++) {
              newPixels[y] = [];
              for (let x = 0; x < newWidth; x++) {
                const srcX = selection.left + x;
                const srcY = selection.top + y;

                // Copy pixel from original layer
                if (
                  layer.pixels &&
                  srcY < layer.pixels.length &&
                  layer.pixels[srcY] &&
                  srcX < layer.pixels[srcY].length
                ) {
                  newPixels[y][x] = [...layer.pixels[srcY][srcX]];
                } else {
                  newPixels[y][x] = [0, 0, 0, 0]; // Transparent pixel
                }
              }
            }

            layer.pixels = newPixels;
          });
        });
      }

      // Update sprite dimensions
      this.currentSprite.width = newWidth;
      this.currentSprite.height = newHeight;

      // Resize layer manager to match new dimensions
      this.layerManager.resize(newWidth, newHeight);

      // CRITICAL FIX: Reload current frame into layer manager after crop
      if (this.animationManager) {
        const currentFrame = this.animationManager.getCurrentFrame();
        if (currentFrame) {
          this.animationManager.loadFrameIntoLayerManager(currentFrame);
        }
      }

      // End batch operation - this will save to history
      this.layerManager.endBatchOperation();

      // CRITICAL FIX: Mark sprite as modified and save
      this.currentSprite.modifiedAt = new Date().toISOString();

      // Force save the sprite
      await this.saveSpriteWithSync(this.currentSprite);

      // Update canvas manager
      this.canvasManager.updateCanvasSize();
      this.canvasManager.render();

      // Update UI
      this.updateUI();

      // Show success message
      this.uiManager?.showNotification(
        `Sprite cropped to ${newWidth}×${newHeight}`,
        "success"
      );

      return true;
    } catch (error) {
      console.error("Error during crop operation:", error);
      this.uiManager?.showNotification("Failed to crop sprite", "error");

      // End batch operation even on error
      this.layerManager.endBatchOperation();

      return false;
    }
  }

  // Set primary color
  setPrimaryColor(color) {
    // Ensure we always have 4 components (RGBA)
    if (Array.isArray(color) && color.length >= 3) {
      this.primaryColor = [
        Math.round(color[0]),
        Math.round(color[1]),
        Math.round(color[2]),
        color.length > 3 ? Math.round(color[3]) : 255,
      ];
    } else {
      console.warn("Invalid color format for setPrimaryColor:", color);
      this.primaryColor = [0, 0, 0, 255]; // Fallback to opaque black
    }

    this.updateToolColors();
    this.saveSettings();

    // Update UI immediately
    if (this.uiManager && this.uiManager.updateColorDisplay) {
      this.uiManager.updateColorDisplay();
    }
  }

  // Set secondary color
  setSecondaryColor(color) {
    // Ensure we always have 4 components (RGBA)
    if (Array.isArray(color) && color.length >= 3) {
      this.secondaryColor = [
        Math.round(color[0]),
        Math.round(color[1]),
        Math.round(color[2]),
        color.length > 3 ? Math.round(color[3]) : 255,
      ];
    } else {
      console.warn("Invalid color format for setSecondaryColor:", color);
      this.secondaryColor = [255, 255, 255, 255]; // Fallback to opaque white
    }

    this.saveSettings();

    if (this.uiManager && this.uiManager.updateColorDisplay) {
      this.uiManager.updateColorDisplay();
    }
  }

  // Update color UI elements
  updateColorUI() {
    this.uiManager.updateColorDisplay();
  }

  /**
   * Undo last action
   */
  undo() {
    if (this.layerManager && this.layerManager.undo()) {
      if (this.canvasManager) {
        this.canvasManager.render();
      }
      this.updateUI();
      // this.uiManager.showNotification("Undone", "info");
      return true;
    }
    return false;
  }

  /**
   * Redo last undone action
   */
  redo() {
    if (this.layerManager && this.layerManager.redo()) {
      if (this.canvasManager) {
        this.canvasManager.render();
      }
      this.updateUI();
      // this.uiManager.showNotification("Redone", "info");
      return true;
    }
    return false;
  }

  /**
   * Save sprites to storage
   */
  async saveSprites() {
    try {
      const userId = window.currentUser ? window.currentUser.uid : null;
      const saveOptions = userId ? { syncToCloud: true, userId } : { syncToCloud: false };
      
      const success = await this.storageManager.saveSprites(this.sprites, saveOptions);
      if (!success) {
        this.uiManager.showNotification("Failed to save sprites", "error");
      }
      return success;
    } catch (error) {
      console.error("Failed to save sprites:", error);
      this.uiManager.showNotification("Failed to save sprites", "error");
      return false;
    }
  }

  /**
   * Load sprites from storage
   */
  /**
   * Load sprites from storage
   */
  async loadSprites() {
    try {
      // Use hybridStorage with cloud sync if available
      const userId = window.currentUser ? window.currentUser.uid : null;
      const loadOptions = userId ? { preferCloud: true, userId } : {};
      
      const loadedSprites = await this.storageManager.loadSprites(loadOptions);
      this.sprites = loadedSprites || []; // Ensure it's always an array

      console.log(`Loaded ${this.sprites.length} sprites (userId: ${userId || 'local only'})`);

      if (this.sprites.length > 0) {
        this.setCurrentSprite(this.sprites[0]);
      }

      return this.sprites.length;
    } catch (error) {
      console.error("Failed to load sprites:", error);
      this.sprites = []; // Fallback to empty array
      return 0;
    }
  }

  /**
   * Save settings to storage
   */
  /**
   * Save settings to storage
   */

  // Update saveSettings to remove opacity settings
  async saveSettings() {
    if (!this.settings) {
      this.settings = this.storageManager.getDefaultSettings();
    }

    this.settings.primaryColor = this.rgbaToHex(this.primaryColor);
    this.settings.secondaryColor = this.rgbaToHex(this.secondaryColor);
    this.settings.primaryAlpha = this.primaryColor[3] || 255;
    this.settings.secondaryAlpha = this.secondaryColor[3] || 255;

    if (this.tools.brush) {
      this.settings.brushSize = this.tools.brush.size;
      // REMOVED: this.settings.brushOpacity = this.tools.brush.opacity;
    }

    if (this.tools.bucket) {
      this.settings.bucketTolerance = this.tools.bucket.tolerance;
    }

    if (this.tools.brightness) {
      this.settings.brightnessIntensity = this.tools.brightness.intensity;
    }

    if (this.tools.smoothsharpen) {
      this.settings.smoothSharpenIntensity =
        this.tools.smoothsharpen.intensity || 50;
      this.settings.smoothSharpenSize = this.tools.smoothsharpen.size || 3;
      this.settings.smoothSharpenMode =
        this.tools.smoothsharpen.mode || "smooth";
    }

    if (this.canvasManager) {
      this.settings.showGrid = this.canvasManager.showGrid;
      this.settings.zoomLevel = this.canvasManager.zoomLevel;
    }

    try {
      await this.storageManager.saveSettings(this.settings);
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  }

  /**
   * Import file (PNG, SVG, JSON)
   */
  importFile(file) {
    if (!file) return;

    const fileType = file.type;

    if (fileType.startsWith("image/")) {
      this.importImage(file);
    } else if (file.name.endsWith(".json")) {
      this.importJSON(file);
    } else {
      this.uiManager.showNotification("Unsupported file type", "error");
    }
  }

  importJSON(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);

        if (data.sprites && Array.isArray(data.sprites)) {
          // Import multiple sprites
          data.sprites.forEach((spriteData) => {
            if (spriteData.width > 64 || spriteData.height > 64) {
              this.uiManager.showNotification(
                `Skipped sprite "${spriteData.name}" - too large (${spriteData.width}x${spriteData.height})`,
                "warning"
              );
              return;
            }

            const sprite = new Sprite(
              spriteData.width,
              spriteData.height,
              spriteData.name || "Imported Sprite",
              spriteData.id || Date.now() + Math.random()
            );

            if (spriteData.pixels) {
              sprite.setPixelArray(spriteData.pixels);
            }

            this.sprites.push(sprite);
          });

          if (this.sprites.length > 0) {
            this.setCurrentSprite(this.sprites[this.sprites.length - 1]);
          }

          this.updateUI();
          this.uiManager.showNotification(
            `Imported ${data.sprites.length} sprites`,
            "success"
          );
        } else {
          this.uiManager.showNotification(
            "Invalid sprite file format",
            "error"
          );
        }
      } catch (error) {
        console.error("Import error:", error);
        this.uiManager.showNotification("Failed to import file", "error");
      }
    };

    reader.readAsText(file);
  }
  importImage(file) {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const editor = this;

    this._importingSprite = true;

    img.onload = async () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Check if image exceeds maximum size
      if (img.width > 64 || img.height > 64) {
        // Show downscale modal
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        editor.uiManager.showDownscaleModal(imageData, img.width, img.height);
        editor._importingSprite = false;
        return;
      }

      // Image is within limits, create sprite directly
      const imageData = ctx.getImageData(0, 0, img.width, img.height);

      if (!imageData || imageData.width === 0 || imageData.height === 0) {
        editor.uiManager.showNotification(
          "Failed to process image data",
          "error"
        );
        editor._importingSprite = false;
        return;
      }

      try {
        // CRITICAL FIX: Save current state before importing
        await editor.saveSprites();

        // Create sprite without triggering automatic save
        const sprite = editor.createSpriteFromImageDataSafe(
          imageData,
          img.width,
          img.height
        );

        // Save all sprites including the new one
        await editor.saveSprites();

        editor.uiManager.showNotification(
          `Imported image: ${img.width}x${img.height}`,
          "success"
        );
      } catch (error) {
        console.error("Failed to import image:", error);
        editor.uiManager.showNotification("Failed to import image", "error");
      } finally {
        editor._importingSprite = false;
      }
    };

    img.onerror = () => {
      editor._importingSprite = false;
      editor.uiManager.showNotification("Failed to load image", "error");
    };

    img.src = URL.createObjectURL(file);
  }

  createSpriteFromImageDataSafe(imageData, width, height) {
    // Create sprite directly without triggering save callbacks
    const spriteName = `Imported Image ${this.sprites.length + 1}`;
    const sprite = new Sprite(width, height, spriteName);

    // Temporarily disable onChange to prevent auto-saves during setup
    const originalOnChange = sprite.onChange;
    sprite.onChange = null;

    // Initialize pixel array from image data
    const pixels = [];
    for (let y = 0; y < height; y++) {
      pixels[y] = [];
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        pixels[y][x] = [
          imageData.data[index],
          imageData.data[index + 1],
          imageData.data[index + 2],
          imageData.data[index + 3],
        ];
      }
    }

    // Initialize frames properly
    sprite.initializeFrames();
    sprite.frames[0].layers[0].pixels = pixels.map((row) =>
      row.map((pixel) => [...pixel])
    );

    // Set backward compatibility data
    sprite.layers = sprite.frames[0].layers.map((layer) => ({
      ...layer,
      pixels: layer.pixels.map((row) => row.map((pixel) => [...pixel])),
    }));
    sprite.pixels = sprite.layers[0].pixels;
    sprite.useTypedArray = false;

    // Add to sprites array
    this.sprites.push(sprite);

    // Set as current sprite
    this.setCurrentSprite(sprite);

    // Restore onChange callback
    sprite.onChange =
      originalOnChange ||
      ((s) => {
        this.saveSpriteWithSync(s);
      });

    this.updateUI();
    return sprite;
  }

  // In PixelEditor class - replace the createSpriteFromImageData method
  // In PixelEditor class - completely replace createSpriteFromImageData method
  createSpriteFromImageData(imageData, width, height) {
    // Create sprite directly without triggering normal creation flow
    const spriteName = `Imported Image ${this.sprites.length + 1}`;
    const sprite = new Sprite(width, height, spriteName);

    // Initialize pixel array from image data
    const pixels = [];
    for (let y = 0; y < height; y++) {
      pixels[y] = [];
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        pixels[y][x] = [
          imageData.data[index],
          imageData.data[index + 1],
          imageData.data[index + 2],
          imageData.data[index + 3],
        ];
      }
    }

    // Ensure proper frame initialization BEFORE setting pixels
    sprite.initializeFrames();

    // Validate frame structure exists
    if (
      !sprite.frames ||
      sprite.frames.length === 0 ||
      !sprite.frames[0].layers ||
      sprite.frames[0].layers.length === 0
    ) {
      console.error(
        "Frame structure not properly initialized for imported sprite"
      );
      // Reinitialize with proper structure
      sprite.frames = [
        {
          id: Date.now() + Math.random(),
          name: "Frame 1",
          width: width,
          height: height,
          activeLayerIndex: 0,
          layers: [
            {
              id: Date.now() + Math.random() + 1,
              name: "Background",
              visible: true,
              opacity: 1,
              pixels: pixels.map((row) => row.map((pixel) => [...pixel])),
              locked: false,
              blendMode: "normal",
            },
          ],
        },
      ];
    } else {
      // Set pixel data on the sprite's frame structure
      sprite.frames[0].layers[0].pixels = pixels.map((row) =>
        row.map((pixel) => [...pixel])
      );
    }

    // Ensure backward compatibility data is properly set
    sprite.layers = sprite.frames[0].layers.map((layer) => ({
      ...layer,
      pixels: layer.pixels.map((row) => row.map((pixel) => [...pixel])),
    }));

    sprite.pixels = sprite.layers[0].pixels;
    sprite.useTypedArray = false;

    // Set up auto-save callback
    sprite.onChange = (s) => {
      this.saveSpriteWithSync(s);
    };

    // Add to sprites array BEFORE setting current sprite
    this.sprites.push(sprite);

    // Save all sprites first to ensure the array is persisted
    this.saveSprites()
      .then(() => {
        console.log("All sprites saved after import");
        // Only then set the current sprite
        this.setCurrentSprite(sprite);
        // Update UI
        this.updateUI();
      })
      .catch((error) => {
        console.error("Failed to save sprites after import:", error);
        // Still set current sprite even if save failed
        this.setCurrentSprite(sprite);
        this.updateUI();
      });

    return sprite;
  }
  /**
   * Import SVG file
   */
  async importSVG(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          // Create temporary image element
          const img = new Image();
          const svgBlob = new Blob([e.target.result], {
            type: "image/svg+xml",
          });
          const url = URL.createObjectURL(svgBlob);

          img.onload = () => {
            // Create temporary canvas to rasterize SVG
            const tempCanvas = document.createElement("canvas");
            const tempCtx = tempCanvas.getContext("2d");
            tempCanvas.width = img.width || 32;
            tempCanvas.height = img.height || 32;

            tempCtx.drawImage(img, 0, 0);
            const imageData = tempCtx.getImageData(
              0,
              0,
              tempCanvas.width,
              tempCanvas.height
            );

            const sprite = Sprite.fromImageData(
              imageData,
              file.name.replace(/\.[^/.]+$/, "")
            );
            this.sprites.push(sprite);
            this.setCurrentSprite(sprite);
            this.saveSprites();

            URL.revokeObjectURL(url);
            this.uiManager.showNotification(
              `Imported SVG: ${file.name}`,
              "success"
            );
            resolve(sprite);
          };

          img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Failed to load SVG"));
          };

          img.src = url;
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  }

  /**
   * Export current sprite as SVG - direct download
   */
  exportAsSVG(scale = 1) {
    if (!this.currentSprite) {
      console.warn("No current sprite to export");
      return;
    }

    // Save current LayerManager state to sprite before export
    if (this.animationManager) {
      this.animationManager.saveLayerManagerToCurrentFrame();
    }

    const sprite = this.currentSprite;
    const scaledWidth = sprite.width * scale;
    const scaledHeight = sprite.height * scale;

    // Create SVG content
    let svgContent = `<svg width="${scaledWidth}" height="${scaledHeight}" xmlns="http://www.w3.org/2000/svg" style="image-rendering: pixelated;">`;

    // Use LayerManager composite data for proper transparency handling
    if (this.layerManager) {
      for (let y = 0; y < sprite.height; y++) {
        for (let x = 0; x < sprite.width; x++) {
          const pixel = this.layerManager.getCompositePixel(x, y);
          const [r, g, b, a] = pixel;

          if (a > 0) {
            const opacity = (a / 255).toFixed(3);
            if (opacity < 1) {
              // Use rgba for transparent pixels
              svgContent += `<rect x="${x * scale}" y="${
                y * scale
              }" width="${scale}" height="${scale}" fill="rgba(${r},${g},${b},${opacity})"/>`;
            } else {
              // Use rgb for opaque pixels
              svgContent += `<rect x="${x * scale}" y="${
                y * scale
              }" width="${scale}" height="${scale}" fill="rgb(${r},${g},${b})"/>`;
            }
          }
        }
      }
    } else {
      // Fallback: Use sprite data
      for (let y = 0; y < sprite.height; y++) {
        for (let x = 0; x < sprite.width; x++) {
          const pixel = sprite.getPixel(x, y);
          const [r, g, b, a] = pixel;

          if (a > 0) {
            const opacity = (a / 255).toFixed(3);
            if (opacity < 1) {
              svgContent += `<rect x="${x * scale}" y="${
                y * scale
              }" width="${scale}" height="${scale}" fill="rgba(${r},${g},${b},${opacity})"/>`;
            } else {
              svgContent += `<rect x="${x * scale}" y="${
                y * scale
              }" width="${scale}" height="${scale}" fill="rgb(${r},${g},${b})"/>`;
            }
          }
        }
      }
    }

    svgContent += "</svg>";

    // Create and download file
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sprite.name || "sprite"}_${scale}x.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  exportAsAnimatedSVG(frameRate = 12) {
    if (
      !this.currentSprite ||
      !this.currentSprite.frames ||
      this.currentSprite.frames.length <= 1
    ) {
      this.uiManager.showNotification("No animation to export", "warning");
      return;
    }

    const sprite = this.currentSprite;
    const frameDuration = (1000 / frameRate) * sprite.frames.length; // Total animation duration in ms

    // Create SVG content with animation
    let svgContent = `<svg width="${sprite.width}" height="${sprite.height}" xmlns="http://www.w3.org/2000/svg" style="image-rendering: pixelated;">`;

    // Create animated rectangles for each pixel that changes
    const pixelAnimations = new Map();

    // Analyze all frames to find changing pixels
    for (let y = 0; y < sprite.height; y++) {
      for (let x = 0; x < sprite.width; x++) {
        const pixelColors = [];
        let hasChanges = false;

        // Get pixel color for each frame
        sprite.frames.forEach((frame, frameIndex) => {
          const color = this.getFramePixelColor(frame, x, y);
          pixelColors.push(color);

          if (frameIndex > 0 && !this.colorsEqual(color, pixelColors[0])) {
            hasChanges = true;
          }
        });

        // Only create animation if pixel changes or is visible
        if (hasChanges || pixelColors[0].a > 0) {
          pixelAnimations.set(`${x}-${y}`, pixelColors);
        }
      }
    }

    // Create animated rectangles
    pixelAnimations.forEach((colors, key) => {
      const [x, y] = key.split("-").map(Number);

      // Create base rectangle
      const firstColor = colors[0];
      if (colors.some((c) => c.a > 0)) {
        // Only if at least one frame has this pixel visible
        svgContent += `<rect x="${x}" y="${y}" width="1" height="1"`;

        // Add fill animation if colors change
        const uniqueColors = [
          ...new Set(
            colors.map((c) => `rgba(${c.r},${c.g},${c.b},${c.a / 255})`)
          ),
        ];
        if (uniqueColors.length > 1) {
          const colorValues = colors
            .map((c) => `rgba(${c.r},${c.g},${c.b},${c.a / 255})`)
            .join(";");
          svgContent += ` fill="${uniqueColors[0]}">`;
          svgContent += `<animate attributeName="fill" values="${colorValues}" dur="${frameDuration}ms" repeatCount="indefinite"/>`;
          svgContent += `</rect>`;
        } else {
          svgContent += ` fill="${uniqueColors[0]}"/>`;
        }
      }
    });

    svgContent += "</svg>";

    // Download the animated SVG
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sprite.name || "animation"}_animated.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  getFramePixelColor(frame, x, y) {
    let finalColor = { r: 0, g: 0, b: 0, a: 0 };

    // Composite all visible layers
    frame.layers.forEach((layer) => {
      if (
        !layer.visible ||
        !layer.pixels ||
        !layer.pixels[y] ||
        !layer.pixels[y][x]
      )
        return;

      const [r, g, b, a] = layer.pixels[y][x];
      if (a > 0) {
        const opacity = (a / 255) * (layer.opacity || 1);

        // Alpha blending
        if (finalColor.a === 0) {
          finalColor = { r, g, b, a: Math.round(opacity * 255) };
        } else {
          const alpha = opacity;
          const invAlpha = 1 - alpha;
          const currentAlpha = finalColor.a / 255;

          finalColor.r = Math.round(
            r * alpha + finalColor.r * invAlpha * currentAlpha
          );
          finalColor.g = Math.round(
            g * alpha + finalColor.g * invAlpha * currentAlpha
          );
          finalColor.b = Math.round(
            b * alpha + finalColor.b * invAlpha * currentAlpha
          );
          finalColor.a = Math.round(255 * (alpha + currentAlpha * invAlpha));
        }
      }
    });

    return finalColor;
  }
  colorsEqual(color1, color2) {
    return (
      color1.r === color2.r &&
      color1.g === color2.g &&
      color1.b === color2.b &&
      color1.a === color2.a
    );
  }

  async exportFramesAsZip() {
    if (
      !this.currentSprite ||
      !this.currentSprite.frames ||
      this.currentSprite.frames.length <= 1
    ) {
      this.uiManager.showNotification("No animation to export", "warning");
      return;
    }

    // Check if JSZip is available
    if (typeof JSZip === "undefined") {
      // Try to load JSZip from CDN
      try {
        await this.loadJSZip();
      } catch (error) {
        this.uiManager.showNotification("JSZip library not available", "error");
        return;
      }
    }

    const sprite = this.currentSprite;
    const zip = new JSZip();
    const frameFolder = zip.folder("frames");

    this.uiManager.showNotification("Generating frames...", "info");

    // Create canvas for frame rendering
    const canvas = document.createElement("canvas");
    canvas.width = sprite.width;
    canvas.height = sprite.height;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    // Generate each frame
    for (let i = 0; i < sprite.frames.length; i++) {
      const frame = sprite.frames[i];

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Render frame layers
      frame.layers.forEach((layer) => {
        if (!layer.visible || !layer.pixels) return;

        for (let y = 0; y < frame.height; y++) {
          for (let x = 0; x < frame.width; x++) {
            if (!layer.pixels[y] || !layer.pixels[y][x]) continue;

            const [r, g, b, a] = layer.pixels[y][x];
            if (a > 0) {
              const opacity = (a / 255) * (layer.opacity || 1);
              ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }
      });

      // Convert to blob and add to zip
      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, "image/png");
      });

      const frameName = `frame_${String(i + 1).padStart(3, "0")}.png`;
      frameFolder.file(frameName, blob);
    }

    // Generate and download zip
    try {
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${sprite.name || "animation"}_frames.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      this.uiManager.showNotification(
        `Exported ${sprite.frames.length} frames as ZIP`,
        "success"
      );
    } catch (error) {
      console.error("Failed to create ZIP:", error);
      this.uiManager.showNotification("Failed to create ZIP file", "error");
    }
  }

  async loadJSZip() {
    return new Promise((resolve, reject) => {
      if (typeof JSZip !== "undefined") {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Failed to load JSZip"));
      document.head.appendChild(script);
    });
  }

  /**
   * Export animation as GIF
   */
  // Modified exportAsGIF method in PixelEditor class
  /**
   * Export animation as GIF using gif.js library
   * This function should be added to the PixelEditor class
   */
  async exportAsGIF(frameRate = 12, scale = 1, repeat = true) {
    if (
      !this.currentSprite ||
      !this.currentSprite.frames ||
      this.currentSprite.frames.length <= 1
    ) {
      this.uiManager.showNotification("No animation to export", "warning");
      return;
    }

    // Save current frame before export
    if (this.animationManager) {
      this.animationManager.saveLayerManagerToCurrentFrame();
    }

    const sprite = this.currentSprite;
    const width = sprite.width * scale;
    const height = sprite.height * scale;

    console.log(
      `Exporting GIF: ${sprite.frames.length} frames, ${width}x${height}`
    );

    try {
      this.uiManager.showNotification("Generating GIF...", "info");

      // Check if gif.js is available
      if (typeof GIF === "undefined") {
        throw new Error("GIF.js library not available");
      }

      // Initialize GIF encoder with transparency support
      const gif = new GIF({
        workers: 2,
        quality: 10,
        width: width,
        height: height,
        repeat: repeat ? 0 : -1,
        delay: Math.round(1000 / frameRate),
        workerScript: "js/lib/gif.worker.js",
        transparent: 0xff00ff, // Use magenta as transparent color (unlikely to be used in pixel art)
        background: null,
      });

      // Process each frame
      for (
        let frameIndex = 0;
        frameIndex < sprite.frames.length;
        frameIndex++
      ) {
        const frame = sprite.frames[frameIndex];
        console.log(
          `Processing frame ${frameIndex + 1}/${sprite.frames.length}`
        );

        // Create canvas for this frame
        const frameCanvas = document.createElement("canvas");
        frameCanvas.width = width;
        frameCanvas.height = height;
        const frameCtx = frameCanvas.getContext("2d");

        // Disable image smoothing
        frameCtx.imageSmoothingEnabled = false;
        frameCtx.webkitImageSmoothingEnabled = false;
        frameCtx.mozImageSmoothingEnabled = false;
        frameCtx.msImageSmoothingEnabled = false;

        // Fill with magenta as transparent background
        frameCtx.fillStyle = "#FF00FF"; // Magenta - will become transparent in GIF
        frameCtx.fillRect(0, 0, width, height);

        // Render frame using proper layer compositing
        this.renderFrameToCanvas(frame, frameCtx, scale);

        // Add frame to GIF
        gif.addFrame(frameCanvas);
      }

      // Render GIF
      gif.on("finished", (blob) => {
        console.log("GIF generation completed");

        // Download the GIF
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${sprite.name || "animation"}.gif`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.uiManager.showNotification(
          `Exported GIF with ${sprite.frames.length} frames`,
          "success"
        );
      });

      gif.on("progress", (progress) => {
        console.log(`GIF progress: ${Math.round(progress * 100)}%`);
      });

      gif.render();
    } catch (error) {
      console.error("GIF export failed:", error);
      this.uiManager.showNotification(
        `GIF export failed: ${error.message}`,
        "error"
      );

      // Fallback to PNG frames
      this.uiManager.showCustomConfirm(
        "GIF export failed. Would you like to export individual PNG frames instead?",
        () => {
          this.exportFramesAsPNGs();
        }
      );
    }
  }

  /**
   * Render a frame to canvas with transparency handling for GIF export
   */
  renderFrameToCanvasWithTransparency(frame, ctx, scale = 1) {
    const width = frame.width;
    const height = frame.height;

    // Render each pixel, preserving transparency
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const compositePixel = this.getCompositePixel(frame, x, y);

        // Only draw non-transparent pixels
        if (compositePixel.a > 0) {
          ctx.fillStyle = `rgba(${compositePixel.r}, ${compositePixel.g}, ${compositePixel.b}, 1)`;
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
        // Transparent pixels will show the green background which becomes transparent in GIF
      }
    }
  }

  /**
   * Export using JSGif library if available
   */
  exportWithJSGIF(frameRate, scale, repeat) {
    const sprite = this.currentSprite;
    const width = sprite.width * scale;
    const height = sprite.height * scale;

    console.log("Using JSGif library");

    const encoder = new GIFEncoder();
    encoder.start();
    encoder.setRepeat(repeat ? 0 : -1);
    encoder.setDelay(Math.round(1000 / frameRate));

    for (let frameIndex = 0; frameIndex < sprite.frames.length; frameIndex++) {
      const frame = sprite.frames[frameIndex];
      const canvas = this.renderFrameToCanvas2(frame, width, height);
      const ctx = canvas.getContext("2d");
      const imageData = ctx.getImageData(0, 0, width, height);
      encoder.addFrame(imageData);
    }

    encoder.finish();
    const binary = encoder.stream().getData();
    const blob = new Blob([new Uint8Array(binary)], { type: "image/gif" });

    this.downloadBlob(blob, `${sprite.name || "animation"}.gif`);
    this.uiManager.showNotification(`Exported GIF using JSGif`, "success");
  }

  /**
   * Check if browser supports animated WebP creation
   */
  canCreateAnimatedWebP() {
    // Most modern browsers support WebP but not animated WebP creation
    // This is more of a placeholder for future implementation
    return false;
  }

  /**
   * Export as animated WebP (placeholder for future implementation)
   */
  exportAsAnimatedWebP(frameRate, scale) {
    this.uiManager.showNotification(
      "Animated WebP export not yet implemented",
      "info"
    );
    this.exportFramesAsPNGs();
  }

  /**
   * Export frames as individual PNG files
   */
  exportFramesAsPNGs() {
    if (!this.currentSprite?.frames || this.currentSprite.frames.length <= 1) {
      this.uiManager.showNotification("No frames to export", "warning");
      return;
    }

    const sprite = this.currentSprite;
    console.log(`Exporting ${sprite.frames.length} frames as PNGs`);

    this.uiManager.showNotification("Exporting frames as PNGs...", "info");

    sprite.frames.forEach((frame, index) => {
      const canvas = this.renderFrameToCanvas2(
        frame,
        sprite.width,
        sprite.height
      );

      canvas.toBlob((blob) => {
        const frameNumber = String(index + 1).padStart(3, "0");
        const filename = `${
          sprite.name || "animation"
        }_frame_${frameNumber}.png`;
        this.downloadBlob(blob, filename);
      }, "image/png");
    });

    this.uiManager.showNotification(
      `Exported ${sprite.frames.length} PNG frames. Use external tools to create GIF.`,
      "success"
    );
  }

  /**
   * Render a frame to a canvas - improved version
   */
  renderFrameToCanvas2(frame, targetWidth, targetHeight) {
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");

    // Disable smoothing for pixel art
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;

    // Calculate scale factor
    const scaleX = targetWidth / frame.width;
    const scaleY = targetHeight / frame.height;

    // Render frame pixel by pixel
    if (!frame.layers) {
      console.warn("Frame has no layers");
      return canvas;
    }

    for (let y = 0; y < frame.height; y++) {
      for (let x = 0; x < frame.width; x++) {
        const pixelColor = this.getCompositePixel(frame, x, y);

        if (pixelColor.a > 0) {
          ctx.fillStyle = `rgba(${pixelColor.r}, ${pixelColor.g}, ${
            pixelColor.b
          }, ${pixelColor.a / 255})`;
          ctx.fillRect(
            Math.floor(x * scaleX),
            Math.floor(y * scaleY),
            Math.ceil(scaleX),
            Math.ceil(scaleY)
          );
        }
      }
    }

    return canvas;
  }

  /**
   * Get the composite color of a pixel from all visible layers in a frame
   */
  getCompositePixel(frame, x, y) {
    let finalColor = { r: 0, g: 0, b: 0, a: 0 }; // Start transparent

    if (!frame.layers) {
      return finalColor;
    }

    // Composite all visible layers from bottom to top
    frame.layers.forEach((layer) => {
      if (
        !layer.visible ||
        !layer.pixels ||
        !layer.pixels[y] ||
        !layer.pixels[y][x]
      ) {
        return;
      }

      const [r, g, b, a] = layer.pixels[y][x];

      if (a > 0) {
        const alpha = a / 255;
        const layerOpacity = layer.opacity !== undefined ? layer.opacity : 1;
        const effectiveAlpha = alpha * layerOpacity;

        if (finalColor.a === 0) {
          // First non-transparent pixel
          finalColor = { r, g, b, a: Math.round(effectiveAlpha * 255) };
        } else {
          // Alpha blend with existing color
          const srcAlpha = effectiveAlpha;
          const dstAlpha = finalColor.a / 255;
          const outAlpha = srcAlpha + dstAlpha * (1 - srcAlpha);

          if (outAlpha > 0) {
            finalColor.r = Math.round(
              (r * srcAlpha + finalColor.r * dstAlpha * (1 - srcAlpha)) /
                outAlpha
            );
            finalColor.g = Math.round(
              (g * srcAlpha + finalColor.g * dstAlpha * (1 - srcAlpha)) /
                outAlpha
            );
            finalColor.b = Math.round(
              (b * srcAlpha + finalColor.b * dstAlpha * (1 - srcAlpha)) /
                outAlpha
            );
            finalColor.a = Math.round(outAlpha * 255);
          }
        }
      }
    });

    return finalColor;
  }

  /**
   * Helper method to render a frame to a canvas context (kept for compatibility)
   */

  /**
   * Render a frame to canvas with proper transparency handling
   */
  renderFrameToCanvas(frame, ctx, scale = 1) {
    const width = frame.width;
    const height = frame.height;

    // Canvas starts transparent by default - no need to clear or fill

    // Render each pixel, only drawing non-transparent ones
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const compositePixel = this.getCompositePixel(frame, x, y);

        // Only draw pixels that have opacity
        if (compositePixel.a > 0) {
          ctx.fillStyle = `rgba(${compositePixel.r}, ${compositePixel.g}, ${
            compositePixel.b
          }, ${compositePixel.a / 255})`;
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
        // Transparent pixels (a === 0) are left as canvas default (transparent)
      }
    }
  }

  /**
   * Download a blob as a file
   */
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Simple manual GIF creation (very basic implementation)
   * This is a last resort fallback
   */
  createManualGIF() {
    // This would require implementing the entire GIF format specification
    // which is quite complex. For now, we'll stick to PNG export.
    this.uiManager.showNotification(
      "Manual GIF creation not implemented. Use PNG frames with external tools.",
      "info"
    );
    this.exportFramesAsPNGs();
  }
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Export current sprite as PNG with current zoom scale
   */
  exportAsPNG(scale = 1) {
    if (!this.currentSprite) {
      console.warn("No current sprite to export");
      return;
    }

    // CRITICAL FIX: Save current LayerManager state to sprite before export
    if (this.animationManager) {
      this.animationManager.saveLayerManagerToCurrentFrame();
    }

    const sprite = this.currentSprite;
    const scaledWidth = sprite.width * scale;
    const scaledHeight = sprite.height * scale;

    // Create a temporary canvas for export
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = scaledWidth;
    exportCanvas.height = scaledHeight;
    const exportCtx = exportCanvas.getContext("2d");

    // Disable image smoothing for pixel-perfect scaling
    exportCtx.imageSmoothingEnabled = false;
    exportCtx.webkitImageSmoothingEnabled = false;
    exportCtx.mozImageSmoothingEnabled = false;
    exportCtx.msImageSmoothingEnabled = false;

    // FIXED: Use LayerManager's composite data instead of sprite.getPixel
    if (this.layerManager) {
      // Get composite image data from LayerManager
      const imageData = this.layerManager.getCompositeImageDataOptimized();

      // Create temporary canvas to scale from
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = sprite.width;
      tempCanvas.height = sprite.height;
      const tempCtx = tempCanvas.getContext("2d");
      tempCtx.putImageData(imageData, 0, 0);

      // Scale to export canvas
      exportCtx.drawImage(
        tempCanvas,
        0,
        0,
        sprite.width,
        sprite.height,
        0,
        0,
        scaledWidth,
        scaledHeight
      );
    } else {
      // Fallback: Draw each pixel manually using sprite data
      for (let y = 0; y < sprite.height; y++) {
        for (let x = 0; x < sprite.width; x++) {
          const pixel = sprite.getPixel(x, y);
          const [r, g, b, a] = pixel;

          if (a > 0) {
            exportCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
            exportCtx.fillRect(x * scale, y * scale, scale, scale);
          }
        }
      }
    }

    // Convert to PNG and download
    exportCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${sprite.name || "sprite"}_${scale}x.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, "image/png");
  }
  /**
   * Export animation frames as PNG spritesheet
   */
  async exportFramesAsPNGSpritesheet(scale = 1) {
    if (
      !this.currentSprite ||
      !this.currentSprite.frames ||
      this.currentSprite.frames.length <= 1
    ) {
      this.uiManager.showNotification("No animation frames to export", "error");
      return;
    }

    // Save current frame state before export
    if (this.animationManager) {
      this.animationManager.saveLayerManagerToCurrentFrame();
    }

    const sprite = this.currentSprite;
    const frameCount = sprite.frames.length;
    const columns = Math.ceil(Math.sqrt(frameCount)); // Square-ish layout
    const rows = Math.ceil(frameCount / columns);

    const scaledFrameWidth = sprite.width * scale;
    const scaledFrameHeight = sprite.height * scale;
    const totalWidth = scaledFrameWidth * columns;
    const totalHeight = scaledFrameHeight * rows;

    // Create spritesheet canvas
    const canvas = document.createElement("canvas");
    canvas.width = totalWidth;
    canvas.height = totalHeight;
    const ctx = canvas.getContext("2d");

    // Disable image smoothing for pixel art
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;

    // Render each frame
    for (let i = 0; i < frameCount; i++) {
      const frame = sprite.frames[i];
      const col = i % columns;
      const row = Math.floor(i / columns);

      const x = col * scaledFrameWidth;
      const y = row * scaledFrameHeight;

      // Render frame to spritesheet
      this.renderFrameToSpritesheet(frame, ctx, x, y, scale);
    }

    // Convert to PNG and download
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${sprite.name || "animation"}_spritesheet_${scale}x.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  /**
   * Export animation frames as SVG spritesheet
   */
  async exportFramesAsSVGSpritesheet(scale = 1) {
    if (
      !this.currentSprite ||
      !this.currentSprite.frames ||
      this.currentSprite.frames.length <= 1
    ) {
      this.uiManager.showNotification("No animation frames to export", "error");
      return;
    }

    // Save current frame state before export
    if (this.animationManager) {
      this.animationManager.saveLayerManagerToCurrentFrame();
    }

    const sprite = this.currentSprite;
    const frameCount = sprite.frames.length;
    const columns = Math.ceil(Math.sqrt(frameCount));
    const rows = Math.ceil(frameCount / columns);

    const scaledFrameWidth = sprite.width * scale;
    const scaledFrameHeight = sprite.height * scale;
    const totalWidth = scaledFrameWidth * columns;
    const totalHeight = scaledFrameHeight * rows;

    // Create SVG content
    let svgContent = `<svg width="${totalWidth}" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg" style="image-rendering: pixelated;">`;

    // Render each frame
    for (let i = 0; i < frameCount; i++) {
      const frame = sprite.frames[i];
      const col = i % columns;
      const row = Math.floor(i / columns);

      const offsetX = col * scaledFrameWidth;
      const offsetY = row * scaledFrameHeight;

      // Create group for this frame
      svgContent += `<g transform="translate(${offsetX},${offsetY})">`;

      // Render frame pixels
      for (let y = 0; y < sprite.height; y++) {
        for (let x = 0; x < sprite.width; x++) {
          const compositePixel = this.getCompositePixel(frame, x, y);

          if (compositePixel.a > 0) {
            const opacity = compositePixel.a / 255;
            svgContent += `<rect x="${x * scale}" y="${
              y * scale
            }" width="${scale}" height="${scale}" fill="rgb(${
              compositePixel.r
            },${compositePixel.g},${compositePixel.b})" opacity="${opacity}"/>`;
          }
        }
      }

      svgContent += "</g>";
    }

    svgContent += "</svg>";

    // Create and download file
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sprite.name || "animation"}_spritesheet_${scale}x.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Helper method to render a frame to spritesheet canvas
   */
  renderFrameToSpritesheet(frame, ctx, x, y, scale) {
    for (let sy = 0; sy < frame.height; sy++) {
      for (let sx = 0; sx < frame.width; sx++) {
        const compositePixel = this.getCompositePixel(frame, sx, sy);

        if (compositePixel.a > 0) {
          ctx.fillStyle = `rgba(${compositePixel.r}, ${compositePixel.g}, ${
            compositePixel.b
          }, ${compositePixel.a / 255})`;
          ctx.fillRect(x + sx * scale, y + sy * scale, scale, scale);
        }
      }
    }
  }
  /**
   * Export all sprites as JSON
   */
  exportAllSprites() {
    try {
      this.storageManager.exportSprites(this.sprites);
      this.uiManager.showNotification(
        `Exported ${this.sprites.length} sprites`,
        "success"
      );
    } catch (error) {
      console.error("Export failed:", error);
      this.uiManager.showNotification(
        `Export failed: ${error.message}`,
        "error"
      );
    }
  }

  /**
   * Update all UI components
   */
  updateUI() {
    this.uiManager.updateAll();
  }

  /**
   * Update tool settings UI
   */
  updateToolSettings() {
    this.uiManager.updateToolSettings();
  }

  /**
   * Convert hex color to RGBA array
   */
  hexToRgba(hex, alpha = 255) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [
          parseInt(result[1], 16),
          parseInt(result[2], 16),
          parseInt(result[3], 16),
          Math.round(alpha),
        ]
      : [0, 0, 0, alpha];
  }

  /**
   * Convert RGBA array to hex color
   */
  rgbaToHex(rgba) {
    if (!Array.isArray(rgba) || rgba.length < 3) {
      return "#000000";
    }

    const [r, g, b] = rgba;
    const toHex = (n) =>
      Math.round(Math.max(0, Math.min(255, n)))
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  rgbaToString(rgba) {
    if (!Array.isArray(rgba) || rgba.length < 3) {
      return "rgba(0, 0, 0, 1)";
    }

    const [r, g, b, a = 255] = rgba;
    const alpha = (a / 255).toFixed(2);
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(
      b
    )}, ${alpha})`;
  }
  /**
   * Get editor statistics
   */
  getStats() {
    const totalPixels = this.sprites.reduce(
      (sum, sprite) => sum + sprite.width * sprite.height,
      0
    );
    const storageUsage = this.storageManager.getStorageUsage();

    return {
      totalSprites: this.sprites.length,
      totalPixels,
      currentSprite: this.currentSprite
        ? {
            name: this.currentSprite.name,
            dimensions: `${this.currentSprite.width}×${this.currentSprite.height}`,
            stats: this.currentSprite.getStats(),
          }
        : null,
      storageUsage,
      currentTool: this.currentTool?.name,
    };
  }

  /**
   * Clear all data (reset editor)
   */
  reset() {
    this.uiManager.showCustomConfirm(
      "Are you sure you want to clear all sprites and reset the editor? This cannot be undone.",
      () => {
        this.sprites = [];
        this.storageManager.clearAll();
        this.createNewSprite();
        this.updateUI();

        this.uiManager.showNotification("Editor reset successfully", "success");
      }
    );
  }

  /**
   * Get current sprite as data URL
   */
  getCurrentSpriteDataURL() {
    if (!this.currentSprite) return null;
    return this.canvasManager.exportAsImage();
  }
}

// Make PixelEditor globally available
window.PixelEditor = PixelEditor;
