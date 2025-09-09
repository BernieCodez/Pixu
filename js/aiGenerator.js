/**
 * Real ONNX Stable Diffusion Integration
 * Replace the mock AI generator with actual ONNX runtime
 */

// First, you'll need to include ONNX Runtime in your HTML:
// <script src="https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.3/dist/ort.min.js"></script>

class RealAIGenerator {
    constructor() {
        this.session = null;
        this.loaded = false;
        this.isGenerating = false;
        this.modal = null;
        
        // Model URLs - you'll need to host these files
        this.modelUrls = {
            // Option 1: Lightweight SD model (smaller but less quality)
            textEncoder: '/models/text_encoder.onnx',     // ~500MB
            unet: '/models/unet.onnx',                    // ~1.5GB  
            vaeDecoder: '/models/vae_decoder.onnx',       // ~100MB
            
            // Option 2: Use a single optimized model
            // singleModel: '/models/sd_optimized.onnx'  // ~2GB total
        };
        
        this.init();
    }

    async init() {
        this.createModal();
        this.bindEvents();
        
        // Configure ONNX Runtime
        ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.3/dist/';
        ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;
        
        // Use WebGL for GPU acceleration if available
        this.executionProviders = ['webgl', 'cpu'];
    }

    async loadModel() {
        if (this.loaded) return;
        
        const statusEl = document.getElementById('ai-status');
        
        try {
            statusEl.innerHTML = '<i class="fas fa-download"></i> Downloading AI model components... (2-4GB total)';
            
            // Load model components
            // This is the biggest change - loading real ONNX models
            this.textEncoderSession = await ort.InferenceSession.create(
                this.modelUrls.textEncoder, 
                { executionProviders: this.executionProviders }
            );
            
            statusEl.innerHTML = '<i class="fas fa-download"></i> Loading UNet model... (50% complete)';
            
            this.unetSession = await ort.InferenceSession.create(
                this.modelUrls.unet,
                { executionProviders: this.executionProviders }
            );
            
            statusEl.innerHTML = '<i class="fas fa-download"></i> Loading VAE decoder... (80% complete)';
            
            this.vaeSession = await ort.InferenceSession.create(
                this.modelUrls.vaeDecoder,
                { executionProviders: this.executionProviders }
            );
            
            this.loaded = true;
            statusEl.innerHTML = '<i class="fas fa-check"></i> AI model loaded successfully!';
            
        } catch (error) {
            console.error('Error loading ONNX model:', error);
            statusEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Failed to load model: ${error.message}`;
            throw error;
        }
    }

    async generateArt() {
        if (this.isGenerating) return;

        const generateBtn = document.getElementById('ai-generate');
        const statusEl = document.getElementById('ai-status');
        const previewContainer = document.getElementById('ai-preview-container');
        const applyBtn = document.getElementById('ai-apply');

        try {
            this.isGenerating = true;
            generateBtn.disabled = true;
            generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
            previewContainer.style.display = 'none';
            applyBtn.style.display = 'none';

            // Get parameters
            const prompt = document.getElementById('ai-prompt').value.trim();
            const canvasSize = parseInt(document.getElementById('ai-canvas-size').value);
            const pixelSize = parseInt(document.getElementById('ai-pixel-size').value);
            const colorPalette = document.getElementById('ai-color-palette').value;

            if (!prompt) {
                throw new Error('Please enter a prompt');
            }

            // Load model if not loaded
            if (!this.loaded) {
                await this.loadModel();
            }

            // Generate image using real Stable Diffusion
            statusEl.innerHTML = '<i class="fas fa-magic"></i> Running Stable Diffusion inference...';
            
            const generatedImage = await this.runStableDiffusion(prompt, 512, 512);

            // Show original
            const originalCanvas = document.getElementById('ai-original-canvas');
            originalCanvas.width = canvasSize * 8;
            originalCanvas.height = canvasSize * 8;
            const originalCtx = originalCanvas.getContext('2d');
            originalCtx.imageSmoothingEnabled = false;
            originalCtx.drawImage(generatedImage, 0, 0, originalCanvas.width, originalCanvas.height);

            // Apply pixelation (same as before)
            statusEl.innerHTML = '<i class="fas fa-th"></i> Applying pixel art conversion...';
            
            const pixelCanvas = document.getElementById('ai-pixel-canvas');
            pixelCanvas.width = canvasSize * 8;
            pixelCanvas.height = canvasSize * 8;
            
            this.pixelateImage(generatedImage, pixelSize, pixelCanvas, colorPalette, canvasSize);

            // Show results
            statusEl.innerHTML = '<i class="fas fa-check"></i> Generation complete!';
            previewContainer.style.display = 'block';
            applyBtn.style.display = 'inline-block';

            this.lastGenerated = {
                canvas: pixelCanvas,
                size: canvasSize
            };

        } catch (error) {
            statusEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Error: ${error.message}`;
            console.error('Generation error:', error);
        } finally {
            this.isGenerating = false;
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="fas fa-magic"></i> Generate';
        }
    }

