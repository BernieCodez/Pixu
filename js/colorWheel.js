/**
 * Color Wheel Implementation
 */
class ColorWheel {
    constructor(canvas, onColorChange) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.onColorChange = onColorChange;
        
        this.radius = canvas.width / 2 - 10;
        this.centerX = canvas.width / 2;
        this.centerY = canvas.height / 2;
        
        this.isDragging = false;
        this.currentHue = 0;
        this.currentSaturation = 1;
        this.currentLightness = 0.5;
        
        this.setupEventListeners();
        this.render();
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.updateColor(e);
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                this.updateColor(e);
            }
        });

        this.canvas.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
        });
    }

    updateColor(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left - this.centerX;
        const y = event.clientY - rect.top - this.centerY;
        
        const distance = Math.sqrt(x * x + y * y);
        
        if (distance <= this.radius) {
            // Calculate hue from angle
            let angle = Math.atan2(y, x);
            if (angle < 0) angle += 2 * Math.PI;
            this.currentHue = angle / (2 * Math.PI);
            
            // Calculate saturation from distance
            this.currentSaturation = Math.min(distance / this.radius, 1);
            
            // Convert HSL to RGB
            const [r, g, b] = this.hslToRgb(this.currentHue, this.currentSaturation, this.currentLightness);
            const hex = `#${Math.round(r * 255).toString(16).padStart(2, '0')}${Math.round(g * 255).toString(16).padStart(2, '0')}${Math.round(b * 255).toString(16).padStart(2, '0')}`;
            
            // Update editor primary color
            if (this.onColorChange) {
                this.onColorChange(hex);
            }
            
            // Redraw with updated selection
            this.render();
        }
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw color wheel
        const imageData = this.ctx.createImageData(this.canvas.width, this.canvas.height);
        const data = imageData.data;
        
        for (let y = 0; y < this.canvas.height; y++) {
            for (let x = 0; x < this.canvas.width; x++) {
                const dx = x - this.centerX;
                const dy = y - this.centerY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance <= this.radius) {
                    let angle = Math.atan2(dy, dx);
                    if (angle < 0) angle += 2 * Math.PI;
                    
                    const hue = angle / (2 * Math.PI);
                    const saturation = distance / this.radius;
                    const lightness = this.currentLightness;
                    
                    const [r, g, b] = this.hslToRgb(hue, saturation, lightness);
                    
                    const index = (y * this.canvas.width + x) * 4;
                    data[index] = Math.round(r * 255);     // Red
                    data[index + 1] = Math.round(g * 255); // Green
                    data[index + 2] = Math.round(b * 255); // Blue
                    data[index + 3] = 255;                 // Alpha
                } else {
                    // Transparent outside the wheel
                    const index = (y * this.canvas.width + x) * 4;
                    data[index + 3] = 0;
                }
            }
        }
        
        this.ctx.putImageData(imageData, 0, 0);
        
        // Draw selection indicator
        this.drawSelectionIndicator();
    }

    drawSelectionIndicator() {
        const angle = this.currentHue * 2 * Math.PI;
        const distance = this.currentSaturation * this.radius;
        const x = this.centerX + Math.cos(angle) * distance;
        const y = this.centerY + Math.sin(angle) * distance;
        
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 4, 0, 2 * Math.PI);
        this.ctx.stroke();
        
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 4, 0, 2 * Math.PI);
        this.ctx.stroke();
    }

    setLightness(lightness) {
        this.currentLightness = Math.max(0, Math.min(1, lightness));
        this.render();
    }

    setColor(color) {
        const [r, g, b] = color;
        const [h, s, l] = this.rgbToHsl(r / 255, g / 255, b / 255);
        
        this.currentHue = h;
        this.currentSaturation = s;
        this.currentLightness = l;
        
        this.render();
    }

    hslToRgb(h, s, l) {
        let r, g, b;

        if (s === 0) {
            r = g = b = l; // Achromatic
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        return [r, g, b];
    }

    rgbToHsl(r, g, b) {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0; // Achromatic
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        return [h, s, l];
    }
}
