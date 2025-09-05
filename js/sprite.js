// Sprite Class - Represents a pixel art sprite
class Sprite {
  constructor(width, height, name = "Untitled", id = null) {
    this.id = id || Date.now() + Math.random();
    this.name = name;
    this.width = width;
    this.height = height;
    this.createdAt = new Date().toISOString();
    this.modifiedAt = new Date().toISOString();

    // Use Uint8Array for better memory efficiency on large images
    if (width * height > 50000) {
      this.pixels = new Uint8Array(width * height * 4);
      this.useTypedArray = true;
    } else {
      this.pixels = this.createEmptyPixelArray();
      this.useTypedArray = false;
    }

    // Optimized history for large sprites
    this.history = [];
    this.historyIndex = -1;
    this.maxHistorySize = width * height > 100000 ? 10 : 50; // Fewer history states for large sprites

    this.onChange = null;
    this.saveToHistory();
  }

  createEmptyPixelArray() {
    if (this.width * this.height > 50000) {
      return new Uint8Array(this.width * this.height * 4);
    }

    const pixels = [];
    for (let y = 0; y < this.height; y++) {
      pixels[y] = [];
      for (let x = 0; x < this.width; x++) {
        pixels[y][x] = [0, 0, 0, 0];
      }
    }
    return pixels;
  }

  // Get pixel at specific coordinates
  getPixel(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return [0, 0, 0, 0];
    }

    if (this.useTypedArray) {
      const index = (y * this.width + x) * 4;
      return [
        this.pixels[index],
        this.pixels[index + 1],
        this.pixels[index + 2],
        this.pixels[index + 3],
      ];
    }

