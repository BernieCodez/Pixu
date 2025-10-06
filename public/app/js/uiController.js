// UI Controller - Handles user interface interactions and updates
class UIController {
  constructor(editor) {
    this.editor = editor;
    this.colorPicker = null;
    this.recentSpritesManager = null;

    this.canvasColors = new Set();
    this.canvasColorsPalette = null;

    // Multiselect support
    this.selectedLayerIndices = new Set();
    this.selectedSpriteIndices = new Set();
    this.selectedFrameIndices = new Set();
    this.lastSelectedLayerIndex = null;
    this.lastSelectedSpriteIndex = null;
    this.lastSelectedFrameIndex = null;

    this.colorMode = "hex";
    this.colorPalette = [
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
      "#ffa500",
      "#a52a2a",
      "#dda0dd",
      "#98fb98",
      "#f0e68c",
      "#deb887",
      "#5f9ea0",
      "#ff1493",
      "#00bfff",
      "#32cd32",
      "#ffb6c1",
      "#87ceeb",
      "#daa520",
      "#b22222",
      "#20b2aa",
      "#f08080",
    ];
    // Bind swap color method for event listeners
    this.swapPrimarySecondaryColor = this.swapPrimarySecondaryColor.bind(this);
    this.setupEventListeners();
    this.initializeColorPalette();
    this.initializeColorWheel();
    this.initializeRecentSprites();
    this.initializeLayers();
    this.setupColorInputListeners();
    this.setupColorModeToggle();
    this.setupSpriteNameInputListener();
    this.setupSecondaryColorSwitch();
    this.initializeCanvasColorsPalette();
  }

  initializeCanvasColorsPalette() {
    const canvasColorsContainer = document.getElementById(
      "canvas-colors-palette"
    );
    if (!canvasColorsContainer) {
      console.warn("Canvas colors palette container not found");
      return;
    }

    // Clear existing content
    // canvasColorsContainer.innerHTML =
    //   '<div class="palette-title">Canvas Colors</div>';

    // Create colors container
    const colorsContainer = document.createElement("div");
    colorsContainer.className = "canvas-colors-container";
    canvasColorsContainer.appendChild(colorsContainer);

    this.canvasColorsPalette = colorsContainer;

    // Initial scan for colors
    this.updateCanvasColorsPalette();
  }

  // Add this new method to UIController:
  updateCanvasColorsPalette() {
    if (!this.canvasColorsPalette || !this.editor.layerManager) {
      return;
    }

    // Collect all unique colors from all visible layers
    const newCanvasColors = new Set();

    this.editor.layerManager.layers.forEach((layer) => {
      if (!layer.visible || !layer.pixels) return;

      for (let y = 0; y < layer.pixels.length; y++) {
        for (let x = 0; x < layer.pixels[y].length; x++) {
          const pixel = layer.pixels[y][x];
          const [r, g, b, a] = pixel;

          // Only include non-transparent pixels
          if (a > 0) {
            // Create color key including alpha for semi-transparent colors
            const colorKey = `${r},${g},${b},${a}`;
            newCanvasColors.add(colorKey);
          }
        }
      }
    });

    // Check if colors have changed
    const currentColors = Array.from(this.canvasColors);
    const newColors = Array.from(newCanvasColors);

    if (
      currentColors.length !== newColors.length ||
      !currentColors.every((color) => newCanvasColors.has(color))
    ) {
      this.canvasColors = newCanvasColors;
      this.renderCanvasColorsPalette();
    }
  }

