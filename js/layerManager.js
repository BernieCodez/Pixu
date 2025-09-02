// Layer Manager - Handles layer functionality using Konva.js
class LayerManager {
    constructor(containerId, width, height) {
        this.containerId = containerId;
        this.width = width;
        this.height = height;
        this.layers = [];
        this.activeLayerIndex = 0;
        this.pixelSize = 20; // Size of each pixel in the layer view
        
        this.initializeStage();
        this.createDefaultLayer();
    }

    initializeStage() {
        // Create Konva stage
        this.stage = new Konva.Stage({
            container: this.containerId,
            width: this.width * this.pixelSize,
            height: this.height * this.pixelSize
        });

        // Add grid layer (lowest layer)
        this.gridLayer = new Konva.Layer();
        this.stage.add(this.gridLayer);
        this.createGrid();
    }

    createGrid() {
        const gridSize = this.pixelSize;
        const stageWidth = this.stage.width();
        const stageHeight = this.stage.height();

        // Vertical lines
        for (let x = 0; x <= stageWidth; x += gridSize) {
            const line = new Konva.Line({
                points: [x, 0, x, stageHeight],
                stroke: '#333',
                strokeWidth: 1,
                opacity: 0.3
            });
            this.gridLayer.add(line);
        }

        // Horizontal lines
        for (let y = 0; y <= stageHeight; y += gridSize) {
            const line = new Konva.Line({
                points: [0, y, stageWidth, y],
                stroke: '#333',
                strokeWidth: 1,
                opacity: 0.3
            });
            this.gridLayer.add(line);
        }

        this.gridLayer.draw();
    }

    createDefaultLayer() {
        this.addLayer('Layer 1');
    }

    addLayer(name = null) {
        const layerName = name || `Layer ${this.layers.length + 1}`;
        
        // Create Konva layer
        const konvaLayer = new Konva.Layer();
        this.stage.add(konvaLayer);

        // Create layer data structure
        const layerData = {
            id: Date.now() + Math.random(),
            name: layerName,
            visible: true,
            opacity: 1,
            konvaLayer: konvaLayer,
            pixels: this.createEmptyPixelArray(),
            locked: false
        };

        this.layers.push(layerData);
        this.activeLayerIndex = this.layers.length - 1;

        // Redraw stage
        this.stage.draw();

        return layerData;
    }

    createEmptyPixelArray() {
        const pixels = [];
        for (let y = 0; y < this.height; y++) {
            pixels[y] = [];
            for (let x = 0; x < this.width; x++) {
                pixels[y][x] = [0, 0, 0, 0]; // Transparent
            }
        }
        return pixels;
    }

    deleteLayer(index) {
        if (this.layers.length <= 1) {
            return false; // Can't delete the last layer
        }

        if (index < 0 || index >= this.layers.length) {
            return false; // Invalid index
        }

        const layer = this.layers[index];
        
        // Remove from Konva stage
        layer.konvaLayer.destroy();
        
        // Remove from array
        this.layers.splice(index, 1);

        // Adjust active layer index
        if (this.activeLayerIndex >= this.layers.length) {
            this.activeLayerIndex = this.layers.length - 1;
        } else if (this.activeLayerIndex > index) {
            this.activeLayerIndex--;
        }

        this.stage.draw();
        return true;
    }

    duplicateLayer(index) {
        if (index < 0 || index >= this.layers.length) {
            return null;
        }

        const sourceLayer = this.layers[index];
        const newLayer = this.addLayer(`${sourceLayer.name} Copy`);

        // Copy pixel data
        newLayer.pixels = sourceLayer.pixels.map(row => 
            row.map(pixel => [...pixel])
        );

        // Copy properties
        newLayer.opacity = sourceLayer.opacity;
        newLayer.visible = sourceLayer.visible;

        // Redraw the new layer
        this.redrawLayer(this.layers.length - 1);

        return newLayer;
    }

    moveLayer(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.layers.length ||
            toIndex < 0 || toIndex >= this.layers.length) {
            return false;
        }

        const layer = this.layers.splice(fromIndex, 1)[0];
        this.layers.splice(toIndex, 0, layer);

        // Update Konva layer order
        this.reorderKonvaLayers();

        // Update active layer index
        if (this.activeLayerIndex === fromIndex) {
            this.activeLayerIndex = toIndex;
        } else if (this.activeLayerIndex > fromIndex && this.activeLayerIndex <= toIndex) {
            this.activeLayerIndex--;
        } else if (this.activeLayerIndex < fromIndex && this.activeLayerIndex >= toIndex) {
            this.activeLayerIndex++;
        }

