/**
 * AI Pixel Art Generator with Pollinations.AI Integration
 * Enhanced with proper mode switching and improved color algorithms
 */

class AIGenerator {
  constructor() {
    this.loaded = true; // Pollinations doesn't require model loading
    this.isGenerating = false;
    this.modal = null;
    this.currentMode = "generate"; // 'generate' or 'chat'
    this.init();
  }

  init() {
    this.createModal();
    this.bindEvents();
  }

  createModal() {
    this.modal = document.getElementById("ai-generator-modal");
  }

  bindEvents() {
    // Main generate button in header
    const generateBtn = document.getElementById("generate-ai-button");
    if (generateBtn) {
      generateBtn.addEventListener("click", () => this.showModal());
    }

    // Mode switching
    document
      .getElementById("generate-tab")
      ?.addEventListener("click", () => this.switchMode("generate"));
    document
      .getElementById("chat-tab")
      ?.addEventListener("click", () => this.switchMode("chat"));

    // Modal events
    document
      .getElementById("ai-modal-close")
      ?.addEventListener("click", () => this.hideModal());
    document
      .getElementById("ai-cancel")
      ?.addEventListener("click", () => this.hideModal());
    document
      .getElementById("chat-close")
      ?.addEventListener("click", () => this.hideModal());
    document
      .getElementById("ai-generate")
      ?.addEventListener("click", () => this.generateArt());
    document
      .getElementById("ai-apply")
      ?.addEventListener("click", () => this.applyToCanvas());

    // Chat events
    document
      .getElementById("chat-send")
      ?.addEventListener("click", () => this.sendChatMessage());
    document
      .getElementById("chat-clear")
      ?.addEventListener("click", () => this.clearChat());

    // Close modal when clicking outside
    this.modal?.addEventListener("click", (e) => {
      if (e.target === this.modal) this.hideModal();
    });

    // Enter key in chat input
    const chatInput = document.getElementById("chat-input");
    if (chatInput) {
      chatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.sendChatMessage();
        }
      });
    }
  }

  showModal() {
    if (this.modal) {
      this.modal.style.display = "flex";
      // Focus on appropriate input based on current mode
      setTimeout(() => {
        if (this.currentMode === "generate") {
          document.getElementById("ai-prompt")?.focus();
        } else {
          document.getElementById("chat-input")?.focus();
        }
      }, 100);
    }
  }

  hideModal() {
    if (this.modal) {
      this.modal.style.display = "none";
      this.resetModal();
    }
  }

  resetModal() {
    document.getElementById("ai-preview-container").style.display = "none";
    document.getElementById("ai-apply").style.display = "none";
    document.getElementById("ai-status").innerHTML = "";
    this.isGenerating = false;
  }

  switchMode(mode) {
    const generateTab = document.getElementById("generate-tab");
    const chatTab = document.getElementById("chat-tab");
    const generateMode = document.getElementById("generate-mode");
    const chatMode = document.getElementById("chat-mode");
    const generateButtons = document.getElementById("generate-buttons");
    const chatButtons = document.getElementById("chat-buttons");

    this.currentMode = mode;

    if (mode === "generate") {
      // Switch to generate mode
      generateTab.classList.add("active");
      chatTab.classList.remove("active");
      generateTab.style.background = "#4CAF50";
      chatTab.style.background = "#444";
      generateMode.style.display = "block";
      chatMode.style.display = "none";
      generateButtons.style.display = "flex";
      chatButtons.style.display = "none";

      // Focus on prompt
      setTimeout(() => document.getElementById("ai-prompt")?.focus(), 100);
    } else {
      // Switch to chat mode
      generateTab.classList.remove("active");
      chatTab.classList.add("active");
      generateTab.style.background = "#444";
      chatTab.style.background = "#6C9BD2";
      generateMode.style.display = "none";
      chatMode.style.display = "block";
      generateButtons.style.display = "none";
      chatButtons.style.display = "flex";

      // Focus on chat input
      setTimeout(() => document.getElementById("chat-input")?.focus(), 100);
    }
  }

  async sendChatMessage() {
    const input = document.getElementById("chat-input");
    const message = input.value.trim();
    if (!message) return;

    const messagesContainer = document.getElementById("chat-messages");

    // Add user message
    this.addChatMessage("user", message);
    input.value = "";

    // Add thinking indicator
    const thinkingDiv = this.addChatMessage("assistant", "Thinking...", true);

    try {
      // Call Pollinations AI for text generation
      const response = await this.getChatResponse(message);

      // Remove thinking indicator and add real response
      thinkingDiv.remove();
      this.addChatMessage("assistant", response);
    } catch (error) {
      thinkingDiv.remove();
      this.addChatMessage(
        "assistant",
        "Sorry, I had trouble responding. Please try again."
      );
      console.error("Chat error:", error);
    }
  }

  async getChatResponse(userMessage) {
    const systemPrompt =
      "You are a helpful AI assistant specialized in pixel art, game design, and creative projects. You provide practical advice about color palettes, art techniques, creative themes, and design principles. Keep responses concise but helpful, and focus on actionable suggestions. You understand retro gaming aesthetics, color theory, and pixel art workflows.";

    const encodedMessage = encodeURIComponent(userMessage);
    const encodedSystem = encodeURIComponent(systemPrompt);

    try {
      const response = await fetch(
        `https://text.pollinations.ai/${encodedMessage}?system=${encodedSystem}&model=openai`
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const text = await response.text();
      return text;
    } catch (error) {
      console.error("Error calling Pollinations text API:", error);
      throw error;
    }
  }

  addChatMessage(role, content, isTemporary = false) {
    const messagesContainer = document.getElementById("chat-messages");
    const messageDiv = document.createElement("div");
    messageDiv.className = `chat-message ${role}`;

    if (isTemporary) {
      messageDiv.classList.add("temporary");
    }

    const senderName = role === "user" ? "You" : "AI Assistant";

    messageDiv.innerHTML = `
        <div class="chat-message-sender">${senderName}</div>
        <div class="chat-message-content">${content}</div>
    `;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    return messageDiv;
  }

  clearChat() {
    const messagesContainer = document.getElementById("chat-messages");
    // Keep only the initial welcome message
    const welcomeMessage = messagesContainer.querySelector(
      ".chat-message.assistant"
    );
    messagesContainer.innerHTML = "";
    if (welcomeMessage) {
      messagesContainer.appendChild(welcomeMessage.cloneNode(true));
    } else {
      // Recreate welcome message if it doesn't exist
      this.addChatMessage(
        "assistant",
        "Hello! I'm here to help with your pixel art projects. Ask me about color palettes, art techniques, creative themes, or any design questions you have!"
      );
    }
  }

  async generateArt() {
    if (this.isGenerating) return;

    const generateBtn = document.getElementById("ai-generate");
    const statusEl = document.getElementById("ai-status");
    const previewContainer = document.getElementById("ai-preview-container");
    const applyBtn = document.getElementById("ai-apply");

    try {
      this.isGenerating = true;
      generateBtn.disabled = true;
      generateBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Generating...';
      previewContainer.style.display = "none";
      applyBtn.style.display = "none";

      // FIXED: Ensure we get the actual selected value as integer
      const prompt = document.getElementById("ai-prompt").value.trim();
      const canvasSizeElement = document.getElementById("ai-canvas-size");
      const targetSize = parseInt(canvasSizeElement.value, 10); // Force base-10 parsing
      const colorPalette = document.getElementById("ai-color-palette").value;
      const model = document.getElementById("ai-model").value;

      // Debug log to verify the target size
      console.log(
        "Selected target size:",
        targetSize,
        "from element value:",
        canvasSizeElement.value
      );

      if (!prompt) {
        throw new Error("Please enter a prompt");
      }

      if (isNaN(targetSize) || targetSize < 16 || targetSize > 64) {
        throw new Error("Invalid target size selected");
      }

      // Generate image using Pollinations.AI
      statusEl.innerHTML =
        '<i class="fas fa-magic"></i> Generating image with Pollinations.AI...';

      const generatedImage = await this.generateImageWithPollinations(
        prompt,
        model
      );

      // Show original image
      const originalCanvas = document.getElementById("ai-original-canvas");
      originalCanvas.width = 400;
      originalCanvas.height = 400;
      const originalCtx = originalCanvas.getContext("2d");
      originalCtx.imageSmoothingEnabled = false;
      originalCtx.drawImage(
        generatedImage,
        0,
        0,
        originalCanvas.width,
        originalCanvas.height
      );

      // Apply pixelation with improved algorithm
      statusEl.innerHTML =
        '<i class="fas fa-th"></i> Converting to pixel art with enhanced algorithms...';
      await this.simulateDelay(500);

      const pixelCanvas = document.getElementById("ai-pixel-canvas");
      pixelCanvas.width = targetSize * 8; // Display size for pixel art
      pixelCanvas.height = targetSize * 8;

      this.pixelateImageAdvanced(
        generatedImage,
        pixelCanvas,
        colorPalette,
        targetSize
      );

      // Show results
      statusEl.innerHTML =
        '<i class="fas fa-check"></i> Generation complete! Click "Add to Canvas" to use this art.';
      previewContainer.style.display = "block";
      applyBtn.style.display = "inline-block";

      // FIXED: Store the result with explicit targetSize
      this.lastGenerated = {
        canvas: pixelCanvas,
        size: targetSize, // Make sure this is the integer value
        prompt: prompt,
      };

      console.log("Stored lastGenerated with size:", this.lastGenerated.size);
    } catch (error) {
      statusEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Error: ${error.message}`;
      console.error("Generation error:", error);
    } finally {
      this.isGenerating = false;
      generateBtn.disabled = false;
      generateBtn.innerHTML = '<i class="fas fa-magic"></i> Generate';
    }
  }

  async generateImageWithPollinations(prompt, model = "flux") {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous"; // Enable CORS for canvas manipulation

      // Build Pollinations.AI URL
      const encodedPrompt = encodeURIComponent(prompt);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?model=${model}&width=512&height=512&nologo=true&enhance=true`;

      img.onload = () => {
        resolve(img);
      };

      img.onerror = (error) => {
        console.error("Error loading image from Pollinations.AI:", error);
        reject(
          new Error(
            "Failed to generate image with Pollinations.AI. Please check your internet connection and try again."
          )
        );
      };

      // Add cache-busting parameter to ensure fresh generation
      const cacheBuster = Date.now();
      img.src = `${imageUrl}&seed=${cacheBuster}`;
    });
  }

  // Enhanced pixelation algorithm with better color quantization
  pixelateImageAdvanced(sourceImage, targetCanvas, colorPalette, targetSize) {
    // Create a temporary canvas to work with the source image
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = sourceImage.width || sourceImage.naturalWidth;
    tempCanvas.height = sourceImage.height || sourceImage.naturalHeight;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(sourceImage, 0, 0);

    const targetCtx = targetCanvas.getContext("2d");
    targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    targetCtx.imageSmoothingEnabled = false;

    // Scale factor from display canvas to actual pixel grid
    const scaleFactor = targetCanvas.width / targetSize;

    // Get palette colors for better color matching
    const palette = this.getEnhancedColorPalette(colorPalette);

    for (let gridY = 0; gridY < targetSize; gridY++) {
      for (let gridX = 0; gridX < targetSize; gridX++) {
        // Enhanced sampling - take multiple samples for better color representation
        const sampleSize = Math.max(
          1,
          Math.floor(tempCanvas.width / targetSize / 4)
        );
        const centerX = Math.floor((gridX / targetSize) * tempCanvas.width);
        const centerY = Math.floor((gridY / targetSize) * tempCanvas.height);

        let r = 0,
          g = 0,
          b = 0,
          a = 0;
        let sampleCount = 0;

        // Sample multiple pixels for better color averaging
        for (let dy = -sampleSize; dy <= sampleSize; dy++) {
          for (let dx = -sampleSize; dx <= sampleSize; dx++) {
            const sampleX = Math.max(
              0,
              Math.min(tempCanvas.width - 1, centerX + dx)
            );
            const sampleY = Math.max(
              0,
              Math.min(tempCanvas.height - 1, centerY + dy)
            );

            const pixelData = tempCtx.getImageData(sampleX, sampleY, 1, 1);
            r += pixelData.data[0];
            g += pixelData.data[1];
            b += pixelData.data[2];
            a += pixelData.data[3];
            sampleCount++;
          }
        }

        // Average the sampled colors
        r = Math.round(r / sampleCount);
        g = Math.round(g / sampleCount);
        b = Math.round(b / sampleCount);
        a = Math.round(a / sampleCount);

        // Apply color palette with improved color distance calculation
        if (colorPalette !== "full" && a > 0) {
          const nearestColor = this.findNearestColorAdvanced(r, g, b, palette);
          [r, g, b] = this.hexToRgb(nearestColor);
        }

        // Draw pixel block
        if (a > 0) {
          // Only draw non-transparent pixels
          targetCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
          targetCtx.fillRect(
            gridX * scaleFactor,
            gridY * scaleFactor,
            scaleFactor,
            scaleFactor
          );
        }
      }
    }
  }

  // Enhanced color palettes with more accurate colors
  getEnhancedColorPalette(paletteType) {
    const palettes = {
      retro: [
        "#000000",
        "#FFFFFF",
        "#FF0000",
        "#00FF00",
        "#0000FF",
        "#FFFF00",
        "#FF00FF",
        "#00FFFF",
        "#800000",
        "#008000",
        "#000080",
        "#808000",
        "#800080",
        "#008080",
        "#C0C0C0",
        "#808080",
      ],
      gameboy: ["#0F380F", "#306230", "#8BAC0F", "#9BBD0F"],
      nes: [
        "#7C7C7C",
        "#0000FC",
        "#0000BC",
        "#4428BC",
        "#940084",
        "#A80020",
        "#A81000",
        "#881400",
        "#503000",
        "#007800",
        "#006800",
        "#005800",
        "#004058",
        "#000000",
        "#BCBCBC",
        "#0078F8",
        "#3CBCFC",
        "#68A2E8",
        "#9878F8",
        "#BC88D8",
        "#E45C80",
        "#FC7858",
      ],
      c64: [
        "#000000",
        "#FFFFFF",
        "#880000",
        "#AAFFEE",
        "#CC44CC",
        "#00CC55",
        "#0000AA",
        "#EEEE77",
        "#DD8855",
        "#664400",
        "#FF7777",
        "#333333",
        "#777777",
        "#AAFF66",
        "#0088FF",
        "#BBBBBB",
      ],
      pico8: [
        "#000000",
        "#1D2B53",
        "#7E2553",
        "#008751",
        "#AB5236",
        "#5F574F",
        "#C2C3C7",
        "#FFF1E8",
        "#FF004D",
        "#FFA300",
        "#FFEC27",
        "#00E436",
        "#29ADFF",
        "#83769C",
        "#FF77A8",
        "#FFCCAA",
      ],
    };
    return palettes[paletteType] || palettes.retro;
  }

  // Improved color distance calculation using perceptual color difference
  findNearestColorAdvanced(r, g, b, palette) {
    let minDistance = Infinity;
    let nearestColor = palette[0];

    for (const color of palette) {
      const [pr, pg, pb] = this.hexToRgb(color);

      // Use perceptual color difference (weighted RGB)
      // Human eye is more sensitive to green, less to blue
      const deltaR = r - pr;
      const deltaG = g - pg;
      const deltaB = b - pb;

      // Perceptual color distance formula
      const distance = Math.sqrt(
        0.3 * deltaR * deltaR + 0.59 * deltaG * deltaG + 0.11 * deltaB * deltaB
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearestColor = color;
      }
    }

    return nearestColor;
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [
          parseInt(result[1], 16),
          parseInt(result[2], 16),
          parseInt(result[3], 16),
        ]
      : [0, 0, 0];
  }

  simulateDelay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Add this method to your AIGenerator class to handle the resize properly
  applyToCanvas() {
    if (!this.lastGenerated || !window.editor) {
      console.error("No generated content or editor not found");
      return;
    }

    try {
      // Get the pixelated canvas and selected parameters
      const sourceCanvas = this.lastGenerated.canvas;
      const targetSize = parseInt(this.lastGenerated.size, 10);

      console.log("Applying to canvas with target size:", targetSize);

      // Validate targetSize
      if (
        !targetSize ||
        isNaN(targetSize) ||
        targetSize < 16 ||
        targetSize > 64
      ) {
        console.error("Invalid target size:", targetSize);
        if (window.editor.uiManager?.showNotification) {
          window.editor.uiManager.showNotification(
            "Invalid target size detected",
            "error"
          );
        }
        return;
      }

      // Get current sprite and layer manager
      const currentSprite = window.editor.currentSprite;
      const layerManager = window.editor.layerManager;

      if (!currentSprite || !layerManager) {
        console.error("No current sprite or layer manager");
        return;
      }

      console.log(
        `Resizing canvas from ${currentSprite.width}x${currentSprite.height} to ${targetSize}x${targetSize}`
      );

      // Step 1: Resize the current sprite to match target size
      this.resizeCurrentSprite(
        currentSprite,
        layerManager,
        targetSize,
        targetSize
      );

      // Step 2: Clear the active layer
      const activeLayer = layerManager.getActiveLayer();
      if (!activeLayer) {
        console.error("No active layer found after resize");
        return;
      }

      // Step 3: Import the AI generated image data
      this.importImageDataToLayer(sourceCanvas, activeLayer, targetSize);

      // Step 4: Update everything
      layerManager.notifyChange();
      window.editor.saveLayersToSprite();

      // Force canvas render
      if (window.editor.canvasManager) {
        window.editor.canvasManager.updateCanvasSize();
        window.editor.canvasManager.render();
      }

      // Step 5: Update sprite name
      this.updateSpriteName(currentSprite);

      // Step 6: Close modal and show success
      this.hideModal();

      if (window.editor.uiManager?.showNotification) {
        window.editor.uiManager.showNotification(
          `AI art applied to ${targetSize}x${targetSize} canvas!`,
          "success"
        );
      }

      console.log(
        `Successfully applied AI art to ${targetSize}x${targetSize} canvas`
      );
    } catch (error) {
      console.error("Error applying AI art to canvas:", error);
      if (window.editor.uiManager?.showNotification) {
        window.editor.uiManager.showNotification(
          "Error applying AI art to canvas",
          "error"
        );
      }
    }
  }
  resizeCurrentSprite(sprite, layerManager, newWidth, newHeight) {
    console.log(
      `Resizing sprite from ${sprite.width}x${sprite.height} to ${newWidth}x${newHeight}`
    );

    // Update sprite dimensions first
    sprite.width = newWidth;
    sprite.height = newHeight;

    // Update layer manager dimensions
    layerManager.width = newWidth;
    layerManager.height = newHeight;

    // Resize all layers
    layerManager.layers.forEach((layer) => {
      const newPixels = [];

      // Create new pixel array with proper dimensions
      for (let y = 0; y < newHeight; y++) {
        newPixels[y] = [];
        for (let x = 0; x < newWidth; x++) {
          // Initialize with transparent pixels
          newPixels[y][x] = [0, 0, 0, 0];
        }
      }

      // Replace the layer's pixel array
      layer.pixels = newPixels;
    });

    console.log(`Sprite resized to ${newWidth}x${newHeight}`);
  }

  // Helper method to import image data into a layer
  importImageDataToLayer(sourceCanvas, targetLayer, targetSize) {
    console.log("Importing AI image data to layer...");

    const sourceCtx = sourceCanvas.getContext("2d");
    const sourceWidth = sourceCanvas.width;
    const sourceHeight = sourceCanvas.height;

    console.log(
      `Source canvas: ${sourceWidth}x${sourceHeight}, Target: ${targetSize}x${targetSize}`
    );

    // Sample the source canvas and map to target layer pixels
    for (let y = 0; y < targetSize; y++) {
      for (let x = 0; x < targetSize; x++) {
        // Calculate sample coordinates (center of each target pixel)
        const sampleX = Math.floor(((x + 0.5) / targetSize) * sourceWidth);
        const sampleY = Math.floor(((y + 0.5) / targetSize) * sourceHeight);

        // Ensure we stay within bounds
        const clampedX = Math.max(0, Math.min(sourceWidth - 1, sampleX));
        const clampedY = Math.max(0, Math.min(sourceHeight - 1, sampleY));

        // Get pixel data from source
        const pixelData = sourceCtx.getImageData(clampedX, clampedY, 1, 1).data;

        // Set pixel in target layer
        targetLayer.pixels[y][x] = [
          pixelData[0], // R
          pixelData[1], // G
          pixelData[2], // B
          pixelData[3], // A
        ];
      }
    }

    console.log("Image data imported successfully");
  }

  // Helper method to update sprite name with AI prompt
  updateSpriteName(sprite) {
    const promptText =
      this.lastGenerated.prompt ||
      document.getElementById("ai-prompt")?.value.trim() ||
      "AI Generated";

    // Create a short, descriptive name
    const shortName = promptText
      .split(" ")
      .slice(0, 3)
      .join(" ")
      .substring(0, 20);

    sprite.name = `AI: ${shortName}`;

    // Update UI to reflect new name
    if (window.editor.updateUI) {
      window.editor.updateUI();
    }

    console.log(`Updated sprite name to: ${sprite.name}`);
  }
  // Add this manual resize method as a fallback
  manualResizeCanvas(sprite, layerManager, newWidth, newHeight) {
    console.log("Performing manual canvas resize to", newWidth, "x", newHeight);

    try {
      // Update sprite dimensions
      sprite.width = newWidth;
      sprite.height = newHeight;

      // Resize all layers
      if (layerManager && layerManager.layers) {
        layerManager.layers.forEach((layer) => {
          const oldPixels = layer.pixels || [];
          layer.pixels = [];

          // Initialize new pixel array
          for (let y = 0; y < newHeight; y++) {
            layer.pixels[y] = [];
            for (let x = 0; x < newWidth; x++) {
              // Copy old pixel if it exists, otherwise transparent
              if (oldPixels[y] && oldPixels[y][x]) {
                layer.pixels[y][x] = [...oldPixels[y][x]];
              } else {
                layer.pixels[y][x] = [0, 0, 0, 0];
              }
            }
          }
        });
      }

      console.log("Manual resize completed successfully");
    } catch (error) {
      console.error("Manual resize failed:", error);
    }
  }

  // Helper method to get current layer from pixel editor
  getCurrentLayer() {
    if (window.pixelEditor && window.pixelEditor.layerManager) {
      return window.pixelEditor.layerManager.getActiveLayer();
    }
    return null;
  }

  // Helper method to set sprite name
  setSpriteName(name) {
    if (window.pixelEditor && window.pixelEditor.currentSprite) {
      window.pixelEditor.currentSprite.name = name;
      if (
        window.pixelEditor.uiManager &&
        window.pixelEditor.uiManager.updateSpriteList
      ) {
        window.pixelEditor.uiManager.updateSpriteList();
      }
    }
  }
}

// Initialize AI Generator when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.aiGenerator = new AIGenerator();
  console.log(
    "Enhanced AI Generator with mode switching and improved algorithms initialized"
  );
});

// Export for module usage
if (typeof module !== "undefined" && module.exports) {
  module.exports = AIGenerator;
}
