// Modifications for PixelEditor class - js/editor.js

// In the constructor, add this after layerManager initialization:
this.animationManager = new AnimationManager(this);

// Modify the initialize method - add after layerManager setup:
// Initialize animation manager
this.animationManager = new AnimationManager(this);

// Modify the setCurrentSprite method:
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

// Modify the saveLayersToSprite method:
saveLayersToSprite() {
  if (!this.currentSprite || !this.layerManager || !this.animationManager) return;

  // Save current layer state to current frame
  this.animationManager.saveLayerManagerToCurrentFrame();
}

// Add method to create new animated sprite:
createNewAnimatedSprite(width = 16, height = 16, name = null, frameCount = 1) {
  const sprite = this.createNewSprite(width, height, name);
  
  // Add additional frames if requested
  for (let i = 1; i < frameCount; i++) {
    this.animationManager.addFrame();
  }
  
  sprite.isAnimated = frameCount > 1;
  return sprite;
}

// Modify the resizeCanvas method:
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

//////////////////////////////////////////////////////////////////////////////////////////////////////////
// Add these methods to your existing UIController class:

// Initialize frame controls (add this to your setupEventListeners method)
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

  // Add animation controls
  this.setupAnimationControls();
}

// Setup animation playback controls
setupAnimationControls() {
  // Create animation controls if they don't exist
  const framesToolbar = document.querySelector('.frames-toolbar');
  if (framesToolbar && !document.getElementById('play-btn')) {
    const animationControls = document.createElement('div');
    animationControls.className = 'animation-controls';
    animationControls.innerHTML = `
      <button class="btn btn-sm" id="play-btn" title="Play Animation">
        <i class="fas fa-play"></i>
      </button>
      <button class="btn btn-sm" id="stop-btn" title="Stop Animation">
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
    });

    // Double-click to rename
    frameInfo.addEventListener('dblclick', () => {
      this.editFrameName(frame, frameInfo.querySelector('.frame-name'));
    });

    // Drag and drop for reordering
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

// Render frame thumbnail
renderFrameThumbnail(ctx, frame, width, height) {
  // Clear canvas
  ctx.fillStyle = '#2d2d2d';
  ctx.fillRect(0, 0, width, height);

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

  // Add checkerboard pattern for transparency areas if needed
  if (frame.width * frame.height < width * height) {
    this.drawTransparencyPattern(ctx, offsetX, offsetY, scaledWidth, scaledHeight);
  }
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

// Add this to your existing updateAll method in UIController:
// this.updateFramesList();

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////



//----------------------------^^^^^-----------------------------------\\
//----------------------------VVVVV-----------------------------------\\

 




// Add these modifications to your existing main.js file:

// In your DOMContentLoaded event listener, after editor initialization, add:
document.addEventListener('DOMContentLoaded', function() {
    // ... existing initialization code ...
    
    // Initialize frame controls after editor is ready
    if (editor && editor.uiController) {
        editor.uiController.setupFrameControls();
    }
    
    // Ensure sprites have frame data for backward compatibility
    if (editor && editor.sprites) {
        editor.sprites.forEach(sprite => {
            if (!sprite.frames || sprite.frames.length === 0) {
                sprite.initializeFrames();
            }
        });
    }
});

// Add keyboard shortcuts for frame navigation (add to existing keyboard event handler):
document.addEventListener('keydown', (e) => {
    if (!editor || !editor.animationManager) return;
    
    // Don't trigger shortcuts if user is typing in an input
    if (e.target.matches('input, textarea')) return;
    
    switch(e.key.toLowerCase()) {
        case 'f':
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                // Add new frame
                editor.animationManager.addFrame();
                editor.uiController.updateFramesList();
            }
            break;
            
        case 'arrowleft':
            if (e.altKey) {
                e.preventDefault();
                // Previous frame
                const currentIndex = editor.animationManager.currentFrameIndex;
                if (currentIndex > 0) {
                    editor.animationManager.setCurrentFrame(currentIndex - 1);
                    editor.uiController.updateFramesList();
                }
            }
            break;
            
        case 'arrowright':
            if (e.altKey) {
                e.preventDefault();
                // Next frame
                const currentIndex = editor.animationManager.currentFrameIndex;
                const frameCount = editor.animationManager.getFrameCount();
                if (currentIndex < frameCount - 1) {
                    editor.animationManager.setCurrentFrame(currentIndex + 1);
                    editor.uiController.updateFramesList();
                }
            }
            break;
            
        case ' ':
            if (e.altKey) {
                e.preventDefault();
                // Toggle animation playback
                if (editor.animationManager.isPlaying) {
                    editor.animationManager.stop();
                } else {
                    editor.animationManager.play();
                }
                // Update play button
                const playBtn = document.getElementById('play-btn');
                if (playBtn) {
                    playBtn.innerHTML = editor.animationManager.isPlaying ? 
                        '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
                }
            }
            break;
    }
});

// Add this helper function to update keyboard help (modify existing showKeyboardHelp function):
function updateKeyboardHelp() {
    // Add these to your existing keyboard shortcuts help:
    const frameShortcuts = `
        <h4>Animation/Frames:</h4>
        <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Ctrl+F</strong> - Add New Frame</li>
            <li><strong>Alt+Left Arrow</strong> - Previous Frame</li>
            <li><strong>Alt+Right Arrow</strong> - Next Frame</li>
            <li><strong>Alt+Space</strong> - Play/Pause Animation</li>
        </ul>
    `;
    // Insert this into your help modal content
}