  // Add this new method to UIController:
  renderCanvasColorsPalette() {
  if (!this.canvasColorsPalette) return;

  this.canvasColorsPalette.innerHTML = "";

  if (this.canvasColors.size === 0) {
    const emptyMessage = document.createElement("div");
    emptyMessage.className = "empty-palette-message";
    emptyMessage.textContent = "No colors on canvas";
    emptyMessage.style.cssText = `
      color: #888;
      font-size: 12px;
      padding: 8px;
      text-align: center;
      font-style: italic;
    `;
    this.canvasColorsPalette.appendChild(emptyMessage);
    return;
  }

  // Convert colors to array and sort by brightness
  const colorsArray = Array.from(this.canvasColors)
    .map((colorKey) => {
      const [r, g, b, a] = colorKey.split(",").map(Number);
      const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      return { colorKey, r, g, b, a, brightness };
    })
    .sort((a, b) => b.brightness - a.brightness);

  // Create color swatches with proper transparency display
  colorsArray.forEach(({ colorKey, r, g, b, a }) => {
    const swatch = document.createElement("div");
    swatch.className = "canvas-color-swatch";
    swatch.style.cssText = `
      width: 20px;
      height: 20px;
      border: 1px solid #333;
      border-radius: 3px;
      cursor: pointer;
      margin: 2px;
      display: inline-block;
      position: relative;
      transition: transform 0.1s ease;
    `;

    // Always add checkerboard background
    swatch.style.backgroundImage = this.createCheckerboardBackground();
    swatch.style.backgroundSize = '6px 6px';

    // Add the color overlay
    const colorOverlay = document.createElement("div");
    colorOverlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(${r}, ${g}, ${b}, ${a / 255});
      border-radius: 2px;
    `;
    swatch.appendChild(colorOverlay);

    // Create hex representation for display
    const hex = this.rgbaToHex([r, g, b, 255]);
    swatch.setAttribute(
      "data-tooltip",
      `RGBA: (${r}, ${g}, ${b}, ${Math.round((a / 255) * 100)}%)\nHEX: ${hex}`
    );

    // Click handler to select color with full RGBA
    swatch.addEventListener("click", () => {
      // Remove selection from other swatches
      this.deselectColorPalette();
      document
        .querySelectorAll(".canvas-color-swatch")
        .forEach((s) => s.classList.remove("selected"));
      swatch.classList.add("selected");

      // Set as primary color with transparency
      this.editor.setPrimaryColor([r, g, b, a]);
      this.updateColorDisplay();
      this.updateColorInputs(hex, [r, g, b, a]);

      // Update color picker if available
      if (this.colorSquare) {
        this.updatePickerFromColor([r, g, b, a]);
      }
    });

    // Hover effects
    swatch.addEventListener("mouseenter", () => {
      swatch.style.transform = "scale(1.1)";
      swatch.style.zIndex = "10";
    });

    swatch.addEventListener("mouseleave", () => {
      swatch.style.transform = "scale(1)";
      swatch.style.zIndex = "1";
    });

    this.canvasColorsPalette.appendChild(swatch);
  });

  // Add color count info
  const colorCount = document.createElement("div");
  colorCount.className = "canvas-colors-count";
  colorCount.textContent = `${this.canvasColors.size} colors`;
  colorCount.style.cssText = `
    color: #aaa;
    font-size: 11px;
    margin-top: 4px;
    text-align: center;
  `;
  this.canvasColorsPalette.appendChild(colorCount);
}
  // Setup event listener for secondary color switching
  setupSecondaryColorSwitch() {
    const secondaryColor = document.getElementById("secondary-color");
    const primaryColor = document.getElementById("primary-color");
    if (primaryColor && secondaryColor) {
      secondaryColor.addEventListener("click", this.swapPrimarySecondaryColor);
      primaryColor.addEventListener("click", this.swapPrimarySecondaryColor);
    }
  }

  // Swap primary and secondary colors
  swapPrimarySecondaryColor() {
    if (this.editor.secondaryColor && this.editor.primaryColor) {
      const temp = this.editor.primaryColor;
      this.editor.setPrimaryColor(this.editor.secondaryColor);
      this.editor.setSecondaryColor(temp);
      this.updateColorDisplay();
      // Optionally update color inputs
      const hex = this.rgbaToHex(this.editor.primaryColor);
      this.updateColorInputs(hex, this.editor.primaryColor);
    }
  }

  // Replace the initializeColorWheel method in UIController class
  initializeColorWheel() {
    // Prevent duplicate initialization
    if (this.colorPicker || this.colorWheel) {
      console.warn("Color wheel already initialized");
      return;
    }

    const colorWheelContainer = document.getElementById("color-wheel");
    if (!colorWheelContainer) {
      console.warn("Color wheel container not found");
      return;
    }

    // Clear any existing content first


    // Create custom color picker with large square and two sliders
    this.createCustomColorPicker(colorWheelContainer);
  }

  createCustomColorPicker(container) {
    // Create the main picker container
    const pickerContainer = document.createElement("div");

    pickerContainer.style.cssText = `
      width: auto;
      height: auto;
      position: relative;
      margin: 0 auto;
    `;

    // Create the main color square (HSL saturation/lightness picker)
    const colorSquare = document.createElement("canvas");
    colorSquare.width = 200;
    colorSquare.height = 160;
    colorSquare.className = "color-square";
    colorSquare.style.cssText = `
      width: 200px;
      height: 160px;
      border: 1px solid #333;
      cursor: crosshair;
      display: block;
      margin-bottom: 8px;
      border-radius: 10px;
    `;

    // Create hue slider
    const hueSlider = document.createElement("canvas");
    hueSlider.width = 200;
    hueSlider.height = 20;
    hueSlider.className = "hue-slider";
    hueSlider.style.cssText = `
      width: 200px;
      height: 20px;
      border: 1px solid #333;
      cursor: pointer;
      display: block;
      margin-bottom: 8px;
      border-radius: 7px;
    `;

    // Create opacity slider
    const opacitySlider = document.createElement("canvas");
    opacitySlider.width = 200;
    opacitySlider.height = 20;
    opacitySlider.className = "opacity-slider";
    opacitySlider.style.cssText = `
      width: 200px;
      height: 20px;
      border: 1px solid #333;
      cursor: pointer;
      display: block;
      border-radius: 7px;
    `;

    // Add elements to container
    pickerContainer.appendChild(colorSquare);
    pickerContainer.appendChild(hueSlider);
    pickerContainer.appendChild(opacitySlider);
    container.appendChild(pickerContainer);

    // Initialize picker state
    this.pickerState = {
      hue: 0,
      saturation: 100,
      lightness: 50,
      opacity: 100,
      squareX: 200,
      squareY: 80,
      hueX: 0,
      opacityX: 200,
    };

    // Set up event handlers and render
    this.setupColorSquareEvents(colorSquare);
    this.setupHueSliderEvents(hueSlider);
    this.setupOpacitySliderEvents(opacitySlider);

    this.renderColorSquare(colorSquare);
    this.renderHueSlider(hueSlider);
    this.renderOpacitySlider(opacitySlider);

    // Store references
    this.colorSquare = colorSquare;
    this.hueSlider = hueSlider;
    this.opacitySlider = opacitySlider;
  }

  setupColorSquareEvents(canvas) {
    let isDragging = false;

    const updateColorFromSquare = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(200, e.clientX - rect.left));
      const y = Math.max(0, Math.min(160, e.clientY - rect.top));

      this.pickerState.squareX = x;
      this.pickerState.squareY = y;

      // Calculate saturation from X position (0 to 100%)
      this.pickerState.saturation = (x / 200) * 100;

      // Calculate lightness to match the actual rendering:
      // The rendering creates: saturation gradient (white->hue) + black overlay
      // This means we need to account for both the base lightness and the black overlay
      const verticalRatio = y / 160; // 0 at top, 1 at bottom
      const horizontalRatio = x / 200; // 0 at left, 1 at right

      // At the top (y=0): white (100% lightness) to pure hue (50% lightness)
      // At the bottom (y=160): black (0% lightness)
      // The horizontal position affects how much of the pure hue we see
      const baseLightness = 100 - horizontalRatio * 50; // 100% at left, 50% at right
      this.pickerState.lightness = baseLightness * (1 - verticalRatio);

      this.updateColorFromPicker();
    };

    canvas.addEventListener("mousedown", (e) => {
      isDragging = true;
      updateColorFromSquare(e);
    });

    document.addEventListener("mousemove", (e) => {
      if (isDragging) {
        updateColorFromSquare(e);
      }
    });

    document.addEventListener("mouseup", () => {
      isDragging = false;
    });
  }

  setupHueSliderEvents(canvas) {
    let isDragging = false;

    const updateHue = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(200, e.clientX - rect.left));

      this.pickerState.hueX = x;
      this.pickerState.hue = (x / 200) * 360;

      this.renderColorSquare(this.colorSquare);
      this.renderOpacitySlider(this.opacitySlider);
      this.updateColorFromPicker();
    };

    canvas.addEventListener("mousedown", (e) => {
      isDragging = true;
      updateHue(e);
    });

    document.addEventListener("mousemove", (e) => {
      if (isDragging) {
        updateHue(e);
      }
    });

    document.addEventListener("mouseup", () => {
      isDragging = false;
    });
  }

  setupOpacitySliderEvents(canvas) {
    let isDragging = false;

    const updateOpacity = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(200, e.clientX - rect.left));

      this.pickerState.opacityX = x;
      this.pickerState.opacity = (x / 200) * 100;

      this.updateColorFromPicker();
    };

    canvas.addEventListener("mousedown", (e) => {
      isDragging = true;
      updateOpacity(e);
    });

    document.addEventListener("mousemove", (e) => {
      if (isDragging) {
        updateOpacity(e);
      }
    });

    document.addEventListener("mouseup", () => {
      isDragging = false;
    });
  }

  renderColorSquare(canvas) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    // Create saturation gradient (left to right: white to pure hue)
    const saturationGradient = ctx.createLinearGradient(0, 0, width, 0);
    const hueColor = this.hslToRgb(this.pickerState.hue, 100, 50);
    saturationGradient.addColorStop(0, "white");
    saturationGradient.addColorStop(
      1,
      `rgb(${hueColor[0]}, ${hueColor[1]}, ${hueColor[2]})`
    );

    ctx.fillStyle = saturationGradient;
    ctx.fillRect(0, 0, width, height);

    // Create lightness gradient (top to bottom: transparent to black)
    const lightnessGradient = ctx.createLinearGradient(0, 0, 0, height);
    lightnessGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    lightnessGradient.addColorStop(1, "rgba(0, 0, 0, 1)");

    ctx.fillStyle = lightnessGradient;
    ctx.fillRect(0, 0, width, height);

    // Draw crosshair at current position
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 2;

    ctx.beginPath();
    ctx.arc(
      this.pickerState.squareX,
      this.pickerState.squareY,
      6,
      0,
      2 * Math.PI
    );
    ctx.stroke();

    ctx.shadowBlur = 0;
  }

  renderHueSlider(canvas) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    // Create rainbow gradient
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    const colors = [
      "rgb(255, 0, 0)", // Red
      "rgb(255, 255, 0)", // Yellow
      "rgb(0, 255, 0)", // Green
      "rgb(0, 255, 255)", // Cyan
      "rgb(0, 0, 255)", // Blue
      "rgb(255, 0, 255)", // Magenta
      "rgb(255, 0, 0)", // Red again
    ];

    for (let i = 0; i < colors.length; i++) {
      gradient.addColorStop(i / (colors.length - 1), colors[i]);
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Draw slider handle
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 2;

    ctx.beginPath();
    ctx.rect(this.pickerState.hueX - 2, 0, 4, height);
    ctx.stroke();

    ctx.shadowBlur = 0;
  }

  renderOpacitySlider(canvas) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    // Draw checkerboard background
    const checkSize = 8;
    for (let x = 0; x < width; x += checkSize) {
      for (let y = 0; y < height; y += checkSize) {
        const isEven =
          (Math.floor(x / checkSize) + Math.floor(y / checkSize)) % 2 === 0;
        ctx.fillStyle = isEven ? "#ccc" : "#fff";
        ctx.fillRect(x, y, checkSize, checkSize);
      }
    }

    // Create opacity gradient with current color
    const currentColor = this.hslToRgb(
      this.pickerState.hue,
      this.pickerState.saturation,
      this.pickerState.lightness
    );
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(
      0,
      `rgba(${currentColor[0]}, ${currentColor[1]}, ${currentColor[2]}, 0)`
    );
    gradient.addColorStop(
      1,
      `rgba(${currentColor[0]}, ${currentColor[1]}, ${currentColor[2]}, 1)`
    );

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Draw slider handle
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 2;

    ctx.beginPath();
    ctx.rect(this.pickerState.opacityX - 2, 0, 4, height);
    ctx.stroke();

    ctx.shadowBlur = 0;
  }

  updateColorFromPicker() {
    const rgb = this.hslToRgb(
      this.pickerState.hue,
      this.pickerState.saturation,
      this.pickerState.lightness
    );

    const rgba = [
      rgb[0],
      rgb[1],
      rgb[2],
      Math.round((this.pickerState.opacity / 100) * 255),
    ];
    const hex = this.rgbaToHex([rgb[0], rgb[1], rgb[2], 255]);

    this.editor.setPrimaryColor(rgba);
    this.updateColorDisplay();
    this.updateColorInputs(hex, rgba);
    this.deselectColorPalette();

    // Re-render all picker components
    this.renderColorSquare(this.colorSquare);
    this.renderHueSlider(this.hueSlider);
    this.renderOpacitySlider(this.opacitySlider);
  }

  // Add method to update picker when color is set from external source
  updatePickerFromColor(rgba) {
    if (!this.pickerState || !this.colorSquare) return;

    const [r, g, b, a] = rgba;
    const hsl = this.rgbToHsl(r, g, b);

    // Only update hue and saturation if the color isn't pure black or pure white
    // This prevents the indicator from snapping when dragging to black
    if (hsl[2] > 0.1 && hsl[2] < 99.9) {
      this.pickerState.hue = hsl[0];
      this.pickerState.saturation = hsl[1];
    } else if (hsl[2] >= 99.9) {
      // Pure white - set saturation to 0 but keep hue
      this.pickerState.saturation = 0;
    }
    // If pure black (hsl[2] <= 0.1), preserve existing hue and saturation values
    
    this.pickerState.lightness = hsl[2];
    this.pickerState.opacity = (a / 255) * 100;

    // Update marker positions
    this.pickerState.hueX = (this.pickerState.hue / 360) * 200;
    this.pickerState.squareX = (this.pickerState.saturation / 100) * 200;

    // Reverse the lightness calculation to find Y position
    const horizontalRatio = this.pickerState.squareX / 200;
    const baseLightness = 100 - horizontalRatio * 50;

    if (baseLightness > 0 && this.pickerState.lightness > 0) {
      const verticalRatio = 1 - this.pickerState.lightness / baseLightness;
      this.pickerState.squareY = Math.max(
        0,
        Math.min(160, verticalRatio * 160)
      );
    } else {
      this.pickerState.squareY = 160; // Bottom for pure black
    }

    this.pickerState.opacityX = (this.pickerState.opacity / 100) * 200;

    // Re-render all components
    this.renderColorSquare(this.colorSquare);
    this.renderHueSlider(this.hueSlider);
    this.renderOpacitySlider(this.opacitySlider);
  }

  rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h,
      s,
      l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }

    return [h * 360, s * 100, l * 100];
  }

  hslToRgb(h, s, l) {
    h = h / 360;
    s = s / 100;
    l = l / 100;

    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  initializeRecentSprites() {
    if (window.RecentSpritesManager) {
      this.recentSpritesManager = new RecentSpritesManager(this.editor);
      console.log("RecentSpritesManager initialized");
    } else {
      console.warn("RecentSpritesManager not available");
    }
  }

  initializeLayers() {
    this.setupLayerEventListeners();
    this.updateLayersList();
  }

  setupLayerEventListeners() {
    // Add layer button
    const addLayerBtn = document.getElementById("add-layer-btn");
    if (addLayerBtn) {
      addLayerBtn.addEventListener("click", () => {
        this.addNewLayer();
      });
    }

    // Delete layer button
    const deleteLayerBtn = document.getElementById("delete-layer-btn");
    if (deleteLayerBtn) {
      deleteLayerBtn.addEventListener("click", () => {
        this.deleteCurrentLayer();
      });
    }

    // Duplicate layer button
    const duplicateLayerBtn = document.getElementById("duplicate-layer-btn");
    if (duplicateLayerBtn) {
      duplicateLayerBtn.addEventListener("click", () => {
        this.duplicateCurrentLayer();
      });
    }

    // In the setupLayerEventListeners method, add after the duplicate layer button setup:
    const mergeLayerBtn = document.getElementById("merge-layer-btn");
    if (mergeLayerBtn) {
      mergeLayerBtn.addEventListener("click", () => {
        this.mergeLayerDown();
      });
    }
  }

  addNewLayer() {
    if (this.editor.layerManager) {
      try {
        const layer = this.editor.layerManager.addLayer();
        this.updateLayersList();
        this.showNotification(`Added ${layer.name}`, "success");
      } catch (error) {
        console.error("Failed to add layer:", error);
        this.showNotification("Failed to add layer", "error");
      }
    } else {
      this.showNotification("Layer system not available", "error");
    }
  }

  deleteCurrentLayer() {
    if (this.editor.layerManager) {
      try {
        const activeIndex = this.editor.layerManager.activeLayerIndex;
        const activeLayer = this.editor.layerManager.getActiveLayer();

        if (this.editor.layerManager.deleteLayer(activeIndex)) {
          this.updateLayersList();
          this.showNotification(`Deleted ${activeLayer.name}`, "success");
        } else {
          this.showNotification("Cannot delete the last layer", "error");
        }
      } catch (error) {
        console.error("Failed to delete layer:", error);
        this.showNotification("Failed to delete layer", "error");
      }
    } else {
      this.showNotification("Layer system not available", "error");
    }
  }

  duplicateCurrentLayer() {
    if (this.editor.layerManager) {
      try {
        const activeIndex = this.editor.layerManager.activeLayerIndex;
        const newLayer = this.editor.layerManager.duplicateLayer(activeIndex);

        if (newLayer) {
          this.updateLayersList();
          this.showNotification(
            `Duplicated layer: ${newLayer.name}`,
            "success"
          );
        } else {
          this.showNotification("Failed to duplicate layer", "error");
        }
      } catch (error) {
        console.error("Failed to duplicate layer:", error);
        this.showNotification("Failed to duplicate layer", "error");
      }
    } else {
      this.showNotification("Layer system not available", "error");
    }
  }

  updateLayerEventListeners() {
    // This method is called after updating the layers list
    // to set up event listeners for the new layer items
  }

  updateLayersList() {
    const layersList = document.getElementById("layers-list");
    if (!layersList) return;

    layersList.innerHTML = "";

    // CRITICAL FIX: Check if layerManager exists and has layers
    if (
      this.editor.layerManager &&
      this.editor.layerManager.layers &&
      this.editor.layerManager.layers.length > 0
    ) {
      const layers = this.editor.layerManager.layers;
      const activeIndex = this.editor.layerManager.activeLayerIndex;

      // Add layers in reverse order (top to bottom in UI)
      for (let i = layers.length - 1; i >= 0; i--) {
        const layer = layers[i];

        // SAFETY CHECK: Ensure layer exists
        if (!layer) continue;

        const layerItem = document.createElement("div");
        const isSelected = this.selectedLayerIndices.has(i);
        layerItem.className = `layer-item ${i === activeIndex ? "active" : ""} ${isSelected ? "multiselected" : ""}`;
        layerItem.setAttribute("draggable", "true");
        layerItem.dataset.index = i;

        layerItem.innerHTML = `
        <span class="drag-handle" data-tooltip="Drag to reorder">
          <i class="fas fa-grip-vertical"></i>
        </span>
        <span class="layer-name">${layer.name || `Layer ${i + 1}`}</span>
        <input type="range" class="layer-opacity-slider" min="0" max="100" value="${Math.round(
          (layer.opacity || 1) * 100
        )}" data-tooltip="Opacity" />
        <span class="layer-opacity-value">${Math.round(
          (layer.opacity || 1) * 100
        )}%</span>
        <button class="btn btn-sm layer-visibility" data-tooltip="Toggle Visibility">
          <i class="fas ${
            layer.visible !== false ? "fa-eye" : "fa-eye-slash"
          }"></i>
        </button>
      `;

        // Click to select layer with multiselect support
        layerItem.addEventListener("click", (e) => {
          // Only select if not clicking slider or button
          if (
            !e.target.classList.contains("layer-opacity-slider") &&
            !e.target.classList.contains("layer-visibility") &&
            !e.target.closest(".layer-visibility")
          ) {
            this.handleLayerSelection(i, e.ctrlKey || e.metaKey, e.shiftKey);
          }
        });

        // Right-click context menu for layers
        layerItem.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          this.showLayerContextMenu(e, layer, i);
        });

        // Opacity slider event
        const opacitySlider = layerItem.querySelector(".layer-opacity-slider");
        const opacityValue = layerItem.querySelector(".layer-opacity-value");
        opacitySlider.addEventListener("input", (e) => {
          const value = parseInt(e.target.value, 10);
          this.editor.layerManager.setLayerOpacity(i, value / 100);
          opacityValue.textContent = `${value}%`;
        });

        // Visibility toggle event
        const visibilityBtn = layerItem.querySelector(".layer-visibility");
        visibilityBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.editor.layerManager.setLayerVisibility(i, !layer.visible);
          this.updateLayersList();
        });

        // Drag and drop events
        layerItem.addEventListener("dragstart", (e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", i);
          layerItem.classList.add("dragging");
        });
        layerItem.addEventListener("dragend", (e) => {
          layerItem.classList.remove("dragging");
        });
        layerItem.addEventListener("dragover", (e) => {
          e.preventDefault();
          
          // Determine if hovering over top or bottom half
          const rect = layerItem.getBoundingClientRect();
          const mouseY = e.clientY - rect.top;
          const isTopHalf = mouseY < rect.height / 2;
          
          // Update visual indicator
          layerItem.classList.remove("drag-over-before", "drag-over-after");
          if (isTopHalf) {
            layerItem.classList.add("drag-over-before");
          } else {
            layerItem.classList.add("drag-over-after");
          }
        });
        layerItem.addEventListener("dragleave", (e) => {
          layerItem.classList.remove("drag-over-before", "drag-over-after");
        });
        layerItem.addEventListener("drop", (e) => {
          e.preventDefault();
          layerItem.classList.remove("drag-over-before", "drag-over-after");
          
          const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
          
          // Determine drop position based on mouse position
          const rect = layerItem.getBoundingClientRect();
          const mouseY = e.clientY - rect.top;
          const isTopHalf = mouseY < rect.height / 2;
          
          // Calculate target index: insert before (top) or after (bottom)
          let toIndex = isTopHalf ? i : i + 1;
          
          if (fromIndex !== toIndex && fromIndex !== toIndex - 1) {
            this.editor.layerManager.moveLayer(fromIndex, toIndex);
            this.updateLayersList();
          }
        });

        layersList.appendChild(layerItem);
      }
    } else {
      // Fallback for when layer manager is not available or has no layers
      layersList.innerHTML = `
      <div class="layer-item layer-item-fallback active">
          <span>Layer 1 (Basic)</span>
      </div>
    `;
    }
    this.updateCanvasColorsPalette();
  }
  // Add this method to UIController:
  mergeAllVisible() {
    if (!this.editor.layerManager) {
      this.showNotification("Layer system not available", "error");
      return;
    }

    const visibleLayers = this.editor.layerManager.layers.filter(
      (layer) => layer.visible
    );

    if (visibleLayers.length < 2) {
      this.showNotification(
        "Need at least 2 visible layers to merge",
        "warning"
      );
      return;
    }

    this.showCustomConfirm(
      `Merge all ${visibleLayers.length} visible layers? This cannot be undone.`,
      () => {
        try {
          this.editor.layerManager.mergeAllVisible();
          this.updateLayersList();
          this.showNotification("Merged all visible layers", "success");
          if (this.editor.canvasManager) {
            this.editor.canvasManager.render();
          }
        } catch (error) {
          console.error("Failed to merge all visible layers:", error);
          this.showNotification("Failed to merge layers", "error");
        }
      }
    );
  }
  // Add this new method to UIController class:
  mergeLayerDown() {
    if (this.editor.layerManager) {
      const activeIndex = this.editor.layerManager.activeLayerIndex;

      if (activeIndex <= 0) {
        this.showNotification("Cannot merge bottom layer", "warning");
        return;
      }

      const activeLayer = this.editor.layerManager.getActiveLayer();
      const targetLayer = this.editor.layerManager.getLayer(activeIndex - 1);

      if (targetLayer.locked) {
        this.showNotification("Cannot merge into locked layer", "error");
        return;
      }

      try {
        // this.showCustomConfirm(
        //   `Merge "${activeLayer.name}" into "${targetLayer.name}"? This cannot be undone.`,
        //   () => {
        const success = this.editor.layerManager.mergeDown(activeIndex);
        if (success) {
          this.updateLayersList();
          this.showNotification(`Merged layers successfully`, "success");
          // Force canvas render
          if (this.editor.canvasManager) {
            this.editor.canvasManager.render();
          }
        } else {
          this.showNotification("Failed to merge layers", "error");
        }
        //   }
        // );
      } catch (error) {
        console.error("Failed to merge layer:", error);
        this.showNotification("Failed to merge layer", "error");
      }
    } else {
      this.showNotification("Layer system not available", "error");
    }
  }

  // Multiselect handler for layers
  handleLayerSelection(index, ctrlKey, shiftKey) {
    if (shiftKey && this.lastSelectedLayerIndex !== null) {
      // Shift-click: select range
      this.selectedLayerIndices.clear();
      const start = Math.min(this.lastSelectedLayerIndex, index);
      const end = Math.max(this.lastSelectedLayerIndex, index);
      for (let i = start; i <= end; i++) {
        this.selectedLayerIndices.add(i);
      }
    } else if (ctrlKey) {
      // Ctrl-click: toggle individual selection
      if (this.selectedLayerIndices.has(index)) {
        this.selectedLayerIndices.delete(index);
      } else {
        this.selectedLayerIndices.add(index);
      }
      this.lastSelectedLayerIndex = index;
    } else {
      // Regular click: select single layer
      this.selectedLayerIndices.clear();
      this.selectedLayerIndices.add(index);
      this.lastSelectedLayerIndex = index;
    }
    
    // Set active layer
    this.editor.layerManager.setActiveLayer(index);
    this.updateLayersList();
  }

  // Multiselect handler for sprites
  handleSpriteSelection(index, ctrlKey, shiftKey, sprite) {
    if (shiftKey && this.lastSelectedSpriteIndex !== null) {
      // Shift-click: select range
      this.selectedSpriteIndices.clear();
      const start = Math.min(this.lastSelectedSpriteIndex, index);
      const end = Math.max(this.lastSelectedSpriteIndex, index);
      for (let i = start; i <= end; i++) {
        this.selectedSpriteIndices.add(i);
      }
    } else if (ctrlKey) {
      // Ctrl-click: toggle individual selection
      if (this.selectedSpriteIndices.has(index)) {
        this.selectedSpriteIndices.delete(index);
      } else {
        this.selectedSpriteIndices.add(index);
      }
      this.lastSelectedSpriteIndex = index;
    } else {
      // Regular click: select single sprite
      this.selectedSpriteIndices.clear();
      this.selectedSpriteIndices.add(index);
      this.lastSelectedSpriteIndex = index;
    }
    
    // Set current sprite
    this.editor.setCurrentSprite(sprite);
    this.updateSpritesList();
  }

  // Multiselect handler for frames
  handleFrameSelection(index, ctrlKey, shiftKey) {
    if (shiftKey && this.lastSelectedFrameIndex !== null) {
      // Shift-click: select range
      this.selectedFrameIndices.clear();
      const start = Math.min(this.lastSelectedFrameIndex, index);
      const end = Math.max(this.lastSelectedFrameIndex, index);
      for (let i = start; i <= end; i++) {
        this.selectedFrameIndices.add(i);
      }
    } else if (ctrlKey) {
      // Ctrl-click: toggle individual selection
      if (this.selectedFrameIndices.has(index)) {
        this.selectedFrameIndices.delete(index);
      } else {
        this.selectedFrameIndices.add(index);
      }
      this.lastSelectedFrameIndex = index;
    } else {
      // Regular click: select single frame
      this.selectedFrameIndices.clear();
      this.selectedFrameIndices.add(index);
      this.lastSelectedFrameIndex = index;
    }
    
    // Set current frame
    this.editor.animationManager.setCurrentFrame(index);
    this.updateFramesList();
    this.updateLayersList();
  }

  // Bulk delete selected layers
  deleteSelectedLayers() {
    if (this.selectedLayerIndices.size === 0) {
      this.showNotification("No layers selected", "warning");
      return;
    }

    const count = this.selectedLayerIndices.size;
    const remainingLayers = this.editor.layerManager.layers.length - count;

    if (remainingLayers < 1) {
      this.showNotification("Cannot delete all layers", "error");
      return;
    }

    this.showCustomConfirm(
      `Delete ${count} selected layer${count > 1 ? 's' : ''}?`,
      () => {
        // Convert to array and sort in descending order to delete from end first
        const indices = Array.from(this.selectedLayerIndices).sort((a, b) => b - a);
        
        indices.forEach(index => {
          this.editor.layerManager.deleteLayer(index);
        });

        this.selectedLayerIndices.clear();
        this.showNotification(`Deleted ${count} layer${count > 1 ? 's' : ''}`, "success");
        this.updateLayersList();
      }
    );
  }

  // Bulk delete selected sprites
  deleteSelectedSprites() {
    if (this.selectedSpriteIndices.size === 0) {
      this.showNotification("No sprites selected", "warning");
      return;
    }

    const count = this.selectedSpriteIndices.size;
    const remainingSprites = this.editor.sprites.length - count;

    if (remainingSprites < 1) {
      this.showNotification("Cannot delete all sprites", "error");
      return;
    }

    this.showCustomConfirm(
      `Delete ${count} selected sprite${count > 1 ? 's' : ''}?`,
      () => {
        // Convert to array and sort in descending order to delete from end first
        const indices = Array.from(this.selectedSpriteIndices).sort((a, b) => b - a);
        
        indices.forEach(index => {
          this.editor.deleteSprite(index);
        });

        this.selectedSpriteIndices.clear();
        this.showNotification(`Deleted ${count} sprite${count > 1 ? 's' : ''}`, "success");
        this.updateSpritesList();
      }
    );
  }

  // Bulk delete selected frames
  deleteSelectedFrames() {
    if (this.selectedFrameIndices.size === 0) {
      this.showNotification("No frames selected", "warning");
      return;
    }

    const sprite = this.editor.currentSprite;
    if (!sprite || !sprite.frames) {
      this.showNotification("No sprite active", "error");
      return;
    }

    const count = this.selectedFrameIndices.size;
    const remainingFrames = sprite.frames.length - count;

    if (remainingFrames < 1) {
      this.showNotification("Cannot delete all frames", "error");
      return;
    }

    this.showCustomConfirm(
      `Delete ${count} selected frame${count > 1 ? 's' : ''}?`,
      () => {
        // Convert to array and sort in descending order to delete from end first
        const indices = Array.from(this.selectedFrameIndices).sort((a, b) => b - a);
        
        indices.forEach(index => {
          this.editor.animationManager.deleteFrame(index);
        });

        this.selectedFrameIndices.clear();
        this.showNotification(`Deleted ${count} frame${count > 1 ? 's' : ''}`, "success");
        this.updateFramesList();
      }
    );
  }

  // Add this method to UIController class to force layer UI update
  forceLayerUIUpdate() {
    // Force update layers list after a short delay to ensure layer manager is ready
    setTimeout(() => {
      this.updateLayersList();
    }, 50);
  }

  showLayerContextMenu(event, layer, index) {
    // Remove any existing context menu
    this.hideContextMenu();

    const contextMenu = document.createElement("div");
    contextMenu.className = "layer-context-menu";
    contextMenu.style.cssText = `
            position: fixed;
            background: #2d2d2d;
            border: 1px solid #444;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            min-width: 160px;
            padding: 4px 0;
            font-family: system-ui, -apple-system, sans-serif;
            color: white;
            font-size: 14px;
        `;

    // Check if multiple layers are selected
    const multipleSelected = this.selectedLayerIndices.size > 1;
    const selectedCount = this.selectedLayerIndices.size;

    const menuItems = multipleSelected ? [
      // Bulk operations menu
      {
        label: `Delete ${selectedCount} Layers`,
        icon: "fas fa-trash",
        action: () => {
          this.deleteSelectedLayers();
          this.hideContextMenu();
        },
        danger: true,
      },
      {
        label: "Deselect All",
        icon: "fas fa-times",
        action: () => {
          this.selectedLayerIndices.clear();
          this.updateLayersList();
          this.hideContextMenu();
        },
      },
    ] : [
      {
        label: "Duplicate Layer",
        icon: "fas fa-copy",
        action: () => {
          this.editor.layerManager.duplicateLayer(index);
          this.updateLayersList();
          this.hideContextMenu();
        },
      },
      {
        label: "Rename Layer",
        icon: "fas fa-edit",
        action: () => {
          this.showLayerRenameDialog(layer, index);
          this.hideContextMenu();
        },
      },
      { type: "separator" },
      {
        label: "Move Up",
        icon: "fas fa-arrow-up",
        action: () => {
          if (index < this.editor.layerManager.layers.length - 1) {
            this.editor.layerManager.moveLayer(index, index + 1);
            this.updateLayersList();
          }
          this.hideContextMenu();
        },
        disabled: index >= this.editor.layerManager.layers.length - 1,
      },
      {
        label: "Move Down",
        icon: "fas fa-arrow-down",
        action: () => {
          if (index > 0) {
            this.editor.layerManager.moveLayer(index, index - 1);
            this.updateLayersList();
          }
          this.hideContextMenu();
        },
        disabled: index <= 0,
      },
      { type: "separator" },
      {
        label: "Delete Layer",
        icon: "fas fa-trash",
        action: () => {
          this.showCustomConfirm(
            `Are you sure you want to delete "${layer.name}"?`,
            () => {
              if (this.editor.layerManager.deleteLayer(index)) {
                this.updateLayersList();
                this.showNotification(`Deleted ${layer.name}`, "success");
              } else {
                this.showNotification("Cannot delete the last layer", "error");
              }
            }
          );
          this.hideContextMenu();
        },
        danger: true,
        disabled: this.editor.layerManager.layers.length <= 1,
      },
      // Update the layer context menu in showLayerContextMenu method by adding this item after "Duplicate Layer":
      {
        label: "Merge Down",
        icon: "fas fa-compress-arrows-alt",
        action: () => {
          if (index <= 0) {
            this.showNotification("Cannot merge bottom layer", "warning");
          } else {
            const targetLayer = this.editor.layerManager.getLayer(index - 1);
            this.showCustomConfirm(
              `Merge "${layer.name}" into "${targetLayer.name}"?`,
              () => {
                const success = this.editor.layerManager.mergeDown(index);
                if (success) {
                  this.updateLayersList();
                  this.showNotification(
                    "Merged layers successfully",
                    "success"
                  );
                }
              }
            );
          }
          this.hideContextMenu();
        },
        disabled:
          index <= 0 || this.editor.layerManager.getLayer(index - 1)?.locked,
      },
    ];

    menuItems.forEach((item) => {
      if (item.type === "separator") {
        const separator = document.createElement("div");
        separator.style.cssText = `
                    height: 1px;
                    background: #444;
                    margin: 4px 0;
                `;
        contextMenu.appendChild(separator);
      } else {
        const menuItem = document.createElement("div");
        menuItem.style.cssText = `
                    padding: 8px 12px;
                    cursor: ${item.disabled ? "not-allowed" : "pointer"};
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: background-color 0.15s ease;
                    opacity: ${item.disabled ? "0.5" : "1"};
                    ${item.danger && !item.disabled ? "color: #ff6b6b;" : ""}
                `;
        menuItem.innerHTML = `
                    <i class="${item.icon}" style="width: 14px;"></i>
                    <span>${item.label}</span>
                `;

        if (!item.disabled) {
          menuItem.addEventListener("mouseenter", () => {
            menuItem.style.backgroundColor = item.danger
              ? "rgba(255, 107, 107, 0.1)"
              : "rgba(255, 255, 255, 0.1)";
          });

          menuItem.addEventListener("mouseleave", () => {
            menuItem.style.backgroundColor = "transparent";
          });

          menuItem.addEventListener("click", item.action);
        }

        contextMenu.appendChild(menuItem);
      }
    });

    // Position the context menu
    let left = event.clientX;
    let top = event.clientY;

    // Ensure menu stays within viewport
    if (left + 160 > window.innerWidth) {
      left = window.innerWidth - 160 - 10;
    }
    if (top + 300 > window.innerHeight) {
      top = window.innerHeight - 300 - 10;
    }

    contextMenu.style.left = `${left}px`;
    contextMenu.style.top = `${top}px`;

    document.body.appendChild(contextMenu);
    this.activeContextMenu = contextMenu;

    // Close menu when clicking outside
    document.addEventListener(
      "click",
      this.handleContextMenuOutsideClick.bind(this),
      { once: true }
    );
  }

  showLayerRenameDialog(layer, index) {
    // Create modal overlay
    const modal = document.createElement("div");
    modal.className = "rename-modal-overlay";
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(3px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease-out;
    `;

