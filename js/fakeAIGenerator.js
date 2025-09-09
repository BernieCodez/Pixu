// Component-Based Pixel Art Generator
// This generates pixel art sprites using reusable components and rules

class PixelArtGenerator {
    constructor() {
        this.colors = {
            // Basic color palette - can be expanded
            red: [255, 50, 50, 255],
            blue: [50, 50, 255, 255],
            green: [50, 255, 50, 255],
            yellow: [255, 255, 50, 255],
            purple: [255, 50, 255, 255],
            orange: [255, 150, 50, 255],
            brown: [139, 69, 19, 255],
            black: [50, 50, 50, 255],
            white: [255, 255, 255, 255],
            gray: [128, 128, 128, 255],
            pink: [255, 192, 203, 255],
            cyan: [0, 255, 255, 255],
            dark: [30, 30, 30, 255],
            light: [220, 220, 220, 255],
            transparent: [0, 0, 0, 0]
        };

        this.baseShapes = this.initializeBaseShapes();
        this.features = this.initializeFeatures();
        this.typeRules = this.initializeTypeRules();
    }

    // Parse text prompt into generation parameters
    parsePrompt(prompt) {
        const words = prompt.toLowerCase().split(/\s+/);
        
        const result = {
            colors: this.extractColors(words),
            type: this.extractType(words),
            features: this.extractFeatures(words),
            style: this.extractStyle(words),
            size: this.extractSize(words)
        };

        // Apply type-based rules
        if (this.typeRules[result.type]) {
            const rules = this.typeRules[result.type];
            result.baseShape = rules.baseShape;
            result.defaultFeatures = rules.features;
            result.defaultColors = rules.colors;
        }

        return result;
    }

    extractColors(words) {
        const foundColors = [];
        for (const word of words) {
            if (this.colors[word]) {
                foundColors.push(word);
            }
        }
        return foundColors.length > 0 ? foundColors : ['black'];
    }

    extractType(words) {
        const types = {
            // Characters
            'knight': 'knight', 'warrior': 'knight', 'soldier': 'knight',
            'wizard': 'wizard', 'mage': 'wizard', 'witch': 'wizard',
            'dragon': 'dragon', 'drake': 'dragon',
            'skeleton': 'skeleton', 'undead': 'skeleton',
            'robot': 'robot', 'mech': 'robot', 'android': 'robot',
            // Animals
            'cat': 'cat', 'dog': 'dog', 'bird': 'bird',
            'snake': 'snake', 'fish': 'fish',
            // Objects
            'sword': 'sword', 'blade': 'sword',
            'potion': 'potion', 'bottle': 'potion',
            'tree': 'tree', 'plant': 'tree',
            'rock': 'rock', 'stone': 'rock',
            'gem': 'gem', 'crystal': 'gem', 'jewel': 'gem'
        };

        for (const word of words) {
            if (types[word]) return types[word];
        }
        return 'blob'; // default fallback
    }

    extractFeatures(words) {
        const features = [];
        const featureWords = {
            'wings': 'wings', 'winged': 'wings',
            'sword': 'weapon', 'blade': 'weapon', 'weapon': 'weapon',
            'armor': 'armor', 'armored': 'armor',
            'helmet': 'helmet', 'hat': 'helmet',
            'cape': 'cape', 'cloak': 'cape',
            'glowing': 'glow', 'bright': 'glow',
            'spiky': 'spikes', 'thorny': 'spikes'
        };

        for (const word of words) {
            if (featureWords[word] && !features.includes(featureWords[word])) {
                features.push(featureWords[word]);
            }
        }
        return features;
    }

    extractStyle(words) {
        const styles = ['cute', 'scary', 'dark', 'bright', 'simple', 'detailed'];
        for (const word of words) {
            if (styles.includes(word)) return word;
        }
        return 'simple';
    }

    extractSize(words) {
        if (words.includes('tiny')) return 'tiny';
        if (words.includes('small')) return 'small';
        if (words.includes('large') || words.includes('big')) return 'large';
        return 'medium';
    }

    // Initialize base shapes as pixel patterns
    initializeBaseShapes() {
        return {
            humanoid: {
                width: 16, height: 20,
                pattern: this.createHumanoidShape()
            },
            quadruped: {
                width: 20, height: 14,
                pattern: this.createQuadrupedShape()
            },
            blob: {
                width: 12, height: 12,
                pattern: this.createBlobShape()
            },
            object: {
                width: 10, height: 10,
                pattern: this.createObjectShape()
            }
        };
    }