    async runStableDiffusion(prompt, width, height) {
        // This is where the real magic happens
        
        // Step 1: Encode text prompt
        const textEmbedding = await this.encodeText(prompt);
        
        // Step 2: Generate random noise (latent space)
        const latentShape = [1, 4, height / 8, width / 8]; // SD works in latent space
        const noise = this.generateRandomNoise(latentShape);
        
        // Step 3: Run denoising process (this is the main computation)
        const denoisedLatent = await this.denoise(noise, textEmbedding);
        
        // Step 4: Decode latent to image
        const finalImage = await this.decodeLatent(denoisedLatent);
        
        return finalImage;
    }

    async encodeText(prompt) {
        // Tokenize the prompt (you'll need a tokenizer)
        const tokens = await this.tokenizeText(prompt);
        
        // Run text encoder
        const inputTensor = new ort.Tensor('int64', tokens, [1, tokens.length]);
        const results = await this.textEncoderSession.run({ input_ids: inputTensor });
        
        return results.last_hidden_state;
    }

    async tokenizeText(prompt) {
        // This is simplified - you'd need a proper CLIP tokenizer
        // You can use transformers.js or implement your own
        
        // For now, return dummy tokens (replace with real tokenization)
        const maxLength = 77; // CLIP max sequence length
        const tokens = new Array(maxLength).fill(49407); // padding token
        
        // In real implementation:
        // const tokenizer = await AutoTokenizer.from_pretrained('openai/clip-vit-base-patch32');
        // const tokens = tokenizer.encode(prompt, { max_length: 77, padding: true });
        
        return tokens;
    }

    generateRandomNoise(shape) {
        const size = shape.reduce((a, b) => a * b, 1);
        const data = new Float32Array(size);
        
        // Generate Gaussian noise
        for (let i = 0; i < size; i += 2) {
            const u1 = Math.random();
            const u2 = Math.random();
            const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
            const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);
            
            data[i] = z0;
            if (i + 1 < size) data[i + 1] = z1;
        }
        
