// Main Editor Class - Coordinates all components of the pixel editor
class PixelEditor {
  constructor() {
    // Core components
    this.canvasManager = null;
    this.uiManager = null;
    this.layerManager = null;
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
    if (!this.currentSprite || !this.layerManager) return;

    // Convert LayerManager data to Sprite format and save
    this.currentSprite.loadFromLayerManager(this.layerManager);

    // CRITICAL: Force immediate save, don't just debounce
    if (
      this.storageManager &&
      typeof this.storageManager.saveSprite === "function"
    ) {
      this.storageManager.saveSprite(this.currentSprite);
    }
  }

  // Replace the setCurrentSprite method
  // Replace the setCurrentSprite method
  setCurrentSprite(sprite) {
    this.currentSprite = sprite;
    if (sprite) {
      sprite.onChange = (s) => this.debouncedSave(s);

      // Load layers properly
      if (this.layerManager) {
        if (sprite.layers && sprite.layers.length > 0) {
          // Load existing layers
          this.layerManager.fromSprite(sprite);
        } else {
          // Create default layer from sprite pixels (backward compatibility)
          this.layerManager.resize(sprite.width, sprite.height);
          const activeLayer = this.layerManager.getActiveLayer();
          if (activeLayer) {
            activeLayer.pixels = sprite.getPixelArray();
            this.layerManager.notifyChange();
          }
        }
      }
    }

    // Set sprite in canvas manager and force immediate render
    this.canvasManager.setSprite(sprite);

    // Force immediate canvas render after setting sprite and layers
    if (this.canvasManager) {
      this.canvasManager.render();
    }

    this.updateUI();

    // CRITICAL FIX: Force layer UI update after everything is set
    if (this.uiManager && this.uiManager.forceLayerUIUpdate) {
      this.uiManager.forceLayerUIUpdate();
    }
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
      this.uiManager.showNotification("Cannot delete the last sprite", "error");
      return false;
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

    this.currentSprite.resize(width, height, maintainAspectRatio);
    this.canvasManager.updateCanvasSize();
    this.saveSprites();
    this.updateUI();

    this.uiManager.showNotification(
      `Canvas resized to ${width}×${height}`,
      "success"
    );
    return true;
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
          svgContent += `<rect x="${x * scale}" y="${
            y * scale
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
