// UI Controller - Handles user interface interactions and updates
class UIController {
  constructor(editor) {
    this.editor = editor;
    this.colorPicker = null;
    this.recentSpritesManager = null;
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
  }
  // Setup event listener for secondary color switching
  setupSecondaryColorSwitch() {
    const secondaryColor = document.getElementById("secondary-color");
    if (secondaryColor) {
      secondaryColor.addEventListener("click", this.swapPrimarySecondaryColor);
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
    const existingPickers = colorWheelContainer.querySelectorAll(
      ".iro__color-picker, canvas"
    );
    existingPickers.forEach((picker) => picker.remove());

    if (window.ColorWheel) {
      // If using custom ColorWheel class
      const canvas = colorWheelContainer.querySelector("canvas");
      if (canvas) {
        this.colorWheel = new window.ColorWheel(canvas, (hex) => {
          const rgba = this.hexToRgba(hex);
          this.editor.setPrimaryColor(rgba);
          this.updateColorDisplay();
          this.updateColorInputs(hex, rgba);
          this.deselectColorPalette();
        });
      }
    } else if (window.iro) {
      // Fallback to iro.js - only create if not already exists
      try {
        this.colorPicker = new iro.ColorPicker(colorWheelContainer, {
          width: 120,
          color: {
            hsl: { h: 0, s: 50, l: 50 },
          },
          borderWidth: 2,
          borderColor: "#333",
        });

        this.colorPicker.on("color:change", (color) => {
          const hex = color.hexString;
          const rgba = this.hexToRgba(hex);
          this.editor.setPrimaryColor(rgba);
          this.updateColorDisplay();
          this.updateColorInputs(hex, rgba);
          this.deselectColorPalette();
        });
      } catch (error) {
        console.error("Failed to create iro color picker:", error);
      }
    }
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
        layerItem.className = `layer-item ${i === activeIndex ? "active" : ""}`;
        layerItem.setAttribute("draggable", "true");
        layerItem.dataset.index = i;

        layerItem.innerHTML = `
        <span class="drag-handle" title="Drag to reorder">
          <i class="fas fa-grip-vertical"></i>
        </span>
        <span class="layer-name">${layer.name || `Layer ${i + 1}`}</span>
        <input type="range" class="layer-opacity-slider" min="0" max="100" value="${Math.round(
          (layer.opacity || 1) * 100
        )}" title="Opacity" />
        <span class="layer-opacity-value">${Math.round(
          (layer.opacity || 1) * 100
        )}%</span>
        <button class="btn btn-sm layer-visibility" title="Toggle Visibility">
          <i class="fas ${layer.visible !== false ? "fa-eye" : "fa-eye-slash"
          }"></i>
        </button>
      `;

        // Click to select layer
        layerItem.addEventListener("click", (e) => {
          // Only select if not clicking slider or button
          if (
            !e.target.classList.contains("layer-opacity-slider") &&
            !e.target.classList.contains("layer-visibility") &&
            !e.target.closest(".layer-visibility")
          ) {
            this.editor.layerManager.setActiveLayer(i);
            this.updateLayersList();
            this.showNotification(
              `Selected ${layer.name || `Layer ${i + 1}`}`,
              "info"
            );
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
          layerItem.classList.add("drag-over");
        });
        layerItem.addEventListener("dragleave", (e) => {
          layerItem.classList.remove("drag-over");
        });
        layerItem.addEventListener("drop", (e) => {
          e.preventDefault();
          layerItem.classList.remove("drag-over");
          const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
          const toIndex = i;
          if (fromIndex !== toIndex) {
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

    const menuItems = [
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
          if (confirm(`Are you sure you want to delete "${layer.name}"?`)) {
            if (this.editor.layerManager.deleteLayer(index)) {
              this.updateLayersList();
              this.showNotification(`Deleted ${layer.name}`, "success");
            } else {
              this.showNotification("Cannot delete the last layer", "error");
            }
          }
          this.hideContextMenu();
        },
        danger: true,
        disabled: this.editor.layerManager.layers.length <= 1,
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

    // Color picker
    this.setupColorPicker();

    // Modal controls
    this.setupModals();

    // Keyboard shortcuts
    this.setupKeyboardShortcuts();

    this.setupFrameControls();
  }

  setupFrameControls() {
    // Frame control buttons
    const addFrameBtn = document.getElementById('add-frame-btn');
    const duplicateFrameBtn = document.getElementById('duplicate-frame-btn');
    const deleteFrameBtn = document.getElementById('delete-frame-btn');

    if (addFrameBtn) {
      addFrameBtn.addEventListener('click', () => {
        if (this.editor.animationManager) {
          this.editor.animationManager.addFrame();
          this.updateFramesList();
          this.showNotification('Frame added', 'success');
        }
      });
    }

    if (duplicateFrameBtn) {
      duplicateFrameBtn.addEventListener('click', () => {
        if (this.editor.animationManager) {
          this.editor.animationManager.duplicateFrame();
          this.updateFramesList();
          this.showNotification('Frame duplicated', 'success');
        }
      });
    }

    if (deleteFrameBtn) {
      deleteFrameBtn.addEventListener('click', () => {
        if (this.editor.animationManager) {
          const success = this.editor.animationManager.deleteFrame();
          if (success) {
            this.updateFramesList();
            this.showNotification('Frame deleted', 'success');
          } else {
            this.showNotification('Cannot delete the last frame', 'warning');
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
    const framesToggleBtn = document.getElementById('frames-toggle-btn');
    const framesRow = document.getElementById('frames-row');

    if (framesToggleBtn && framesRow) {
      // Load saved state from localStorage
      const isCollapsed = localStorage.getItem('frames-panel-collapsed') === 'true';
      if (isCollapsed) {
        framesRow.classList.add('collapsed');
      }

      framesToggleBtn.addEventListener('click', () => {
        const isCurrentlyCollapsed = framesRow.classList.contains('collapsed');

        if (isCurrentlyCollapsed) {
          framesRow.classList.remove('collapsed');
          localStorage.setItem('frames-panel-collapsed', 'false');
          if (this.showNotification) {
            this.showNotification('Frames panel expanded', 'info');
          }
        } else {
          framesRow.classList.add('collapsed');
          localStorage.setItem('frames-panel-collapsed', 'true');
          if (this.showNotification) {
            this.showNotification('Frames panel collapsed', 'info');
          }
        }
      });
    }
  }

  setupAnimationControls() {
    // Create animation controls if they don't exist
    const framesToolbar = document.querySelector('.frames-toolbar');
    if (framesToolbar && !document.getElementById('play-btn')) {
      const animationControls = document.createElement('div');
      animationControls.className = 'animation-controls';
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
      const playBtn = document.getElementById('play-btn');
      const stopBtn = document.getElementById('stop-btn');
      const fpsInput = document.getElementById('fps-input');

      if (playBtn) {
        playBtn.addEventListener('click', () => {
          if (this.editor.animationManager) {
            if (this.editor.animationManager.isPlaying) {
              this.editor.animationManager.stop();
              playBtn.innerHTML = '<i class="fas fa-play"></i>';
              playBtn.title = 'Play Animation';
            } else {
              this.editor.animationManager.play();
              playBtn.innerHTML = '<i class="fas fa-pause"></i>';
              playBtn.title = 'Pause Animation';
            }
          }
        });
      }

      if (stopBtn) {
        stopBtn.addEventListener('click', () => {
          if (this.editor.animationManager) {
            this.editor.animationManager.stop();
            if (playBtn) {
              playBtn.innerHTML = '<i class="fas fa-play"></i>';
              playBtn.title = 'Play Animation';
            }
          }
        });
      }

      if (fpsInput) {
        fpsInput.addEventListener('change', (e) => {
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
    const framesList = document.getElementById('frames-list');
    if (!framesList || !this.editor.animationManager) return;

    const sprite = this.editor.currentSprite;
    if (!sprite || !sprite.frames) {
      framesList.innerHTML = '<div class="no-frames">No frames</div>';
      return;
    }

    // Clear existing frames
    framesList.innerHTML = '';

    // Create frame thumbnails
    sprite.frames.forEach((frame, index) => {
      const frameItem = document.createElement('div');
      frameItem.className = `frame-item ${index === this.editor.animationManager.currentFrameIndex ? 'active' : ''}`;
      frameItem.draggable = true;
      frameItem.dataset.frameIndex = index;

      // Create thumbnail canvas
      const thumbnail = document.createElement('canvas');
      thumbnail.width = 64;
      thumbnail.height = 64;
      thumbnail.className = 'frame-thumbnail';
      const ctx = thumbnail.getContext('2d');

      // Render frame thumbnail
      this.renderFrameThumbnail(ctx, frame, 64, 64);

      // Create frame info
      const frameInfo = document.createElement('div');
      frameInfo.className = 'frame-info';
      frameInfo.innerHTML = `
      <div class="frame-name">${frame.name || `Frame ${index + 1}`}</div>
      <div class="frame-number">${index + 1}</div>
    `;

      frameItem.appendChild(thumbnail);
      frameItem.appendChild(frameInfo);

      // Add event listeners
      frameItem.addEventListener('click', () => {
        this.editor.animationManager.setCurrentFrame(index);
        this.updateFramesList();
        this.updateLayersList();
      });

      // ADDED: Right-click context menu for frame export
      frameItem.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showFrameContextMenu(e, frame, index);
      });

      // Double-click to rename
      frameInfo.addEventListener('dblclick', () => {
        this.editFrameName(frame, frameInfo.querySelector('.frame-name'));
      });

      // Existing drag and drop code...
      frameItem.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', index.toString());
        frameItem.classList.add('dragging');
      });

      frameItem.addEventListener('dragend', () => {
        frameItem.classList.remove('dragging');
      });

      frameItem.addEventListener('dragover', (e) => {
        e.preventDefault();
        frameItem.classList.add('drag-over');
      });

      frameItem.addEventListener('dragleave', () => {
        frameItem.classList.remove('drag-over');
      });

      frameItem.addEventListener('drop', (e) => {
        e.preventDefault();
        frameItem.classList.remove('drag-over');

        const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
        const toIndex = index;

        if (fromIndex !== toIndex) {
          this.editor.animationManager.moveFrame(fromIndex, toIndex);
          this.updateFramesList();
        }
      });

      framesList.appendChild(frameItem);
    });
  }

  showFrameContextMenu(event, frame, frameIndex) {
    this.hideContextMenu();

    const contextMenu = document.createElement('div');
    contextMenu.className = 'frame-context-menu';
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

    const menuItems = [
      {
        label: 'Export Frame (1x)',
        icon: 'fas fa-download',
        action: () => {
          this.editor.exportSingleFrame(frameIndex, 1);
          this.hideContextMenu();
        }
      },
      {
        label: 'Export Frame (4x)',
        icon: 'fas fa-download',
        action: () => {
          this.editor.exportSingleFrame(frameIndex, 4);
          this.hideContextMenu();
        }
      },
      {
        label: 'Export Frame (10x)',
        icon: 'fas fa-download',
        action: () => {
          this.editor.exportSingleFrame(frameIndex, 10);
          this.hideContextMenu();
        }
      },
      { type: 'separator' },
      {
        label: 'Duplicate Frame',
        icon: 'fas fa-copy',
        action: () => {
          this.editor.animationManager.duplicateFrame(frameIndex);
          this.updateFramesList();
          this.hideContextMenu();
        }
      },
      {
        label: 'Delete Frame',
        icon: 'fas fa-trash',
        action: () => {
          if (this.editor.currentSprite.frames.length > 1) {
            if (confirm(`Delete "${frame.name || `Frame ${frameIndex + 1}`}"?`)) {
              this.editor.animationManager.deleteFrame(frameIndex);
              this.updateFramesList();
            }
          } else {
            this.showNotification('Cannot delete the last frame', 'warning');
          }
          this.hideContextMenu();
        },
        danger: true,
        disabled: this.editor.currentSprite.frames.length <= 1
      }
    ];

    // Build menu items
    menuItems.forEach(item => {
      if (item.type === 'separator') {
        const separator = document.createElement('div');
        separator.style.cssText = 'height: 1px; background: #444; margin: 4px 0;';
        contextMenu.appendChild(separator);
      } else {
        const menuItem = document.createElement('div');
        menuItem.style.cssText = `
        padding: 8px 12px;
        cursor: ${item.disabled ? 'not-allowed' : 'pointer'};
        display: flex;
        align-items: center;
        gap: 8px;
        transition: background-color 0.15s ease;
        opacity: ${item.disabled ? '0.5' : '1'};
        ${item.danger && !item.disabled ? 'color: #ff6b6b;' : ''}
      `;

        menuItem.innerHTML = `
        <i class="${item.icon}" style="width: 14px;"></i>
        <span>${item.label}</span>
      `;

        if (!item.disabled) {
          menuItem.addEventListener('mouseenter', () => {
            menuItem.style.backgroundColor = item.danger
              ? 'rgba(255, 107, 107, 0.1)'
              : 'rgba(255, 255, 255, 0.1)';
          });

          menuItem.addEventListener('mouseleave', () => {
            menuItem.style.backgroundColor = 'transparent';
          });

          menuItem.addEventListener('click', item.action);
        }

        contextMenu.appendChild(menuItem);
      }
    });

    // Position and show menu
    let left = event.clientX;
    let top = event.clientY;

    if (left + 180 > window.innerWidth) {
      left = window.innerWidth - 180 - 10;
    }
    if (top + 300 > window.innerHeight) {
      top = window.innerHeight - 300 - 10;
    }

    contextMenu.style.left = `${left}px`;
    contextMenu.style.top = `${top}px`;

    document.body.appendChild(contextMenu);
    this.activeContextMenu = contextMenu;

    document.addEventListener('click', this.handleContextMenuOutsideClick.bind(this), { once: true });
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
    frame.layers.forEach(layer => {
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
    ctx.fillStyle = '#404040';

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
    const currentName = frame.name || 'Frame';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'frame-name-input';
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
      const newName = input.value.trim() || 'Frame';
      frame.name = newName;

      const newNameElement = document.createElement('div');
      newNameElement.className = 'frame-name';
      newNameElement.textContent = newName;

      input.replaceWith(newNameElement);

      // Save changes
      this.editor.saveSprites();

      // Add double-click listener to new element
      newNameElement.addEventListener('dblclick', () => {
        this.editFrameName(frame, newNameElement);
      });
    };

    input.addEventListener('blur', finishEdit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        finishEdit();
      } else if (e.key === 'Escape') {
        const nameElement = document.createElement('div');
        nameElement.className = 'frame-name';
        nameElement.textContent = currentName;
        input.replaceWith(nameElement);

        nameElement.addEventListener('dblclick', () => {
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
  setupColorPicker() {
    const colorPicker = document.getElementById("color-picker");
    if (colorPicker) {
      colorPicker.addEventListener("change", (e) => {
        const rgba = this.hexToRgba(e.target.value);
        this.editor.setPrimaryColor(rgba);
      });
    }
  }

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
      swatch.style.backgroundColor = color;
      swatch.title = color;
      swatch.addEventListener("click", () => {
        // Remove previous selection
        this.deselectColorPalette();
        // Add selection to clicked swatch
        swatch.classList.add("selected");
        // Convert hex to RGBA and set primary color
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
    const colorPicker = document.getElementById("color-picker");
    if (primaryColor && this.editor.primaryColor) {
      const hex = this.rgbaToHex(this.editor.primaryColor);
      primaryColor.style.backgroundColor = hex;
      if (colorPicker) colorPicker.value = hex;
      // Update color wheel if it exists
      if (this.colorPicker && this.colorPicker.color) {
        this.colorPicker.color.hexString = hex;
      }
      // Update color value inputs
      this.updateColorInputs(hex, this.editor.primaryColor);
    }
    // Update secondary color display
    const secondaryColorDiv = document.getElementById("secondary-color");
    if (secondaryColorDiv && this.editor.secondaryColor) {
      const hex2 = this.rgbaToHex(this.editor.secondaryColor);
      secondaryColorDiv.style.backgroundColor = hex2;
    }
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
      spriteItem.className = `sprite-item ${sprite === this.editor.currentSprite ? "active" : ""
        }`;

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

      // Click to select sprite
      spriteItem.addEventListener("click", () => {
        this.editor.setCurrentSprite(sprite);
        // spriteItem.classList.add("active");
        this.updateSpritesList();
      });

      // Right-click context menu
      spriteItem.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        this.showSpriteContextMenu(e, sprite, index);
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
          if (confirm(`Delete "${sprite.name}" from storage permanently?`)) {
            await this.editor.storageManager.deleteSprite(sprite.id);
            this.editor.updateUI();
            this.showNotification(
              `Deleted from storage: ${sprite.name}`,
              "success"
            );
          }
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
      canvas.addEventListener('mouseenter', () => {
        if (!canvas._isAnimating) {
          canvas._isAnimating = true;
          canvas._currentFrameIndex = 0;

          canvas._animationInterval = setInterval(() => {
            canvas._currentFrameIndex = (canvas._currentFrameIndex + 1) % sprite.frames.length;
            this.renderThumbnailFrame(canvas, sprite, canvas._currentFrameIndex);
          }, 150); // ~6.7 FPS for smooth preview
        }
      });

      canvas.addEventListener('mouseleave', () => {
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
      canvas.style.position = 'relative';
      canvas.style.cursor = 'pointer';
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
        frame.layers.forEach(layer => {
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

    const menuItems = [
      {
        label: "Duplicate",
        icon: "fas fa-copy",
        action: () => {
          // Save current layer state before duplicating
          if (this.editor.layerManager && this.editor.currentSprite === sprite) {
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
          if (confirm(`Are you sure you want to delete "${sprite.name}"?`)) {
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

  applyDownscale() {
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

    this.hideDownscaleModal();
    this.showNotification(
      `Image downscaled to ${targetWidth}x${targetHeight}`,
      "success"
    );
  }
  createSpriteFromImageData(imageData, width, height) {
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
          imageData.data[index],     // R
          imageData.data[index + 1], // G
          imageData.data[index + 2], // B
          imageData.data[index + 3], // A
        ];
      }
    }

    // Handle both legacy and animation-enabled sprites
    if (sprite.frames && sprite.frames.length > 0) {
      // Animation-enabled sprite - set pixels on the first frame's first layer
      const firstFrame = sprite.frames[0];
      if (firstFrame.layers && firstFrame.layers.length > 0) {
        firstFrame.layers[0].pixels = pixels;
      } else {
        // Fallback: create default layer structure
        firstFrame.layers = [{
          name: 'Background',
          visible: true,
          opacity: 1,
          pixels: pixels
        }];
      }
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
          imageData.data[index],     // R
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
    if (sprite.frames && Array.isArray(sprite.frames) && sprite.frames.length > 0) {
      // Animation-enabled sprite
      const firstFrame = sprite.frames[0];

      if (!firstFrame.layers || !Array.isArray(firstFrame.layers)) {
        // Initialize layers array if it doesn't exist
        firstFrame.layers = [];
      }

      if (firstFrame.layers.length === 0) {
        // Create default layer
        firstFrame.layers.push({
          name: 'Background',
          visible: true,
          opacity: 1,
          pixels: pixels
        });
      } else {
        // Use first existing layer
        firstFrame.layers[0].pixels = pixels;
      }

      // Ensure frame dimensions are correct
      firstFrame.width = sprite.width;
      firstFrame.height = sprite.height;

    } else if (typeof sprite.setPixelArray === 'function') {
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
        console.warn('Failed to sync with layer manager:', error);
      }
    }

    // Update animation manager if it exists
    if (this.editor.animationManager && sprite.frames) {
      try {
        this.editor.animationManager.initializeFromSprite(sprite);
      } catch (error) {
        console.warn('Failed to sync with animation manager:', error);
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
      }
    } else if (type === "rgb") {
      const rgbMatch = value.match(/^rgb\((\d{1,3}),(\d{1,3}),(\d{1,3})\)$/);
      if (rgbMatch) {
        const r = Math.min(255, parseInt(rgbMatch[1]));
        const g = Math.min(255, parseInt(rgbMatch[2]));
        const b = Math.min(255, parseInt(rgbMatch[3]));
        rgba = [r, g, b, 255];
      }
    }
    if (rgba) {
      this.editor.setPrimaryColor(rgba);
      const hex = this.rgbaToHex(rgba);
      if (this.colorPicker && this.colorPicker.color) {
        this.colorPicker.color.hexString = hex;
      }
      this.updateColorInputs(hex, rgba);
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
        rgbInput.style.display = "";
        labelRgb.style.display = "";
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
        this.updateSelectedColor(e.target.value, "rgb");
      });
      rgbInput.addEventListener("change", (e) => {
        this.updateSelectedColor(e.target.value, "rgb");
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
    if (hexInput) hexInput.value = hex;
    if (rgbInput) rgbInput.value = `rgb(${rgba[0]},${rgba[1]},${rgba[2]})`;
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
    let animationSection = document.getElementById('animation-export-section');

    if (hasAnimation) {
      if (!animationSection) {
        animationSection = document.createElement('div');
        animationSection.id = 'animation-export-section';
        animationSection.className = 'export-section';
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
        const exportContent = document.querySelector('#export-modal .modal-content');
        const regularExportSection = exportContent.querySelector('.export-section');
        exportContent.insertBefore(animationSection, regularExportSection);

        // Add event listeners
        document.getElementById('export-animated-svg').addEventListener('click', () => {
          const fps = parseInt(document.getElementById('animation-fps').value);
          this.editor.exportAsAnimatedSVG(fps);
          this.hideExportModal();
        });

        document.getElementById('export-gif').addEventListener('click', () => {
          const fps = parseInt(document.getElementById('animation-fps').value);
          this.editor.exportAsGIF(fps);
          this.hideExportModal();
        });

        document.getElementById('export-frames-zip').addEventListener('click', () => {
          this.editor.exportFramesAsZip();
          this.hideExportModal();
        });
      }

      animationSection.style.display = 'block';
    } else {
      if (animationSection) {
        animationSection.style.display = 'none';
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

    if (!this.editor.currentSprite) return;

    const sprite = this.editor.currentSprite;
    const hasAnimation = sprite.frames && sprite.frames.length > 1;

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
    const scale = parseInt(document.getElementById("export-scale").value || "1");
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
            this.showNotification(`Exported animated SVG with ${sprite.frames.length} frames`, "success");
          } else {
            this.editor.exportAsSVG(scale);
            this.showNotification(`Exported SVG at ${scale}x scale`, "success");
          }
          break;

        case "png":
          if (hasAnimation) {
            await this.editor.exportFramesAsZip();
            this.showNotification(`Exported ${sprite.frames.length} frames as ZIP`, "success");
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
            this.showNotification("Quick exported animated SVG at 12 FPS", "success");
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
            this.showNotification("Quick exported animated GIF at 12 FPS", "success");
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
}

// Make UIController globally available
window.UIController = UIController;