    // Initialize feature components
    initializeFeatures() {
        return {
            wings: {
                positions: ['shoulder_left', 'shoulder_right'],
                pattern: this.createWingsPattern()
            },
            weapon: {
                positions: ['hand_right'],
                pattern: this.createWeaponPattern()
            },
            helmet: {
                positions: ['head'],
                pattern: this.createHelmetPattern()
            },
            glow: {
                positions: ['outline'],
                pattern: this.createGlowPattern()
            }
        };
    }

    // Define rules for different types
    initializeTypeRules() {
        return {
            knight: {
                baseShape: 'humanoid',
                features: ['weapon', 'armor'],
                colors: ['gray', 'brown']
            },
            wizard: {
                baseShape: 'humanoid', 
                features: ['cape', 'glow'],
                colors: ['purple', 'blue']
            },
            dragon: {
                baseShape: 'quadruped',
                features: ['wings', 'spikes'],
                colors: ['red', 'green']
            },
            robot: {
                baseShape: 'humanoid',
                features: ['armor', 'glow'],
                colors: ['gray', 'blue']
            },
            cat: {
                baseShape: 'quadruped',
                features: [],
                colors: ['brown', 'black', 'white']
            },
            sword: {
                baseShape: 'object',
                features: ['glow'],
                colors: ['gray', 'yellow']
            },
            potion: {
                baseShape: 'object',
                features: ['glow'],
                colors: ['red', 'blue', 'green']
            },
            blob: {
                baseShape: 'blob',
                features: [],
                colors: ['green', 'blue']
            }
        };
    }

    // Generate sprite based on parsed prompt
    generateSprite(prompt, targetWidth = 32, targetHeight = 32) {
        const params = this.parsePrompt(prompt);
        
        // Create empty canvas
        const canvas = this.createEmptyCanvas(targetWidth, targetHeight);
        
        // Get base shape
        const baseShape = this.baseShapes[params.baseShape];
        if (!baseShape) return canvas; // fallback
        
        // Calculate positioning
        const centerX = Math.floor((targetWidth - baseShape.width) / 2);
        const centerY = Math.floor((targetHeight - baseShape.height) / 2);
        
        // Draw base shape
        this.drawShape(canvas, baseShape.pattern, centerX, centerY, params.colors[0] || 'black');
        
        // Add features
        const features = [...(params.defaultFeatures || []), ...params.features];
        for (const featureName of features) {
            this.addFeature(canvas, featureName, centerX, centerY, params.colors[1] || params.colors[0]);
        }
        
        return canvas;
    }

    // Create empty canvas as 2D array
    createEmptyCanvas(width, height) {
        const canvas = [];
        for (let y = 0; y < height; y++) {
            const row = [];
            for (let x = 0; x < width; x++) {
                row.push([0, 0, 0, 0]); // transparent
            }
            canvas.push(row);
        }
        return canvas;
    }

    // Draw a shape pattern onto canvas
    drawShape(canvas, pattern, offsetX, offsetY, colorName) {
        const color = this.colors[colorName] || this.colors.black;
        
        for (let y = 0; y < pattern.length; y++) {
            for (let x = 0; x < pattern[y].length; x++) {
                if (pattern[y][x] === 1) { // 1 means draw pixel
                    const canvasX = offsetX + x;
                    const canvasY = offsetY + y;
                    if (canvasY >= 0 && canvasY < canvas.length && 
                        canvasX >= 0 && canvasX < canvas[0].length) {
                        canvas[canvasY][canvasX] = [...color];
                    }
                }
            }
        }
    }

    // Add feature to sprite (original method)
    addFeature(canvas, featureName, baseX, baseY, colorName) {
        const feature = this.features[featureName];
        if (!feature) return;
        
        const color = this.colors[colorName] || this.colors.black;
        
        // Simple feature positioning - can be made more sophisticated
        let featureX = baseX;
        let featureY = baseY;
        
        if (featureName === 'wings') {
            featureX = baseX - 3; // offset for wings
            featureY = baseY + 4;
        } else if (featureName === 'weapon') {
            featureX = baseX + 12; // offset for weapon in hand
            featureY = baseY + 8;
        } else if (featureName === 'helmet') {
            featureX = baseX + 4; // center on head
            featureY = baseY - 2; // above head
        }
        
        this.drawShape(canvas, feature.pattern, featureX, featureY, colorName);
    }