        return new ort.Tensor('float32', data, shape);
    }

    async denoise(noiseTensor, textEmbedding) {
        // This is the main denoising loop
        const numInferenceSteps = 20; // Fewer steps = faster but lower quality
        const guidanceScale = 7.5; // How much to follow the prompt
        
        let latent = noiseTensor;
        
        // Create timesteps
        const timesteps = this.createTimesteps(numInferenceSteps);
        
        for (let i = 0; i < numInferenceSteps; i++) {
            const t = timesteps[i];
            const timestepTensor = new ort.Tensor('int64', [t], [1]);
            
            // Run UNet prediction
            const unetInputs = {
                sample: latent,
                timestep: timestepTensor,
                encoder_hidden_states: textEmbedding
            };
            
            const results = await this.unetSession.run(unetInputs);
            const noisePred = results.out_sample;
            
            // Update latent (scheduler step)
            latent = this.schedulerStep(latent, noisePred, t, i, numInferenceSteps);
            
            // Update progress
            const progress = Math.round(((i + 1) / numInferenceSteps) * 100);
            document.getElementById('ai-status').innerHTML = 
                `<i class="fas fa-magic"></i> Generating... ${progress}% (${i + 1}/${numInferenceSteps} steps)`;
        }
        
        return latent;
    }

    createTimesteps(numInferenceSteps) {
        // Create denoising timesteps (simplified DDIM scheduler)
        const timesteps = [];
        const stepSize = Math.floor(1000 / numInferenceSteps);
        
        for (let i = numInferenceSteps - 1; i >= 0; i--) {
            timesteps.push(i * stepSize);
        }
        
        return timesteps;
    }

    schedulerStep(latent, noisePred, timestep, stepIndex, numInferenceSteps) {
        // Simplified DDIM scheduler step
        // In real implementation, you'd use a proper scheduler like DDIMScheduler
        
        const alphaT = 1 - timestep / 1000;
        const alphaPrev = stepIndex === numInferenceSteps - 1 ? 1 : 1 - (timestep - 1000/numInferenceSteps) / 1000;
        
        const latentData = latent.data;
        const noiseData = noisePred.data;
        const newLatentData = new Float32Array(latentData.length);
        
        for (let i = 0; i < latentData.length; i++) {
            // Simplified step computation
            newLatentData[i] = latentData[i] - (Math.sqrt(1 - alphaT) * noiseData[i]);
        }
        
        return new ort.Tensor('float32', newLatentData, latent.dims);
    }

    async decodeLatent(latent) {
        // Decode latent to RGB image using VAE decoder
        const results = await this.vaeSession.run({ latent_sample: latent });
        const imageData = results.sample.data;
        
        // Convert to canvas
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(512, 512);
        
        // Convert from [-1, 1] to [0, 255] and arrange RGB
        for (let i = 0; i < 512 * 512; i++) {
            const r = Math.round((imageData[i] + 1) * 127.5);
            const g = Math.round((imageData[i + 512 * 512] + 1) * 127.5);
            const b = Math.round((imageData[i + 2 * 512 * 512] + 1) * 127.5);
            
            imgData.data[i * 4] = Math.max(0, Math.min(255, r));
            imgData.data[i * 4 + 1] = Math.max(0, Math.min(255, g));
            imgData.data[i * 4 + 2] = Math.max(0, Math.min(255, b));
            imgData.data[i * 4 + 3] = 255;
        }
        
        ctx.putImageData(imgData, 0, 0);
        return canvas;
    }

    // Keep all the existing pixelation methods from the mock version
    pixelateImage(sourceCanvas, pixelSize, targetCanvas, colorPalette, targetSize) {
        // Same implementation as before...
    }

    // ... other helper methods remain the same
}

// Alternative: Using Transformers.js (Easier Implementation)
class TransformersJSAIGenerator {
    constructor() {
        this.pipeline = null;
        this.loaded = false;
        this.init();
    }

    async init() {
        this.createModal();
        this.bindEvents();
        
        // Import transformers.js
        const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0');
        this.pipelineClass = pipeline;
    }

    async loadModel() {
        if (this.loaded) return;
        
        const statusEl = document.getElementById('ai-status');
        statusEl.innerHTML = '<i class="fas fa-download"></i> Loading Stable Diffusion model...';
        
        // This downloads and caches the model automatically
        this.pipeline = await this.pipelineClass(
            'text-to-image', 
            'Xenova/stable-diffusion-2-1-base',
            { 
                dtype: 'fp16',  // Use half precision for better performance
                device: 'webgl' // Use WebGL if available
            }
        );
        
        this.loaded = true;
        statusEl.innerHTML = '<i class="fas fa-check"></i> Model loaded successfully!';
    }

    async generateArt() {
        // Load model
        if (!this.loaded) {
            await this.loadModel();
        }

        const prompt = document.getElementById('ai-prompt').value.trim();
        
        // Generate image
        const result = await this.pipeline(prompt, {
            width: 512,
            height: 512,
            num_inference_steps: 20,
            guidance_scale: 7.5
        });

        // Convert result to canvas
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // result.images[0] is a PIL-like image object
        const imgData = await result.images[0].toImageData();
        ctx.putImageData(imgData, 0, 0);
        
        // Continue with pixelation process...
        return canvas;
    }
}

// Setup Instructions:
/*
1. HOST THE ONNX MODELS:
   - Download ONNX Stable Diffusion models from Hugging Face
   - Host them on your server or CDN
   - Models needed: text_encoder.onnx, unet.onnx, vae_decoder.onnx
   
2. UPDATE YOUR HTML:
   Add before your other scripts:
   <script src="https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.3/dist/ort.min.js"></script>
   
3. REPLACE THE MOCK GENERATOR:
   Replace the mock AIGenerator class with RealAIGenerator
   
4. OPTIONAL - Use Transformers.js instead (easier):
   Replace with TransformersJSAIGenerator for automatic model management

5. PERFORMANCE CONSIDERATIONS:
   - First load will be slow (model download)
   - Consider showing download progress
   - Cache models in browser storage
   - Use Web Workers for inference to prevent UI blocking
*/