    // Create modal content
    const modalContent = document.createElement("div");
    modalContent.className = "rename-modal-content";
    modalContent.style.cssText = `
        background: #2d2d2d;
        border: 1px solid #444;
        border-radius: 12px;
        padding: 24px;
        min-width: 320px;
        max-width: 90vw;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        color: #fff;
        animation: slideIn 0.2s ease-out;
    `;

    modalContent.innerHTML = `
        <h3 style="
            color: #00d4ff;
            font-size: 18px;
            margin: 0 0 20px 0;
            text-align: center;
        ">Rename Layer</h3>
        
        <div class="input-group" style="margin-bottom: 20px;">
            <label for="layer-name-input" style="
                display: block;
                color: #ccc;
                font-size: 14px;
                font-weight: 500;
                margin-bottom: 8px;
            ">Layer Name:</label>
            <input type="text" id="layer-name-input" value="${layer.name}" style="
                width: 100%;
                padding: 10px 12px;
                border: 1px solid #444;
                border-radius: 6px;
                background: #1a1a1a;
                color: #fff;
                font-size: 14px;
                box-sizing: border-box;
                transition: border-color 0.2s, box-shadow 0.2s;
            ">
        </div>
        
        <div style="
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        ">
            <button id="layer-rename-cancel" class="btn btn-secondary" style="
                background: #444;
                color: #fff;
                border: 1px solid #555;
                border-radius: 6px;
                padding: 8px 16px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 6px;
            ">Cancel</button>
            <button id="layer-rename-confirm" class="btn btn-primary" style="
                background: #00d4ff;
                color: #1a1a1a;
                border: none;
                border-radius: 6px;
                padding: 8px 16px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 6px;
            ">Rename</button>
        </div>
    `;

