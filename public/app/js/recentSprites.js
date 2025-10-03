// Recent Sprites Manager - Handles persistent folder access for sprites
class RecentSpritesManager {
  constructor(editor) {
    this.editor = editor;
    this.dirHandle = null;
    this.dbName = "pixelEditorDB";
    this.dbVersion = 1;
    this.storeName = "fileHandles";

    this.setupEventListeners();
    this.initializeDatabase();
    this.setupDragAndDrop();
  }

  // Setup drag-and-drop for image import
  setupDragAndDrop() {
    const container = document.getElementById("sprites-sidebar");
    if (!container) return;

    container.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      container.classList.add("drag-over");
    });

    container.addEventListener("dragleave", (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Only remove drag-over if we're leaving the container entirely
      if (!container.contains(e.relatedTarget)) {
        container.classList.remove("drag-over");
      }
    });

    container.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      container.classList.remove("drag-over");
      
      // Handle dropped files
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        this.handleDroppedFiles(e.dataTransfer.files);
      }
    });

    // Prevent default drag behaviors on the document
    document.addEventListener("dragover", (e) => e.preventDefault());
    document.addEventListener("drop", (e) => e.preventDefault());
  }

  // Handle dropped image files
  async handleDroppedFiles(fileList) {
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file.type.startsWith("image/")) continue;
      
      try {
        if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith('.svg')) {
          // Handle SVG files
          await this.handleSVGFile(file);
        } else {
          // Handle raster images (PNG, JPG, etc.)
          await this.handleRasterImage(file);
        }
      } catch (error) {
        console.error(`Failed to process dropped file: ${file.name}`, error);
        if (window.editor && window.editor.uiManager) {
          window.editor.uiManager.showNotification(
            `Failed to load: ${file.name}`,
            "error"
          );
        }
      }
    }
  }

  // Handle SVG file loading
  async handleSVGFile(file) {
    try {
      const svgText = await file.text();
      const sprite = await this.parseSVGToSprite(svgText, file.name.replace(/\.[^/.]+$/, ""));
      
      if (window.editor && window.editor.addSprite) {
        window.editor.addSprite(sprite);
        window.editor.setCurrentSprite(sprite);
        window.editor.uiManager.showNotification(
          `Imported SVG: ${sprite.name} (${sprite.width}x${sprite.height})`,
          "success"
        );
      }
    } catch (error) {
      throw new Error(`Failed to process SVG file: ${error.message}`);
    }
  }

  // Handle raster image files
  async handleRasterImage(file) {
    const img = new Image();
    
    return new Promise((resolve, reject) => {
      img.onload = async () => {
        try {
          // Create a canvas to get image data
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          
          // If too large, show downscale modal
          if (img.width > 64 || img.height > 64) {
            if (
              window.editor &&
              window.editor.uiManager &&
              window.editor.uiManager.showDownscaleModal
            ) {
              window.editor.uiManager.showDownscaleModal(
                imageData,
                img.width,
                img.height
              );
            }
          } else {
            // Otherwise, import directly
            if (window.editor && window.editor.createSpriteFromImageData) {
              window.editor.createSpriteFromImageData(
                imageData,
                img.width,
                img.height
              );
              window.editor.uiManager.showNotification(
                `Imported image: ${img.width}x${img.height}`,
                "success"
              );
            }
          }
          
          URL.revokeObjectURL(img.src);
          resolve();
        } catch (error) {
          URL.revokeObjectURL(img.src);
          reject(error);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error("Failed to load dropped image"));
      };

      img.src = URL.createObjectURL(file);
    });
  }

  // Initialize IndexedDB for storing file handles
  async initializeDatabase() {
    try {
      await this.loadStoredDirectoryHandle();
    } catch (error) {
      console.error("Failed to initialize recent sprites:", error);
    }
  }

  // Get IndexedDB instance
  async getDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  // Save directory handle to IndexedDB
  async saveDirectoryHandle(handle) {
    try {
      const db = await this.getDatabase();
      const transaction = db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);

      return new Promise((resolve, reject) => {
        const request = store.put(handle, "spritesDirectory");
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Failed to save directory handle:", error);
      throw error;
    }
  }

  // Load directory handle from IndexedDB
  async loadDirectoryHandle() {
    try {
      const db = await this.getDatabase();
      const transaction = db.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);

      return new Promise((resolve, reject) => {
        const request = store.get("spritesDirectory");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Failed to load directory handle:", error);
      return null;
    }
  }

  // Load stored directory handle and check permissions
  async loadStoredDirectoryHandle() {
    const storedHandle = await this.loadDirectoryHandle();

    if (storedHandle) {
      try {
        // Check if we still have permission
        const permission = await storedHandle.queryPermission({
          mode: "readwrite",
        });

        if (permission === "granted") {
          this.dirHandle = storedHandle;
          await this.loadRecentSprites();
        } else if (permission === "prompt") {
          // Try to request permission
          const requestResult = await storedHandle.requestPermission({
            mode: "readwrite",
          });
          if (requestResult === "granted") {
            this.dirHandle = storedHandle;
            await this.loadRecentSprites();
          }
        }
      } catch (error) {
        console.warn("Stored directory handle is no longer valid:", error);
        // Clear invalid handle
        await this.clearStoredHandle();
      }
    }

    this.updateUI();
  }

  // Clear stored directory handle
  async clearStoredHandle() {
    try {
      const db = await this.getDatabase();
      const transaction = db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);

      return new Promise((resolve, reject) => {
        const request = store.delete("spritesDirectory");
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Failed to clear stored handle:", error);
    }
  }

  // Setup event listeners
  setupEventListeners() {
    const pickFolderBtn = document.getElementById("pick-folder");
    if (pickFolderBtn) {
      pickFolderBtn.addEventListener("click", () => this.pickSpritesFolder());
      console.log("Pick folder button event listener added");
    } else {
      console.warn("Pick folder button not found");
    }
  }

  // Pick sprites folder
  async pickSpritesFolder() {
    console.log("pickSpritesFolder called");

    try {
      // Check if File System Access API is supported
      if (!("showDirectoryPicker" in window)) {
        console.log("showDirectoryPicker not supported");
        this.showUnsupportedMessage();
        return;
      }

      console.log("Calling showDirectoryPicker...");
      this.dirHandle = await window.showDirectoryPicker({
        mode: "readwrite",
      });

      // Save handle for persistence
      await this.saveDirectoryHandle(this.dirHandle);

      // Request persistent storage
      if ("storage" in navigator && "persist" in navigator.storage) {
        await navigator.storage.persist();
      }

      // Load sprites from the selected folder
      await this.loadRecentSprites();

      this.editor.uiManager.showNotification(
        "Sprites folder selected successfully!",
        "success"
      );
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Failed to pick folder:", error);
        this.editor.uiManager.showNotification(
          "Failed to select folder",
          "error"
        );
      }
    }
  }

  // Load recent sprites from the selected folder
  async loadRecentSprites() {
    if (!this.dirHandle) return;

    try {
      const sprites = [];

      for await (const entry of this.dirHandle.values()) {
        if (
          entry.kind === "file" &&
          entry.name.toLowerCase().endsWith(".svg")
        ) {
          try {
            const file = await entry.getFile();
            const url = URL.createObjectURL(file);

            sprites.push({
              name: entry.name.replace(".svg", ""),
              url: url,
              file: file,
              handle: entry,
              size: `${file.size}B`,
              modified: new Date(file.lastModified).toLocaleDateString(),
            });
          } catch (error) {
            console.warn(`Failed to load sprite: ${entry.name}`, error);
          }
        }
      }

      // Sort by modified date (newest first)
      sprites.sort(
        (a, b) => new Date(b.file.lastModified) - new Date(a.file.lastModified)
      );

      this.displayRecentSprites(sprites);
    } catch (error) {
      console.error("Failed to load recent sprites:", error);
      this.editor.uiManager.showNotification(
        "Failed to load sprites from folder",
        "error"
      );
    }
  }

  // Display recent sprites in the UI
  displayRecentSprites(sprites) {
    const container = document.getElementById("recent-sprites");
    if (!container) return;

    container.innerHTML = "";

    if (sprites.length === 0) {
      container.innerHTML = `
        <div class="no-sprites-message">
          <i class="fas fa-image"></i>
          <p>No SVG sprites found</p>
          <p class="help-text">Save some sprites to see them here</p>
        </div>
      `;
      return;
    }

    sprites.forEach((sprite) => {
      const spriteElement = document.createElement("div");
      spriteElement.className = "recent-sprite-item";
      spriteElement.setAttribute("data-tooltip", `${sprite.name} (${sprite.size})`);

      spriteElement.innerHTML = `
        <img src="${sprite.url}" alt="${sprite.name}" loading="lazy">
        <div class="recent-sprite-info">
          <div class="recent-sprite-name">${sprite.name}</div>
          <div class="recent-sprite-size">${sprite.modified}</div>
        </div>
      `;

      // Add click handler to load sprite
      spriteElement.addEventListener("click", () => {
        this.loadSpriteFromFile(sprite);
      });

      container.appendChild(spriteElement);
    });
  }

  // Load sprite from file into editor - FIXED METHOD
  async loadSpriteFromFile(spriteData) {
    try {
      // Use the editor's existing import functionality
      await this.editor.importFile(spriteData.file);
      
      this.editor.uiManager.showNotification(
        `Loaded sprite: ${spriteData.name}`,
        "success"
      );
    } catch (error) {
      console.error("Failed to load sprite:", error);
      this.editor.uiManager.showNotification(
        `Failed to load sprite: ${spriteData.name}`,
        "error"
      );
    }
  }

  // Save current sprite to the selected folder
  async saveCurrentSpriteToFolder() {
    if (!this.dirHandle || !this.editor.currentSprite) {
      this.editor.uiManager.showNotification(
        "No folder selected or no current sprite",
        "error"
      );
      return;
    }

    try {
      const sprite = this.editor.currentSprite;
      const svgString = sprite.toSVG();
      const fileName = `${sprite.name}.svg`;

      const fileHandle = await this.dirHandle.getFileHandle(fileName, {
        create: true,
      });
      const writable = await fileHandle.createWritable();

      await writable.write(svgString);
      await writable.close();

      // Reload recent sprites to show the new file
      await this.loadRecentSprites();

      this.editor.uiManager.showNotification(
        `Saved sprite: ${fileName}`,
        "success"
      );
    } catch (error) {
      console.error("Failed to save sprite to folder:", error);
      this.editor.uiManager.showNotification(
        "Failed to save sprite to folder",
        "error"
      );
    }
  }

  // Show unsupported browser message
  showUnsupportedMessage() {
    const container = document.getElementById("recent-sprites");
    if (container) {
      container.innerHTML = `
        <div class="no-sprites-message">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Feature not supported</p>
          <p class="help-text">Your browser doesn't support the File System Access API. Try Chrome 86+</p>
        </div>
      `;
    }
  }

  // Update UI based on current state
  updateUI() {
    const container = document.getElementById("recent-sprites");

    if (container) {
      // Always try to load recent sprites if we have a directory handle
      if (this.dirHandle) {
        this.loadRecentSprites();
      }
    }
  }
}

// Make RecentSpritesManager globally available
window.RecentSpritesManager = RecentSpritesManager;