        return true;
    }

    reorderKonvaLayers() {
        // Remove all layers except grid
        this.layers.forEach(layer => {
            layer.konvaLayer.remove();
        });

        // Re-add in correct order
        this.layers.forEach(layer => {
            this.stage.add(layer.konvaLayer);
        });

        this.stage.draw();
    }

    setLayerVisibility(index, visible) {
        if (index < 0 || index >= this.layers.length) {
            return false;
        }

        const layer = this.layers[index];
        layer.visible = visible;
        layer.konvaLayer.visible(visible);
        this.stage.draw();

        return true;
    }

    setLayerOpacity(index, opacity) {
        if (index < 0 || index >= this.layers.length) {
            return false;
        }

        const layer = this.layers[index];
        layer.opacity = Math.max(0, Math.min(1, opacity));
        layer.konvaLayer.opacity(layer.opacity);
        this.stage.draw();

        return true;
    }

    setActiveLayer(index) {
        if (index < 0 || index >= this.layers.length) {
            return false;
        }

        this.activeLayerIndex = index;
        return true;
    }

    getActiveLayer() {
        return this.layers[this.activeLayerIndex] || null;
    }

    setPixel(x, y, color) {
        const activeLayer = this.getActiveLayer();
        if (!activeLayer || activeLayer.locked) {
            return false;
        }

        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return false;
        }

        // Update pixel data
        activeLayer.pixels[y][x] = [...color];

        // Update Konva layer
        this.updateKonvaPixel(activeLayer, x, y, color);

        return true;
    }

    updateKonvaPixel(layer, x, y, color) {
        const [r, g, b, a] = color;
        
        // Remove existing pixel if it exists
        const existingPixel = layer.konvaLayer.findOne(`#pixel_${x}_${y}`);
        if (existingPixel) {
            existingPixel.destroy();
        }

        // Add new pixel if not transparent
        if (a > 0) {
            const rect = new Konva.Rect({
                id: `pixel_${x}_${y}`,
                x: x * this.pixelSize,
                y: y * this.pixelSize,
                width: this.pixelSize,
                height: this.pixelSize,
                fill: `rgba(${r}, ${g}, ${b}, ${a / 255})`,
                stroke: null
            });

            layer.konvaLayer.add(rect);
        }

        layer.konvaLayer.draw();
    }

    redrawLayer(index) {
        if (index < 0 || index >= this.layers.length) {
            return false;
        }

        const layer = this.layers[index];
        
        // Clear the layer
        layer.konvaLayer.destroyChildren();

        // Redraw all pixels
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const color = layer.pixels[y][x];
                if (color[3] > 0) { // Not transparent
                    this.updateKonvaPixel(layer, x, y, color);
                }
            }
        }

        return true;
    }

    getCompositeImageData() {
        // Create a temporary canvas to composite all visible layers
        const canvas = document.createElement('canvas');
        canvas.width = this.width;
        canvas.height = this.height;
        const ctx = canvas.getContext('2d');

        // Composite layers from bottom to top
        this.layers.forEach(layer => {
            if (!layer.visible) return;

            const layerCanvas = document.createElement('canvas');
            layerCanvas.width = this.width;
            layerCanvas.height = this.height;
            const layerCtx = layerCanvas.getContext('2d');

            // Draw layer pixels
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    const [r, g, b, a] = layer.pixels[y][x];
                    if (a > 0) {
                        layerCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
                        layerCtx.fillRect(x, y, 1, 1);
                    }
                }
            }

            // Composite onto main canvas
            ctx.globalAlpha = layer.opacity;
            ctx.drawImage(layerCanvas, 0, 0);
            ctx.globalAlpha = 1;
        });

        return ctx.getImageData(0, 0, this.width, this.height);
    }

    resize(newWidth, newHeight) {
        this.width = newWidth;
        this.height = newHeight;

        // Resize stage
        this.stage.width(newWidth * this.pixelSize);
        this.stage.height(newHeight * this.pixelSize);

        // Recreate grid
        this.gridLayer.destroyChildren();
        this.createGrid();

        // Resize all layers
        this.layers.forEach((layer, index) => {
            // Resize pixel array
            const newPixels = this.createEmptyPixelArray();
            
            // Copy existing pixels
            for (let y = 0; y < Math.min(layer.pixels.length, newHeight); y++) {
                for (let x = 0; x < Math.min(layer.pixels[y].length, newWidth); x++) {
                    newPixels[y][x] = [...layer.pixels[y][x]];
                }
            }

            layer.pixels = newPixels;
            this.redrawLayer(index);
        });

        this.stage.draw();
    }

    toggleGridVisibility() {
        this.gridLayer.visible(!this.gridLayer.visible());
        this.stage.draw();
    }

    exportAsSprite() {
        // Convert the composite to a Sprite object
        const imageData = this.getCompositeImageData();
        return Sprite.fromImageData(imageData, 'Layered Sprite');
    }

    loadFromSprite(sprite) {
        // Clear existing layers except the first one
        while (this.layers.length > 1) {
            this.deleteLayer(1);
        }

        // Load sprite data into the first layer
        const firstLayer = this.layers[0];
        const spritePixels = sprite.getPixelArray();
        
        // Resize if necessary
        if (sprite.width !== this.width || sprite.height !== this.height) {
            this.resize(sprite.width, sprite.height);
        }

        // Copy pixels
        firstLayer.pixels = spritePixels.map(row => 
            row.map(pixel => [...pixel])
        );

        this.redrawLayer(0);
    }

    destroy() {
        if (this.stage) {
            this.stage.destroy();
        }
    }
}

// Make LayerManager globally available
window.LayerManager = LayerManager;
