Here are the modified versions of your other tools with enterable inputs:

## Brush Tool

**Modified `getSettingsHTML()`:**
```javascript
getSettingsHTML() {
    return `
            <div class="setting-group">
                <label for="brush-size">Size:</label>
                <div class="slider-container">
                    <input type="range" id="brush-size" min="1" max="10" value="${this.size}">
                    <input type="number" class="slider-value-input" data-slider="brush-size" min="1" max="10" value="${this.size}">
                </div>
            </div>
            <div class="setting-group">
                <label for="brush-opacity">Opacity:</label>
                <div class="slider-container">
                    <input type="range" id="brush-opacity" min="0" max="100" value="${this.opacity}">
                    <input type="number" class="slider-value-input" data-slider="brush-opacity" min="0" max="100" value="${this.opacity}">%
                </div>
            </div>
            <div class="setting-group">
                <label>
                    <input type="checkbox" id="brush-apply-once" ${this.applyOnce ? "checked" : ""}>
                    Apply Once
                </label>
            </div>
        `;
}
```

**Modified `initializeSettings()`:**
```javascript
initializeSettings() {
    const sizeSlider = document.getElementById("brush-size");
    const opacitySlider = document.getElementById("brush-opacity");
    const applyOnceCheckbox = document.getElementById("brush-apply-once");
    
    // Get the number inputs
    const sizeInput = document.querySelector('[data-slider="brush-size"]');
    const opacityInput = document.querySelector('[data-slider="brush-opacity"]');

    if (sizeSlider && sizeInput) {
        // Slider to input sync
        sizeSlider.addEventListener("input", (e) => {
            const value = parseInt(e.target.value);
            this.setSize(value);
            sizeInput.value = this.size;
        });
        
        // Input to slider sync
        sizeInput.addEventListener("input", (e) => {
            const value = parseInt(e.target.value);
            if (value >= 1 && value <= 10) {
                this.setSize(value);
                sizeSlider.value = this.size;
            }
        });
        
        // Validate on blur
        sizeInput.addEventListener("blur", (e) => {
            const value = parseInt(e.target.value);
            if (isNaN(value) || value < 1 || value > 10) {
                e.target.value = this.size;
            }
        });
    }

    if (opacitySlider && opacityInput) {
        // Slider to input sync
        opacitySlider.addEventListener("input", (e) => {
            const value = parseInt(e.target.value);
            this.setOpacity(value);
            opacityInput.value = this.opacity;
        });
        
        // Input to slider sync
        opacityInput.addEventListener("input", (e) => {
            const value = parseInt(e.target.value);
            if (value >= 0 && value <= 100) {
                this.setOpacity(value);
                opacitySlider.value = this.opacity;
            }
        });
        
        // Validate on blur
        opacityInput.addEventListener("blur", (e) => {
            const value = parseInt(e.target.value);
            if (isNaN(value) || value < 0 || value > 100) {
                e.target.value = this.opacity;
            }
        });
    }

    if (applyOnceCheckbox) {
        applyOnceCheckbox.addEventListener("change", (e) => {
            this.setApplyOnce(e.target.checked);
        });
    }
}
```

## Smooth/Sharpen Tool

**Modified `getSettingsHTML()`:**
```javascript
getSettingsHTML() {
    return `
      <div class="setting-group">
        <label for="smoothsharpen-intensity">Intensity:</label>
        <div class="slider-container">
          <input type="range" id="smoothsharpen-intensity" min="0" max="100" value="${this.intensity}">
          <input type="number" class="slider-value-input" data-slider="smoothsharpen-intensity" min="0" max="100" value="${this.intensity}">%
        </div>
      </div>
      <div class="setting-group">
        <label for="smoothsharpen-size">Size:</label>
        <div class="slider-container">
          <input type="range" id="smoothsharpen-size" min="1" max="10" value="${this.size}">
          <input type="number" class="slider-value-input" data-slider="smoothsharpen-size" min="1" max="10" value="${this.size}">
        </div>
      </div>
      <div class="setting-group">
        <label>
          <input type="checkbox" id="smoothsharpen-apply-once" ${this.applyOnce ? "checked" : ""}>
          Apply Once
        </label>
      </div>
      <div class="setting-group">
        <label>
          <input type="checkbox" id="smoothsharpen-sharpen-mode" ${this.mode === "sharpen" ? "checked" : ""}>
          Sharpen
        </label>
      </div>
    `;
}
```

