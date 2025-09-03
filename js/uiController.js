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

  initializeColorWheel() {
    const colorWheelContainer = document.getElementById("color-wheel");
    if (colorWheelContainer && window.ColorWheel) {
      // If using custom ColorWheel class
      const canvas = colorWheelContainer.querySelector('canvas');
      if (canvas) {
        this.colorWheel = new window.ColorWheel(canvas, (hex) => {
          const rgba = this.hexToRgba(hex);
          this.editor.setPrimaryColor(rgba);
          this.updateColorDisplay();
          this.updateColorInputs(hex, rgba);
          this.deselectColorPalette();
        });
      }
    } else if (colorWheelContainer && window.iro) {
      // Fallback to iro.js
      this.colorPicker = new iro.ColorPicker("#color-wheel", {
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

    if (this.editor.layerManager) {
      const layers = this.editor.layerManager.layers;
      const activeIndex = this.editor.layerManager.activeLayerIndex;

      // Add layers in reverse order (top to bottom in UI)
      for (let i = layers.length - 1; i >= 0; i--) {
        const layer = layers[i];
        const layerItem = document.createElement("div");
        layerItem.className = `layer-item ${i === activeIndex ? "active" : ""}`;
        layerItem.setAttribute("draggable", "true");
        layerItem.dataset.index = i;
        layerItem.style.cssText = `
          display: flex;
          align-items: center;
          padding: 8px 12px;
          margin-bottom: 4px;
          background: ${i === activeIndex ? "rgba(74, 144, 226, 0.2)" : "rgba(255, 255, 255, 0.05)"};
          border: 1px solid ${i === activeIndex ? "#4a90e2" : "transparent"};
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        `;

        layerItem.innerHTML = `
          <span class="drag-handle" title="Drag to reorder" style="cursor: grab; margin-right: 8px; color: #aaa;">
            <i class="fas fa-grip-vertical"></i>
          </span>
          <span class="layer-name" style="flex: 1; color: white;">${layer.name}</span>
          <input type="range" class="layer-opacity-slider" min="0" max="100" value="${Math.round(layer.opacity * 100)}" title="Opacity" style="width: 70px; margin-left: 8px;" />
          <span class="layer-opacity-value" style="font-size: 12px; color: #999; margin-left: 4px;">${Math.round(layer.opacity * 100)}%</span>
          <button class="btn btn-sm layer-visibility" title="Toggle Visibility" style="margin-left: 8px;">
            <i class="fas ${layer.visible ? "fa-eye" : "fa-eye-slash"}"></i>
          </button>
        `;

        // Click to select layer
        layerItem.addEventListener("click", (e) => {
          // Only select if not clicking slider or button
          if (!e.target.classList.contains("layer-opacity-slider") && !e.target.classList.contains("layer-visibility")) {
            this.editor.layerManager.setActiveLayer(i);
            this.updateLayersList();
            this.showNotification(`Selected ${layer.name}`, "info");
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
      // Fallback for when layer manager is not available
      layersList.innerHTML = `
                <div class="layer-item active" style="
                    display: flex;
                    align-items: center;
                    padding: 8px 12px;
                    background: rgba(74, 144, 226, 0.2);
                    border: 1px solid #4a90e2;
                    border-radius: 6px;
                ">
                    <span style="color: white;">Layer 1 (Basic)</span>
                </div>
            `;
    }
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
    const modal = document.createElement("div");
    modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

    modal.innerHTML = `
            <div class="modal rename-modal" style="
                background: #2d2d2d;
                color: white;
                padding: 30px;
                border-radius: 12px;
                max-width: 400px;
                width: 90%;
                text-align: center;
            ">
                <h3 style="margin-bottom: 20px;">Rename Layer</h3>
                <input type="text" id="layer-name-input" value="${layer.name}" style="
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #444;
                    border-radius: 6px;
                    background: #1a1a1a;
                    color: white;
                    font-size: 16px;
                    margin-bottom: 20px;
                    box-sizing: border-box;
                ">
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="layer-rename-cancel" style="
                        background: #666;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 6px;
                        cursor: pointer;
                    ">Cancel</button>
                    <button id="layer-rename-confirm" style="
                        background: #4a90e2;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 6px;
                        cursor: pointer;
                    ">Rename</button>
                </div>
            </div>
        `;

    document.body.appendChild(modal);

    const input = modal.querySelector("#layer-name-input");
    const cancelBtn = modal.querySelector("#layer-rename-cancel");
    const confirmBtn = modal.querySelector("#layer-rename-confirm");

    // Focus and select text
    input.focus();
    input.select();

    const handleRename = () => {
      const newName = input.value.trim();
      if (newName && newName !== layer.name) {
        layer.name = newName;
        this.updateLayersList();
        this.showNotification(`Renamed layer to "${newName}"`, "success");
      }
      modal.remove();
    };

    const handleCancel = () => {
      modal.remove();
    };

    confirmBtn.addEventListener("click", handleRename);
    cancelBtn.addEventListener("click", handleCancel);

    // Handle Enter and Escape keys
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        handleRename();
      } else if (e.key === "Escape") {
        handleCancel();
      }
    });

    // Close on outside click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        handleCancel();
      }
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
  }

  // Handle SVG export - simple direct download
  exportAsSVG() {
    // Just call the editor's direct export method
    this.editor.exportAsSVG();
  }

  // Setup tool button event listeners
  setupToolButtons() {
    const toolButtons = document.querySelectorAll(".tool-btn[data-tool]");
    toolButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const toolName = button.dataset.tool;
        this.editor.setCurrentTool(toolName);
      });
    });

    // Undo button
    const undoBtn = document.getElementById("undo-btn");
    if (undoBtn) {
      undoBtn.addEventListener("click", () => {
        this.editor.undo();
      });
    }

    // Redo button
    const redoBtn = document.getElementById("redo-btn");
    if (redoBtn) {
      redoBtn.addEventListener("click", () => {
        this.editor.redo();
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
    const resizeBtn = document.getElementById("resize-canvas");
    if (resizeBtn) {
      resizeBtn.addEventListener("click", () => {
        this.showResizeModal();
      });
    }
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
        case "g":
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
              this.editor.redo();
            } else {
              this.editor.undo();
            }
            e.preventDefault();
          }
          break;
        case "y":
          if (e.ctrlKey || e.metaKey) {
            this.editor.redo();
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

  updateSpritesList() {
    const spritesList = document.getElementById("sprites-list");
    if (!spritesList) return;

    spritesList.innerHTML = "";

    this.editor.sprites.forEach((sprite, index) => {
      const spriteItem = document.createElement("div");
      spriteItem.className = "sprite-item";
      if (sprite === this.editor.currentSprite) {
        spriteItem.classList.add("active");
      }

      const thumbnail = this.createSpriteThumbnail(sprite);
      const nameSpan = document.createElement("span");
      nameSpan.textContent = sprite.name;
      nameSpan.className = "sprite-name";

      spriteItem.appendChild(thumbnail);
      spriteItem.appendChild(nameSpan);

      spriteItem.addEventListener("click", () => {
        this.editor.setCurrentSprite(sprite);
        this.updateHeaderSpriteName();
      });

      // Add right-click context menu
      spriteItem.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        this.showSpriteContextMenu(e, sprite, index);
      });

      spritesList.appendChild(spriteItem);
    });
  }

  createSpriteThumbnail(sprite) {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    canvas.className = "sprite-thumbnail";

    const ctx = canvas.getContext("2d");

    // Create checkerboard pattern for transparency
    this.drawCheckerboard(ctx, canvas.width, canvas.height, 4);

    // Draw sprite scaled to fit thumbnail
    const scaleX = canvas.width / sprite.width;
    const scaleY = canvas.height / sprite.height;
    const scale = Math.min(scaleX, scaleY);

    const scaledWidth = sprite.width * scale;
    const scaledHeight = sprite.height * scale;
    const offsetX = (canvas.width - scaledWidth) / 2;
    const offsetY = (canvas.height - scaledHeight) / 2;

    // Get pixels using the correct method name
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

    return canvas;
  }

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
    const sizeDisplay = document.getElementById("canvas-size");
    if (sizeDisplay && this.editor.currentSprite) {
      sizeDisplay.textContent = `${this.editor.currentSprite.width}x${this.editor.currentSprite.height}`;
    }
  }

  updateUndoRedoButtons() {
    const undoBtn = document.getElementById("undo-btn");
    const redoBtn = document.getElementById("redo-btn");

    if (undoBtn) {
      undoBtn.disabled = !this.editor.currentSprite?.canUndo();
    }

    if (redoBtn) {
      redoBtn.disabled = !this.editor.currentSprite?.canRedo();
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
      this.editor.resizeCanvas(width, height);
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
  updateAll() {
    this.updateToolButtons();
    this.updateColorDisplay();
    this.updateSpritesList();
    this.updateCanvasSizeDisplay();
    this.updateUndoRedoButtons();
    this.updateToolSettings();
    this.updateSpriteNameInput();
    this.updateHeaderSpriteName();
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

  // Show rename dialog
  showRenameDialog(sprite) {
    const modal = document.createElement("div");
    modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

    modal.innerHTML = `
            <div class="modal rename-modal" style="
                background: #2d2d2d;
                color: white;
                padding: 30px;
                border-radius: 12px;
                max-width: 400px;
                width: 90%;
                text-align: center;
            ">
                <h3 style="margin-bottom: 20px;">Rename Sprite</h3>
                <input type="text" id="sprite-name-input" value="${sprite.name}" style="
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #444;
                    border-radius: 6px;
                    background: #1a1a1a;
                    color: white;
                    font-size: 16px;
                    margin-bottom: 20px;
                    box-sizing: border-box;
                ">
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="rename-cancel" style="
                        background: #666;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 6px;
                        cursor: pointer;
                    ">Cancel</button>
                    <button id="rename-confirm" style="
                        background: #4a90e2;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 6px;
                        cursor: pointer;
                    ">Rename</button>
                </div>
            </div>
        `;

    document.body.appendChild(modal);

    const input = modal.querySelector("#sprite-name-input");
    const cancelBtn = modal.querySelector("#rename-cancel");
    const confirmBtn = modal.querySelector("#rename-confirm");

    // Focus and select text
    input.focus();
    input.select();

    const handleRename = () => {
      const newName = input.value.trim();
      if (newName && newName !== sprite.name) {
        sprite.name = newName;
        sprite.modifiedAt = new Date().toISOString();
        this.editor.saveSprites();
        this.updateSpritesList();
        this.showNotification(`Renamed sprite to "${newName}"`, "success");
      }
      modal.remove();
    };

    const handleCancel = () => {
      modal.remove();
    };

    confirmBtn.addEventListener("click", handleRename);
    cancelBtn.addEventListener("click", handleCancel);

    // Handle Enter and Escape keys
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        handleRename();
      } else if (e.key === "Escape") {
        handleCancel();
      }
    });

    // Close on outside click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        handleCancel();
      }
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
      this.updateExportPreview();
      modal.style.display = "flex";
    }
  }

  hideExportModal() {
    const modal = document.getElementById("export-modal");
    if (modal) {
      modal.style.display = "none";
    }
  }

  updateExportPreview() {
    const scaleSlider = document.getElementById("export-scale");
    const scaleValue = document.getElementById("scale-value");
    const dimensions = document.getElementById("export-dimensions");

    if (scaleSlider && scaleValue && dimensions && this.editor.currentSprite) {
      const scale = parseInt(scaleSlider.value);
      const sprite = this.editor.currentSprite;
      const newWidth = sprite.width * scale;
      const newHeight = sprite.height * scale;

      scaleValue.textContent = `${scale}x`;
      dimensions.textContent = `${sprite.width}x${sprite.height} → ${newWidth}x${newHeight}`;
    }
  }

  performExport() {
    const format = document.getElementById("export-format").value;
    const scale = parseInt(document.getElementById("export-scale").value);

    if (format === "svg") {
      this.editor.exportAsSVG(scale);
    } else {
      this.editor.exportAsPNG(scale);
    }

    this.hideExportModal();
    this.showNotification(
      `Exported as ${format.toUpperCase()} at ${scale}x scale`,
      "success"
    );
  }

  performQuickExport() {
    const format = document.getElementById("export-format").value;
    const scale = 20;

    if (format === "svg") {
      this.editor.exportAsSVG(scale);
    } else {
      this.editor.exportAsPNG(scale);
    }

    this.hideExportModal();
    this.showNotification(
      `Quick exported as ${format.toUpperCase()} at 20x scale`,
      "success"
    );
  }
}

// Make UIController globally available
window.UIController = UIController;