    // Draw a scaled shape pattern onto canvas
    drawScaledShape(canvas, pattern, offsetX, offsetY, scale, colorName) {
        const color = this.colors[colorName] || this.colors.black;
        
        for (let y = 0; y < pattern.length; y++) {
            for (let x = 0; x < pattern[y].length; x++) {
                if (pattern[y][x] === 1) { // 1 means draw pixel
                    // Draw scaled pixel block
                    for (let sy = 0; sy < scale; sy++) {
                        for (let sx = 0; sx < scale; sx++) {
                            const canvasX = offsetX + (x * scale) + sx;
                            const canvasY = offsetY + (y * scale) + sy;
                            if (canvasY >= 0 && canvasY < canvas.length && 
                                canvasX >= 0 && canvasX < canvas[0].length) {
                                canvas[canvasY][canvasX] = [...color];
                            }
                        }
                    }
                }
            }
        }
    }

    // Add scaled feature to sprite
    addScaledFeature(canvas, featureName, baseX, baseY, scale, colorName) {
        const feature = this.features[featureName];
        if (!feature) return;
        
        const color = this.colors[colorName] || this.colors.black;
        
        // Simple feature positioning - scaled appropriately
        let featureX = baseX;
        let featureY = baseY;
        
        if (featureName === 'wings') {
            featureX = baseX - (3 * scale); // scaled offset for wings
            featureY = baseY + (4 * scale);
        } else if (featureName === 'weapon') {
            featureX = baseX + (12 * scale); // scaled offset for weapon in hand
            featureY = baseY + (8 * scale);
        } else if (featureName === 'helmet') {
            featureX = baseX + (4 * scale); // scaled center on head
            featureY = baseY - (2 * scale); // scaled above head
        }
        
        this.drawScaledShape(canvas, feature.pattern, featureX, featureY, scale, colorName);
    }

    // Basic shape patterns (1 = draw pixel, 0 = skip)
    createHumanoidShape() {
        return [
            [0,0,0,1,1,1,1,0,0,0], // head
            [0,0,1,1,1,1,1,1,0,0],
            [0,0,1,1,1,1,1,1,0,0],
            [0,0,0,1,1,1,1,0,0,0],
            [0,0,0,1,1,1,1,0,0,0], // neck
            [0,1,1,1,1,1,1,1,1,0], // shoulders
            [0,1,1,1,1,1,1,1,1,0], // body
            [0,1,1,1,1,1,1,1,1,0],
            [0,1,1,1,1,1,1,1,1,0],
            [0,0,1,1,1,1,1,1,0,0],
            [0,0,1,1,1,1,1,1,0,0],
            [0,0,0,1,1,1,1,0,0,0], // waist
            [0,0,1,1,0,0,1,1,0,0], // legs
            [0,0,1,1,0,0,1,1,0,0],
            [0,0,1,1,0,0,1,1,0,0],
            [0,0,1,1,0,0,1,1,0,0],
            [0,0,1,1,0,0,1,1,0,0],
            [0,1,1,1,0,0,1,1,1,0], // feet
            [0,1,1,1,0,0,1,1,1,0],
            [0,1,1,1,0,0,1,1,1,0]
        ];
    }