**Modified `initializeSettings()`:**
```javascript
initializeSettings() {
    const intensitySlider = document.getElementById("smoothsharpen-intensity");
    const sizeSlider = document.getElementById("smoothsharpen-size");
    const applyOnceCheckbox = document.getElementById("smoothsharpen-apply-once");
    const sharpenCheckbox = document.getElementById("smoothsharpen-sharpen-mode");
    
    // Get the number inputs
    const intensityInput = document.querySelector('[data-slider="smoothsharpen-intensity"]');
    const sizeInput = document.querySelector('[data-slider="smoothsharpen-size"]');

    if (intensitySlider && intensityInput) {
        // Slider to input sync
        intensitySlider.addEventListener("input", (e) => {
            const value = parseInt(e.target.value);
            this.setIntensity(value);
            intensityInput.value = this.intensity;
        });
        
        // Input to slider sync
        intensityInput.addEventListener("input", (e) => {
            const value = parseInt(e.target.value);
            if (value >= 0 && value <= 100) {
                this.setIntensity(value);
                intensitySlider.value = this.intensity;
            }
        });
        
        // Validate on blur
        intensityInput.addEventListener("blur", (e) => {
            const value = parseInt(e.target.value);
            if (isNaN(value) || value < 0 || value > 100) {
                e.target.value = this.intensity;
            }
        });
    }

    if (sizeSlider && sizeInput) {
        // Slider to input sync
        sizeSlider.addEventListener("input", (e) => {
            const value = parseInt(e.target.value);
            this.setSize(value);
            sizeInput.value = this.size;
        });
        
        // Input to slider sync
        sizeInput.addEventListener("input", (e) => {
            const value = parseInt(e.target.value);
            if (value >= 1 && value <= 10) {
                this.setSize(value);
                sizeSlider.value = this.size;
            }
        });
        
        // Validate on blur
        sizeInput.addEventListener("blur", (e) => {
            const value = parseInt(e.target.value);
            if (isNaN(value) || value < 1 || value > 10) {
                e.target.value = this.size;
            }
        });
    }

    if (applyOnceCheckbox) {
        applyOnceCheckbox.addEventListener("change", (e) => {
            this.setApplyOnce(e.target.checked);
        });
    }

    if (sharpenCheckbox) {
        sharpenCheckbox.addEventListener("change", (e) => {
            this.setMode(e.target.checked ? "sharpen" : "smooth");
        });
    }
}
```

## Brightness Tool

**Modified `getSettingsHTML()`:**
```javascript
getSettingsHTML() {
    return `
          <div class="setting-group">
              <label for="brightness-intensity">Intensity:</label>
              <div class="slider-container">
                  <input type="range" id="brightness-intensity" min="-50" max="50" value="${this.intensity}">
                  <input type="number" class="slider-value-input" data-slider="brightness-intensity" min="-50" max="50" value="${this.intensity}">%
              </div>
          </div>
          <div class="setting-group">
              <label for="brightness-size">Size:</label>
              <div class="slider-container">
                  <input type="range" id="brightness-size" min="1" max="10" value="${this.size}">
                  <input type="number" class="slider-value-input" data-slider="brightness-size" min="1" max="10" value="${this.size}">
              </div>
          </div>
          <div class="setting-group">
              <label>
                  <input type="checkbox" id="brightness-apply-once" ${this.applyOnce ? "checked" : ""}>
                  Apply Once
              </label>
          </div>
          <div class="setting-group">
              <label>
                  <input type="checkbox" id="brightness-random" ${this.randomMode ? "checked" : ""}>
                  Random
              </label>
          </div>
      `;
}
```

**Modified `initializeSettings()`:**
```javascript
initializeSettings() {
    const intensitySlider = document.getElementById("brightness-intensity");
    const sizeSlider = document.getElementById("brightness-size");
    const applyOnceCheckbox = document.getElementById("brightness-apply-once");
    const randomCheckbox = document.getElementById("brightness-random");
    
    // Get the number inputs
    const intensityInput = document.querySelector('[data-slider="brightness-intensity"]');
    const sizeInput = document.querySelector('[data-slider="brightness-size"]');

    if (intensitySlider && intensityInput) {
        // Slider to input sync
        intensitySlider.addEventListener("input", (e) => {
            const value = parseInt(e.target.value);
            this.setIntensity(value);
            intensityInput.value = this.intensity;
        });
        
        // Input to slider sync
        intensityInput.addEventListener("input", (e) => {
            const value = parseInt(e.target.value);
            if (value >= -50 && value <= 50) {
                this.setIntensity(value);
                intensitySlider.value = this.intensity;
            }
        });
        
        // Validate on blur
        intensityInput.addEventListener("blur", (e) => {
            const value = parseInt(e.target.value);
            if (isNaN(value) || value < -50 || value > 50) {
                e.target.value = this.intensity;
            }
        });
    }

    if (sizeSlider && sizeInput) {
        // Slider to input sync
        sizeSlider.addEventListener("input", (e) => {
            const value = parseInt(e.target.value);
            this.setSize(value);
            sizeInput.value = this.size;
        });
        
        // Input to slider sync
        sizeInput.addEventListener("input", (e) => {
            const value = parseInt(e.target.value);
            if (value >= 1 && value <= 10) {
                this.setSize(value);
                sizeSlider.value = this.size;
            }
        });
        
        // Validate on blur
        sizeInput.addEventListener("blur", (e) => {
            const value = parseInt(e.target.value);
            if (isNaN(value) || value < 1 || value > 10) {
                e.target.value = this.size;
            }
        });
    }

    if (applyOnceCheckbox) {
        applyOnceCheckbox.addEventListener("change", (e) => {
            this.setApplyOnce(e.target.checked);
        });
    }

    if (randomCheckbox) {
        randomCheckbox.addEventListener("change", (e) => {
            this.setRandomMode(e.target.checked);
        });
    }
}
```

The key changes for each tool:
1. Replaced `<span class="slider-value">` elements with `<input type="number" class="slider-value-input">` elements
2. Added `data-slider` attributes to link inputs to their corresponding sliders  
3. Added two-way synchronization between sliders and number inputs
4. Added validation on blur to reset invalid values
5. Maintained proper min/max constraints for each input

You'll also want to add the CSS I provided earlier for styling the `.slider-value-input` elements.