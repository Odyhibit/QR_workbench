// QR Code Renderer
// Handles rendering QR codes with custom styling options

const QRRenderer = {
    // Styling state
    state: {
        logoImage: null,
        logoImg: null,
        logoImageData: null,
        logoX: 50, // percentage position
        logoY: 50,
        logoScale: 100,
        moduleShape: 'square', // 'square', 'circle', 'rounded', 'diamond', 'cushion'
        moduleSize: 80, // percentage (20-100)
        colorMode: 'default', // 'default', 'palette', 'gradient'
        darkPalette: ['#000000', '#333333', '#1a1a1a', '#0d0d0d'],
        lightPalette: ['#ffffff', '#f0f0f0', '#e0e0e0', '#d0d0d0'],
        darkMaxLuminosity: 33,
        lightMinLuminosity: 66,
        quietZone: 4,
        finderShape: 'square', // 'square', 'circle', 'hybrid', 'hybrid-inverse', 'rounded'
        backgroundFill: 'transparent' // 'transparent', 'light', 'dark'
    },

    /**
     * Load logo image
     */
    loadLogo(file, callback) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.state.logoImage = e.target.result;
                this.state.logoImg = img;

                // Create ImageData for sampling
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCanvas.width = img.width;
                tempCanvas.height = img.height;
                tempCtx.drawImage(img, 0, 0);
                this.state.logoImageData = tempCtx.getImageData(0, 0, img.width, img.height);

                // Extract colors for palette mode
                const colors = ColorUtils.extractDominantColors(img);
                this.state.darkPalette = colors.darkPalette;
                this.state.lightPalette = colors.lightPalette;

                // Reset position to center
                this.state.logoX = 50;
                this.state.logoY = 50;

                if (callback) callback();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    /**
     * Clear logo
     */
    clearLogo() {
        this.state.logoImage = null;
        this.state.logoImg = null;
        this.state.logoImageData = null;
        this.state.logoX = 50;
        this.state.logoY = 50;
        this.state.darkPalette = ['#000000', '#333333', '#1a1a1a', '#0d0d0d'];
        this.state.lightPalette = ['#ffffff', '#f0f0f0', '#e0e0e0', '#d0d0d0'];
        this.state.backgroundFill = 'transparent';
    },

    /**
     * Check if a module is part of a finder pattern (7x7 core only)
     */
    isFinderPattern(row, col, moduleCount) {
        if (row <= 6 && col <= 6) return true;
        if (row <= 6 && col >= moduleCount - 7) return true;
        if (row >= moduleCount - 7 && col <= 6) return true;
        return false;
    },

    /**
     * Check if a module is a separator (1-module border around finders)
     */
    isSeparator(row, col, moduleCount) {
        if (row <= 7 && col <= 7) {
            if (row === 7 || col === 7) return true;
        }
        if (row <= 7 && col >= moduleCount - 8) {
            if (row === 7 || col === moduleCount - 8) return true;
        }
        if (row >= moduleCount - 8 && col <= 7) {
            if (row === moduleCount - 8 || col === 7) return true;
        }
        return false;
    },

    /**
     * Calculate logo dimensions and position
     */
    getLogoBounds(qrAreaSize) {
        if (!this.state.logoImg) return null;

        const img = this.state.logoImg;
        const scale = this.state.logoScale / 100;
        const maxSize = qrAreaSize * scale;
        const aspectRatio = img.width / img.height;

        let logoWidth, logoHeight;
        if (aspectRatio > 1) {
            logoWidth = maxSize;
            logoHeight = maxSize / aspectRatio;
        } else {
            logoHeight = maxSize;
            logoWidth = maxSize * aspectRatio;
        }

        const logoX = (qrAreaSize * this.state.logoX / 100) - (logoWidth / 2);
        const logoY = (qrAreaSize * this.state.logoY / 100) - (logoHeight / 2);

        return { x: logoX, y: logoY, width: logoWidth, height: logoHeight };
    },

    /**
     * Draw logo as background
     */
    drawLogoBackground(ctx, offsetX, offsetY, qrAreaSize) {
        if (!this.state.logoImg) return;

        const bounds = this.getLogoBounds(qrAreaSize);
        if (!bounds) return;

        ctx.drawImage(
            this.state.logoImg,
            offsetX + bounds.x,
            offsetY + bounds.y,
            bounds.width,
            bounds.height
        );
    },

    /**
     * Sample logo color at specific position
     */
    sampleLogo(canvasX, canvasY, qrAreaSize) {
        if (!this.state.logoImg || !this.state.logoImageData) {
            return null;
        }

        const bounds = this.getLogoBounds(qrAreaSize);
        if (!bounds) return null;

        const logoLocalX = canvasX - bounds.x;
        const logoLocalY = canvasY - bounds.y;

        if (logoLocalX < 0 || logoLocalX >= bounds.width || logoLocalY < 0 || logoLocalY >= bounds.height) {
            return null;
        }

        const logoOriginalX = Math.floor((logoLocalX / bounds.width) * this.state.logoImg.width);
        const logoOriginalY = Math.floor((logoLocalY / bounds.height) * this.state.logoImg.height);

        const clampedX = Math.max(0, Math.min(this.state.logoImg.width - 1, logoOriginalX));
        const clampedY = Math.max(0, Math.min(this.state.logoImg.height - 1, logoOriginalY));

        const idx = (clampedY * this.state.logoImg.width + clampedX) * 4;

        return [
            this.state.logoImageData.data[idx],
            this.state.logoImageData.data[idx + 1],
            this.state.logoImageData.data[idx + 2],
            this.state.logoImageData.data[idx + 3]
        ];
    },

    /**
     * Get color for a module based on color mode
     */
    getModuleColor(canvasX, canvasY, isDark, qrAreaSize) {
        if (this.state.colorMode === 'default') {
            return isDark ? '#000000' : '#ffffff';
        }

        let sampledRgba = this.sampleLogo(canvasX, canvasY, qrAreaSize);

        if (!sampledRgba || sampledRgba[3] < 128) {
            // Outside logo or transparent - use default
            if (this.state.colorMode === 'palette') {
                const palette = isDark ? this.state.darkPalette : this.state.lightPalette;
                return palette[1] || palette[0];
            }
            sampledRgba = isDark ? [0, 0, 0, 255] : [255, 255, 255, 255];
        }

        const sampledRgb = [sampledRgba[0], sampledRgba[1], sampledRgba[2]];

        if (this.state.colorMode === 'gradient') {
            const hsl = ColorUtils.rgbToHsl(sampledRgb[0], sampledRgb[1], sampledRgb[2]);

            if (isDark) {
                if (hsl.l > this.state.darkMaxLuminosity) {
                    hsl.l = this.state.darkMaxLuminosity;
                }
            } else {
                if (hsl.l < this.state.lightMinLuminosity) {
                    hsl.l = this.state.lightMinLuminosity;
                }
            }

            const rgb = ColorUtils.hslToRgb(hsl.h, hsl.s, hsl.l);
            return ColorUtils.rgbToHex(rgb.r, rgb.g, rgb.b);
        } else if (this.state.colorMode === 'palette') {
            const palette = isDark ? this.state.darkPalette : this.state.lightPalette;
            return ColorUtils.findBestMatch(sampledRgb, palette);
        }

        return isDark ? '#000000' : '#ffffff';
    },

    /**
     * Draw white quiet zone overlay to prevent logo bleed
     */
    drawQuietZoneOverlay(ctx, canvasSize, moduleSize, quietZone) {
        if (!quietZone || quietZone <= 0) return;

        const quietZonePixels = quietZone * moduleSize;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasSize, quietZonePixels);
        ctx.fillRect(0, canvasSize - quietZonePixels, canvasSize, quietZonePixels);
        ctx.fillRect(0, 0, quietZonePixels, canvasSize);
        ctx.fillRect(canvasSize - quietZonePixels, 0, quietZonePixels, canvasSize);
    },

    /**
     * Draw a single module with shape
     */
    drawModule(ctx, x, y, width, height, color, shape, sizeFraction) {
        ctx.fillStyle = color;

        const shrunkWidth = width * sizeFraction;
        const shrunkHeight = height * sizeFraction;
        const offsetX = (width - shrunkWidth) / 2;
        const offsetY = (height - shrunkHeight) / 2;
        const centerX = x + offsetX + shrunkWidth / 2;
        const centerY = y + offsetY + shrunkHeight / 2;

        if (shape === 'circle') {
            const radius = Math.min(shrunkWidth, shrunkHeight) / 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fill();
        } else if (shape === 'rounded') {
            const rx = x + offsetX;
            const ry = y + offsetY;
            const radius = Math.min(shrunkWidth, shrunkHeight) * 0.10;
            ctx.beginPath();
            ctx.roundRect(rx, ry, shrunkWidth, shrunkHeight, radius);
            ctx.fill();
        } else if (shape === 'cushion') {
            const halfWidth = shrunkWidth / 2;
            const halfHeight = shrunkHeight / 2;
            const top = { x: centerX, y: y + offsetY };
            const right = { x: x + offsetX + shrunkWidth, y: centerY };
            const bottom = { x: centerX, y: y + offsetY + shrunkHeight };
            const left = { x: x + offsetX, y: centerY };
            const concaveFactor = 0.35;

            ctx.beginPath();
            ctx.moveTo(top.x, top.y);
            ctx.quadraticCurveTo(centerX + halfWidth * concaveFactor, centerY - halfHeight * concaveFactor, right.x, right.y);
            ctx.quadraticCurveTo(centerX + halfWidth * concaveFactor, centerY + halfHeight * concaveFactor, bottom.x, bottom.y);
            ctx.quadraticCurveTo(centerX - halfWidth * concaveFactor, centerY + halfHeight * concaveFactor, left.x, left.y);
            ctx.quadraticCurveTo(centerX - halfWidth * concaveFactor, centerY - halfHeight * concaveFactor, top.x, top.y);
            ctx.fill();
        } else if (shape === 'diamond') {
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(Math.PI / 4);
            const halfSize = Math.min(shrunkWidth, shrunkHeight) / 2;
            ctx.fillRect(-halfSize, -halfSize, halfSize * 2, halfSize * 2);
            ctx.restore();
        } else {
            ctx.fillRect(x + offsetX, y + offsetY, shrunkWidth, shrunkHeight);
        }
    },

    /**
     * Draw finder pattern
     */
    drawFinder(ctx, startRow, startCol, moduleSize, offset, darkColor, lightColor, sizeFraction, matrixSize) {
        const centerModuleX = startCol + 3.5;
        const centerModuleY = startRow + 3.5;
        const centerX = offset + (centerModuleX * moduleSize);
        const centerY = offset + (centerModuleY * moduleSize);

        // For non-square finders, draw background modules first
        if (this.state.finderShape !== 'square' && this.state.finderShape !== 'rounded') {
            const qrAreaSize = matrixSize * moduleSize;
            for (let row = 0; row < 7; row++) {
                for (let col = 0; col < 7; col++) {
                    const moduleX = offset + ((startCol + col) * moduleSize);
                    const moduleY = offset + ((startRow + row) * moduleSize);
                    const moduleCenterX = ((startCol + col) * moduleSize) + moduleSize / 2;
                    const moduleCenterY = ((startRow + row) * moduleSize) + moduleSize / 2;
                    const color = this.getModuleColor(moduleCenterX, moduleCenterY, false, qrAreaSize);
                    this.drawModule(ctx, moduleX, moduleY, moduleSize, moduleSize, color, this.state.moduleShape, sizeFraction);
                }
            }
        }

        const thicknessBoost = 0.08;

        if (this.state.finderShape === 'circle') {
            ctx.fillStyle = darkColor;
            ctx.beginPath();
            ctx.arc(centerX, centerY, (3.5 + thicknessBoost) * moduleSize, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = lightColor;
            ctx.beginPath();
            ctx.arc(centerX, centerY, (2.5 - thicknessBoost * 0.5) * moduleSize, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = darkColor;
            ctx.beginPath();
            ctx.arc(centerX, centerY, 1.5 * moduleSize, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.state.finderShape === 'rounded') {
            const roundingPercent = 0.10;

            ctx.fillStyle = darkColor;
            const outerX = offset + (startCol * moduleSize);
            const outerY = offset + (startRow * moduleSize);
            const outerSize = 7 * moduleSize;
            ctx.beginPath();
            ctx.roundRect(outerX, outerY, outerSize, outerSize, outerSize * roundingPercent);
            ctx.fill();

            ctx.fillStyle = lightColor;
            const middleX = offset + ((startCol + 1) * moduleSize);
            const middleY = offset + ((startRow + 1) * moduleSize);
            const middleSize = 5 * moduleSize;
            ctx.beginPath();
            ctx.roundRect(middleX, middleY, middleSize, middleSize, middleSize * roundingPercent);
            ctx.fill();

            ctx.fillStyle = darkColor;
            const innerX = offset + ((startCol + 2) * moduleSize);
            const innerY = offset + ((startRow + 2) * moduleSize);
            const innerSize = 3 * moduleSize;
            ctx.beginPath();
            ctx.roundRect(innerX, innerY, innerSize, innerSize, innerSize * roundingPercent);
            ctx.fill();
        } else if (this.state.finderShape === 'hybrid') {
            ctx.fillStyle = darkColor;
            ctx.beginPath();
            ctx.arc(centerX, centerY, (3.5 + thicknessBoost) * moduleSize, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = lightColor;
            ctx.beginPath();
            ctx.arc(centerX, centerY, (2.5 - thicknessBoost * 0.5) * moduleSize, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = darkColor;
            const innerSize = 3 * moduleSize;
            const innerX = offset + ((startCol + 2) * moduleSize);
            const innerY = offset + ((startRow + 2) * moduleSize);
            ctx.fillRect(innerX, innerY, innerSize, innerSize);
        } else if (this.state.finderShape === 'hybrid-inverse') {
            ctx.fillStyle = darkColor;
            const outerX = offset + (startCol * moduleSize) - (thicknessBoost * moduleSize);
            const outerY = offset + (startRow * moduleSize) - (thicknessBoost * moduleSize);
            const outerSize = (7 + thicknessBoost * 2) * moduleSize;
            ctx.fillRect(outerX, outerY, outerSize, outerSize);

            ctx.fillStyle = lightColor;
            const middleX = offset + ((startCol + 1) * moduleSize) + (thicknessBoost * 0.5 * moduleSize);
            const middleY = offset + ((startRow + 1) * moduleSize) + (thicknessBoost * 0.5 * moduleSize);
            const middleSize = (5 - thicknessBoost) * moduleSize;
            ctx.fillRect(middleX, middleY, middleSize, middleSize);

            ctx.fillStyle = darkColor;
            ctx.beginPath();
            ctx.arc(centerX, centerY, 1.5 * moduleSize, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Square
            ctx.fillStyle = darkColor;
            const outerX = offset + (startCol * moduleSize);
            const outerY = offset + (startRow * moduleSize);
            ctx.fillRect(outerX, outerY, 7 * moduleSize, 7 * moduleSize);

            ctx.fillStyle = lightColor;
            const middleX = offset + ((startCol + 1) * moduleSize);
            const middleY = offset + ((startRow + 1) * moduleSize);
            ctx.fillRect(middleX, middleY, 5 * moduleSize, 5 * moduleSize);

            ctx.fillStyle = darkColor;
            const innerX = offset + ((startCol + 2) * moduleSize);
            const innerY = offset + ((startRow + 2) * moduleSize);
            ctx.fillRect(innerX, innerY, 3 * moduleSize, 3 * moduleSize);
        }
    },

    /**
     * Main render function
     */
    render(canvas, matrix, version) {
        if (!matrix) return;

        const ctx = canvas.getContext('2d');
        const canvasSize = canvas.width;
        const size = matrix.length;
        const quietZone = this.state.quietZone;
        const totalSize = size + (quietZone * 2);
        const moduleSize = canvasSize / totalSize;
        const offset = quietZone * moduleSize;
        const qrAreaSize = size * moduleSize;

        // Clear canvas
        ctx.clearRect(0, 0, canvasSize, canvasSize);

        // Fill background based on backgroundFill setting
        if (this.state.backgroundFill === 'transparent') {
            ctx.fillStyle = 'white';
        } else if (this.state.backgroundFill === 'dark') {
            ctx.fillStyle = this.state.darkPalette[0] || '#000000';
        } else {
            ctx.fillStyle = this.state.lightPalette[0] || '#ffffff';
        }
        ctx.fillRect(0, 0, canvasSize, canvasSize);

        // Draw logo background
        if (this.state.logoImg) {
            this.drawLogoBackground(ctx, offset, offset, qrAreaSize);
        }

        // Ensure quiet zone stays white even if logo scales beyond content
        this.drawQuietZoneOverlay(ctx, canvasSize, moduleSize, quietZone);

        const sizeFraction = this.state.moduleSize / 100;

        // Get finder colors
        let finderDarkColor = '#000000';
        let finderLightColor = '#ffffff';
        if (this.state.colorMode !== 'default' && this.state.logoImg) {
            finderDarkColor = this.state.darkPalette[0];
            finderLightColor = this.state.lightPalette[0];
        }

        // Draw data modules (skip finder patterns)
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                if (this.isFinderPattern(row, col, size)) continue;
                if (this.isSeparator(row, col, size)) continue;

                const moduleX = offset + (col * moduleSize);
                const moduleY = offset + (row * moduleSize);
                const isDark = matrix[row][col];

                const moduleCenterX = (col * moduleSize) + moduleSize / 2;
                const moduleCenterY = (row * moduleSize) + moduleSize / 2;
                const color = this.getModuleColor(moduleCenterX, moduleCenterY, isDark, qrAreaSize);

                this.drawModule(ctx, moduleX, moduleY, moduleSize, moduleSize, color, this.state.moduleShape, sizeFraction);
            }
        }

        // Draw finder patterns
        this.drawFinder(ctx, 0, 0, moduleSize, offset, finderDarkColor, finderLightColor, sizeFraction, size);
        this.drawFinder(ctx, 0, size - 7, moduleSize, offset, finderDarkColor, finderLightColor, sizeFraction, size);
        this.drawFinder(ctx, size - 7, 0, moduleSize, offset, finderDarkColor, finderLightColor, sizeFraction, size);
    },

    /**
     * Render with transparent modules (for logo positioning step)
     */
    renderWithTransparency(canvas, matrix, version, moduleOpacity = 0.4) {
        if (!matrix) return;

        const ctx = canvas.getContext('2d');
        const canvasSize = canvas.width;
        const size = matrix.length;
        const quietZone = this.state.quietZone;
        const totalSize = size + (quietZone * 2);
        const moduleSize = canvasSize / totalSize;
        const offset = quietZone * moduleSize;
        const qrAreaSize = size * moduleSize;

        // Clear canvas with white or background fill color
        ctx.clearRect(0, 0, canvasSize, canvasSize);

        if (this.state.backgroundFill === 'transparent') {
            ctx.fillStyle = 'white';
        } else if (this.state.backgroundFill === 'dark') {
            ctx.fillStyle = this.state.darkPalette[0] || '#000000';
        } else {
            ctx.fillStyle = this.state.lightPalette[0] || '#ffffff';
        }
        ctx.fillRect(0, 0, canvasSize, canvasSize);

        // Draw logo background (full opacity)
        if (this.state.logoImg) {
            this.drawLogoBackground(ctx, offset, offset, qrAreaSize);
        }

        // Ensure quiet zone stays white even if logo scales beyond content
        this.drawQuietZoneOverlay(ctx, canvasSize, moduleSize, quietZone);

        // Draw semi-transparent modules on top
        ctx.globalAlpha = moduleOpacity;

        const sizeFraction = 0.85; // Use larger modules for visibility

        // Draw all modules as simple black/white
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                const moduleX = offset + (col * moduleSize);
                const moduleY = offset + (row * moduleSize);
                const isDark = matrix[row][col];

                const color = isDark ? '#000000' : '#ffffff';
                this.drawModule(ctx, moduleX, moduleY, moduleSize, moduleSize, color, 'square', sizeFraction);
            }
        }

        // Reset alpha
        ctx.globalAlpha = 1.0;
    },

    /**
     * Export as PNG
     */
    exportPNG(canvas, matrix, version, exportSize = 1024) {
        // Create a temporary canvas at the export size
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = exportSize;
        exportCanvas.height = exportSize;

        // Store original canvas size
        const originalWidth = canvas.width;
        const originalHeight = canvas.height;

        // Temporarily resize main canvas for rendering
        canvas.width = exportSize;
        canvas.height = exportSize;

        // Render at export size
        this.render(canvas, matrix, version);

        // Get data URL
        const dataURL = canvas.toDataURL('image/png');

        // Restore original size and re-render
        canvas.width = originalWidth;
        canvas.height = originalHeight;
        this.render(canvas, matrix, version);

        // Trigger download
        const link = document.createElement('a');
        link.download = `qrcode-${exportSize}px.png`;
        link.href = dataURL;
        link.click();
    }
};
