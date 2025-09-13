// Main Editor Class - Coordinates all components of the pixel editor
class PixelEditor {
  constructor() {
    // Core components
    this.canvasManager = null;
    this.uiManager = null;
    this.layerManager = null;
    this.animationManager = new AnimationManager(this);
    this.storageManager = window.storageManager;

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
      if (
        this.storageManager &&
        typeof this.storageManager.saveSprite === "function"
      ) {
        await this.storageManager.saveSprite(sprite);
      }
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

    // Load settings AFTER initializing layer manager
    this.settings = await this.storageManager.loadSettings();

    // Initialize tools (now that settings are loaded)
    this.initializeTools();

    // Initialize UI manager
    this.uiManager = new UIController(this);

    // Load sprites from storage (now async)
    await this.loadSprites();

    // Set initial colors
    this.setPrimaryColor(this.hexToRgba(this.settings.primaryColor));
    this.setSecondaryColor(this.hexToRgba(this.settings.secondaryColor));

    // Set initial tool
    this.setCurrentTool("brush");

    // Create initial sprite if none exist
    if (this.sprites.length === 0) {
      this.createNewSprite();
    } else {
      this.setCurrentSprite(this.sprites[0]);
      // CRITICAL FIX: Force render after setting current sprite
      setTimeout(() => {
        if (this.canvasManager) {
          this.canvasManager.render();
        }
      }, 0);
    }

    // Update UI
    this.updateUI();

    console.log("Pixel Editor initialized successfully!");
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
  saveLayersToSprite() {
    if (!this.currentSprite || !this.layerManager || !this.animationManager) return;

    // Save current layer state to current frame
    this.animationManager.saveLayerManagerToCurrentFrame();
  }

  createNewAnimatedSprite(width = 16, height = 16, name = null, frameCount = 1) {
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
    if (this.currentSprite && this.animationManager) {
      this.animationManager.saveLayerManagerToCurrentFrame();
    }

    this.currentSprite = sprite;
    if (sprite) {
      sprite.onChange = (s) => this.debouncedSave(s);

      // Initialize frames for backward compatibility
      if (!sprite.frames || sprite.frames.length === 0) {
        sprite.initializeFrames();
      }

      // Load first frame into animation manager and layer manager
      if (this.animationManager) {
        this.animationManager.currentFrameIndex = 0;
        this.animationManager.loadFrameIntoLayerManager(sprite.frames[0]);
      }
    }

    // Set sprite in canvas manager
    this.canvasManager.setSprite(sprite);

    // Force immediate render
    if (this.canvasManager) {
      this.canvasManager.render();
    }

    this.updateUI();
  }

  // Apply saved tool settings
  // Apply saved tool settings
  applyToolSettings() {
    // Safety check - if settings not loaded yet, use defaults
    if (!this.settings) {
      console.warn("Settings not loaded, skipping tool settings application");
      return;
    }

    if (this.tools.brush) {
      this.tools.brush.setSize(this.settings.brushSize);
      this.tools.brush.setOpacity(this.settings.brushOpacity);
    }

    if (this.tools.bucket) {
      this.tools.bucket.setTolerance(this.settings.bucketTolerance);
    }

    if (this.tools.brightness) {
      this.tools.brightness.setIntensity(this.settings.brightnessIntensity);
    }
  }

  // Update tool colors when primary/secondary colors change
  updateToolColors() {
    Object.values(this.tools).forEach((tool) => {
      if (tool.setColor) {
        tool.setColor(this.primaryColor);
      }
    });
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
      if (
        this.storageManager &&
        typeof this.storageManager.saveSprite === "function"
      ) {
        this.storageManager.saveSprite(s);
      }
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
  duplicateSprite(sprite) {
    const duplicate = sprite.clone();
    this.sprites.push(duplicate);
    this.setCurrentSprite(duplicate);
    this.saveSprites();

    this.uiManager.showNotification(
      `Duplicated sprite: ${duplicate.name}`,
      "success"
    );
    return duplicate;
  }

  // Delete sprite
  deleteSprite(index) {
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

    // Remove sprite from array
    this.sprites.splice(index, 1);

    // If deleted sprite was current, switch to another
    if (deletedSprite === this.currentSprite) {
      const newIndex = Math.min(index, this.sprites.length - 1);
      this.setCurrentSprite(this.sprites[newIndex]);
    }

    this.saveSprites();
    this.uiManager.showNotification(`Deleted sprite: ${spriteName}`, "success");
    return true;
  }

  /**
   * Resize current canvas
   */
  resizeCanvas(width, height, maintainAspectRatio = false) {
    if (!this.currentSprite) return false;

    // Resize all frames in the sprite
    if (this.currentSprite.frames) {
      this.currentSprite.frames.forEach(frame => {
        frame.width = width;
        frame.height = height;

        // Resize each layer in the frame
        frame.layers.forEach(layer => {
          const newPixels = [];
          for (let y = 0; y < height; y++) {
            newPixels[y] = [];
            for (let x = 0; x < width; x++) {
              if (y < layer.pixels.length && x < layer.pixels[y].length) {
                newPixels[y][x] = [...layer.pixels[y][x]];
              } else {
                newPixels[y][x] = [0, 0, 0, 0]; // Transparent
              }
            }
          }
          layer.pixels = newPixels;
        });
      });
    }

    // Update sprite dimensions
    this.currentSprite.width = width;
    this.currentSprite.height = height;

    // Resize layer manager
    this.layerManager.resize(width, height);

    // Reload current frame
    if (this.animationManager) {
      const currentFrame = this.animationManager.getCurrentFrame();
      if (currentFrame) {
        this.animationManager.loadFrameIntoLayerManager(currentFrame);
      }
    }

    this.canvasManager.updateCanvasSize();
    this.saveSprites();
    this.updateUI();

    this.uiManager.showNotification(
      `Canvas resized to ${width}×${height}`,
      "success"
    );
    return true;
  }

  // Add this method to your PixelEditor class
  // This should be inserted in the PixelEditor class after the resizeCanvas method

  /**
   * Crop current sprite to selection bounds
   */
  cropToSelection(selection) {
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
      // Start batch operation to prevent multiple history entries
      this.layerManager.startBatchOperation();

      // Create new layer data for cropped size
      const oldLayers = this.layerManager.layers.map((layer) => ({
        ...layer,
        pixels: layer.pixels.map((row) => [...row]), // Deep copy pixels
      }));

      // Resize layer manager to new dimensions
      this.layerManager.resize(newWidth, newHeight);

      // Copy cropped pixels for each layer
      for (
        let layerIndex = 0;
        layerIndex < this.layerManager.layers.length;
        layerIndex++
      ) {
        const layer = this.layerManager.layers[layerIndex];
        const oldLayer = oldLayers[layerIndex];

        if (!oldLayer) continue;

        // Initialize new pixel array
        layer.pixels = [];

        for (let y = 0; y < newHeight; y++) {
          layer.pixels[y] = [];
          for (let x = 0; x < newWidth; x++) {
            const srcX = selection.left + x;
            const srcY = selection.top + y;

            // Copy pixel from original layer
            if (
              srcY < oldLayer.pixels.length &&
              srcX < oldLayer.pixels[srcY].length
            ) {
              layer.pixels[y][x] = [...oldLayer.pixels[srcY][srcX]];
            } else {
              layer.pixels[y][x] = [0, 0, 0, 0]; // Transparent pixel
            }
          }
        }
      }

      // Update sprite dimensions
      this.currentSprite.width = newWidth;
      this.currentSprite.height = newHeight;

      // Save layers back to sprite
      this.saveLayersToSprite();

      // End batch operation - this will save to history
      this.layerManager.endBatchOperation();

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
    this.primaryColor = [...color];
    this.updateToolColors();
    this.saveSettings();
  }

  // Set secondary color
  setSecondaryColor(color) {
    this.secondaryColor = [...color];
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
      this.uiManager.showNotification("Undone", "info");
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
      this.uiManager.showNotification("Redone", "info");
      return true;
    }
    return false;
  }

  /**
   * Save sprites to storage
   */
  /**
   * Save sprites to storage
   */
  async saveSprites() {
    try {
      const success = await this.storageManager.saveSprites(this.sprites);
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
      const loadedSprites = await this.storageManager.loadSprites();
      this.sprites = loadedSprites || []; // Ensure it's always an array

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
  async saveSettings() {
    if (!this.settings) {
      this.settings = this.storageManager.getDefaultSettings();
    }

    this.settings.primaryColor = this.rgbaToHex(this.primaryColor);
    this.settings.secondaryColor = this.rgbaToHex(this.secondaryColor);

    // Save tool settings
    if (this.tools.brush) {
      this.settings.brushSize = this.tools.brush.size;
      this.settings.brushOpacity = this.tools.brush.opacity;
    }

    if (this.tools.bucket) {
      this.settings.bucketTolerance = this.tools.bucket.tolerance;
    }

    if (this.tools.brightness) {
      this.settings.brightnessIntensity = this.tools.brightness.intensity;
    }

    this.settings.showGrid = this.canvasManager.showGrid;
    this.settings.zoomLevel = this.canvasManager.zoomLevel;

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
    const editor = this; // Capture 'this' reference

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Check if image exceeds maximum size
      if (img.width > 64 || img.height > 64) {
        // Show downscale modal
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        editor.uiManager.showDownscaleModal(imageData, img.width, img.height);
        return;
      }

      // Image is within limits, create sprite directly
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      editor.createSpriteFromImageData(imageData, img.width, img.height);
      editor.uiManager.showNotification(
        `Imported image: ${img.width}x${img.height}`,
        "success"
      );
    };

    img.onerror = () => {
      editor.uiManager.showNotification("Failed to load image", "error");
    };

    img.src = URL.createObjectURL(file);
  }

  createSpriteFromImageData(imageData, width, height) {
    const sprite = this.createNewSprite(width, height);
    const pixels = [];

    // Initialize pixel array
    for (let y = 0; y < height; y++) {
      pixels[y] = [];
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        pixels[y][x] = [
          imageData.data[index], // R
          imageData.data[index + 1], // G
          imageData.data[index + 2], // B
          imageData.data[index + 3], // A
        ];
      }
    }

    sprite.setPixelArray(pixels);
    this.updateUI();
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

    const sprite = this.currentSprite;
    const scaledWidth = sprite.width * scale;
    const scaledHeight = sprite.height * scale;

    // Create SVG content
    let svgContent = `<svg width="${scaledWidth}" height="${scaledHeight}" xmlns="http://www.w3.org/2000/svg" style="image-rendering: pixelated;">`;

    // Add each pixel as a rectangle
    for (let y = 0; y < sprite.height; y++) {
      for (let x = 0; x < sprite.width; x++) {
        const pixel = sprite.getPixel(x, y);
        const [r, g, b, a] = pixel;

        if (a > 0) {
          // Only render non-transparent pixels
          const opacity = a / 255;
          svgContent += `<rect x="${x * scale}" y="${y * scale
            }" width="${scale}" height="${scale}" fill="rgb(${r},${g},${b})" opacity="${opacity}"/>`;
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
    if (!this.currentSprite || !this.currentSprite.frames || this.currentSprite.frames.length <= 1) {
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
      const [x, y] = key.split('-').map(Number);

      // Create base rectangle
      const firstColor = colors[0];
      if (colors.some(c => c.a > 0)) { // Only if at least one frame has this pixel visible
        svgContent += `<rect x="${x}" y="${y}" width="1" height="1"`;

        // Add fill animation if colors change
        const uniqueColors = [...new Set(colors.map(c => `rgba(${c.r},${c.g},${c.b},${c.a / 255})`))];
        if (uniqueColors.length > 1) {
          const colorValues = colors.map(c => `rgba(${c.r},${c.g},${c.b},${c.a / 255})`).join(';');
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
    frame.layers.forEach(layer => {
      if (!layer.visible || !layer.pixels || !layer.pixels[y] || !layer.pixels[y][x]) return;

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

          finalColor.r = Math.round(r * alpha + finalColor.r * invAlpha * currentAlpha);
          finalColor.g = Math.round(g * alpha + finalColor.g * invAlpha * currentAlpha);
          finalColor.b = Math.round(b * alpha + finalColor.b * invAlpha * currentAlpha);
          finalColor.a = Math.round(255 * (alpha + currentAlpha * invAlpha));
        }
      }
    });

    return finalColor;
  }
  colorsEqual(color1, color2) {
    return color1.r === color2.r && color1.g === color2.g &&
      color1.b === color2.b && color1.a === color2.a;
  }


  async exportFramesAsZip() {
    if (!this.currentSprite || !this.currentSprite.frames || this.currentSprite.frames.length <= 1) {
      this.uiManager.showNotification("No animation to export", "warning");
      return;
    }

    // Check if JSZip is available
    if (typeof JSZip === 'undefined') {
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
    const canvas = document.createElement('canvas');
    canvas.width = sprite.width;
    canvas.height = sprite.height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Generate each frame
    for (let i = 0; i < sprite.frames.length; i++) {
      const frame = sprite.frames[i];

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Render frame layers
      frame.layers.forEach(layer => {
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
      const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/png');
      });

      const frameName = `frame_${String(i + 1).padStart(3, '0')}.png`;
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

      this.uiManager.showNotification(`Exported ${sprite.frames.length} frames as ZIP`, "success");
    } catch (error) {
      console.error("Failed to create ZIP:", error);
      this.uiManager.showNotification("Failed to create ZIP file", "error");
    }
  }

  async loadJSZip() {
    return new Promise((resolve, reject) => {
      if (typeof JSZip !== 'undefined') {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load JSZip'));
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


  /**
   * Helper method to render a frame to a canvas context
   * This should also be added to the PixelEditor class
   */
  /**
 * Simplified, direct GIF export that should actually produce a GIF file
 * Replace your existing exportAsGIF method with this
 */
  /**
   * Debug version of GIF export to identify the exact failure point
   */
  /**
  * Export animation as GIF using gif.js library
  * This method should replace the empty exportAsGIF method in your PixelEditor class
  */
  async exportAsGIF(frameRate = 12, scale = 1, repeat = true) {
    if (!this.currentSprite || !this.currentSprite.frames || this.currentSprite.frames.length <= 1) {
      this.uiManager.showNotification("No animation to export", "warning");
      return;
    }

    // Check if GIF library is available
    if (typeof GIF === 'undefined') {
      this.uiManager.showNotification("GIF.js library not available", "error");
      return;
    }

    const sprite = this.currentSprite;
    const width = sprite.width * scale;
    const height = sprite.height * scale;

    try {
      this.uiManager.showNotification("Generating GIF...", "info");

      // Get current colors to determine if we can preserve them
      const currentColors = this.getCurrentColors();
      const MAX_GIF_COLORS = 256;
      const preserveColors = currentColors.length < MAX_GIF_COLORS;

      // Find transparent color if needed
      let transparentColor = null;
      let transparent = null;

      if (preserveColors && this.hasTransparency()) {
        transparentColor = this.getUnusedColor(currentColors);
        if (transparentColor) {
          transparent = parseInt(transparentColor.substring(1), 16);
        }
      }

      // Create GIF instance
      const gif = new GIF({
        workers: 2, // Reduced workers for better compatibility
        quality: 1, // Best quality
        width: width,
        height: height,
        preserveColors: preserveColors,
        repeat: repeat ? 0 : -1, // 0 = repeat forever, -1 = no repeat
        transparent: transparent,
        debug: false
      });

      // Create background canvas for transparent color fill
      const backgroundCanvas = document.createElement('canvas');
      backgroundCanvas.width = sprite.width;
      backgroundCanvas.height = sprite.height;
      const backgroundCtx = backgroundCanvas.getContext('2d');
      backgroundCtx.imageSmoothingEnabled = false;

      // Process each frame
      for (let frameIndex = 0; frameIndex < sprite.frames.length; frameIndex++) {
        const frame = sprite.frames[frameIndex];

        // Clear and fill background if we have a transparent color
        backgroundCtx.clearRect(0, 0, sprite.width, sprite.height);
        if (transparentColor) {
          backgroundCtx.fillStyle = transparentColor;
          backgroundCtx.fillRect(0, 0, sprite.width, sprite.height);
        }

        // Render frame layers onto background canvas
        this.renderFrameToCanvas(frame, backgroundCtx);

        // Scale up if needed
        let frameCanvas = backgroundCanvas;
        if (scale > 1) {
          frameCanvas = this.scaleCanvas(backgroundCanvas, scale);
        }

        // Add frame to GIF
        gif.addFrame(frameCanvas.getContext('2d'), {
          delay: Math.round(1000 / frameRate) // Convert FPS to milliseconds delay
        });
      }

      // Set up progress tracking
      gif.on('progress', (progress) => {
        const percentage = Math.round(progress * 100);
        console.log(`GIF generation progress: ${percentage}%`);
        // You could update a progress bar here if you have one
      });

      // Handle completion
      gif.on('finished', (blob) => {
        this.downloadBlob(blob, `${sprite.name || 'animation'}.gif`);
        this.uiManager.showNotification(
          `Exported GIF: ${sprite.frames.length} frames at ${frameRate} FPS`,
          "success"
        );
      });

      // Handle errors
      gif.on('abort', () => {
        this.uiManager.showNotification("GIF export was aborted", "error");
      });

      // Start rendering
      gif.render();

    } catch (error) {
      console.error("GIF export failed:", error);
      this.uiManager.showNotification(`GIF export failed: ${error.message}`, "error");
    }
  }

  /**
   * Helper method to render a frame to a canvas context
   */
  renderFrameToCanvas(frame, ctx) {
    const width = frame.width;
    const height = frame.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Render each visible layer
    frame.layers.forEach(layer => {
      if (!layer.visible || !layer.pixels) return;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (!layer.pixels[y] || !layer.pixels[y][x]) continue;

          const [r, g, b, a] = layer.pixels[y][x];
          if (a > 0) {
            const opacity = (a / 255) * (layer.opacity !== undefined ? layer.opacity : 1);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    });
  }

  /**
   * Scale a canvas using pixel-perfect nearest neighbor scaling
   */
  scaleCanvas(sourceCanvas, scale) {
    if (scale === 1) return sourceCanvas;

    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = sourceCanvas.width * scale;
    scaledCanvas.height = sourceCanvas.height * scale;

    const scaledCtx = scaledCanvas.getContext('2d');
    scaledCtx.imageSmoothingEnabled = false;
    scaledCtx.webkitImageSmoothingEnabled = false;
    scaledCtx.mozImageSmoothingEnabled = false;
    scaledCtx.msImageSmoothingEnabled = false;

    // Use drawImage for scaling
    scaledCtx.drawImage(
      sourceCanvas,
      0, 0, sourceCanvas.width, sourceCanvas.height,
      0, 0, scaledCanvas.width, scaledCanvas.height
    );

    return scaledCanvas;
  }

  /**
   * Get all unique colors used in the current sprite
   */
  getCurrentColors() {
    if (!this.currentSprite || !this.currentSprite.frames) return [];

    const colorSet = new Set();

    this.currentSprite.frames.forEach(frame => {
      frame.layers.forEach(layer => {
        if (!layer.visible || !layer.pixels) return;

        layer.pixels.forEach(row => {
          row.forEach(pixel => {
            const [r, g, b, a] = pixel;
            if (a > 0) { // Only count visible pixels
              const colorHex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
              colorSet.add(colorHex);
            }
          });
        });
      });
    });

    return Array.from(colorSet);
  }

  /**
   * Check if the current sprite has any transparency
   */
  hasTransparency() {
    if (!this.currentSprite || !this.currentSprite.frames) return false;

    return this.currentSprite.frames.some(frame =>
      frame.layers.some(layer =>
        layer.visible && layer.pixels && layer.pixels.some(row =>
          row.some(pixel => pixel[3] < 255) // Alpha less than 255
        )
      )
    );
  }

  /**
   * Find an unused color for transparency
   */
  getUnusedColor(usedColors) {
    const colorSet = new Set(usedColors);

    // Try some common unused colors first
    const candidates = [
      '#FF00FF', // Magenta (common transparent color)
      '#00FF00', // Bright green
      '#FF0080', // Hot pink
      '#80FF00', // Lime
      '#0080FF', // Blue
      '#8000FF'  // Purple
    ];

    for (const color of candidates) {
      if (!colorSet.has(color)) {
        return color;
      }
    }

    // Generate random colors until we find one not used
    for (let i = 0; i < 1000; i++) {
      const r = Math.floor(Math.random() * 256);
      const g = Math.floor(Math.random() * 256);
      const b = Math.floor(Math.random() * 256);
      const color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

      if (!colorSet.has(color)) {
        return color;
      }
    }

    console.warn('Could not find unused color for transparency');
    return '#FF00FF'; // Fallback to magenta
  }

  /**
   * Download a blob as a file
   */
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Export current sprite as PNG with current zoom scale
   */
  exportAsPNG(scale = 1) {
    if (!this.currentSprite) {
      console.warn("No current sprite to export");
      return;
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

    // Draw each pixel scaled up
    for (let y = 0; y < sprite.height; y++) {
      for (let x = 0; x < sprite.width; x++) {
        const pixel = sprite.getPixel(x, y);
        const [r, g, b, a] = pixel;

        if (a > 0) {
          // Only render non-transparent pixels
          exportCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
          exportCtx.fillRect(x * scale, y * scale, scale, scale);
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
  hexToRgba(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
        255,
      ]
      : [0, 0, 0, 255];
  }

  /**
   * Convert RGBA array to hex color
   */
  rgbaToHex(rgba) {
    const [r, g, b] = rgba;
    const toHex = (n) => Math.round(n).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
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
    if (
      confirm(
        "Are you sure you want to clear all sprites and reset the editor? This cannot be undone."
      )
    ) {
      this.sprites = [];
      this.storageManager.clearAll();
      this.createNewSprite();
      this.updateUI();

      this.uiManager.showNotification("Editor reset successfully", "success");
    }
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
