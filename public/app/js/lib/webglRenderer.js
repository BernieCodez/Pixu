/**
 * WebGLRenderer - A WebGL-based renderer for pixel art
 * Provides GPU-accelerated rendering for large sprites
 */
class WebGLRenderer {
  constructor() {
    this.initialized = false;
    this.gl = null;
    this.program = null;
    this.textures = {
      sprite: null,
      checkerboard: null
    };
    this.buffers = {
      position: null,
      texCoord: null
    };
    this.width = 0;
    this.height = 0;
    this.canvasWidth = 0;
    this.canvasHeight = 0;
  }

  /**
   * Initialize WebGL context and resources
   * @param {HTMLCanvasElement} canvas - Canvas element to render to
   * @returns {boolean} - True if initialization was successful
   */
  initialize(canvas) {
    try {
      // Try to get WebGL context - fall back to WebGL 1 if WebGL 2 is not available
      this.gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

      if (!this.gl) {
        console.warn('WebGL not supported. Falling back to Canvas 2D rendering.');
        return false;
      }

      // Create shader program
      this.program = this.createShaderProgram();
      if (!this.program) {
        console.warn('Failed to create WebGL shader program.');
        return false;
      }

      // Create buffers
      this.createBuffers();

      // Create textures
      this.createTextures();

      this.initialized = true;
      return true;
    } catch (e) {
      console.error('WebGL initialization failed:', e);
      return false;
    }
  }
  
  setupShaders() {
    // Vertex shader program
    const vsSource = `
      attribute vec4 aVertexPosition;
      attribute vec2 aTextureCoord;
      varying highp vec2 vTextureCoord;
      void main() {
        gl_Position = aVertexPosition;
        vTextureCoord = aTextureCoord;
      }
    `;

    // Fragment shader program
    const fsSource = `
      precision mediump float;
      varying highp vec2 vTextureCoord;
      uniform sampler2D uSampler;
      uniform sampler2D uCheckerboard;
      uniform bool uShowCheckerboard;
      
      void main() {
        vec4 texelColor = texture2D(uSampler, vTextureCoord);
        
        if (uShowCheckerboard && texelColor.a < 1.0) {
          vec4 checkerColor = texture2D(uCheckerboard, vTextureCoord * 8.0);
          texelColor = vec4(
            mix(checkerColor.rgb, texelColor.rgb, texelColor.a),
            1.0
          );
        }
        
        gl_FragColor = texelColor;
      }
    `;
    
    // Create the shader program
    const vertexShader = this.loadShader(this.gl.VERTEX_SHADER, vsSource);
    const fragmentShader = this.loadShader(this.gl.FRAGMENT_SHADER, fsSource);
    
    this.program = this.gl.createProgram();
    this.gl.attachShader(this.program, vertexShader);
    this.gl.attachShader(this.program, fragmentShader);
    this.gl.linkProgram(this.program);
    
    if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
      console.error('Unable to initialize the shader program:', this.gl.getProgramInfoLog(this.program));
      return;
    }
    