// Easy Drop-in Replacement (add this to your aiGenerator.js):
document.addEventListener('DOMContentLoaded', () => {
    // Replace this line:
    // window.aiGenerator = new AIGenerator();
    
    // With this:
    // Simplest option - handles everything automatically
    window.aiGenerator = new TransformersJSAIGenerator();

});






/**
 * AI Pixel Art Generator for Pixel Editor
 * Integrates browser-based AI generation with the existing pixel editor
 */

class AIGenerator {
    constructor() {
        this.loaded = false;
        this.isGenerating = false;
        this.modal = null;
        this.init();
    }

    init() {
        this.createModal();
        this.bindEvents();
    }

    createModal() {
        // Create AI Generator Modal
        const modalHTML = `
            <div class="modal" id="ai-generator-modal">
                <div class="modal-content" style="max-width: 800px;">
                    <div class="modal-header">
                        <h3><i class="fas fa-magic"></i> AI Pixel Art Generator</h3>
                        <button class="modal-close" id="ai-modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="ai-info-box" style="background: #2a2a2a; border: 1px solid #444; border-radius: 6px; padding: 15px; margin-bottom: 20px;">
                            <h4 style="margin-top: 0; color: #4CAF50;"><i class="fas fa-info-circle"></i> Local AI Model Demo</h4>
                            <p style="margin-bottom: 8px;">This demonstrates how a browser-based AI model would work in your editor.</p>
                            <p style="margin: 0; font-size: 13px; color: #ccc;">Real implementation would load ONNX Stable Diffusion (~2-4GB) for true AI generation.</p>
                        </div>
                        
                        <div class="input-group">
                            <label for="ai-prompt">Prompt:</label>
                            <textarea 
                                id="ai-prompt" 
                                placeholder="Describe your pixel art (e.g., 'medieval castle, 16-bit style', 'retro spaceship', 'fantasy sword')"
                                rows="3"
                                style="width: 100%; background: #1a1a1a; border: 1px solid #444; color: #fff; padding: 10px; border-radius: 6px; resize: vertical; font-family: inherit;">pixel art medieval castle, 16-bit retro game style</textarea>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
                            <div class="input-group">
                                <label for="ai-canvas-size">Target Canvas Size:</label>
                                <select id="ai-canvas-size" style="background: #1a1a1a; border: 1px solid #444; color: #fff; padding: 8px; border-radius: 4px;">
                                    <option value="16">16x16</option>
                                    <option value="32" selected>32x32</option>
                                    <option value="48">48x48</option>
                                    <option value="64">64x64</option>
                                </select>
                            </div>
                            
                            <div class="input-group">
                                <label for="ai-pixel-size">Pixel Size:</label>
                                <select id="ai-pixel-size" style="background: #1a1a1a; border: 1px solid #444; color: #fff; padding: 8px; border-radius: 4px;">
                                    <option value="4">4px</option>
                                    <option value="6">6px</option>
                                    <option value="8" selected>8px</option>
                                    <option value="10">10px</option>
                                    <option value="12">12px</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="input-group">
                            <label for="ai-color-palette">Color Palette:</label>
                            <select id="ai-color-palette" style="background: #1a1a1a; border: 1px solid #444; color: #fff; padding: 8px; border-radius: 4px;">
                                <option value="full">Full Color</option>
                                <option value="retro" selected>Retro 16-Color</option>
                                <option value="gameboy">Game Boy Green</option>
                                <option value="nes">NES Palette</option>
                                <option value="c64">Commodore 64</option>
                            </select>
                        </div>
                        
                        <div class="ai-status" id="ai-status" style="text-align: center; margin: 20px 0; min-height: 24px; font-size: 14px;"></div>
                        
                        <div class="ai-preview-container" id="ai-preview-container" style="display: none; margin-top: 20px;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                                <div style="text-align: center;">
                                    <h4 style="margin-bottom: 10px; color: #ccc;">AI Generated</h4>
                                    <canvas id="ai-original-canvas" style="border: 1px solid #444; max-width: 100%; background: #000;"></canvas>
                                </div>
                                <div style="text-align: center;">
                                    <h4 style="margin-bottom: 10px; color: #ccc;">Pixel Art Result</h4>
                                    <canvas id="ai-pixel-canvas" style="border: 1px solid #444; max-width: 100%; background: #000; image-rendering: pixelated;"></canvas>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" id="ai-cancel">Cancel</button>
                        <button class="btn btn-primary" id="ai-generate" style="background: linear-gradient(45deg, #4CAF50, #45a049);">
                            <i class="fas fa-magic"></i> Generate
                        </button>
                        <button class="btn btn-success" id="ai-apply" style="display: none;">
                            <i class="fas fa-plus"></i> Add to Canvas
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('ai-generator-modal');
    }

    bindEvents() {
        // Main generate button in header
        const generateBtn = document.getElementById('generate-ai-button');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.showModal());
        }

        // Modal events
        document.getElementById('ai-modal-close')?.addEventListener('click', () => this.hideModal());
        document.getElementById('ai-cancel')?.addEventListener('click', () => this.hideModal());
        document.getElementById('ai-generate')?.addEventListener('click', () => this.generateArt());
        document.getElementById('ai-apply')?.addEventListener('click', () => this.applyToCanvas());

        // Close modal when clicking outside
        this.modal?.addEventListener('click', (e) => {
            if (e.target === this.modal) this.hideModal();
        });
    }

    showModal() {
        if (this.modal) {
            this.modal.style.display = 'flex';
            // Focus on prompt textarea
            setTimeout(() => {
                document.getElementById('ai-prompt')?.focus();
            }, 100);
        }
    }

    hideModal() {
        if (this.modal) {
            this.modal.style.display = 'none';
            this.resetModal();
        }
    }

    resetModal() {
        document.getElementById('ai-preview-container').style.display = 'none';
        document.getElementById('ai-apply').style.display = 'none';
        document.getElementById('ai-status').innerHTML = '';
        this.isGenerating = false;
    }

    async generateArt() {
        if (this.isGenerating) return;

        const generateBtn = document.getElementById('ai-generate');
        const statusEl = document.getElementById('ai-status');
        const previewContainer = document.getElementById('ai-preview-container');
        const applyBtn = document.getElementById('ai-apply');

        try {
            this.isGenerating = true;
            generateBtn.disabled = true;
            generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
            previewContainer.style.display = 'none';
            applyBtn.style.display = 'none';

            // Get parameters
            const prompt = document.getElementById('ai-prompt').value.trim();
            const canvasSize = parseInt(document.getElementById('ai-canvas-size').value);
            const pixelSize = parseInt(document.getElementById('ai-pixel-size').value);
            const colorPalette = document.getElementById('ai-color-palette').value;

            if (!prompt) {
                throw new Error('Please enter a prompt');
            }

            // Simulate model loading (first time)
            if (!this.loaded) {
                statusEl.innerHTML = '<i class="fas fa-download"></i> Loading AI model... (2-4GB download in real implementation)';
                await this.simulateDelay(2000);
                this.loaded = true;
            }

            // Generate image
            statusEl.innerHTML = '<i class="fas fa-magic"></i> Generating image from prompt...';
            await this.simulateDelay(1500);

            const generatedCanvas = this.generateImageFromPrompt(prompt, 512, 512);

            // Show original
            const originalCanvas = document.getElementById('ai-original-canvas');
            originalCanvas.width = canvasSize * 8; // Display size
            originalCanvas.height = canvasSize * 8;
            const originalCtx = originalCanvas.getContext('2d');
            originalCtx.imageSmoothingEnabled = false;
            originalCtx.drawImage(generatedCanvas, 0, 0, originalCanvas.width, originalCanvas.height);

            // Apply pixelation
            statusEl.innerHTML = '<i class="fas fa-th"></i> Applying pixel art conversion...';
            await this.simulateDelay(800);

            const pixelCanvas = document.getElementById('ai-pixel-canvas');
            pixelCanvas.width = canvasSize * 8; // Display size
            pixelCanvas.height = canvasSize * 8;
            
            this.pixelateImage(generatedCanvas, pixelSize, pixelCanvas, colorPalette, canvasSize);

            // Show results
            statusEl.innerHTML = '<i class="fas fa-check"></i> Generation complete! Click "Add to Canvas" to use this art.';
            previewContainer.style.display = 'block';
            applyBtn.style.display = 'inline-block';

            // Store the result for applying to canvas
            this.lastGenerated = {
                canvas: pixelCanvas,
                size: canvasSize
            };

        } catch (error) {
            statusEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Error: ${error.message}`;
        } finally {
            this.isGenerating = false;
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="fas fa-magic"></i> Generate';
        }
    }

    generateImageFromPrompt(prompt, width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Generate base gradient based on prompt
        const colors = this.getColorsFromPrompt(prompt);
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        
        for (let i = 0; i < colors.length; i++) {
            gradient.addColorStop(i / (colors.length - 1), colors[i]);
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Add noise and patterns
        this.addStructuralNoise(ctx, width, height, prompt);

        return canvas;
    }

    getColorsFromPrompt(prompt) {
        const lowerPrompt = prompt.toLowerCase();
        
        // Theme-based color schemes
        if (lowerPrompt.includes('castle') || lowerPrompt.includes('medieval') || lowerPrompt.includes('knight')) {
            return ['#2C3E50', '#34495E', '#7F8C8D', '#BDC3C7'];
        } else if (lowerPrompt.includes('space') || lowerPrompt.includes('cosmic') || lowerPrompt.includes('star')) {
            return ['#0F0F23', '#1B1B3A', '#2E2E5F', '#4169E1', '#87CEEB'];
        } else if (lowerPrompt.includes('forest') || lowerPrompt.includes('nature') || lowerPrompt.includes('tree')) {
            return ['#1B4332', '#2D6A4F', '#40916C', '#52B788', '#8EE4AF'];
        } else if (lowerPrompt.includes('fire') || lowerPrompt.includes('lava') || lowerPrompt.includes('dragon')) {
            return ['#8B0000', '#CD5C5C', '#FF6347', '#FF4500', '#FFD700'];
        } else if (lowerPrompt.includes('ocean') || lowerPrompt.includes('water') || lowerPrompt.includes('sea')) {
            return ['#003366', '#0066CC', '#3399FF', '#87CEEB', '#F0F8FF'];
        } else if (lowerPrompt.includes('desert') || lowerPrompt.includes('sand')) {
            return ['#8B4513', '#CD853F', '#DEB887', '#F4A460', '#FFF8DC'];
        } else if (lowerPrompt.includes('crystal') || lowerPrompt.includes('gem') || lowerPrompt.includes('magic')) {
            return ['#4B0082', '#8B008B', '#9932CC', '#BA55D3', '#DDA0DD'];
        }
        
        // Default retro game colors
        return ['#2C3E50', '#E74C3C', '#F39C12', '#27AE60'];
    }

    addStructuralNoise(ctx, width, height, prompt) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const x = (i / 4) % width;
            const y = Math.floor((i / 4) / width);
            
            // Create structured patterns based on prompt
            let noise = 0;
            
            // Basic perlin-like noise
            noise += this.noise(x * 0.01, y * 0.01) * 0.3;
            
            // Add geometric patterns for certain themes
            if (prompt.toLowerCase().includes('brick') || prompt.toLowerCase().includes('wall')) {
                noise += Math.sin(x * 0.1) * Math.sin(y * 0.2) * 0.2;
            }
            
            if (prompt.toLowerCase().includes('circuit') || prompt.toLowerCase().includes('tech')) {
                noise += (Math.sin(x * 0.05) * Math.cos(y * 0.05)) * 0.25;
            }
            
            const adjustment = noise * 80;
            
            data[i] = Math.max(0, Math.min(255, data[i] + adjustment));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + adjustment));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + adjustment));
        }
        
        ctx.putImageData(imageData, 0, 0);
    }

    noise(x, y) {
        const noise = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        return noise - Math.floor(noise);
    }

    pixelateImage(sourceCanvas, pixelSize, targetCanvas, colorPalette, targetSize) {
        const srcCtx = sourceCanvas.getContext('2d');
        const targetCtx = targetCanvas.getContext('2d');
        
        targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
        targetCtx.imageSmoothingEnabled = false;
        
        // Scale factor from display canvas to actual pixel grid
        const scaleFactor = targetCanvas.width / targetSize;
        const actualPixelSize = Math.max(1, Math.floor(scaleFactor / (targetSize / pixelSize)));
        
        for (let gridY = 0; gridY < targetSize; gridY++) {
            for (let gridX = 0; gridX < targetSize; gridX++) {
                // Sample from source
                const sampleX = Math.floor((gridX / targetSize) * sourceCanvas.width);
                const sampleY = Math.floor((gridY / targetSize) * sourceCanvas.height);
                
                const pixelData = srcCtx.getImageData(sampleX, sampleY, 1, 1);
                let [r, g, b, a] = pixelData.data;
                
                // Apply color palette
                if (colorPalette !== 'full') {
                    const palette = this.getColorPalette(colorPalette);
                    const nearestColor = this.findNearestColor(r, g, b, palette);
                    [r, g, b] = this.hexToRgb(nearestColor);
                }
                
                // Draw pixel block
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

    getColorPalette(paletteType) {
        const palettes = {
            retro: [
                '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
                '#FF00FF', '#00FFFF', '#800000', '#008000', '#000080', '#808000',
                '#800080', '#008080', '#C0C0C0', '#808080'
            ],
            gameboy: ['#0F380F', '#306230', '#8BAC0F', '#9BBD0F'],
            nes: [
                '#7C7C7C', '#0000FC', '#0000BC', '#4428BC', '#940084', '#A80020',
                '#A81000', '#881400', '#503000', '#007800', '#006800', '#005800',
                '#004058', '#000000', '#BCBCBC', '#0078F8'
            ],
            c64: [
                '#000000', '#FFFFFF', '#880000', '#AAFFEE', '#CC44CC', '#00CC55',
                '#0000AA', '#EEEE77', '#DD8855', '#664400', '#FF7777', '#333333',
                '#777777', '#AAFF66', '#0088FF', '#BBBBBB'
            ]
        };
        return palettes[paletteType] || palettes.retro;
    }

    findNearestColor(r, g, b, palette) {
        let minDistance = Infinity;
        let nearestColor = palette[0];
        
        for (const color of palette) {
            const [pr, pg, pb] = this.hexToRgb(color);
            const distance = Math.sqrt(
                Math.pow(r - pr, 2) + Math.pow(g - pg, 2) + Math.pow(b - pb, 2)
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
        return result ? [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16)
        ] : [0, 0, 0];
    }

    simulateDelay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    applyToCanvas() {
        if (!this.lastGenerated || !window.pixelEditor) {
            return;
        }

        try {
            // Get the pixelated canvas
            const sourceCanvas = this.lastGenerated.canvas;
            const targetSize = this.lastGenerated.size;
            
            // Create a new sprite with the AI generated content
            const newSprite = window.pixelEditor.createNewSprite();
            
            // Resize the canvas to match the AI generated size
            window.pixelEditor.resizeCanvas(targetSize, targetSize);
            
            // Create a temporary canvas to extract pixel data
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = targetSize;
            tempCanvas.height = targetSize;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Draw the AI result to temp canvas at actual size
            tempCtx.imageSmoothingEnabled = false;
            tempCtx.drawImage(sourceCanvas, 0, 0, targetSize, targetSize);
            
            // Get pixel data and apply to editor
            const imageData = tempCtx.getImageData(0, 0, targetSize, targetSize);
            const pixelData = imageData.data;
            
            // Apply pixels to the current layer
            const currentLayer = window.pixelEditor.getCurrentLayer();
            if (currentLayer && currentLayer.canvas) {
                const layerCtx = currentLayer.canvas.getContext('2d');
                layerCtx.clearRect(0, 0, targetSize, targetSize);
                
                for (let y = 0; y < targetSize; y++) {
                    for (let x = 0; x < targetSize; x++) {
                        const index = (y * targetSize + x) * 4;
                        const r = pixelData[index];
                        const g = pixelData[index + 1];
                        const b = pixelData[index + 2];
                        const a = pixelData[index + 3];
                        
                        if (a > 0) {
                            layerCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
                            layerCtx.fillRect(x, y, 1, 1);
                        }
                    }
                }
            }
            
            // Refresh the editor display
            window.pixelEditor.render();
            
            // Update sprite name
            const promptText = document.getElementById('ai-prompt').value.trim();
            const shortName = promptText.split(' ').slice(0, 3).join(' ').substring(0, 20);
            if (shortName && window.pixelEditor.setSpriteName) {
                window.pixelEditor.setSpriteName(`AI: ${shortName}`);
            }
            
            // Hide modal
            this.hideModal();
            
            console.log('AI generated pixel art applied to canvas successfully');
            
        } catch (error) {
            console.error('Error applying AI art to canvas:', error);
            alert('Error applying AI art to canvas. Please check the console for details.');
        }
    }
}

// Initialize AI Generator when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.aiGenerator = new AIGenerator();
    console.log('AI Generator initialized');
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIGenerator;
}