    // Add CSS animations
    const style = document.createElement("style");
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes slideIn {
            from { 
                opacity: 0;
                transform: translateY(-10px) scale(0.95);
            }
            to { 
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
        
        .rename-modal-content input:focus {
            outline: none;
            border-color: #00d4ff !important;
            box-shadow: 0 0 0 2px rgba(0, 212, 255, 0.3) !important;
        }
        
        .rename-modal-content .btn:hover {
            transform: translateY(-1px);
        }
        
        .rename-modal-content .btn-secondary:hover {
            background: #555 !important;
            border-color: #666 !important;
        }
        
        .rename-modal-content .btn-primary:hover {
            background: #00bae6 !important;
        }
    `;

    document.head.appendChild(style);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Get elements
    const input = modal.querySelector("#layer-name-input");
    const cancelBtn = modal.querySelector("#layer-rename-cancel");
    const confirmBtn = modal.querySelector("#layer-rename-confirm");

    // Focus and select text after a brief delay to ensure visibility
    setTimeout(() => {
      input.focus();
      input.select();
    }, 50);

    const cleanup = () => {
      document.head.removeChild(style);
      document.body.removeChild(modal);
    };

    const handleRename = () => {
      const newName = input.value.trim();
      if (newName && newName !== layer.name) {
        layer.name = newName;
        this.updateLayersList();
        if (this.showNotification) {
          this.showNotification(`Renamed layer to "${newName}"`, "success");
        }
      }
      cleanup();
    };

    const handleCancel = () => {
      cleanup();
    };

    // Event listeners
    confirmBtn.addEventListener("click", handleRename);
    cancelBtn.addEventListener("click", handleCancel);

    // Handle keyboard events
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleRename();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    });

    // Close on outside click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        handleCancel();
      }
    });

    // Prevent modal content clicks from closing
    modalContent.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }

  // Setup event listeners for UI elements
  setupEventListeners() {
    // Header buttons
    this.setupHeaderButtons();

    // Tool buttons
    this.setupToolButtons();

    // Canvas controls
    this.setupCanvasControls();

    // Modal controls
    this.setupModals();

    // Keyboard shortcuts
    this.setupKeyboardShortcuts();

    this.setupFrameControls();
  }

  setupFrameControls() {
    // Frame control buttons
    const addFrameBtn = document.getElementById("add-frame-btn");
    const duplicateFrameBtn = document.getElementById("duplicate-frame-btn");
    const deleteFrameBtn = document.getElementById("delete-frame-btn");

    if (addFrameBtn) {
      addFrameBtn.addEventListener("click", () => {
        if (this.editor.animationManager) {
          this.editor.animationManager.addFrame();
          this.updateFramesList();
          this.showNotification("Frame added", "success");
        }
      });
    }

    if (duplicateFrameBtn) {
      duplicateFrameBtn.addEventListener("click", () => {
        if (this.editor.animationManager) {
          this.editor.animationManager.duplicateFrame();
          this.updateFramesList();
          this.showNotification("Frame duplicated", "success");
        }
      });
    }

    if (deleteFrameBtn) {
      deleteFrameBtn.addEventListener("click", () => {
        if (this.editor.animationManager) {
          const success = this.editor.animationManager.deleteFrame();
          if (success) {
            this.updateFramesList();
            this.showNotification("Frame deleted", "success");
          } else {
            this.showNotification("Cannot delete the last frame", "warning");
          }
        }
      });
    }

    // Add frames panel toggle functionality
    this.setupFramesToggle();

    // Add animation controls
    this.setupAnimationControls();
  }

  setupFramesToggle() {
    const framesToggleBtn = document.getElementById("frames-toggle-btn");
    const framesRow = document.getElementById("frames-row");

    if (framesToggleBtn && framesRow) {
      // Load saved state from localStorage
      const isCollapsed =
        localStorage.getItem("frames-panel-collapsed") === "true";
      if (isCollapsed) {
        framesRow.classList.add("collapsed");
      }

      framesToggleBtn.addEventListener("click", () => {
        const isCurrentlyCollapsed = framesRow.classList.contains("collapsed");

        if (isCurrentlyCollapsed) {
          framesRow.classList.remove("collapsed");
          localStorage.setItem("frames-panel-collapsed", "false");
          // if (this.showNotification) {
          //   // this.showNotification("Frames panel expanded", "info");
          // }
        } else {
          framesRow.classList.add("collapsed");
          localStorage.setItem("frames-panel-collapsed", "true");
          // if (this.showNotification) {
          //   this.showNotification("Frames panel collapsed", "info");
          // }
        }
      });
    }
  }

  setupAnimationControls() {
    // Create animation controls if they don't exist
    const framesToolbar = document.querySelector(".frames-toolbar");
    if (framesToolbar && !document.getElementById("play-btn")) {
      const animationControls = document.createElement("div");
      animationControls.className = "animation-controls";
      animationControls.innerHTML = `
      <button class="btn btn-sm" id="play-btn">
        <i class="fas fa-play"></i>
      </button>
      <button class="btn btn-sm" id="stop-btn" >
        <i class="fas fa-stop"></i>
      </button>
      <div class="fps-control" style="display: inline-block; margin-left: 8px;">
        <label for="fps-input" style="font-size: 12px; margin-right: 4px;">FPS:</label>
        <input type="number" id="fps-input" min="1" max="60" value="12" 
               style="width: 50px; padding: 2px; border: 1px solid #444; background: #1a1a1a; color: white; border-radius: 3px;">
      </div>
    `;
      framesToolbar.appendChild(animationControls);

      // Add event listeners
      const playBtn = document.getElementById("play-btn");
      const stopBtn = document.getElementById("stop-btn");
      const fpsInput = document.getElementById("fps-input");

      if (playBtn) {
        playBtn.addEventListener("click", () => {
          if (this.editor.animationManager) {
            if (this.editor.animationManager.isPlaying) {
              this.editor.animationManager.stop();
              playBtn.innerHTML = '<i class="fas fa-play"></i>';
              playBtn.title = "Play Animation";
            } else {
              this.editor.animationManager.play();
              playBtn.innerHTML = '<i class="fas fa-pause"></i>';
              playBtn.title = "Pause Animation";
            }
          }
        });
      }

      if (stopBtn) {
        stopBtn.addEventListener("click", () => {
          if (this.editor.animationManager) {
            this.editor.animationManager.stop();
            if (playBtn) {
              playBtn.innerHTML = '<i class="fas fa-play"></i>';
              playBtn.title = "Play Animation";
            }
          }
        });
      }

      if (fpsInput) {
        fpsInput.addEventListener("change", (e) => {
          const fps = parseInt(e.target.value);
          if (this.editor.animationManager && fps > 0 && fps <= 60) {
            this.editor.animationManager.setFrameRate(fps);
          }
        });
      }
    }
  }

  // Update frames list UI
  updateFramesList() {
    const framesList = document.getElementById("frames-list");
    if (!framesList || !this.editor.animationManager) return;

    const sprite = this.editor.currentSprite;
    if (!sprite || !sprite.frames) {
      framesList.innerHTML = '<div class="no-frames">No frames</div>';
      return;
    }

    // Clear existing frames
    framesList.innerHTML = "";

    // Create frame thumbnails
    sprite.frames.forEach((frame, index) => {
      const frameItem = document.createElement("div");
      const isSelected = this.selectedFrameIndices.has(index);
      frameItem.className = `frame-item ${
        index === this.editor.animationManager.currentFrameIndex ? "active" : ""
      } ${isSelected ? "multiselected" : ""}`;
      frameItem.draggable = true;
      frameItem.dataset.frameIndex = index;

      // Create thumbnail canvas
      const thumbnail = document.createElement("canvas");
      thumbnail.width = 64;
      thumbnail.height = 64;
      thumbnail.className = "frame-thumbnail";
      const ctx = thumbnail.getContext("2d");

      // Render frame thumbnail
      this.renderFrameThumbnail(ctx, frame, 64, 64);

      // Create frame info
      const frameInfo = document.createElement("div");
      frameInfo.className = "frame-info";
      frameInfo.innerHTML = `
      <div class="frame-name">${frame.name || `Frame ${index + 1}`}</div>
      <div class="frame-number">${index + 1}</div>
    `;

      frameItem.appendChild(thumbnail);
      frameItem.appendChild(frameInfo);

      // Add event listeners with multiselect support
      frameItem.addEventListener("click", (e) => {
        this.handleFrameSelection(index, e.ctrlKey || e.metaKey, e.shiftKey);
      });

      // ADDED: Right-click context menu for frame export
      frameItem.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent event bubbling
        this.showFrameContextMenu(e, frame, index);
      });

      // Double-click to rename
      frameInfo.addEventListener("dblclick", () => {
        this.editFrameName(frame, frameInfo.querySelector(".frame-name"));
      });

      // Existing drag and drop code...
      frameItem.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", index.toString());
        frameItem.classList.add("dragging");
      });

      frameItem.addEventListener("dragend", () => {
        frameItem.classList.remove("dragging");
      });

      frameItem.addEventListener("dragover", (e) => {
        e.preventDefault();
        
        // Determine if hovering over left or right half
        const rect = frameItem.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const isLeftHalf = mouseX < rect.width / 2;
        
        // Update visual indicator
        frameItem.classList.remove("drag-over-before", "drag-over-after");
        if (isLeftHalf) {
          frameItem.classList.add("drag-over-before");
        } else {
          frameItem.classList.add("drag-over-after");
        }
      });

      frameItem.addEventListener("dragleave", () => {
        frameItem.classList.remove("drag-over-before", "drag-over-after");
      });

      frameItem.addEventListener("drop", (e) => {
        e.preventDefault();
        frameItem.classList.remove("drag-over-before", "drag-over-after");

        const fromIndex = parseInt(e.dataTransfer.getData("text/plain"));
        
        // Determine drop position based on mouse position
        const rect = frameItem.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const isLeftHalf = mouseX < rect.width / 2;
        
        // Calculate target index: insert before (left) or after (right)
        let toIndex = isLeftHalf ? index : index + 1;

        if (fromIndex !== toIndex && fromIndex !== toIndex - 1) {
          this.editor.animationManager.moveFrame(fromIndex, toIndex);
          this.updateFramesList();
        }
      });

      framesList.appendChild(frameItem);
    });

    this.updateFrameDisplay();
    this.updateCanvasColorsPalette();
  }

  showFrameContextMenu(event, frame, frameIndex) {
    this.hideContextMenu();

    const contextMenu = document.createElement("div");
    contextMenu.className = "frame-context-menu";
    contextMenu.style.cssText = `
    position: fixed;
    background: #2d2d2d;
    border: 1px solid #444;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    min-width: 180px;
    padding: 4px 0;
    font-family: system-ui, -apple-system, sans-serif;
    color: white;
    font-size: 14px;
  `;

    // Check if multiple frames are selected
    const multipleSelected = this.selectedFrameIndices.size > 1;
    const selectedCount = this.selectedFrameIndices.size;

    const menuItems = multipleSelected ? [
      // Bulk operations menu
      {
        label: `Delete ${selectedCount} Frames`,
        icon: "fas fa-trash",
        action: () => {
          this.deleteSelectedFrames();
          this.hideContextMenu();
        },
        danger: true,
      },
      {
        label: "Deselect All",
        icon: "fas fa-times",
        action: () => {
          this.selectedFrameIndices.clear();
          this.updateFramesList();
          this.hideContextMenu();
        },
      },
    ] : [
      {
        label: "Export Frame (1x)",
        icon: "fas fa-download",
        action: () => {
          this.editor.exportSingleFrame(frameIndex, 1);
          this.hideContextMenu();
        },
      },
      {
        label: "Export Frame (4x)",
        icon: "fas fa-download",
        action: () => {
          this.editor.exportSingleFrame(frameIndex, 4);
          this.hideContextMenu();
        },
      },
      {
        label: "Export Frame (10x)",
        icon: "fas fa-download",
        action: () => {
          this.editor.exportSingleFrame(frameIndex, 10);
          this.hideContextMenu();
        },
      },
      { type: "separator" },
      {
        label: "Duplicate Frame",
        icon: "fas fa-copy",
        action: () => {
          this.editor.animationManager.duplicateFrame(frameIndex);
          this.updateFramesList();
          this.hideContextMenu();
        },
      },
      {
        label: "Delete Frame",
        icon: "fas fa-trash",
        action: () => {
          if (this.editor.currentSprite.frames.length > 1) {
            this.showCustomConfirm(
              `Delete "${frame.name || `Frame ${frameIndex + 1}`}"?`,
              () => {
                this.editor.animationManager.deleteFrame(frameIndex);
                this.updateFramesList();
              }
            );
          } else {
            this.showNotification("Cannot delete the last frame", "warning");
          }
          this.hideContextMenu();
        },
        danger: true,
        disabled: this.editor.currentSprite.frames.length <= 1,
      },
    ];

    // Build menu items
    menuItems.forEach((item) => {
      if (item.type === "separator") {
        const separator = document.createElement("div");
        separator.style.cssText =
          "height: 1px; background: #444; margin: 4px 0;";
        contextMenu.appendChild(separator);
      } else {
        const menuItem = document.createElement("div");
        menuItem.style.cssText = `
        padding: 8px 12px;
        cursor: ${item.disabled ? "not-allowed" : "pointer"};
        display: flex;
        align-items: center;
        gap: 8px;
        transition: background-color 0.15s ease;
        opacity: ${item.disabled ? "0.5" : "1"};
        ${item.danger && !item.disabled ? "color: #ff6b6b;" : ""}
      `;

        menuItem.innerHTML = `
        <i class="${item.icon}" style="width: 14px;"></i>
        <span>${item.label}</span>
      `;

        if (!item.disabled) {
          menuItem.addEventListener("mouseenter", () => {
            menuItem.style.backgroundColor = item.danger
              ? "rgba(255, 107, 107, 0.1)"
              : "rgba(255, 255, 255, 0.1)";
          });

          menuItem.addEventListener("mouseleave", () => {
            menuItem.style.backgroundColor = "transparent";
          });

          menuItem.addEventListener("click", item.action);
        }

        contextMenu.appendChild(menuItem);
      }
    });

    // Position and show menu
    const menuWidth = 180;
    const menuHeight = 300;
    
    // Use clientX/clientY for fixed positioning (relative to viewport)
    let left = event.clientX;
    let top = event.clientY;

    // Debug: log coordinates
    console.log('Frame context menu - clientX:', event.clientX, 'clientY:', event.clientY);
    console.log('Frame context menu - pageX:', event.pageX, 'pageY:', event.pageY);

    // Ensure menu stays within viewport
    if (left + menuWidth > window.innerWidth) {
      left = window.innerWidth - menuWidth - 10;
    }
    if (top + menuHeight > window.innerHeight) {
      top = window.innerHeight - menuHeight - 10;
    }

    // Append to body first (before setting position to avoid reflow)
    document.body.appendChild(contextMenu);
    
    // Apply positioning after appending
    contextMenu.style.position = 'fixed';
    contextMenu.style.left = `${left}px`;
    contextMenu.style.top = `${top}px`;
    contextMenu.style.zIndex = '10000';
    
    this.activeContextMenu = contextMenu;

    document.addEventListener(
      "click",
      this.handleContextMenuOutsideClick.bind(this),
      { once: true }
    );
  }

  // Render frame thumbnail
  // In the renderFrameThumbnail method, add the checkerboard background at the beginning:
  renderFrameThumbnail(ctx, frame, width, height) {
    // Add checkerboard background for transparency
    this.drawCheckerboard(ctx, width, height, 4);

    if (!frame || !frame.layers) return;

    // Calculate scale to fit frame in thumbnail
    const scale = Math.min(width / frame.width, height / frame.height);
    const scaledWidth = frame.width * scale;
    const scaledHeight = frame.height * scale;
    const offsetX = (width - scaledWidth) / 2;
    const offsetY = (height - scaledHeight) / 2;

    // Render each visible layer
    frame.layers.forEach((layer) => {
      if (!layer.visible || !layer.pixels) return;

      for (let y = 0; y < frame.height; y++) {
        for (let x = 0; x < frame.width; x++) {
          if (!layer.pixels[y] || !layer.pixels[y][x]) continue;

          const [r, g, b, a] = layer.pixels[y][x];
          if (a > 0) {
            const opacity = (a / 255) * layer.opacity;
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
            ctx.fillRect(
              offsetX + x * scale,
              offsetY + y * scale,
              Math.max(1, scale),
              Math.max(1, scale)
            );
          }
        }
      }
    });
  }

  // Draw transparency checkerboard pattern
  drawTransparencyPattern(ctx, x, y, width, height) {
    const checkSize = 4;
    ctx.fillStyle = "#404040";

    for (let py = y; py < y + height; py += checkSize) {
      for (let px = x; px < x + width; px += checkSize) {
        const checkX = Math.floor((px - x) / checkSize);
        const checkY = Math.floor((py - y) / checkSize);

        if ((checkX + checkY) % 2 === 0) {
          ctx.fillRect(px, py, checkSize, checkSize);
        }
      }
    }
  }

  // Edit frame name
  editFrameName(frame, nameElement) {
    const currentName = frame.name || "Frame";
    const input = document.createElement("input");
    input.type = "text";
    input.value = currentName;
    input.className = "frame-name-input";
    input.style.cssText = `
    background: #1a1a1a;
    border: 1px solid #00d4ff;
    color: white;
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 12px;
    width: 100%;
  `;

    nameElement.replaceWith(input);
    input.focus();
    input.select();

    const finishEdit = () => {
      const newName = input.value.trim() || "Frame";
      frame.name = newName;

      const newNameElement = document.createElement("div");
      newNameElement.className = "frame-name";
      newNameElement.textContent = newName;

      input.replaceWith(newNameElement);

      // Save changes
      this.editor.saveSprites();

      // Add double-click listener to new element
      newNameElement.addEventListener("dblclick", () => {
        this.editFrameName(frame, newNameElement);
      });
    };

    input.addEventListener("blur", finishEdit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        finishEdit();
      } else if (e.key === "Escape") {
        const nameElement = document.createElement("div");
        nameElement.className = "frame-name";
        nameElement.textContent = currentName;
        input.replaceWith(nameElement);

        nameElement.addEventListener("dblclick", () => {
          this.editFrameName(frame, nameElement);
        });
      }
    });
  }

  // Setup header button event listeners
  setupHeaderButtons() {
    // New sprite button
    const newSpriteBtn = document.getElementById("new-sprite");
    if (newSpriteBtn) {
      newSpriteBtn.addEventListener("click", () => {
        this.editor.createNewSprite();
      });
    }

    // Import button
    const importBtn = document.getElementById("import-btn");
    if (importBtn) {
      importBtn.addEventListener("click", () => {
        this.openFileImport();
      });
    }

    // Export button
    const exportBtn = document.getElementById("export-btn");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        this.showExportModal();
      });
    }

    // Canvas size inputs
    this.setupCanvasSizeInputs();
  }
  setupCanvasSizeInputs() {
    const widthInput = document.getElementById("canvas-width-header");
    const heightInput = document.getElementById("canvas-height-header");

    if (widthInput && heightInput) {
      const applyResize = () => {
        const width = parseInt(widthInput.value);
        const height = parseInt(heightInput.value);

        if (width > 0 && height > 0 && width <= 128 && height <= 128) {
          this.editor.resizeCanvas(width, height);
          this.showNotification(
            `Canvas resized to ${width}×${height}`,
            "success"
          );
        } else {
          this.showNotification(
            "Invalid dimensions. Use values between 1 and 128.",
            "error"
          );
          // Reset to current sprite size
          if (this.editor.currentSprite) {
            widthInput.value = this.editor.currentSprite.width;
            heightInput.value = this.editor.currentSprite.height;
          }
        }
      };

      widthInput.addEventListener("change", applyResize);
      heightInput.addEventListener("change", applyResize);

      // Also listen for Enter key
      widthInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          applyResize();
        }
      });

      heightInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          applyResize();
        }
      });
    }
  }

  // Handle SVG export - simple direct download
  exportAsSVG() {
    // Just call the editor's direct export method
    this.editor.exportAsSVG();
  }

  // Setup tool button event listeners
  // Setup tool button event listeners
  setupToolButtons() {
    const toolButtons = document.querySelectorAll(".tool-btn[data-tool]");
    toolButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const toolName = button.dataset.tool;
        this.editor.setCurrentTool(toolName);
      });
    });

    // Undo button - now uses LayerManager
    const undoBtn = document.getElementById("undo-btn");
    if (undoBtn) {
      undoBtn.addEventListener("click", () => {
        if (this.editor.layerManager) {
          const success = this.editor.layerManager.undo();
          if (success) {
            this.editor.canvasManager.render();
            this.editor.updateUI();
          }
        }
      });
    }

    // Redo button - now uses LayerManager
    const redoBtn = document.getElementById("redo-btn");
    if (redoBtn) {
      redoBtn.addEventListener("click", () => {
        if (this.editor.layerManager) {
          const success = this.editor.layerManager.redo();
          if (success) {
            this.editor.canvasManager.render();
            this.editor.updateUI();
          }
        }
      });
    }

    // Grid toggle
    const gridToggle = document.getElementById("toggle-grid");
    if (gridToggle) {
      gridToggle.addEventListener("click", () => {
        this.editor.canvasManager.toggleGrid();
      });
    }
  }

  // Setup canvas control event listeners
  setupCanvasControls() {
    // Zoom controls
    const zoomInBtn = document.getElementById("zoom-in");
    if (zoomInBtn) {
      zoomInBtn.addEventListener("click", () => {
        this.editor.canvasManager.zoomIn();
      });
    }

    const zoomOutBtn = document.getElementById("zoom-out");
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener("click", () => {
        this.editor.canvasManager.zoomOut();
      });
    }

    const resetZoomBtn = document.getElementById("reset-zoom");
    if (resetZoomBtn) {
      resetZoomBtn.addEventListener("click", () => {
        this.editor.canvasManager.resetZoom();
      });
    }

    // Resize canvas
    // const resizeBtn = document.getElementById("resize-canvas");
    // if (resizeBtn) {
    //   resizeBtn.addEventListener("click", () => {
    //     this.showResizeModal();
    //   });
    // }
  }

  // Setup color picker event listeners


  // Setup modal event listeners
  setupModals() {
    // Resize modal
    const applyResizeBtn = document.getElementById("apply-resize");
    if (applyResizeBtn) {
      applyResizeBtn.addEventListener("click", () => {
        this.applyResize();
      });
    }

    const cancelResizeBtn = document.getElementById("cancel-resize");
    if (cancelResizeBtn) {
      cancelResizeBtn.addEventListener("click", () => {
        this.hideResizeModal();
      });
    }

    // File input for import
    const fileInput = document.getElementById("file-input");
    if (fileInput) {
      fileInput.addEventListener("change", (e) => {
        this.handleFileImport(e);
      });
    }
    // Export modal
    const applyExportBtn = document.getElementById("apply-export");
    if (applyExportBtn) {
      applyExportBtn.addEventListener("click", () => {
        this.performExport();
      });
    }

    const quickExportBtn = document.getElementById("quick-export");
    if (quickExportBtn) {
      quickExportBtn.addEventListener("click", () => {
        this.performQuickExport();
      });
    }

    // Export spritesheet button
    const exportSpritesheetBtn = document.getElementById("export-spritesheet");
    if (exportSpritesheetBtn) {
      exportSpritesheetBtn.addEventListener("click", () => {
        this.performSpritesheetExport();
      });
    }

    const cancelExportBtn = document.getElementById("cancel-export");
    if (cancelExportBtn) {
      cancelExportBtn.addEventListener("click", () => {
        this.hideExportModal();
      });
    }

    const exportModalClose = document.getElementById("export-modal-close");
    if (exportModalClose) {
      exportModalClose.addEventListener("click", () => {
        this.hideExportModal();
      });
    }

    // Export scale slider
    const exportScaleSlider = document.getElementById("export-scale");
    if (exportScaleSlider) {
      exportScaleSlider.addEventListener("input", () => {
        this.updateExportPreview();
      });
    }

    // Export format selector
    const exportFormatSelect = document.getElementById("export-format");
    if (exportFormatSelect) {
      exportFormatSelect.addEventListener("change", () => {
        this.updateExportUIForFormat();
        this.updateExportPreview();
      });
    }

    // FPS slider
    const exportFpsSlider = document.getElementById("export-fps");
    if (exportFpsSlider) {
      exportFpsSlider.addEventListener("input", () => {
        this.updateExportPreview();
      });
    }
  }

  // Setup keyboard shortcut event listeners
  setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      // Don't trigger shortcuts when typing in input fields
      if (e.target.matches("input, textarea")) return;

      switch (e.key.toLowerCase()) {
        case "b":
          if (!e.ctrlKey && !e.metaKey) {
            this.editor.setCurrentTool("brush");
            e.preventDefault();
          }
          break;
        case "e":
          if (!e.ctrlKey && !e.metaKey) {
            this.editor.setCurrentTool("eraser");
            e.preventDefault();
          } else if (e.ctrlKey || e.metaKey) {
            this.exportAsSVG();
            e.preventDefault();
          }
          break;
        case "f":
          if (!e.ctrlKey && !e.metaKey) {
            this.editor.setCurrentTool("bucket");
            e.preventDefault();
          }
          break;
        case "m":
          if (!e.ctrlKey && !e.metaKey) {
            this.editor.setCurrentTool("select");
            e.preventDefault();
          }
          break;
        case "i":
          if (!e.ctrlKey && !e.metaKey) {
            this.editor.setCurrentTool("eyedropper");
            e.preventDefault();
          }
          break;
        case "l":
          if (!e.ctrlKey && !e.metaKey) {
            this.editor.setCurrentTool("brightness");
            e.preventDefault();
          }
          break;
        case "z":
          if (e.ctrlKey || e.metaKey) {
            if (e.shiftKey) {
              // Redo with Ctrl+Shift+Z
              if (this.editor.layerManager) {
                const success = this.editor.layerManager.redo();
                if (success) {
                  this.editor.canvasManager.render();
                  this.editor.updateUI();
                }
              }
            } else {
              // Undo with Ctrl+Z
              if (this.editor.layerManager) {
                const success = this.editor.layerManager.undo();
                if (success) {
                  this.editor.canvasManager.render();
                  this.editor.updateUI();
                }
              }
            }
            e.preventDefault();
          }
          break;
        case "y":
          if (e.ctrlKey || e.metaKey) {
            // Redo with Ctrl+Y
            if (this.editor.layerManager) {
              const success = this.editor.layerManager.redo();
              if (success) {
                this.editor.canvasManager.render();
                this.editor.updateUI();
              }
            }
            e.preventDefault();
          }
          break;
        case "n":
          if (e.ctrlKey || e.metaKey) {
            this.editor.createNewSprite();
            e.preventDefault();
          }
          break;
        case "s":
          if (e.ctrlKey || e.metaKey) {
            this.editor.saveSprites();
            e.preventDefault();
          }
          break;
        case "x":
          if (!e.ctrlKey && !e.metaKey) {
            this.swapPrimarySecondaryColor();
            e.preventDefault();
          }
          break;
        case "delete":
        case "backspace":
          // Delete selected items (layers, sprites, or frames)
          if (this.selectedLayerIndices.size > 1) {
            this.deleteSelectedLayers();
            e.preventDefault();
          } else if (this.selectedSpriteIndices.size > 1) {
            this.deleteSelectedSprites();
            e.preventDefault();
          } else if (this.selectedFrameIndices.size > 1) {
            this.deleteSelectedFrames();
            e.preventDefault();
          }
          break;
      }
    });
  }

  // Initialize color palette
  initializeColorPalette() {
  const paletteContainer = document.getElementById("color-palette");
  if (!paletteContainer) return;

  paletteContainer.innerHTML = "";

  this.colorPalette.forEach((color) => {
    const swatch = document.createElement("div");
    swatch.className = "color-swatch";
    swatch.style.cssText = `
      position: relative;
      width: 20px;
      height: 20px;
      border-radius: 5px;
      cursor: pointer;
      margin: 2px;
      display: inline-block;
    `;
    
    // Add checkerboard background
    swatch.style.backgroundImage = this.createCheckerboardBackground();
    swatch.style.backgroundSize = '6px 6px';
    
    // Add color overlay
    const colorOverlay = document.createElement("div");
    colorOverlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: ${color};
      border-radius: 2px;
    `;
    swatch.appendChild(colorOverlay);
    
    swatch.title = color;
    swatch.addEventListener("click", () => {
      // Remove previous selection
      this.deselectColorPalette();
      // Add selection to clicked swatch
      swatch.classList.add("selected");
      // Convert hex to RGBA (full opacity for palette colors)
      const rgba = this.hexToRgba(color);
      this.updateSelectedColor(color, "hex");
    });
    
    paletteContainer.appendChild(swatch);
  });
}

  // File import handlers
  openFileImport() {
    const fileInput = document.getElementById("file-input");
    if (fileInput) {
      fileInput.click();
    }
  }

  handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    this.editor.importFile(file);
  }

  // Update UI elements
  updateToolButtons() {
    const toolButtons = document.querySelectorAll(".tool-btn[data-tool]");
    const currentTool = this.editor.currentTool?.name;

    toolButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.tool === currentTool);
    });
  }

  updateColorDisplay() {
    const primaryColor = document.getElementById("primary-color");
  const secondaryColor = document.getElementById("secondary-color");

    if (primaryColor && this.editor.primaryColor) {
      const [r, g, b, a] = this.editor.primaryColor;
      const alpha = a / 255;

      // Show checkerboard background for transparency
      primaryColor.style.backgroundImage = this.createCheckerboardBackground();
      primaryColor.style.backgroundSize = "8px 8px";

      // Overlay the color with transparency
      const colorOverlay =
        primaryColor.querySelector(".color-overlay") ||
        this.createColorOverlay(primaryColor);
      colorOverlay.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${alpha})`;

      const hex = this.rgbaToHex([r, g, b, 255]); // Hex without alpha for input


      // Update color inputs
      this.updateColorInputs(hex, this.editor.primaryColor);

      // Update custom color picker if exists
      if (this.colorSquare) {
        this.updatePickerFromColor(this.editor.primaryColor);
      }
    }

    // Update secondary color display
    if (secondaryColor && this.editor.secondaryColor) {
      const [r, g, b, a] = this.editor.secondaryColor;
      const alpha = a / 255;

      secondaryColor.style.backgroundImage =
        this.createCheckerboardBackground();
      secondaryColor.style.backgroundSize = "8px 8px";

      const colorOverlay =
        secondaryColor.querySelector(".color-overlay") ||
        this.createColorOverlay(secondaryColor);
      colorOverlay.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }

  createCheckerboardBackground() {
  // Create a proper checkerboard pattern like the opacity slider
  // Using a data URL with a small canvas to create the pattern
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  
  // Light gray color
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 16, 16);
  
  // Dark gray squares in checkerboard pattern
  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(0, 0, 8, 8);    // Top-left
  ctx.fillRect(8, 8, 8, 8);    // Bottom-right
  
  return `url(${canvas.toDataURL()})`;
}

  createColorOverlay(parentElement) {
    const overlay = document.createElement("div");
    overlay.className = "color-overlay";
    overlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 4px;
  `;
    parentElement.style.position = "relative";
    parentElement.appendChild(overlay);
    return overlay;
  }

  // In the updateSpritesList method, add a safety check at the beginning:
  updateSpritesList() {
    const spritesList = document.getElementById("sprites-list");
    if (!spritesList) return;

    spritesList.innerHTML = "";

    // Add safety check for sprites array
    if (!this.editor.sprites || !Array.isArray(this.editor.sprites)) {
      console.warn("Sprites array not available yet");
      return;
    }

    this.editor.sprites.forEach((sprite, index) => {
      const spriteItem = document.createElement("div");
      const isSelected = this.selectedSpriteIndices.has(index);
      spriteItem.className = `sprite-item ${
        sprite === this.editor.currentSprite ? "active" : ""
      } ${isSelected ? "multiselected" : ""}`;
      spriteItem.setAttribute("draggable", "true");
      spriteItem.dataset.index = index;

      // Create thumbnail
      const thumbnail = this.createSpriteThumbnail(sprite);

      const spriteInfo = document.createElement("div");
      spriteInfo.className = "sprite-info";
      spriteInfo.innerHTML = `
            <div class="sprite-name">${sprite.name}</div>
            <div class="sprite-size">${sprite.width}×${sprite.height}</div>
        `;

      spriteItem.appendChild(thumbnail);
      spriteItem.appendChild(spriteInfo);

      // Click to select sprite with multiselect support
      spriteItem.addEventListener("click", (e) => {
        this.handleSpriteSelection(index, e.ctrlKey || e.metaKey, e.shiftKey, sprite);
      });

      // Right-click context menu
      spriteItem.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        this.showSpriteContextMenu(e, sprite, index);
      });

      // Drag and drop events for reordering
      spriteItem.addEventListener("dragstart", (e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", index);
        spriteItem.classList.add("dragging");
      });
      
      spriteItem.addEventListener("dragend", (e) => {
        spriteItem.classList.remove("dragging");
      });
      
      spriteItem.addEventListener("dragover", (e) => {
        e.preventDefault();
        
        // Determine if hovering over top or bottom half
        const rect = spriteItem.getBoundingClientRect();
        const mouseY = e.clientY - rect.top;
        const isTopHalf = mouseY < rect.height / 2;
        
        // Update visual indicator
        spriteItem.classList.remove("drag-over-before", "drag-over-after");
        if (isTopHalf) {
          spriteItem.classList.add("drag-over-before");
        } else {
          spriteItem.classList.add("drag-over-after");
        }
      });
      
      spriteItem.addEventListener("dragleave", (e) => {
        spriteItem.classList.remove("drag-over-before", "drag-over-after");
      });
      
      spriteItem.addEventListener("drop", (e) => {
        e.preventDefault();
        spriteItem.classList.remove("drag-over-before", "drag-over-after");
        
        const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
        
        // Determine drop position based on mouse position
        const rect = spriteItem.getBoundingClientRect();
        const mouseY = e.clientY - rect.top;
        const isTopHalf = mouseY < rect.height / 2;
        
        // Calculate target index: insert before (top) or after (bottom)
        let toIndex = isTopHalf ? index : index + 1;
        
        if (fromIndex !== toIndex && fromIndex !== toIndex - 1) {
          this.editor.moveSprite(fromIndex, toIndex);
          this.updateSpritesList();
        }
      });

      spritesList.appendChild(spriteItem);
    });

    // Load IndexedDB sprites for current session display
    this.loadSessionSprites();
  }

  // Load and display sprites from IndexedDB under current session
  async loadSessionSprites() {
    try {
      const allStoredSprites = await this.editor.storageManager.loadSprites();

      if (!allStoredSprites || allStoredSprites.length === 0) {
        return;
      }

      // Get sprites not currently in the session
      const sessionSpriteIds = new Set(this.editor.sprites.map((s) => s.id));
      const storedOnlySprites = allStoredSprites.filter(
        (sprite) => !sessionSpriteIds.has(sprite.id)
      );
    } catch (error) {
      console.error("Failed to load session sprites:", error);
    }
  }

  // Load a stored sprite into the current session
  loadStoredSpriteToSession(sprite) {
    // Check if sprite is already in session
    const existingIndex = this.editor.sprites.findIndex(
      (s) => s.id === sprite.id
    );

    if (existingIndex !== -1) {
      // Switch to existing sprite
      this.editor.setCurrentSprite(this.editor.sprites[existingIndex]);
      this.showNotification(`Switched to: ${sprite.name}`, "info");
    } else {
      // Add to session
      this.editor.sprites.push(sprite);
      this.editor.setCurrentSprite(sprite);
      this.showNotification(`Loaded to session: ${sprite.name}`, "success");
    }

    this.editor.updateUI();
  }
  // Show context menu for stored sprites
  showStoredSpriteContextMenu(event, sprite) {
    // Remove any existing context menu
    this.hideContextMenu();

    const contextMenu = document.createElement("div");
    contextMenu.className = "sprite-context-menu";
    contextMenu.style.cssText = `
        position: fixed;
        background: #2d2d2d;
        border: 1px solid #444;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        min-width: 140px;
        padding: 4px 0;
        font-family: system-ui, -apple-system, sans-serif;
        color: white;
        font-size: 14px;
    `;

    const menuItems = [
      {
        label: "Load to Session",
        icon: "fas fa-plus",
        action: () => {
          this.loadStoredSpriteToSession(sprite);
          this.hideContextMenu();
        },
      },
      {
        label: "Duplicate to Session",
        icon: "fas fa-copy",
        action: () => {
          const duplicate = sprite.clone();
          this.editor.sprites.push(duplicate);
          this.editor.setCurrentSprite(duplicate);
          this.editor.updateUI();
          this.showNotification(
            `Duplicated to session: ${duplicate.name}`,
            "success"
          );
          this.hideContextMenu();
        },
      },
      { type: "separator" },
      {
        label: "Delete from Storage",
        icon: "fas fa-trash",
        action: async () => {
          this.showCustomConfirm(
            `Delete "${sprite.name}" from storage permanently?`,
            async () => {
              await this.editor.storageManager.deleteSprite(sprite.id);
              this.editor.updateUI();
              this.showNotification(
                `Deleted from storage: ${sprite.name}`,
                "success"
              );
            }
          );
          this.hideContextMenu();
        },
        danger: true,
      },
    ];

    menuItems.forEach((item) => {
      if (item.type === "separator") {
        const separator = document.createElement("div");
        separator.style.cssText = `
                height: 1px;
                background: #444;
                margin: 4px 0;
            `;
        contextMenu.appendChild(separator);
      } else {
        const menuItem = document.createElement("div");
        menuItem.style.cssText = `
                padding: 8px 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: background-color 0.15s ease;
                ${item.danger ? "color: #ff6b6b;" : ""}
            `;
        menuItem.innerHTML = `
                <i class="${item.icon}" style="width: 14px;"></i>
                <span>${item.label}</span>
            `;

        menuItem.addEventListener("mouseenter", () => {
          menuItem.style.backgroundColor = item.danger
            ? "rgba(255, 107, 107, 0.1)"
            : "rgba(255, 255, 255, 0.1)";
        });

        menuItem.addEventListener("mouseleave", () => {
          menuItem.style.backgroundColor = "transparent";
        });

        menuItem.addEventListener("click", item.action);
        contextMenu.appendChild(menuItem);
      }
    });

    // Position the context menu
    let left = event.clientX;
    let top = event.clientY;

    if (left + 140 > window.innerWidth) {
      left = window.innerWidth - 140 - 10;
    }
    if (top + 200 > window.innerHeight) {
      top = window.innerHeight - 200 - 10;
    }

    contextMenu.style.left = `${left}px`;
    contextMenu.style.top = `${top}px`;

    document.body.appendChild(contextMenu);
    this.activeContextMenu = contextMenu;

    // Close menu when clicking outside
    document.addEventListener(
      "click",
      this.handleContextMenuOutsideClick.bind(this),
      { once: true }
    );
  }

  createSpriteThumbnail(sprite) {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    canvas.className = "sprite-thumbnail";

    const ctx = canvas.getContext("2d");

    // Store animation data for hover functionality
    canvas._sprite = sprite;
    canvas._animationInterval = null;
    canvas._currentFrameIndex = 0;
    canvas._isAnimating = false;

    // Initial render with first frame
    this.renderThumbnailFrame(canvas, sprite, 0);

    // Add hover animation functionality if sprite has multiple frames
    if (sprite.frames && sprite.frames.length > 1) {
      canvas.addEventListener("mouseenter", () => {
        if (!canvas._isAnimating) {
          canvas._isAnimating = true;
          canvas._currentFrameIndex = 0;

          canvas._animationInterval = setInterval(() => {
            canvas._currentFrameIndex =
              (canvas._currentFrameIndex + 1) % sprite.frames.length;
            this.renderThumbnailFrame(
              canvas,
              sprite,
              canvas._currentFrameIndex
            );
          }, 150); // ~6.7 FPS for smooth preview
        }
      });

      canvas.addEventListener("mouseleave", () => {
        if (canvas._animationInterval) {
          clearInterval(canvas._animationInterval);
          canvas._animationInterval = null;
        }
        canvas._isAnimating = false;
        canvas._currentFrameIndex = 0;
        // Return to first frame
        this.renderThumbnailFrame(canvas, sprite, 0);
      });

      // Visual indicator for animated sprites
      canvas.style.position = "relative";
      canvas.style.cursor = "pointer";
      canvas.title = `${sprite.name} (${sprite.frames.length} frames - hover to preview)`;
    } else {
      canvas.title = sprite.name;
    }

    return canvas;
  }

  // New method to render a specific frame to thumbnail
  renderThumbnailFrame(canvas, sprite, frameIndex) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Create checkerboard pattern for transparency
    this.drawCheckerboard(ctx, canvas.width, canvas.height, 4);

    // Calculate scaling
    const scaleX = canvas.width / sprite.width;
    const scaleY = canvas.height / sprite.height;
    const scale = Math.min(scaleX, scaleY);

    const scaledWidth = sprite.width * scale;
    const scaledHeight = sprite.height * scale;
    const offsetX = (canvas.width - scaledWidth) / 2;
    const offsetY = (canvas.height - scaledHeight) / 2;

    // Check if sprite has frame-based animation data
    if (sprite.frames && sprite.frames[frameIndex]) {
      const frame = sprite.frames[frameIndex];

      // Render each visible layer in the frame
      if (frame.layers && Array.isArray(frame.layers)) {
        frame.layers.forEach((layer) => {
          if (!layer.visible || !layer.pixels) return;

          for (let y = 0; y < frame.height; y++) {
            for (let x = 0; x < frame.width; x++) {
              if (!layer.pixels[y] || !layer.pixels[y][x]) continue;

              const [r, g, b, a] = layer.pixels[y][x];
              if (a > 0) {
                const opacity = (a / 255) * layer.opacity;
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
                ctx.fillRect(
                  offsetX + x * scale,
                  offsetY + y * scale,
                  scale,
                  scale
                );
              }
            }
          }
        });
        return;
      }
    }

    // Fallback to original sprite rendering for non-animated sprites
    for (let y = 0; y < sprite.height; y++) {
      for (let x = 0; x < sprite.width; x++) {
        const pixel = sprite.getPixel(x, y);
        const [r, g, b, a] = pixel;

        if (a > 0) {
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
          ctx.fillRect(offsetX + x * scale, offsetY + y * scale, scale, scale);
        }
      }
    }
  }

  // Update the drawCheckerboard method to use the same colors as sprite thumbnails:
  drawCheckerboard(ctx, width, height, size) {
    const lightColor = "#ffffff";
    const darkColor = "#e0e0e0";

    for (let x = 0; x < width; x += size) {
      for (let y = 0; y < height; y += size) {
        const isEven = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0;
        ctx.fillStyle = isEven ? lightColor : darkColor;
        ctx.fillRect(x, y, size, size);
      }
    }
  }

  updateCanvasSizeDisplay() {
    const widthInput = document.getElementById("canvas-width-header");
    const heightInput = document.getElementById("canvas-height-header");

    if (widthInput && heightInput && this.editor.currentSprite) {
      widthInput.value = this.editor.currentSprite.width;
      heightInput.value = this.editor.currentSprite.height;
    }
  }

  updateUndoRedoButtons() {
    const undoBtn = document.getElementById("undo-btn");
    const redoBtn = document.getElementById("redo-btn");

    if (undoBtn) {
      undoBtn.disabled = !this.editor.layerManager?.canUndo();
    }

    if (redoBtn) {
      redoBtn.disabled = !this.editor.layerManager?.canRedo();
    }
  }

  // Update tool settings panel
  updateToolSettings() {
    const settingsContainer = document.getElementById("tool-settings");
    if (!settingsContainer || !this.editor.currentTool) {
      if (settingsContainer) settingsContainer.innerHTML = "";
      return;
    }

    // Clear all settings
    settingsContainer.innerHTML = "";

    // Add tool-specific settings if the tool has them
    if (this.editor.currentTool.getSettingsHTML) {
      const toolSpecificSettings = document.createElement("div");
      toolSpecificSettings.className = "tool-settings"; // Ensure flex styling
      toolSpecificSettings.innerHTML =
        this.editor.currentTool.getSettingsHTML();
      settingsContainer.appendChild(toolSpecificSettings);

      // Optionally, ensure all direct children have 'setting-group' class for flex row
      Array.from(toolSpecificSettings.children).forEach((child) => {
        if (!child.classList.contains("setting-group")) {
          child.classList.add("setting-group");
        }
      });

      // Initialize tool-specific event listeners
      if (this.editor.currentTool.initializeSettings) {
        this.editor.currentTool.initializeSettings();
      }
    }
  }

  // Update canvas info display
  updateCanvasInfo() {
    const sizeDisplay = document.getElementById("canvas-info-size");
    const zoomDisplay = document.getElementById("canvas-info-zoom");

    if (sizeDisplay && this.editor.currentSprite) {
      sizeDisplay.textContent = `${this.editor.currentSprite.width}x${this.editor.currentSprite.height}`;
    }

    if (zoomDisplay && this.editor.canvasManager) {
      const zoomPercent = Math.round(this.editor.canvasManager.scale * 100);
      zoomDisplay.textContent = `${zoomPercent}%`;
    }
  }

  // Convert RGBA array to hex color
  rgbaToHex(rgba) {
    const [r, g, b] = rgba;
    const toHex = (n) => Math.round(n).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  }

  // Modal handling
  showResizeModal() {
    const modal = document.getElementById("resize-modal");
    const widthInput = document.getElementById("canvas-width");
    const heightInput = document.getElementById("canvas-height");

    if (modal && this.editor.currentSprite) {
      widthInput.value = this.editor.currentSprite.width;
      heightInput.value = this.editor.currentSprite.height;
      modal.style.display = "flex";
    }
  }

  hideResizeModal() {
    const modal = document.getElementById("resize-modal");
    if (modal) {
      modal.style.display = "none";
    }
  }

  applyResize() {
    const widthInput = document.getElementById("canvas-width");
    const heightInput = document.getElementById("canvas-height");

    const width = parseInt(widthInput.value);
    const height = parseInt(heightInput.value);

    if (width > 0 && height > 0 && width <= 256 && height <= 256) {
      // Use nearest neighbor scaling instead of cropping
      this.editor.resizeCanvasWithScaling(width, height, true);
      this.hideResizeModal();
    } else {
      this.showNotification(
        "Invalid dimensions. Use values between 1 and 256.",
        "error"
      );
    }
  }

  // Show notification message
  showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.style.position = "fixed";
    notification.style.top = "20px";
    notification.style.right = "20px";
    notification.style.background =
      type === "error" ? "#ff6b6b" : type === "success" ? "#51cf66" : "#339af0";
    notification.style.color = "white";
    notification.style.padding = "12px 16px";
    notification.style.borderRadius = "6px";
    notification.style.zIndex = "10000";
    notification.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
    notification.textContent = message;

    document.body.appendChild(notification);

    // Auto-remove notification after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.opacity = "0";
        notification.style.transform = "translateX(100%)";
        notification.style.transition =
          "opacity 0.3s ease, transform 0.3s ease";

        setTimeout(() => {
          if (notification.parentNode) {
            document.body.removeChild(notification);
          }
        }, 300);
      }
    }, 3000);
  }

  // Update all UI elements
  // In the updateAll method, make it safer:
  updateAll() {
    try {
      this.updateToolButtons();
      this.updateColorDisplay();
      this.updateFramesList();
      this.updateLayersList();

      // Add canvas colors palette update
      this.updateCanvasColorsPalette();

      // Only update sprites list if sprites are available
      if (this.editor.sprites && Array.isArray(this.editor.sprites)) {
        this.updateSpritesList();
      }

      this.updateCanvasSizeDisplay();
      this.updateUndoRedoButtons();
      this.updateToolSettings();
      this.updateSpriteNameInput();
      this.updateHeaderSpriteName();
    } catch (error) {
      console.warn("Error updating UI:", error);
    }
  }

  // Update the sprite name in the header
  updateHeaderSpriteName() {
    const nameDisplay = document.getElementById("sprite-name-display");
    if (nameDisplay && this.editor.currentSprite) {
      nameDisplay.textContent = this.editor.currentSprite.name || "Untitled";
    }
  }

  updateSpriteNameInput() {
    const nameInput = document.getElementById("sprite-name");
    if (nameInput && this.editor.currentSprite) {
      nameInput.value = this.editor.currentSprite.name;
    }
  }

  // Update the name of the active sprite in the sidebar without full re-render
  updateActiveSpriteNameInSidebar() {
    const spritesList = document.getElementById("sprites-list");
    if (!spritesList) return;
    const activeItem = spritesList.querySelector(
      ".sprite-item.active .sprite-name"
    );
    if (activeItem && this.editor.currentSprite) {
      activeItem.textContent = this.editor.currentSprite.name || "Untitled";
    }
  }

  setupSpriteNameInputListener() {
    const nameInput = document.getElementById("sprite-name");
    if (nameInput) {
      nameInput.removeAttribute("readonly");
      nameInput.addEventListener("change", (e) => {
        if (this.editor.currentSprite) {
          this.editor.currentSprite.name = e.target.value;
          this.updateHeaderSpriteName();
          this.updateActiveSpriteNameInSidebar();
        }
      });
    }
  }

  // Convert hex color to RGBA array
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

  // Deselect all color palette items
  deselectColorPalette() {
    const paletteItems = document.querySelectorAll(".color-swatch");
    paletteItems.forEach((item) => {
      item.classList.remove("selected");
    });
  }

  // Show context menu for sprite
  showSpriteContextMenu(event, sprite, index) {
    // Remove any existing context menu
    this.hideContextMenu();

    const contextMenu = document.createElement("div");
    contextMenu.className = "sprite-context-menu";
    contextMenu.style.cssText = `
            position: fixed;
            background: #2d2d2d;
            border: 1px solid #444;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            min-width: 140px;
            padding: 4px 0;
            font-family: system-ui, -apple-system, sans-serif;
            color: white;
            font-size: 14px;
        `;

    // Check if multiple sprites are selected
    const multipleSelected = this.selectedSpriteIndices.size > 1;
    const selectedCount = this.selectedSpriteIndices.size;

    const menuItems = multipleSelected ? [
      // Bulk operations menu
      {
        label: `Delete ${selectedCount} Sprites`,
        icon: "fas fa-trash",
        action: () => {
          this.deleteSelectedSprites();
          this.hideContextMenu();
        },
        danger: true,
      },
      {
        label: "Deselect All",
        icon: "fas fa-times",
        action: () => {
          this.selectedSpriteIndices.clear();
          this.updateSpritesList();
          this.hideContextMenu();
        },
      },
    ] : [
      {
        label: "Duplicate",
        icon: "fas fa-copy",
        action: () => {
          // Save current layer state before duplicating
          if (
            this.editor.layerManager &&
            this.editor.currentSprite === sprite
          ) {
            this.editor.saveLayersToSprite();
          }

          this.editor.duplicateSprite(sprite);
          this.hideContextMenu();
        },
      },
      {
        label: "Rename",
        icon: "fas fa-edit",
        action: () => {
          this.showRenameDialog(sprite);
          this.hideContextMenu();
        },
      },
      {
        label: "Export SVG",
        icon: "fas fa-file-export",
        action: () => {
          const currentSprite = this.editor.currentSprite;
          this.editor.setCurrentSprite(sprite);
          this.exportAsSVG();
          this.editor.setCurrentSprite(currentSprite);
          this.hideContextMenu();
        },
      },
      { type: "separator" },
      {
        label: "Delete",
        icon: "fas fa-trash",
        action: () => {
          this.showCustomConfirm(
            `Are you sure you want to delete "${sprite.name}"?`,
            () => {
              this.editor.deleteSprite(index);
              //set current sprite to another if available
              if (this.editor.sprites.length > 0) {
                this.editor.setCurrentSprite(
                  this.editor.sprites[
                    Math.min(index, this.editor.sprites.length - 1)
                  ]
                );
              } else {
                this.editor.currentSprite = null;
              }
              this.showNotification(`Deleted: ${sprite.name}`, "success");
            }
          );
          this.hideContextMenu();
        },
        danger: true,
      },
    ];

    menuItems.forEach((item) => {
      if (item.type === "separator") {
        const separator = document.createElement("div");
        separator.style.cssText = `
                    height: 1px;
                    background: #444;
                    margin: 4px 0;
                `;
        contextMenu.appendChild(separator);
      } else {
        const menuItem = document.createElement("div");
        menuItem.style.cssText = `
                    padding: 8px 12px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: background-color 0.15s ease;
                    ${item.danger ? "color: #ff6b6b;" : ""}
                `;
        menuItem.innerHTML = `
                    <i class="${item.icon}" style="width: 14px;"></i>
                    <span>${item.label}</span>
                `;

        menuItem.addEventListener("mouseenter", () => {
          menuItem.style.backgroundColor = item.danger
            ? "rgba(255, 107, 107, 0.1)"
            : "rgba(255, 255, 255, 0.1)";
        });

        menuItem.addEventListener("mouseleave", () => {
          menuItem.style.backgroundColor = "transparent";
        });

        menuItem.addEventListener("click", item.action);
        contextMenu.appendChild(menuItem);
      }
    });

    // Position the context menu
    const rect = contextMenu.getBoundingClientRect();
    let left = event.clientX;
    let top = event.clientY;

    // Ensure menu stays within viewport
    if (left + 140 > window.innerWidth) {
      left = window.innerWidth - 140 - 10;
    }
    if (top + 200 > window.innerHeight) {
      top = window.innerHeight - 200 - 10;
    }

    contextMenu.style.left = `${left}px`;
    contextMenu.style.top = `${top}px`;

    document.body.appendChild(contextMenu);
    this.activeContextMenu = contextMenu;

    // Close menu when clicking outside
    document.addEventListener(
      "click",
      this.handleContextMenuOutsideClick.bind(this),
      { once: true }
    );
  }

  // Handle clicking outside context menu
  handleContextMenuOutsideClick(event) {
    if (
      this.activeContextMenu &&
      !this.activeContextMenu.contains(event.target)
    ) {
      this.hideContextMenu();
    }
  }

  // Hide context menu
  hideContextMenu() {
    if (this.activeContextMenu) {
      this.activeContextMenu.remove();
      this.activeContextMenu = null;
    }
  }
  // Show downscale modal for large images
  showDownscaleModal(imageData, originalWidth, originalHeight) {
    const modal = document.getElementById("downscale-modal");
    if (!modal) return;

    // Store original image data for processing
    this.originalImageData = imageData;
    this.originalImageWidth = originalWidth;
    this.originalImageHeight = originalHeight;

    // Update dimensions display
    document.getElementById(
      "original-dimensions"
    ).textContent = `${originalWidth}x${originalHeight}`;

    // Calculate initial target size maintaining aspect ratio
    const aspectRatio = originalWidth / originalHeight;
    let targetWidth, targetHeight;

    if (aspectRatio > 1) {
      targetWidth = Math.min(64, originalWidth);
      targetHeight = Math.round(targetWidth / aspectRatio);
    } else {
      targetHeight = Math.min(64, originalHeight);
      targetWidth = Math.round(targetHeight * aspectRatio);
    }

    // Set initial values
    document.getElementById("target-width").value = targetWidth;
    document.getElementById("target-height").value = targetHeight;

    // Setup preview canvases
    this.updateDownscalePreview();

    // Show modal
    modal.style.display = "flex";

    // Setup event listeners if not already done
    this.setupDownscaleModalListeners();
  }

  setupDownscaleModalListeners() {
    if (this.downscaleListenersSetup) return;
    this.downscaleListenersSetup = true;

    const modal = document.getElementById("downscale-modal");
    const targetWidthInput = document.getElementById("target-width");
    const targetHeightInput = document.getElementById("target-height");
    const maintainAspectCheckbox = document.getElementById(
      "maintain-aspect-downscale"
    );
    const cancelBtn = document.getElementById("cancel-downscale");
    const applyBtn = document.getElementById("apply-downscale");
    const closeBtn = document.getElementById("downscale-modal-close");

    // Update preview when inputs change
    targetWidthInput.addEventListener("input", () => {
      if (maintainAspectCheckbox.checked) {
        const aspectRatio = this.originalImageWidth / this.originalImageHeight;
        const newHeight = Math.round(
          parseInt(targetWidthInput.value) / aspectRatio
        );
        targetHeightInput.value = Math.min(64, Math.max(1, newHeight));
      }
      this.updateDownscalePreview();
    });

    targetHeightInput.addEventListener("input", () => {
      if (maintainAspectCheckbox.checked) {
        const aspectRatio = this.originalImageWidth / this.originalImageHeight;
        const newWidth = Math.round(
          parseInt(targetHeightInput.value) * aspectRatio
        );
        targetWidthInput.value = Math.min(64, Math.max(1, newWidth));
      }
      this.updateDownscalePreview();
    });

    maintainAspectCheckbox.addEventListener(
      "change",
      this.updateDownscalePreview.bind(this)
    );

    // Modal controls
    cancelBtn.addEventListener("click", () => this.hideDownscaleModal());
    closeBtn.addEventListener("click", () => this.hideDownscaleModal());
    applyBtn.addEventListener("click", () => this.applyDownscale());

    // Close on outside click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        this.hideDownscaleModal();
      }
    });
  }

  updateDownscalePreview() {
    const originalCanvas = document.getElementById("original-preview");
    const downscaledCanvas = document.getElementById("downscaled-preview");
    const originalSizeInfo = document.getElementById("original-size-info");
    const downscaledSizeInfo = document.getElementById("downscaled-size-info");

    if (!originalCanvas || !downscaledCanvas || !this.originalImageData) return;

    const targetWidth = parseInt(document.getElementById("target-width").value);
    const targetHeight = parseInt(
      document.getElementById("target-height").value
    );

    // Draw original image
    const originalCtx = originalCanvas.getContext("2d");
    originalCtx.clearRect(0, 0, originalCanvas.width, originalCanvas.height);

    // Scale original to fit preview canvas
    const originalScale = Math.min(
      128 / this.originalImageWidth,
      128 / this.originalImageHeight
    );
    const scaledOriginalWidth = this.originalImageWidth * originalScale;
    const scaledOriginalHeight = this.originalImageHeight * originalScale;
    const originalOffsetX = (128 - scaledOriginalWidth) / 2;
    const originalOffsetY = (128 - scaledOriginalHeight) / 2;

    originalCtx.putImageData(this.originalImageData, 0, 0);
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = this.originalImageWidth;
    tempCanvas.height = this.originalImageHeight;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.putImageData(this.originalImageData, 0, 0);

    originalCtx.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
    originalCtx.drawImage(
      tempCanvas,
      originalOffsetX,
      originalOffsetY,
      scaledOriginalWidth,
      scaledOriginalHeight
    );

    // Draw downscaled version
    const downscaledCtx = downscaledCanvas.getContext("2d");
    downscaledCtx.clearRect(
      0,
      0,
      downscaledCanvas.width,
      downscaledCanvas.height
    );

    // Create downscaled version
    const downscaledTempCanvas = document.createElement("canvas");
    downscaledTempCanvas.width = targetWidth;
    downscaledTempCanvas.height = targetHeight;
    const downscaledTempCtx = downscaledTempCanvas.getContext("2d");

    // Use smoothing for better downscale quality
    downscaledTempCtx.imageSmoothingEnabled = true;
    downscaledTempCtx.imageSmoothingQuality = "high";
    downscaledTempCtx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);

    // Scale to fit preview canvas
    const downscaledScale = Math.min(128 / targetWidth, 128 / targetHeight);
    const scaledDownscaledWidth = targetWidth * downscaledScale;
    const scaledDownscaledHeight = targetHeight * downscaledScale;
    const downscaledOffsetX = (128 - scaledDownscaledWidth) / 2;
    const downscaledOffsetY = (128 - scaledDownscaledHeight) / 2;

    downscaledCtx.drawImage(
      downscaledTempCanvas,
      downscaledOffsetX,
      downscaledOffsetY,
      scaledDownscaledWidth,
      scaledDownscaledHeight
    );

    // Update size info
    originalSizeInfo.textContent = `${this.originalImageWidth} x ${this.originalImageHeight}`;
    downscaledSizeInfo.textContent = `${targetWidth} x ${targetHeight}`;
  }

  hideDownscaleModal() {
    const modal = document.getElementById("downscale-modal");
    if (modal) {
      modal.style.display = "none";
    }
    // Clean up stored data
    this.originalImageData = null;
    this.originalImageWidth = null;
    this.originalImageHeight = null;
  }

  async applyDownscale() {
    const targetWidth = parseInt(document.getElementById("target-width").value);
    const targetHeight = parseInt(
      document.getElementById("target-height").value
    );

    if (
      targetWidth < 1 ||
      targetHeight < 1 ||
      targetWidth > 64 ||
      targetHeight > 64
    ) {
      this.showNotification(
        "Invalid dimensions. Use values between 1 and 64.",
        "error"
      );
      return;
    }

    try {
      // CRITICAL FIX: Save existing sprites before creating new one
      // await this.editor.saveSprites();

      // Create downscaled image data
      const canvas = document.createElement("canvas");
      canvas.width = this.originalImageWidth;
      canvas.height = this.originalImageHeight;
      const ctx = canvas.getContext("2d");
      ctx.putImageData(this.originalImageData, 0, 0);

      // Create final downscaled canvas
      const finalCanvas = document.createElement("canvas");
      finalCanvas.width = targetWidth;
      finalCanvas.height = targetHeight;
      const finalCtx = finalCanvas.getContext("2d");
      finalCtx.imageSmoothingEnabled = true;
      finalCtx.imageSmoothingQuality = "high";
      finalCtx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

      // Get downscaled image data
      const downscaledImageData = finalCtx.getImageData(
        0,
        0,
        targetWidth,
        targetHeight
      );

      // Create sprite from downscaled data
      this.createSpriteFromImageData(
        downscaledImageData,
        targetWidth,
        targetHeight
      );

      // CRITICAL FIX: Save all sprites after creating the new one
      await this.editor.saveSprites();

      this.hideDownscaleModal();
      this.showNotification(
        `Image downscaled to ${targetWidth}x${targetHeight}`,
        "success"
      );
    } catch (error) {
      console.error("Failed to apply downscale:", error);
      this.showNotification("Failed to downscale image", "error");
      this.hideDownscaleModal();
    }
  }
  createSpriteFromImageData(imageData, width, height) {
    // CRITICAL FIX: Set importing flag to prevent auto-clearing of sprites
    this.editor._importingSprite = true;

    try {
      // Create new sprite with animation support
      const sprite = this.editor.createNewSprite(width, height);

      // Convert ImageData to pixel array format
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

      // Ensure sprite has proper frame structure
      if (!sprite.frames || sprite.frames.length === 0) {
        sprite.initializeFrames();
      }

      // Handle both legacy and animation-enabled sprites
      if (sprite.frames && sprite.frames.length > 0) {
        // Animation-enabled sprite - set pixels on the first frame's first layer
        const firstFrame = sprite.frames[0];
        if (firstFrame.layers && firstFrame.layers.length > 0) {
          firstFrame.layers[0].pixels = pixels.map((row) =>
            row.map((pixel) => [...pixel])
          );
        } else {
          // Fallback: create default layer structure
          firstFrame.layers = [
            {
              id: Date.now() + Math.random(),
              name: "Background",
              visible: true,
              opacity: 1,
              pixels: pixels.map((row) => row.map((pixel) => [...pixel])),
              locked: false,
              blendMode: "normal",
            },
          ];
        }

        // Update sprite's backward compatibility properties
        sprite.layers = firstFrame.layers.map((layer) => ({
          ...layer,
          pixels: layer.pixels.map((row) => row.map((pixel) => [...pixel])),
        }));
        sprite.pixels = sprite.layers[0].pixels;
      } else {
        // Legacy sprite - use setPixelArray method
        sprite.setPixelArray(pixels);
      }

      // Update layer manager if it exists
      if (this.editor.layerManager) {
        this.editor.layerManager.fromSprite(sprite);
      }

      // Force UI update
      this.editor.updateUI();

      // Force canvas render
      if (this.editor.canvasManager) {
        this.editor.canvasManager.render();
      }
    } catch (error) {
      console.error("Error creating sprite from image data:", error);
      this.showNotification("Failed to create sprite from image", "error");
    } finally {
      // Always reset the importing flag
      setTimeout(() => {
        this.editor._importingSprite = false;
      }, 1000);
    }

    setTimeout(() => {
      this.updateCanvasColorsPalette();
    }, 100);
  }

  createSpriteFromImageDataRobust(imageData, width, height, spriteName = null) {
    const name = spriteName || `Imported ${width}x${height}`;

    // Convert ImageData to pixel array
    const pixels = this.imageDataToPixelArray(imageData, width, height);

    // Create sprite using editor's method
    const sprite = this.editor.createNewSprite(width, height, name);

    // Apply pixels based on sprite structure
    this.applyPixelsToSprite(sprite, pixels);

    // Ensure proper initialization
    this.initializeSpriteAfterImport(sprite);

    return sprite;
  }

  // Helper method to convert ImageData to 2D pixel array
  imageDataToPixelArray(imageData, width, height) {
    const pixels = [];

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

    return pixels;
  }

  // Helper method to apply pixels to sprite regardless of structure
  applyPixelsToSprite(sprite, pixels) {
    if (
      sprite.frames &&
      Array.isArray(sprite.frames) &&
      sprite.frames.length > 0
    ) {
      // Animation-enabled sprite
      const firstFrame = sprite.frames[0];

      if (!firstFrame.layers || !Array.isArray(firstFrame.layers)) {
        // Initialize layers array if it doesn't exist
        firstFrame.layers = [];
      }

      if (firstFrame.layers.length === 0) {
        // Create default layer
        firstFrame.layers.push({
          name: "Background",
          visible: true,
          opacity: 1,
          pixels: pixels,
        });
      } else {
        // Use first existing layer
        firstFrame.layers[0].pixels = pixels;
      }

      // Ensure frame dimensions are correct
      firstFrame.width = sprite.width;
      firstFrame.height = sprite.height;
    } else if (typeof sprite.setPixelArray === "function") {
      // Legacy sprite with setPixelArray method
      sprite.setPixelArray(pixels);
    } else {
      // Direct pixel assignment fallback
      sprite.pixels = pixels;
    }
  }

  // Helper method to ensure sprite is properly initialized after import
  initializeSpriteAfterImport(sprite) {
    // Update layer manager if it exists
    if (this.editor.layerManager && sprite) {
      try {
        this.editor.layerManager.fromSprite(sprite);
      } catch (error) {
        console.warn("Failed to sync with layer manager:", error);
      }
    }

    // Update animation manager if it exists
    if (this.editor.animationManager && sprite.frames) {
      try {
        this.editor.animationManager.initializeFromSprite(sprite);
      } catch (error) {
        console.warn("Failed to sync with animation manager:", error);
      }
    }

    // Force UI updates
    this.editor.updateUI();

    // Force canvas render
    if (this.editor.canvasManager) {
      this.editor.canvasManager.render();
    }

    // Update frames list
    this.updateFramesList();
  }

  // Show rename dialog
  showLayerRenameDialog(layer, index) {
    // Create modal overlay
    const modal = document.createElement("div");
    modal.className = "rename-modal-overlay";
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(3px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease-out;
    `;

    // Create modal content
    const modalContent = document.createElement("div");
    modalContent.className = "rename-modal-content";
    modalContent.style.cssText = `
        background: #2d2d2d;
        border: 1px solid #444;
        border-radius: 12px;
        padding: 24px;
        min-width: 320px;
        max-width: 90vw;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        color: #fff;
        animation: slideIn 0.2s ease-out;
    `;

    modalContent.innerHTML = `
        <h3 style="
            color: #00d4ff;
            font-size: 18px;
            margin: 0 0 20px 0;
            text-align: center;
        ">Rename Layer</h3>
        
        <div class="input-group" style="margin-bottom: 20px;">
            <label for="layer-name-input" style="
                display: block;
                color: #ccc;
                font-size: 14px;
                font-weight: 500;
                margin-bottom: 8px;
            ">Layer Name:</label>
            <input type="text" id="layer-name-input" value="${layer.name}" style="
                width: 100%;
                padding: 10px 12px;
                border: 1px solid #444;
                border-radius: 6px;
                background: #1a1a1a;
                color: #fff;
                font-size: 14px;
                box-sizing: border-box;
                transition: border-color 0.2s, box-shadow 0.2s;
            ">
        </div>
        
        <div style="
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        ">
            <button id="layer-rename-cancel" class="btn btn-secondary" style="
                background: #444;
                color: #fff;
                border: 1px solid #555;
                border-radius: 6px;
                padding: 8px 16px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 6px;
            ">Cancel</button>
            <button id="layer-rename-confirm" class="btn btn-primary" style="
                background: #00d4ff;
                color: #1a1a1a;
                border: none;
                border-radius: 6px;
                padding: 8px 16px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 6px;
            ">Rename</button>
        </div>
    `;

    // Add CSS animations
    const style = document.createElement("style");
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes slideIn {
            from { 
                opacity: 0;
                transform: translateY(-10px) scale(0.95);
            }
            to { 
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
        
        .rename-modal-content input:focus {
            outline: none;
            border-color: #00d4ff !important;
            box-shadow: 0 0 0 2px rgba(0, 212, 255, 0.3) !important;
        }
        
        .rename-modal-content .btn:hover {
            transform: translateY(-1px);
        }
        
        .rename-modal-content .btn-secondary:hover {
            background: #555 !important;
            border-color: #666 !important;
        }
        
        .rename-modal-content .btn-primary:hover {
            background: #00bae6 !important;
        }
    `;

    document.head.appendChild(style);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Get elements
    const input = modal.querySelector("#layer-name-input");
    const cancelBtn = modal.querySelector("#layer-rename-cancel");
    const confirmBtn = modal.querySelector("#layer-rename-confirm");

    // Focus and select text after a brief delay to ensure visibility
    setTimeout(() => {
      input.focus();
      input.select();
    }, 50);

    const cleanup = () => {
      document.head.removeChild(style);
      document.body.removeChild(modal);
    };

    const handleRename = () => {
      const newName = input.value.trim();
      if (newName && newName !== layer.name) {
        // FIXED: Use LayerManager method instead of direct property modification
        if (this.editor && this.editor.layerManager) {
          const success = this.editor.layerManager.setLayerName(index, newName);
          if (success) {
            // FIXED: Force sprite save after layer rename
            if (this.editor.saveLayersToSprite) {
              this.editor.saveLayersToSprite();
            }

            // Update UI
            this.updateLayersList();

            if (this.showNotification) {
              this.showNotification(`Renamed layer to "${newName}"`, "success");
            }
          } else {
            if (this.showNotification) {
              this.showNotification("Failed to rename layer", "error");
            }
          }
        } else {
          // Fallback to direct modification if layerManager not available
          layer.name = newName;
          this.updateLayersList();
          if (this.showNotification) {
            this.showNotification(`Renamed layer to "${newName}"`, "success");
          }
        }
      }
      cleanup();
    };

    const handleCancel = () => {
      cleanup();
    };

    // Event listeners
    confirmBtn.addEventListener("click", handleRename);
    cancelBtn.addEventListener("click", handleCancel);

    // Handle keyboard events
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleRename();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    });

    // Close on outside click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        handleCancel();
      }
    });

    // Prevent modal content clicks from closing
    modalContent.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }

  // Update selected color from input value (HEX or RGB)
  updateSelectedColor(value, type = "hex") {
    let rgba;

    if (type === "hex") {
      let val = value.trim();
      if (!val.startsWith("#")) val = "#" + val;
      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
        rgba = this.hexToRgba(val);
        // Preserve current alpha when changing hex
        if (this.editor.primaryColor && this.editor.primaryColor.length > 3) {
          rgba[3] = this.editor.primaryColor[3];
        }
      }
    } else if (type === "rgba") {
      // Support both rgb() and rgba() formats
      const rgbaMatch = value.match(
        /^rgba?\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})(?:,\s*([\d.]+))?\)$/
      );
      if (rgbaMatch) {
        const r = Math.min(255, parseInt(rgbaMatch[1]));
        const g = Math.min(255, parseInt(rgbaMatch[2]));
        const b = Math.min(255, parseInt(rgbaMatch[3]));
        const a = rgbaMatch[4]
          ? Math.min(1, parseFloat(rgbaMatch[4])) * 255
          : 255;
        rgba = [r, g, b, Math.round(a)];
      }
    }

    if (rgba) {
      this.editor.setPrimaryColor(rgba);
      this.updateColorDisplay();

      // Update custom color picker if it exists
      if (this.colorSquare) {
        this.updatePickerFromColor(rgba);
      }

      // Deselect palette colors since we have a custom color
      this.deselectColorPalette();
    }
  }

  setupColorModeToggle() {
    const toggleBtn = document.getElementById("toggle-color-mode");
    const hexInput = document.getElementById("color-hex");
    const rgbInput = document.getElementById("color-rgb");
    const labelHex = document.getElementById("label-hex");
    const labelRgb = document.getElementById("label-rgb");
    if (!toggleBtn || !hexInput || !rgbInput || !labelHex || !labelRgb) return;
    toggleBtn.addEventListener("click", () => {
      if (this.colorMode === "hex") {
        this.colorMode = "rgb";
        hexInput.style.display = "none";
        labelHex.style.display = "none";
        rgbInput.style.display = "block";
        labelRgb.style.display = "block";
        toggleBtn.textContent = "Show HEX";
      } else {
        this.colorMode = "hex";
        hexInput.style.display = "";
        labelHex.style.display = "";
        rgbInput.style.display = "none";
        labelRgb.style.display = "none";
        toggleBtn.textContent = "Show RGB";
      }
    });
  }

  setupColorInputListeners() {
    const hexInput = document.getElementById("color-hex");
    const rgbInput = document.getElementById("color-rgb");
    const alphaSlider = document.getElementById("alpha-slider");

    if (hexInput) {
      hexInput.addEventListener("input", (e) => {
        this.updateSelectedColor(e.target.value, "hex");
      });
      hexInput.addEventListener("change", (e) => {
        this.updateSelectedColor(e.target.value, "hex");
      });
    }

    if (rgbInput) {
      rgbInput.addEventListener("input", (e) => {
        this.updateSelectedColor(e.target.value, "rgba");
      });
      rgbInput.addEventListener("change", (e) => {
        this.updateSelectedColor(e.target.value, "rgba");
      });
    }

    // Add alpha slider support
    if (alphaSlider) {
      alphaSlider.addEventListener("input", (e) => {
        const currentColor = [...this.editor.primaryColor];
        currentColor[3] = parseInt(e.target.value);
        this.editor.setPrimaryColor(currentColor);
        this.updateColorDisplay();

        // Update alpha value display
        const alphaValue = document.getElementById("alpha-value");
        if (alphaValue) {
          alphaValue.textContent = `${Math.round(
            (currentColor[3] / 255) * 100
          )}%`;
        }
      });
    }
  }

  // Call this from eyedropper tool when color is picked
  setColorFromEyedropper(rgba) {
    // Use updateSelectedColor to ensure full sync
    this.updateSelectedColor(this.rgbaToHex(rgba), "hex");
  }

  // Update color inputs display
  updateColorInputs(hex, rgba) {
    const hexInput = document.getElementById("color-hex");
    const rgbInput = document.getElementById("color-rgb");
    const alphaSlider = document.getElementById("alpha-slider");
    const alphaValue = document.getElementById("alpha-value");

    if (hexInput) hexInput.value = hex;

    if (rgbInput) {
      rgbInput.value = `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${(
        rgba[3] / 255
      ).toFixed(2)})`;
    }

    // Update alpha controls if they exist
    if (alphaSlider && rgba.length > 3) {
      alphaSlider.value = rgba[3];
      if (alphaValue) {
        alphaValue.textContent = `${Math.round((rgba[3] / 255) * 100)}%`;
      }
    }
  }
  showExportModal() {
    const modal = document.getElementById("export-modal");
    if (modal && this.editor.currentSprite) {
      // Reset to default values
      document.getElementById("export-format").value = "svg";
      document.getElementById("export-scale").value = "1";
      document.getElementById("export-fps").value = "12";

      this.updateExportUIForFormat();
      this.updateExportPreview();
      modal.style.display = "flex";
    }
  }
  updateExportUIForFormat() {
    const format = document.getElementById("export-format").value;
    const scaleGroup = document.getElementById("scale-group");
    const fpsGroup = document.getElementById("fps-group");
    const quickExportBtn = document.getElementById("quick-export");

    // Show/hide controls based on format
    if (format === "gif") {
      // GIF format - show FPS, hide scale, modify quick export
      scaleGroup.style.display = "none";
      fpsGroup.style.display = "block";
      quickExportBtn.textContent = "Quick Export (12 FPS)";
    } else {
      // SVG/PNG formats - show scale, hide FPS
      scaleGroup.style.display = "block";
      fpsGroup.style.display = "none";
      quickExportBtn.textContent = "Quick Export (20x)";
    }
  }

  updateExportModalForAnimation() {
    const sprite = this.editor.currentSprite;
    const hasAnimation = sprite && sprite.frames && sprite.frames.length > 1;

    // Find or create animation export section
    let animationSection = document.getElementById("animation-export-section");

    if (hasAnimation) {
      if (!animationSection) {
        animationSection = document.createElement("div");
        animationSection.id = "animation-export-section";
        animationSection.className = "export-section";
        animationSection.innerHTML = `
        <h3 style="color: #00d4ff; margin-bottom: 15px;">Animation Export</h3>
        <div class="export-row">
          <label for="animation-fps">Frame Rate (FPS):</label>
          <input type="number" id="animation-fps" min="1" max="60" value="12" style="width: 60px;">
        </div>
        <div class="export-buttons" style="display: flex; gap: 10px; margin-top: 15px;">
          <button id="export-animated-svg" class="btn btn-primary">
            <i class="fas fa-file-code"></i> Export Animated SVG
          </button>
          <button id="export-gif" class="btn btn-primary">
            <i class="fas fa-file-image"></i> Export GIF
          </button>
          <button id="export-frames-zip" class="btn btn-primary">
            <i class="fas fa-file-archive"></i> Export Frames (ZIP)
          </button>
        </div>
      `;

        // Insert before the regular export options
        const exportContent = document.querySelector(
          "#export-modal .modal-content"
        );
        const regularExportSection =
          exportContent.querySelector(".export-section");
        exportContent.insertBefore(animationSection, regularExportSection);

        // Add event listeners
        document
          .getElementById("export-animated-svg")
          .addEventListener("click", () => {
            const fps = parseInt(
              document.getElementById("animation-fps").value
            );
            this.editor.exportAsAnimatedSVG(fps);
            this.hideExportModal();
          });

        document.getElementById("export-gif").addEventListener("click", () => {
          const fps = parseInt(document.getElementById("animation-fps").value);
          this.editor.exportAsGIF(fps);
          this.hideExportModal();
        });

        document
          .getElementById("export-frames-zip")
          .addEventListener("click", () => {
            this.editor.exportFramesAsZip();
            this.hideExportModal();
          });
      }

      animationSection.style.display = "block";
    } else {
      if (animationSection) {
        animationSection.style.display = "none";
      }
    }
  }

  hideExportModal() {
    const modal = document.getElementById("export-modal");
    if (modal) {
      modal.style.display = "none";
    }
  }

  updateExportPreview() {
    const format = document.getElementById("export-format").value;
    const scaleSlider = document.getElementById("export-scale");
    const fpsSlider = document.getElementById("export-fps");
    const scaleValue = document.getElementById("scale-value");
    const fpsValue = document.getElementById("fps-value");
    const dimensions = document.getElementById("export-dimensions");
    const animationInfo = document.getElementById("export-animation-info");
    const frameCount = document.getElementById("frame-count");
    const spritesheetBtn = document.getElementById("export-spritesheet");

    if (!this.editor.currentSprite) return;

    const sprite = this.editor.currentSprite;
    const hasAnimation = sprite.frames && sprite.frames.length > 1;

    // Show/hide spritesheet button based on animation
    if (spritesheetBtn) {
      spritesheetBtn.style.display = hasAnimation ? "inline-block" : "none";
    }

    // Update scale/fps values
    if (scaleSlider && scaleValue) {
      const scale = parseInt(scaleSlider.value);
      scaleValue.textContent = `${scale}x`;

      if (format !== "gif") {
        const newWidth = sprite.width * scale;
        const newHeight = sprite.height * scale;
        dimensions.textContent = `${sprite.width}x${sprite.height} → ${newWidth}x${newHeight}`;
      }
    }

    if (fpsSlider && fpsValue) {
      const fps = parseInt(fpsSlider.value);
      fpsValue.textContent = `${fps}`;
    }

    // Update animation info
    if (animationInfo && frameCount) {
      if (hasAnimation) {
        frameCount.textContent = sprite.frames.length;
        animationInfo.style.display = "block";

        if (format === "gif") {
          dimensions.textContent = `${sprite.width}x${sprite.height} (animated)`;
        }
      } else {
        animationInfo.style.display = "none";

        if (format === "gif") {
          dimensions.textContent = `${sprite.width}x${sprite.height} (single frame)`;
        }
      }
    }
  }

  async performExport() {
    const format = document.getElementById("export-format").value;
    const scale = parseInt(
      document.getElementById("export-scale").value || "1"
    );
    const fps = parseInt(document.getElementById("export-fps").value || "12");

    const sprite = this.editor.currentSprite;
    if (!sprite) {
      this.showNotification("No sprite to export", "error");
      return;
    }

    const hasAnimation = sprite.frames && sprite.frames.length > 1;

    this.hideExportModal();

    try {
      switch (format) {
        case "svg":
          if (hasAnimation) {
            await this.editor.exportAsAnimatedSVG(fps);
            this.showNotification(
              `Exported animated SVG with ${sprite.frames.length} frames`,
              "success"
            );
          } else {
            this.editor.exportAsSVG(scale);
            this.showNotification(`Exported SVG at ${scale}x scale`, "success");
          }
          break;

        case "png":
          if (hasAnimation) {
            await this.editor.exportFramesAsZip();
            this.showNotification(
              `Exported ${sprite.frames.length} frames as ZIP`,
              "success"
            );
          } else {
            this.editor.exportAsPNG(scale);
            this.showNotification(`Exported PNG at ${scale}x scale`, "success");
          }
          break;

        case "gif":
          if (hasAnimation) {
            // DON'T show notification here - let exportAsGIF handle it
            await this.editor.exportAsGIF(fps);
          } else {
            // For single frame, export as static PNG instead
            this.editor.exportAsPNG(scale);
            this.showNotification("Single frame exported as PNG", "info");
          }
          break;

        default:
          this.showNotification("Unknown export format", "error");
      }
    } catch (error) {
      console.error("Export failed:", error);
      this.showNotification(`Export failed: ${error.message}`, "error");
    }
  }
  async performSpritesheetExport() {
    const format = document.getElementById("export-format").value;
    const scale = parseInt(
      document.getElementById("export-scale").value || "1"
    );

    const sprite = this.editor.currentSprite;
    if (!sprite || !sprite.frames || sprite.frames.length <= 1) {
      this.showNotification(
        "No animation frames to export as spritesheet",
        "error"
      );
      return;
    }

    this.hideExportModal();

    try {
      switch (format) {
        case "svg":
          await this.editor.exportFramesAsSVGSpritesheet(scale);
          this.showNotification(
            `Exported SVG spritesheet with ${sprite.frames.length} frames`,
            "success"
          );
          break;
        case "png":
          await this.editor.exportFramesAsPNGSpritesheet(scale);
          this.showNotification(
            `Exported PNG spritesheet with ${sprite.frames.length} frames`,
            "success"
          );
          break;
        case "gif":
          await this.editor.exportFramesAsPNGSpritesheet(scale);
          this.showNotification(
            `Exported PNG spritesheet with ${sprite.frames.length} frames (GIF format uses PNG for spritesheets)`,
            "info"
          );
          break;
        default:
          this.showNotification(
            "Unknown export format for spritesheet",
            "error"
          );
      }
    } catch (error) {
      console.error("Spritesheet export failed:", error);
      this.showNotification(
        `Spritesheet export failed: ${error.message}`,
        "error"
      );
    }
  }
  async performQuickExport() {
    const format = document.getElementById("export-format").value;
    const sprite = this.editor.currentSprite;

    if (!sprite) {
      this.showNotification("No sprite to export", "error");
      return;
    }

    const hasAnimation = sprite.frames && sprite.frames.length > 1;

    this.hideExportModal();

    try {
      switch (format) {
        case "svg":
          if (hasAnimation) {
            await this.editor.exportAsAnimatedSVG(12); // Quick export at 12 FPS
            this.showNotification(
              "Quick exported animated SVG at 12 FPS",
              "success"
            );
          } else {
            this.editor.exportAsSVG(20); // Quick export at 20x scale
            this.showNotification("Quick exported SVG at 20x scale", "success");
          }
          break;

        case "png":
          if (hasAnimation) {
            await this.editor.exportFramesAsZip();
            this.showNotification("Quick exported frames as ZIP", "success");
          } else {
            this.editor.exportAsPNG(20); // Quick export at 20x scale
            this.showNotification("Quick exported PNG at 20x scale", "success");
          }
          break;

        case "gif":
          if (hasAnimation) {
            await this.editor.exportAsGIF(12); // Quick export at 12 FPS
            this.showNotification(
              "Quick exported animated GIF at 12 FPS",
              "success"
            );
          } else {
            this.editor.exportAsPNG(20); // For single frame, export as PNG
            this.showNotification("Quick exported single frame as PNG", "info");
          }
          break;

        default:
          this.showNotification("Unknown export format", "error");
      }
    } catch (error) {
      console.error("Quick export failed:", error);
      this.showNotification(`Quick export failed: ${error.message}`, "error");
    }
  }

  // Update frame display when frame changes
  updateFrameDisplay() {
    if (this.editor && this.editor.canvasManager) {
      this.editor.canvasManager.updateFrameDisplay();
    }
  }
  // Add this method to the UIController class

  showCustomConfirm(message, onConfirm, onCancel = null) {
    const modal = document.getElementById("confirm-modal");
    const messageEl = document.getElementById("confirm-modal-message");
    const cancelBtn = document.getElementById("confirm-cancel");
    const confirmBtn = document.getElementById("confirm-confirm");

    // Set message
    messageEl.textContent = message;

    // Show modal
    modal.style.display = "flex";

    const cleanup = () => {
      modal.style.display = "none";
      // Remove event listeners to prevent memory leaks
      confirmBtn.removeEventListener("click", handleConfirm);
      cancelBtn.removeEventListener("click", handleCancel);
      modal.removeEventListener("keydown", handleKeydown);
      modal.removeEventListener("click", handleOutsideClick);
    };

    const handleConfirm = () => {
      cleanup();
      if (onConfirm) onConfirm();
    };

    const handleCancel = () => {
      cleanup();
      if (onCancel) onCancel();
    };

    const handleKeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    };

    const handleOutsideClick = (e) => {
      if (e.target === modal) {
        handleCancel();
      }
    };

    // Event listeners
    confirmBtn.addEventListener("click", handleConfirm);
    cancelBtn.addEventListener("click", handleCancel);
    modal.addEventListener("keydown", handleKeydown);
    modal.addEventListener("click", handleOutsideClick);

    // Focus the confirm button for keyboard accessibility
    setTimeout(() => {
      confirmBtn.focus();
    }, 100);
  }
}

// Make UIController globally available
window.UIController = UIController;