    // Set program info
    this.programInfo = {
      program: this.program,
      attribLocations: {
        vertexPosition: this.gl.getAttribLocation(this.program, 'aVertexPosition'),
        textureCoord: this.gl.getAttribLocation(this.program, 'aTextureCoord'),
      },
      uniformLocations: {
        uSampler: this.gl.getUniformLocation(this.program, 'uSampler'),
        uCheckerboard: this.gl.getUniformLocation(this.program, 'uCheckerboard'),
        uShowCheckerboard: this.gl.getUniformLocation(this.program, 'uShowCheckerboard'),
      },
    };
  }
  
  loadShader(type, source) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('An error occurred compiling the shaders:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }
    
    return shader;
  }
  
  createBuffers() {
    // Create position buffer for a full-screen quad
    const positions = [
      -1.0, -1.0,  // bottom left
       1.0, -1.0,  // bottom right
      -1.0,  1.0,  // top left
       1.0,  1.0,  // top right
    ];
    
    const textureCoords = [
      0.0, 1.0,    // bottom left
      1.0, 1.0,    // bottom right
      0.0, 0.0,    // top left
      1.0, 0.0,    // top right
    ];
    
    this.vertexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);
    
    this.textureCoordBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.textureCoordBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(textureCoords), this.gl.STATIC_DRAW);
  }
  
  createTextures() {
    this.texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    
    // Fill the texture with a placeholder pink color
    const placeholderPixel = new Uint8Array([255, 0, 255, 255]); // Pink
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      1, 1,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      placeholderPixel
    );
  }
  
  createCheckerboardTexture() {
    const checkerSize = 16;
    const data = new Uint8Array(checkerSize * checkerSize * 4);
    
    // Create checkerboard pattern for transparency
    for (let y = 0; y < checkerSize; y++) {
      for (let x = 0; x < checkerSize; x++) {
        const index = (y * checkerSize + x) * 4;
        // Light gray or white alternating pattern
        const color = ((x & 1) ^ (y & 1)) ? 220 : 255;
        
        data[index] = color;
        data[index + 1] = color;
        data[index + 2] = color;
        data[index + 3] = 255; // Fully opaque
      }
    }
    
    this.checkerboardTexture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.checkerboardTexture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      checkerSize, checkerSize,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      data
    );
    
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
  }
  
  // Draw the pixel art to the canvas
  draw(imageData, showCheckerboard = true) {
    if (!this.initialized) return;
    
    const gl = this.gl;
    
    // Set viewport to canvas size
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    
    // Clear the canvas
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // Use the shader program
    gl.useProgram(this.program);
    
    // Set up vertex positions
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.vertexAttribPointer(
      this.programInfo.attribLocations.vertexPosition,
      2, // Number of components per vertex
      gl.FLOAT,
      false,
      0,
      0
    );
    gl.enableVertexAttribArray(this.programInfo.attribLocations.vertexPosition);
    
    // Set up texture coordinates
    gl.bindBuffer(gl.ARRAY_BUFFER, this.textureCoordBuffer);
    gl.vertexAttribPointer(
      this.programInfo.attribLocations.textureCoord,
      2, // Number of components per texture coord
      gl.FLOAT,
      false,
      0,
      0
    );
    gl.enableVertexAttribArray(this.programInfo.attribLocations.textureCoord);
    
    // Upload the new image data to the texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      imageData.width,
      imageData.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      imageData.data
    );
    
    // Set texture uniforms for the shader
    gl.uniform1i(this.programInfo.uniformLocations.uSampler, 0);
    
    // Set up checkerboard texture
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.checkerboardTexture);
    gl.uniform1i(this.programInfo.uniformLocations.uCheckerboard, 1);
    
    // Set if we should show the checkerboard
    gl.uniform1i(this.programInfo.uniformLocations.uShowCheckerboard, showCheckerboard ? 1 : 0);
    
    // Draw the quad
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  
  // Clean up resources when no longer needed
  destroy() {
    if (!this.gl) return;
    
    // Delete textures
    if (this.texture) this.gl.deleteTexture(this.texture);
    if (this.checkerboardTexture) this.gl.deleteTexture(this.checkerboardTexture);
    
    // Delete buffers
    if (this.vertexBuffer) this.gl.deleteBuffer(this.vertexBuffer);
    if (this.textureCoordBuffer) this.gl.deleteBuffer(this.textureCoordBuffer);
    
    // Delete program and shaders
    if (this.program) this.gl.deleteProgram(this.program);
    
    this.initialized = false;
  }
  
  // Resize the renderer to match canvas dimensions
  resize(width, height) {
    if (!this.initialized) return;
    
    this.gl.viewport(0, 0, width, height);
    this.canvasWidth = width;
    this.canvasHeight = height;
    
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }
}

// Export the renderer
window.WebGLRenderer = WebGLRenderer;