    createQuadrupedShape() {
        return [
            [0,0,1,1,1,1,0,0,0,0,0,0,0,0], // head
            [0,1,1,1,1,1,1,0,0,0,0,0,0,0],
            [1,1,1,1,1,1,1,1,1,1,1,1,0,0], // body
            [1,1,1,1,1,1,1,1,1,1,1,1,1,0],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [0,1,1,1,1,1,1,1,1,1,1,1,1,0],
            [0,0,1,1,1,1,1,1,1,1,1,1,0,0],
            [0,0,1,0,1,0,1,0,1,0,1,0,0,0], // legs
            [0,0,1,0,1,0,1,0,1,0,1,0,0,0],
            [0,0,1,0,1,0,1,0,1,0,1,0,0,0],
            [0,1,1,0,1,1,0,1,1,0,1,1,0,0], // feet
            [1,1,1,1,1,1,1,1,1,1,1,1,1,0],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1]
        ];
    }

    createBlobShape() {
        return [
            [0,0,1,1,1,1,1,1,0,0],
            [0,1,1,1,1,1,1,1,1,0],
            [1,1,1,1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1,1,1,1],
            [0,1,1,1,1,1,1,1,1,0],
            [0,0,1,1,1,1,1,1,0,0],
            [0,0,0,1,1,1,1,0,0,0],
            [0,0,0,0,1,1,0,0,0,0]
        ];
    }

    createObjectShape() {
        return [
            [0,1,1,1,1,1,1,0],
            [1,1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1,1],
            [0,1,1,1,1,1,1,0]
        ];
    }

    createWingsPattern() {
        return [
            [1,1,0,0,0,0],
            [1,1,1,0,0,0],
            [1,1,1,1,0,0],
            [1,1,1,1,1,0],
            [1,1,1,1,0,0],
            [1,1,1,0,0,0],
            [1,1,0,0,0,0]
        ];
    }

    createWeaponPattern() {
        return [
            [0,0,1],
            [0,0,1],
            [0,0,1],
            [0,1,1],
            [1,1,1],
            [0,1,0],
            [0,1,0],
            [0,1,0]
        ];
    }

    createHelmetPattern() {
        return [
            [0,1,1,1,1,1,0],
            [1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1],
            [0,1,1,1,1,1,0]
        ];
    }

    createGlowPattern() {
        // This would add glow effect - simplified for now
        return [
            [1,1,1],
            [1,0,1],
            [1,1,1]
        ];
    }
}

// Initialize the generator
const pixelArtGenerator = new PixelArtGenerator();

// Function to handle the generate button click
function handleGenerateAI() {
    const prompt = window.prompt("Enter description for pixel art generation:", "blue knight with sword");
    if (!prompt) return;

    try {
        // Generate the sprite array
        const spriteArray = pixelArtGenerator.generateSprite(prompt, 32, 32);
        
        // Create a new sprite in the editor with this data
        // This assumes your editor has a way to create sprites from pixel arrays
        createSpriteFromArray(spriteArray, `AI: ${prompt}`);
        
    } catch (error) {
        console.error('Error generating AI sprite:', error);
        alert('Failed to generate sprite. Please try a different prompt.');
    }
}

// Helper function to create sprite in your editor
function createSpriteFromArray(pixelArray, spriteName) {
    try {
        // Create layers data in the format your storage system expects
        const layersData = [{
            name: "Layer 1",
            visible: true,
            opacity: 1,
            pixels: pixelArray,
            useTypedArray: false // Small sprites don't need typed arrays
        }];

        // Create a new Sprite object (assumes Sprite class is available)
        const sprite = new Sprite(
            pixelArray[0].length, // width
            pixelArray.length,    // height
            spriteName,
            Date.now() + Math.random(), // unique ID
            layersData
        );

        // Set timestamps
        sprite.createdAt = new Date().toISOString();
        sprite.modifiedAt = new Date().toISOString();

        // Save to storage
        if (window.storageManager) {
            window.storageManager.saveSprite(sprite).then(success => {
                if (success) {
                    console.log(`Generated sprite "${spriteName}" saved successfully`);
                    
                    // Trigger UI refresh - check if there's a sprite list to update
                    if (window.updateSpritesList) {
                        window.updateSpritesList();
                    }
                    
                    // If there's an editor instance, switch to the new sprite
                    if (window.editor && window.editor.loadSprite) {
                        window.editor.loadSprite(sprite);
                    } else if (window.switchToSprite) {
                        window.switchToSprite(sprite);
                    }
                    
                    // Force a page refresh if needed
                    if (window.refreshUI) {
                        window.refreshUI();
                    } else {
                        // Gentle page refresh to show the new sprite
                        setTimeout(() => {
                            location.reload();
                        }, 1000);
                    }
                } else {
                    console.error('Failed to save generated sprite');
                    alert('Generated sprite but failed to save. Check console for details.');
                }
            });
        } else {
            console.error('StorageManager not available');
            alert('Generated sprite but storage system not available');
        }
        
    } catch (error) {
        console.error('Error creating sprite from array:', error);
        alert('Failed to create sprite. Check console for details.');
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PixelArtGenerator, handleGenerateAI };
}