    return [...this.pixels[y][x]];
  }

  // Set pixel at specific coordinates
  setPixel(x, y, color) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return false;
    }

    if (!Array.isArray(color) || color.length !== 4) {
      console.error("Invalid color format:", color);
      return false;
    }

    if (this.useTypedArray) {
      const index = (y * this.width + x) * 4;
      this.pixels[index] = color[0];
      this.pixels[index + 1] = color[1];
      this.pixels[index + 2] = color[2];
      this.pixels[index + 3] = color[3];
    } else {
      this.pixels[y][x] = [...color];
    }

    this.modifiedAt = new Date().toISOString();
    if (typeof this.onChange === "function") {
      this.onChange(this);
    }
    return true;
  }

  // Batch pixel updates for better performance
  setPixels(pixelUpdates) {
    if (!Array.isArray(pixelUpdates)) return false;

    const startTime = performance.now();
    let updateCount = 0;

    for (const update of pixelUpdates) {
      const { x, y, color } = update;
      if (this.setPixel(x, y, color)) {
        updateCount++;
      }

      // Prevent blocking for too long
      if (performance.now() - startTime > 16) {
        // 16ms = 60fps
        break;
      }
    }

    return updateCount;
  }

  // Get the entire pixel array
  // Optimized pixel array access
  getPixelArray() {
    if (this.useTypedArray) {
      const result = [];
      for (let y = 0; y < this.height; y++) {
        result[y] = [];
        for (let x = 0; x < this.width; x++) {
          const index = (y * this.width + x) * 4;
          result[y][x] = [
            this.pixels[index],
            this.pixels[index + 1],
            this.pixels[index + 2],
            this.pixels[index + 3],
          ];
        }
      }
      return result;
    }

    return this.pixels.map((row) => row.map((pixel) => [...pixel]));
  }

  // Optimized pixel array setting
  setPixelArray(pixels) {
    if (!Array.isArray(pixels) || pixels.length !== this.height) {
      console.error("Invalid pixel array dimensions");
      return false;
    }

    if (this.useTypedArray) {
      let index = 0;
      for (let y = 0; y < this.height; y++) {
        if (!Array.isArray(pixels[y]) || pixels[y].length !== this.width) {
          console.error("Invalid pixel array row at", y);
          return false;
        }

        for (let x = 0; x < this.width; x++) {
          const pixel = pixels[y][x];
          this.pixels[index] = pixel[0];
          this.pixels[index + 1] = pixel[1];
          this.pixels[index + 2] = pixel[2];
          this.pixels[index + 3] = pixel[3];
          index += 4;
        }
      }
    } else {
      this.pixels = pixels.map((row) => row.map((pixel) => [...pixel]));
    }

    this.modifiedAt = new Date().toISOString();
    if (typeof this.onChange === "function") {
      this.onChange(this);
    }
    return true;
  }

  // Resize the sprite
  resize(newWidth, newHeight, maintainAspectRatio = false) {
    if (maintainAspectRatio) {
      const aspectRatio = this.width / this.height;
      if (newWidth / newHeight > aspectRatio) {
        newWidth = Math.round(newHeight * aspectRatio);
      } else {
        newHeight = Math.round(newWidth / aspectRatio);
      }
    }

    // Determine if we should use typed arrays for the new size
    const shouldUseTypedArray = newWidth * newHeight > 50000;

    if (shouldUseTypedArray) {
      const newPixels = new Uint8Array(newWidth * newHeight * 4);

      // Copy existing pixels efficiently
      for (let y = 0; y < Math.min(this.height, newHeight); y++) {
        for (let x = 0; x < Math.min(this.width, newWidth); x++) {
          const oldPixel = this.getPixel(x, y);
          const newIndex = (y * newWidth + x) * 4;
          newPixels[newIndex] = oldPixel[0];
          newPixels[newIndex + 1] = oldPixel[1];
          newPixels[newIndex + 2] = oldPixel[2];
          newPixels[newIndex + 3] = oldPixel[3];
        }
      }

      this.pixels = newPixels;
      this.useTypedArray = true;
    } else {
      const newPixels = [];
      for (let y = 0; y < newHeight; y++) {
        newPixels[y] = [];
        for (let x = 0; x < newWidth; x++) {
          if (x < this.width && y < this.height) {
            newPixels[y][x] = [...this.getPixel(x, y)];
          } else {
            newPixels[y][x] = [0, 0, 0, 0];
          }
        }
      }

      this.pixels = newPixels;
      this.useTypedArray = false;
    }

    this.width = newWidth;
    this.height = newHeight;
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
  clone(newName = null) {
    const copy = new Sprite(
      this.width,
      this.height,
      newName || `${this.name} Copy`
    );
    copy.setPixelArray(this.getPixelArray());
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
  toImageData() {
    const imageData = new ImageData(this.width, this.height);
    const data = imageData.data;

    if (this.useTypedArray) {
      // Direct copy for typed arrays
      data.set(this.pixels);
    } else {
      // Convert 2D array to flat array
      let index = 0;
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          const [r, g, b, a] = this.pixels[y][x];
          data[index] = r;
          data[index + 1] = g;
          data[index + 2] = b;
          data[index + 3] = a;
          index += 4;
        }
      }
    }

    return imageData;
  }

  /**
   * Create sprite from ImageData
   */
  static fromImageData(imageData, name = "Imported Sprite") {
    const sprite = new Sprite(imageData.width, imageData.height, name);

    if (sprite.useTypedArray) {
      sprite.pixels.set(imageData.data);
    } else {
      const data = imageData.data;
      let index = 0;
      for (let y = 0; y < imageData.height; y++) {
        for (let x = 0; x < imageData.width; x++) {
          sprite.pixels[y][x] = [
            data[index],
            data[index + 1],
            data[index + 2],
            data[index + 3],
          ];
          index += 4;
        }
      }
    }

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
        const [r, g, b, a] = this.pixels[y][x];

        // Only include non-transparent pixels
        if (a > 0) {
          hasVisiblePixels = true;
          if (a === 255) {
            // Fully opaque pixels
            const color = `rgb(${r},${g},${b})`;
            svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="${color}"/>`;
          } else {
            // Semi-transparent pixels
            const opacity = (a / 255).toFixed(3);
            const color = `rgba(${r},${g},${b},${opacity})`;
            svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="${color}"/>`;
          }
        }
      }
    }

    // If no visible pixels, add a transparent pixel to ensure valid SVG
    if (!hasVisiblePixels) {
      svg += '<rect x="0" y="0" width="1" height="1" fill="rgba(0,0,0,0)"/>';
    }

    svg += "</g></svg>";
    return svg;
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
        const [r, g, b, a] = this.pixels[y][x];

        if (a === 0) {
          transparentPixels++;
        } else {
          opaquePixels++;
          const colorKey = `${r},${g},${b},${a}`;
          colorCounts.set(colorKey, (colorCounts.get(colorKey) || 0) + 1);
        }
      }
    }

    return {
      width: this.width,
      height: this.height,
      totalPixels: this.width * this.height,
      transparentPixels,
      opaquePixels,
      uniqueColors: colorCounts.size,
      colorCounts: Object.fromEntries(colorCounts),
      createdAt: this.createdAt,
      modifiedAt: this.modifiedAt,
    };
  }
}
