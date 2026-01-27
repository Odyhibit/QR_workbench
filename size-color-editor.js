// Size & Color Editor for QR Code Workbench
// Allows users to style QR modules with custom shapes, sizes, and colors

// ========== STATE MANAGEMENT ==========
let sizeColorState = {
    logoImage: null,
    logoImg: null,
    logoImageData: null,
    logoHasTransparency: false, // Whether the logo has transparent pixels
    moduleShape: 'square', // 'square', 'circle', 'rounded', 'diamond', 'cushion'
    moduleSize: 80, // percentage (20-100)
    logoScale: 100,
    logoX: 50, // Center percentage
    logoY: 50,
    colorMode: 'default', // 'default', 'palette', 'gradient'
    darkPalette: ['#000000', '#333333', '#1a1a1a', '#0d0d0d'],
    lightPalette: ['#ffffff', '#f0f0f0', '#e0e0e0', '#d0d0d0'],
    darkMaxLuminosity: 33,
    lightMinLuminosity: 50,
    quietZone: 2, // modules (0-4)
    fullSizeSeparators: false, // toggle for testing scan performance
    finderShape: 'square', // 'square', 'circle', 'hybrid', 'hybrid-inverse', 'rounded'
    transparentTreatment: 'transparent', // 'transparent', 'light', or 'dark' - background fill for areas not covered by logo
    // Finder pattern colors: outer dark, middle light, center dark
    finderOuterColor: '#000000',
    finderMiddleColor: '#ffffff',
    finderCenterColor: '#000000',
    // Background layer settings (for logos with transparency)
    backgroundEnabled: true, // Whether to show background layer
    backgroundModuleSize: 100, // percentage (100-200) - larger than foreground
    backgroundModuleShape: 'square' // independent shape for background layer
};

// ========== LOGO HANDLING ==========

/**
 * Load logo image for Size & Color editor
 */
function loadSizeColorLogo(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            sizeColorState.logoImage = e.target.result;
            sizeColorState.logoImg = img;

            // Create ImageData for sampling
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            tempCtx.drawImage(img, 0, 0);
            sizeColorState.logoImageData = tempCtx.getImageData(0, 0, img.width, img.height);

            // Detect transparency in the logo
            sizeColorState.logoHasTransparency = detectLogoTransparency(sizeColorState.logoImageData);
            updateBackgroundLayerVisibility();

            // Extract colors for palette mode if using logo-blend.js functions
            if (typeof extractDominantColors === 'function') {
                const colors = extractDominantColors(img);
                sizeColorState.darkPalette = colors.darkPalette;
                sizeColorState.lightPalette = colors.lightPalette;

                // Update palette display if in palette mode
                if (sizeColorState.colorMode === 'palette') {
                    displaySizeColorPalette();
                }
            }

            if (callback) callback();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

/**
 * Detect if an image has transparent pixels
 */
function detectLogoTransparency(imageData) {
    const data = imageData.data;
    // Sample every 16th pixel for performance
    for (let i = 3; i < data.length; i += 64) {
        if (data[i] < 250) { // Alpha channel less than ~98%
            return true;
        }
    }
    return false;
}

/**
 * Show/hide background layer controls based on logo transparency
 */
function updateBackgroundLayerVisibility() {
    const bgControls = document.getElementById('backgroundLayerControls');
    if (bgControls) {
        bgControls.style.display = sizeColorState.logoHasTransparency ? 'block' : 'none';
    }
}

/**
 * Display extracted color palette
 */
function displaySizeColorPalette() {
    const display = document.getElementById('sizeColorPaletteDisplay');
    if (!display) return;

    // Update dark color inputs
    for (let i = 0; i < 4; i++) {
        const elem = document.getElementById(`sizeColorDarkColor${i}`);
        if (elem && sizeColorState.darkPalette[i]) {
            elem.value = sizeColorState.darkPalette[i];
        }
    }

    // Update light color inputs
    for (let i = 0; i < 4; i++) {
        const elem = document.getElementById(`sizeColorLightColor${i}`);
        if (elem && sizeColorState.lightPalette[i]) {
            elem.value = sizeColorState.lightPalette[i];
        }
    }

    display.style.display = 'block';
}

// ========== HELPER FUNCTIONS ==========

/**
 * Check if a module is part of a finder pattern (excluding separator)
 * Finder patterns are 7x7, separators add 1 module around them
 */
function isFinderPatternOnly(row, col, moduleCount) {
    // Top-left finder (0-6, 0-6)
    if (row <= 6 && col <= 6) return true;

    // Top-right finder (0-6, moduleCount-7 to moduleCount-1)
    if (row <= 6 && col >= moduleCount - 7) return true;

    // Bottom-left finder (moduleCount-7 to moduleCount-1, 0-6)
    if (row >= moduleCount - 7 && col <= 6) return true;

    return false;
}

/**
 * Check if a module is part of a separator (the 1-module border around finder patterns)
 */
function isSeparatorModule(row, col, moduleCount) {
    // Top-left separator (row/col 7, or outer edge of 8x8 area)
    if (row <= 7 && col <= 7) {
        // Inside 8x8 area but not inside 7x7 finder
        if (row === 7 || col === 7) return true;
    }

    // Top-right separator
    if (row <= 7 && col >= moduleCount - 8) {
        if (row === 7 || col === moduleCount - 8) return true;
    }

    // Bottom-left separator
    if (row >= moduleCount - 8 && col <= 7) {
        if (row === moduleCount - 8 || col === 7) return true;
    }

    return false;
}

// ========== RENDERING ==========

/**
 * Draw logo as background on Size & Color canvas
 */
function drawSizeColorLogoBackground(ctx, canvasWidth, canvasHeight) {
    if (!sizeColorState.logoImg) return;

    const img = sizeColorState.logoImg;
    const scale = sizeColorState.logoScale / 100;

    // Calculate logo size maintaining aspect ratio
    const canvasSize = Math.min(canvasWidth, canvasHeight);
    const maxSize = canvasSize * scale;
    const aspectRatio = img.width / img.height;

    let logoWidth, logoHeight;
    if (aspectRatio > 1) {
        logoWidth = maxSize;
        logoHeight = maxSize / aspectRatio;
    } else {
        logoHeight = maxSize;
        logoWidth = maxSize * aspectRatio;
    }

    // Center the logo
    const logoX = (canvasWidth * sizeColorState.logoX / 100) - (logoWidth / 2);
    const logoY = (canvasHeight * sizeColorState.logoY / 100) - (logoHeight / 2);

    // Draw logo
    ctx.drawImage(img, logoX, logoY, logoWidth, logoHeight);
}

function getSizeColorQuietZoneColor() {
    if (sizeColorState.transparentTreatment === 'dark') {
        return sizeColorState.darkPalette[0] || '#000000';
    }
    if (sizeColorState.transparentTreatment === 'light') {
        return sizeColorState.lightPalette[0] || '#ffffff';
    }
    return '#ffffff';
}

function drawSizeColorQuietZoneOverlay(ctx, canvasSize, modulePixelSize, quietZone, color) {
    if (!quietZone || quietZone <= 0) return;

    const quietZonePixels = quietZone * modulePixelSize;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvasSize, quietZonePixels);
    ctx.fillRect(0, canvasSize - quietZonePixels, canvasSize, quietZonePixels);
    ctx.fillRect(0, 0, quietZonePixels, canvasSize);
    ctx.fillRect(canvasSize - quietZonePixels, 0, quietZonePixels, canvasSize);
}

/**
 * Sample logo color at specific canvas position
 */
function sampleSizeColorLogo(canvasX, canvasY, canvasSize) {
    if (!sizeColorState.logoImg || !sizeColorState.logoImageData) {
        return null;
    }

    const scale = sizeColorState.logoScale / 100;
    const maxSize = Math.min(canvasSize, canvasSize) * scale;

    const aspectRatio = sizeColorState.logoImg.width / sizeColorState.logoImg.height;
    let logoWidth, logoHeight;
    if (aspectRatio > 1) {
        logoWidth = maxSize;
        logoHeight = maxSize / aspectRatio;
    } else {
        logoHeight = maxSize;
        logoWidth = maxSize * aspectRatio;
    }

    const logoX = (canvasSize * sizeColorState.logoX / 100) - (logoWidth / 2);
    const logoY = (canvasSize * sizeColorState.logoY / 100) - (logoHeight / 2);

    // Check if position is inside logo
    const logoLocalX = canvasX - logoX;
    const logoLocalY = canvasY - logoY;

    const isInsideLogo = logoLocalX >= 0 && logoLocalX < logoWidth &&
                         logoLocalY >= 0 && logoLocalY < logoHeight;

    if (!isInsideLogo) {
        return null;
    }

    // Convert to original image coordinates
    const logoOriginalX = Math.floor((logoLocalX / logoWidth) * sizeColorState.logoImg.width);
    const logoOriginalY = Math.floor((logoLocalY / logoHeight) * sizeColorState.logoImg.height);

    // Clamp to bounds
    const clampedX = Math.max(0, Math.min(sizeColorState.logoImg.width - 1, logoOriginalX));
    const clampedY = Math.max(0, Math.min(sizeColorState.logoImg.height - 1, logoOriginalY));

    const logoPixelIndex = (clampedY * sizeColorState.logoImg.width + clampedX) * 4;

    const r = sizeColorState.logoImageData.data[logoPixelIndex];
    const g = sizeColorState.logoImageData.data[logoPixelIndex + 1];
    const b = sizeColorState.logoImageData.data[logoPixelIndex + 2];
    const a = sizeColorState.logoImageData.data[logoPixelIndex + 3];

    return [r, g, b, a];
}

/**
 * Get color for a module based on color mode
 */
function getSizeColorModuleColor(canvasX, canvasY, isDark, canvasSize) {
    // Default mode - simple black and white
    if (sizeColorState.colorMode === 'default') {
        return isDark ? '#000000' : '#ffffff';
    }

    // Sample logo
    let sampledRgba = sampleSizeColorLogo(canvasX, canvasY, canvasSize);

    if (!sampledRgba) {
        // Outside logo - use transparentTreatment setting
        // 'transparent' and 'light' both show light background, 'dark' shows dark
        const treatAsLight = sizeColorState.transparentTreatment !== 'dark';
        if (sizeColorState.colorMode === 'palette') {
            // In palette mode, keep dark/light module intent but use background slot (position 0).
            const palette = isDark ? sizeColorState.darkPalette : sizeColorState.lightPalette;
            return palette[0];
        }
        // Gradient mode: fall through with a default sampled color.
        sampledRgba = treatAsLight ? [255, 255, 255, 255] : [0, 0, 0, 255];
    }

    // Check if pixel is transparent (alpha < 128)
    const alpha = sampledRgba[3];
    if (alpha < 128) {
        // Transparent pixel - use transparentTreatment setting
        // 'transparent' and 'light' both show light background, 'dark' shows dark
        const treatAsLight = sizeColorState.transparentTreatment !== 'dark';
        if (sizeColorState.colorMode === 'palette') {
            const palette = isDark ? sizeColorState.darkPalette : sizeColorState.lightPalette;
            return palette[0];
        }
        // Gradient mode: fall through with a default sampled color.
        sampledRgba = treatAsLight ? [255, 255, 255, 255] : [0, 0, 0, 255];
    }

    const sampledRgb = [sampledRgba[0], sampledRgba[1], sampledRgba[2]];
    const sampledLuminance = 0.299 * sampledRgb[0] + 0.587 * sampledRgb[1] + 0.114 * sampledRgb[2];

    if (sizeColorState.colorMode === 'gradient') {
        // Use logo color with brightness adjustment
        const hsl = rgbToHsl(sampledRgb[0], sampledRgb[1], sampledRgb[2]);

        if (isDark) {
            if (hsl.l > sizeColorState.darkMaxLuminosity) {
                hsl.l = sizeColorState.darkMaxLuminosity;
            }
        } else {
            if (hsl.l < sizeColorState.lightMinLuminosity) {
                hsl.l = sizeColorState.lightMinLuminosity;
            }
        }

        const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
        const r = rgb.r.toString(16).padStart(2, '0');
        const g = rgb.g.toString(16).padStart(2, '0');
        const b = rgb.b.toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    } else if (sizeColorState.colorMode === 'palette') {
        // Use palette matching
        const palette = isDark ? sizeColorState.darkPalette : sizeColorState.lightPalette;
        if (typeof findBestMatch === 'function') {
            return findBestMatch(sampledRgb, palette);
        }
        // Fallback
        return isDark ? palette[0] : palette[0];
    }

    return isDark ? '#000000' : '#ffffff';
}

/**
 * Draw rounded separators for a finder pattern when using rounded finder + full separators
 */
function drawRoundedSeparators(ctx, startRow, startCol, modulePixelSize, offsetPixels, color, size) {
    const roundingPercent = 0.20; // More visible rounding on smaller separator elements
    const thicknessBoost = 0.70; // Must cover the finder's rounded corner gap (finder uses 10% of 7 = 0.7 modules)

    // Determine which finder this is
    const isTopLeft = startRow === 0 && startCol === 0;
    const isTopRight = startRow === 0 && startCol === size - 7;
    const isBottomLeft = startRow === size - 7 && startCol === 0;

    if (isTopLeft) {
        // Horizontal separator (row 7, cols 0-7)
        const hSepX = offsetPixels + (0 * modulePixelSize);
        const hSepY = offsetPixels + (7 * modulePixelSize);
        const hSepWidth = 8 * modulePixelSize;
        const hSepHeight = (1 + thicknessBoost) * modulePixelSize; // Grow upward toward finder
        const hSepRadius = hSepHeight * roundingPercent;

        ctx.fillStyle = color;
        ctx.beginPath();
        // Only round the bottom corners
        ctx.roundRect(hSepX, hSepY - thicknessBoost * modulePixelSize, hSepWidth, hSepHeight, [0, 0, hSepRadius, hSepRadius]);
        ctx.fill();

        // Vertical separator (col 7, rows 0-7)
        const vSepX = offsetPixels + (7 * modulePixelSize);
        const vSepY = offsetPixels + (0 * modulePixelSize);
        const vSepWidth = (1 + thicknessBoost) * modulePixelSize; // Grow leftward toward finder
        const vSepHeight = 8 * modulePixelSize;
        const vSepRadius = vSepWidth * roundingPercent;

        ctx.beginPath();
        // Only round the right corners
        ctx.roundRect(vSepX - thicknessBoost * modulePixelSize, vSepY, vSepWidth, vSepHeight, [0, vSepRadius, vSepRadius, 0]);
        ctx.fill();
        // Note: corner module (7,7) is covered by the overlap of horizontal and vertical separators
    }
    else if (isTopRight) {
        // Horizontal separator (row 7, cols size-8 to size-1)
        const hSepX = offsetPixels + ((size - 8) * modulePixelSize);
        const hSepY = offsetPixels + (7 * modulePixelSize);
        const hSepWidth = 8 * modulePixelSize;
        const hSepHeight = (1 + thicknessBoost) * modulePixelSize; // Grow upward toward finder
        const hSepRadius = hSepHeight * roundingPercent;

        ctx.fillStyle = color;
        ctx.beginPath();
        // Only round the bottom corners
        ctx.roundRect(hSepX, hSepY - thicknessBoost * modulePixelSize, hSepWidth, hSepHeight, [0, 0, hSepRadius, hSepRadius]);
        ctx.fill();

        // Vertical separator (col size-8, rows 0-7)
        const vSepX = offsetPixels + ((size - 8) * modulePixelSize);
        const vSepY = offsetPixels + (0 * modulePixelSize);
        const vSepWidth = (1 + thicknessBoost) * modulePixelSize; // Grow rightward toward finder
        const vSepHeight = 8 * modulePixelSize;
        const vSepRadius = vSepWidth * roundingPercent;

        ctx.beginPath();
        // Only round the left corners
        ctx.roundRect(vSepX, vSepY, vSepWidth, vSepHeight, [vSepRadius, 0, 0, vSepRadius]);
        ctx.fill();
        // Note: corner module (7, size-8) is covered by the overlap of horizontal and vertical separators
    }
    else if (isBottomLeft) {
        // Horizontal separator (row size-8, cols 0-7)
        const hSepX = offsetPixels + (0 * modulePixelSize);
        const hSepY = offsetPixels + ((size - 8) * modulePixelSize);
        const hSepWidth = 8 * modulePixelSize;
        const hSepHeight = (1 + thicknessBoost) * modulePixelSize; // Grow downward toward finder
        const hSepRadius = hSepHeight * roundingPercent;

        ctx.fillStyle = color;
        ctx.beginPath();
        // Only round the top corners
        ctx.roundRect(hSepX, hSepY, hSepWidth, hSepHeight, [hSepRadius, hSepRadius, 0, 0]);
        ctx.fill();

        // Vertical separator (col 7, rows size-8 to size-1)
        const vSepX = offsetPixels + (7 * modulePixelSize);
        const vSepY = offsetPixels + ((size - 8) * modulePixelSize);
        const vSepWidth = (1 + thicknessBoost) * modulePixelSize; // Grow leftward toward finder
        const vSepHeight = 8 * modulePixelSize;
        const vSepRadius = vSepWidth * roundingPercent;

        ctx.beginPath();
        // Only round the right corners
        ctx.roundRect(vSepX - thicknessBoost * modulePixelSize, vSepY, vSepWidth, vSepHeight, [0, vSepRadius, vSepRadius, 0]);
        ctx.fill();
        // Note: corner module (size-8, 7) is covered by the overlap of horizontal and vertical separators
    }
}

/**
 * Draw a custom-shaped finder pattern (7x7 core only, no separator)
 * @param outerColor - Color for the outer 7x7 dark ring
 * @param middleColor - Color for the middle 5x5 light ring
 * @param centerColor - Color for the inner 3x3 dark center
 */
function drawCustomFinderPattern(ctx, startRow, startCol, modulePixelSize, offsetPixels, outerColor, middleColor, centerColor, sizeFraction, size) {
    const centerModuleX = startCol + 3.5;
    const centerModuleY = startRow + 3.5;
    const centerX = offsetPixels + (centerModuleX * modulePixelSize);
    const centerY = offsetPixels + (centerModuleY * modulePixelSize);

    // For circular/hybrid finders, draw reduced-size modules first
    // Each module samples logo color underneath it
    if (sizeColorState.finderShape !== 'square' && sizeColorState.finderShape !== 'rounded') {
        const qrAreaSize = size * modulePixelSize;

        // Draw modules at the current size reduction for entire 7x7 area
        for (let row = 0; row < 7; row++) {
            for (let col = 0; col < 7; col++) {
                const moduleX = offsetPixels + ((startCol + col) * modulePixelSize);
                const moduleY = offsetPixels + ((startRow + row) * modulePixelSize);

                // Get module center for color sampling (relative to QR area, not canvas)
                const moduleCenterX = ((startCol + col) * modulePixelSize) + modulePixelSize / 2;
                const moduleCenterY = ((startRow + row) * modulePixelSize) + modulePixelSize / 2;

                // Sample logo color at this position (treat as light module)
                const color = getSizeColorModuleColor(moduleCenterX, moduleCenterY, false, qrAreaSize);

                // Draw reduced-size module with sampled color
                drawStyledModule(ctx, moduleX, moduleY, modulePixelSize, modulePixelSize,
                    color, sizeColorState.moduleShape, sizeFraction, false);
            }
        }
    }

    if (sizeColorState.finderShape === 'circle') {
        // All circles with thickness boost for better scanning on smaller versions
        // Add extra thickness that's more noticeable on smaller QR versions
        const thicknessBoost = 0.08; // Extra modules of thickness

        // Outer circle (7 modules diameter = 3.5 module radius + boost)
        ctx.fillStyle = outerColor;
        ctx.beginPath();
        ctx.arc(centerX, centerY, (3.5 + thicknessBoost) * modulePixelSize, 0, Math.PI * 2);
        ctx.fill();

        // Middle circle (5 modules diameter = 2.5 module radius - boost to keep outer ring thicker)
        ctx.fillStyle = middleColor;
        ctx.beginPath();
        ctx.arc(centerX, centerY, (2.5 - thicknessBoost * 0.5) * modulePixelSize, 0, Math.PI * 2);
        ctx.fill();

        // Inner circle (3 modules diameter = 1.5 module radius)
        ctx.fillStyle = centerColor;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 1.5 * modulePixelSize, 0, Math.PI * 2);
        ctx.fill();

    } else if (sizeColorState.finderShape === 'rounded') {
        // Rounded squares - traditional concentric squares with rounded corners
        const roundingPercent = 0.10; // 10% rounding

        // Draw rounded separators FIRST if full-size separators are enabled
        // This way the finder pattern will be drawn on top and won't have its corners trimmed
        if (sizeColorState.fullSizeSeparators) {
            drawRoundedSeparators(ctx, startRow, startCol, modulePixelSize, offsetPixels, middleColor, size);
        }

        // Outer square (7x7)
        ctx.fillStyle = outerColor;
        const outerX = offsetPixels + (startCol * modulePixelSize);
        const outerY = offsetPixels + (startRow * modulePixelSize);
        const outerSize = 7 * modulePixelSize;
        const outerRadius = outerSize * roundingPercent;
        ctx.beginPath();
        ctx.roundRect(outerX, outerY, outerSize, outerSize, outerRadius);
        ctx.fill();

        // Middle square (5x5)
        ctx.fillStyle = middleColor;
        const middleX = offsetPixels + ((startCol + 1) * modulePixelSize);
        const middleY = offsetPixels + ((startRow + 1) * modulePixelSize);
        const middleSize = 5 * modulePixelSize;
        const middleRadius = middleSize * roundingPercent;
        ctx.beginPath();
        ctx.roundRect(middleX, middleY, middleSize, middleSize, middleRadius);
        ctx.fill();

        // Inner square (3x3)
        ctx.fillStyle = centerColor;
        const innerX = offsetPixels + ((startCol + 2) * modulePixelSize);
        const innerY = offsetPixels + ((startRow + 2) * modulePixelSize);
        const innerSize = 3 * modulePixelSize;
        const innerRadius = innerSize * roundingPercent;
        ctx.beginPath();
        ctx.roundRect(innerX, innerY, innerSize, innerSize, innerRadius);
        ctx.fill();

    } else if (sizeColorState.finderShape === 'hybrid') {
        // Circle outer + square center with thickness boost
        const thicknessBoost = 0.08;

        // Outer circle
        ctx.fillStyle = outerColor;
        ctx.beginPath();
        ctx.arc(centerX, centerY, (3.5 + thicknessBoost) * modulePixelSize, 0, Math.PI * 2);
        ctx.fill();

        // Middle circle
        ctx.fillStyle = middleColor;
        ctx.beginPath();
        ctx.arc(centerX, centerY, (2.5 - thicknessBoost * 0.5) * modulePixelSize, 0, Math.PI * 2);
        ctx.fill();

        // Inner square (3x3 modules)
        ctx.fillStyle = centerColor;
        const innerSize = 3 * modulePixelSize;
        const innerX = offsetPixels + ((startCol + 2) * modulePixelSize);
        const innerY = offsetPixels + ((startRow + 2) * modulePixelSize);
        ctx.fillRect(innerX, innerY, innerSize, innerSize);

    } else if (sizeColorState.finderShape === 'hybrid-inverse') {
        // Square outer + circle center with slight boost to outer
        const thicknessBoost = 0.08;

        // Outer square (7x7 + boost)
        ctx.fillStyle = outerColor;
        const outerX = offsetPixels + (startCol * modulePixelSize) - (thicknessBoost * modulePixelSize);
        const outerY = offsetPixels + (startRow * modulePixelSize) - (thicknessBoost * modulePixelSize);
        const outerSize = (7 + thicknessBoost * 2) * modulePixelSize;
        ctx.fillRect(outerX, outerY, outerSize, outerSize);

        // Middle square (5x5 - slight reduction to keep outer thicker)
        ctx.fillStyle = middleColor;
        const middleX = offsetPixels + ((startCol + 1) * modulePixelSize) + (thicknessBoost * 0.5 * modulePixelSize);
        const middleY = offsetPixels + ((startRow + 1) * modulePixelSize) + (thicknessBoost * 0.5 * modulePixelSize);
        const middleSize = (5 - thicknessBoost) * modulePixelSize;
        ctx.fillRect(middleX, middleY, middleSize, middleSize);

        // Inner circle (3 modules diameter = 1.5 module radius)
        ctx.fillStyle = centerColor;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 1.5 * modulePixelSize, 0, Math.PI * 2);
        ctx.fill();

    } else {
        // Square (traditional) - draw as squares
        // Outer square (7x7)
        ctx.fillStyle = outerColor;
        const outerX = offsetPixels + (startCol * modulePixelSize);
        const outerY = offsetPixels + (startRow * modulePixelSize);
        const outerSize = 7 * modulePixelSize;
        ctx.fillRect(outerX, outerY, outerSize, outerSize);

        // Middle square (5x5)
        ctx.fillStyle = middleColor;
        const middleX = offsetPixels + ((startCol + 1) * modulePixelSize);
        const middleY = offsetPixels + ((startRow + 1) * modulePixelSize);
        const middleSize = 5 * modulePixelSize;
        ctx.fillRect(middleX, middleY, middleSize, middleSize);

        // Inner square (3x3)
        ctx.fillStyle = centerColor;
        const innerX = offsetPixels + ((startCol + 2) * modulePixelSize);
        const innerY = offsetPixels + ((startRow + 2) * modulePixelSize);
        const innerSize = 3 * modulePixelSize;
        ctx.fillRect(innerX, innerY, innerSize, innerSize);
    }
}

/**
 * Draw a single module with shape and size
 */
function drawStyledModule(ctx, moduleX, moduleY, moduleWidth, moduleHeight, color, shape, sizeFraction, isFinder = false) {
    ctx.fillStyle = color;

    // For finder patterns, add a tiny overlap to eliminate grid lines
    const overlap = isFinder ? 0.5 : 0;

    const shrunkWidth = moduleWidth * sizeFraction;
    const shrunkHeight = moduleHeight * sizeFraction;
    const offsetX = (moduleWidth - shrunkWidth) / 2;
    const offsetY = (moduleHeight - shrunkHeight) / 2;
    const centerX = moduleX + offsetX + shrunkWidth / 2;
    const centerY = moduleY + offsetY + shrunkHeight / 2;

    if (shape === 'circle') {
        const radius = Math.min(shrunkWidth, shrunkHeight) / 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
    } else if (shape === 'rounded') {
        const x = moduleX + offsetX;
        const y = moduleY + offsetY;
        const radius = Math.min(shrunkWidth, shrunkHeight) * 0.10;
        ctx.beginPath();
        ctx.roundRect(x, y, shrunkWidth, shrunkHeight, radius);
        ctx.fill();
    } else if (shape === 'cushion') {
        // Cushion cut - diamond with concave curved edges (like a cushion-cut gemstone)
        const halfWidth = shrunkWidth / 2;
        const halfHeight = shrunkHeight / 2;

        // Corner points of the diamond
        const top = { x: centerX, y: moduleY + offsetY };
        const right = { x: moduleX + offsetX + shrunkWidth, y: centerY };
        const bottom = { x: centerX, y: moduleY + offsetY + shrunkHeight };
        const left = { x: moduleX + offsetX, y: centerY };

        // Concave factor - how much to curve inward (0.35 = moderately concave)
        // Lower values = more inward curve. Must be < 0.5 for concave effect
        const concaveFactor = 0.35;

        ctx.beginPath();
        ctx.moveTo(top.x, top.y);

        // Top-right edge (concave curve from top to right)
        const tr_ctrl_x = centerX + (halfWidth * concaveFactor);
        const tr_ctrl_y = centerY - (halfHeight * concaveFactor);
        ctx.quadraticCurveTo(tr_ctrl_x, tr_ctrl_y, right.x, right.y);

        // Bottom-right edge (concave curve from right to bottom)
        const br_ctrl_x = centerX + (halfWidth * concaveFactor);
        const br_ctrl_y = centerY + (halfHeight * concaveFactor);
        ctx.quadraticCurveTo(br_ctrl_x, br_ctrl_y, bottom.x, bottom.y);

        // Bottom-left edge (concave curve from bottom to left)
        const bl_ctrl_x = centerX - (halfWidth * concaveFactor);
        const bl_ctrl_y = centerY + (halfHeight * concaveFactor);
        ctx.quadraticCurveTo(bl_ctrl_x, bl_ctrl_y, left.x, left.y);

        // Top-left edge (concave curve from left to top)
        const tl_ctrl_x = centerX - (halfWidth * concaveFactor);
        const tl_ctrl_y = centerY - (halfHeight * concaveFactor);
        ctx.quadraticCurveTo(tl_ctrl_x, tl_ctrl_y, top.x, top.y);

        ctx.fill();
    } else if (shape === 'diamond') {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(Math.PI / 4);
        const halfSize = Math.min(shrunkWidth, shrunkHeight) / 2;
        ctx.fillRect(-halfSize, -halfSize, halfSize * 2, halfSize * 2);
        ctx.restore();
    } else {
        // Square - add overlap for finder patterns to eliminate grid lines
        ctx.fillRect(
            moduleX + offsetX - overlap,
            moduleY + offsetY - overlap,
            shrunkWidth + overlap * 2,
            shrunkHeight + overlap * 2
        );
    }
}

/**
 * Draw a layer of QR modules with specified size and shape
 */
function drawModuleLayer(ctx, modulePixelSize, offsetPixels, size, sizeFraction, moduleShape, isBackground) {
    const finderMiddleColor = sizeColorState.finderMiddleColor;
    const qrAreaSize = size * modulePixelSize;
    const hasDeleteState = typeof deleteState !== 'undefined';

    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            const isFinderOnly = isFinderPatternOnly(row, col, size);

            // Skip finder patterns - drawn separately
            if (isFinderOnly) continue;

            // Check if this module is deleted or modified (from Module Delete tab)
            let codewordIndex = null;
            if (hasDeleteState && typeof getCodewordIndexForModule === 'function') {
                codewordIndex = getCodewordIndexForModule(row, col);

                const isDeleted = deleteState.editMode === 'delete' &&
                    codewordIndex !== null &&
                    deleteState.deletedCodewords.has(codewordIndex);

                if (isDeleted) continue;
            }

            const isSeparator = isSeparatorModule(row, col, size);

            // Skip separators if using rounded finders with full separators
            if (isSeparator && sizeColorState.finderShape === 'rounded' && sizeColorState.fullSizeSeparators) {
                continue;
            }

            const moduleX = offsetPixels + (col * modulePixelSize);
            const moduleY = offsetPixels + (row * modulePixelSize);
            let isDark = currentMatrix[row][col];
            if (hasDeleteState &&
                codewordIndex !== null &&
                typeof getBitIndexForModule === 'function' &&
                deleteState.modifiedCodewords &&
                deleteState.modifiedCodewords.has(codewordIndex)) {
                const bitIndex = getBitIndexForModule(row, col, codewordIndex);
                if (bitIndex !== null && bitIndex >= 0) {
                    const byteValue = deleteState.modifiedCodewords.get(codewordIndex);
                    isDark = ((byteValue >> (7 - bitIndex)) & 1) === 1;
                }
            }

            // Determine size and shape
            let currentSizeFraction;
            let currentShape;

            if (isSeparator && sizeColorState.fullSizeSeparators && sizeColorState.finderShape !== 'rounded') {
                currentSizeFraction = 1.0;
                currentShape = 'square';
            } else {
                currentSizeFraction = sizeFraction;
                currentShape = moduleShape;
            }

            // Get module center for color sampling
            const moduleCenterX = (col * modulePixelSize) + modulePixelSize / 2;
            const moduleCenterY = (row * modulePixelSize) + modulePixelSize / 2;

            // Get color
            let color;
            if (isSeparator && sizeColorState.fullSizeSeparators && sizeColorState.finderShape !== 'rounded') {
                color = finderMiddleColor;
            } else if (isBackground) {
                // Background layer uses leftmost palette color (position 0) like foreground
                const palette = isDark ? sizeColorState.darkPalette : sizeColorState.lightPalette;
                color = palette[0];
            } else {
                color = getSizeColorModuleColor(moduleCenterX, moduleCenterY, isDark, qrAreaSize);
            }

            const shouldRemoveGridLines = isSeparator && sizeColorState.fullSizeSeparators && sizeColorState.finderShape !== 'rounded';

            drawStyledModule(ctx, moduleX, moduleY, modulePixelSize, modulePixelSize,
                           color, currentShape, currentSizeFraction, shouldRemoveGridLines);
        }
    }
}

/**
 * Main render function for Size & Color editor
 * Draw order: background fill -> background modules -> logo -> foreground modules
 */
function renderSizeColorQR() {
    if (!currentMatrix) {
        console.warn('No QR code generated yet');
        return;
    }

    const canvas = document.getElementById('sizeColorCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const canvasSize = 600;
    const size = currentMatrix.length;
    const quietZone = sizeColorState.quietZone;
    const totalSize = size + (quietZone * 2);
    const modulePixelSize = canvasSize / totalSize;
    const offsetPixels = quietZone * modulePixelSize;
    const qrAreaSize = size * modulePixelSize;
    const quietZoneColor = getSizeColorQuietZoneColor();

    // Clear canvas with quiet zone color
    ctx.fillStyle = quietZoneColor;
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // STEP 1: Fill QR area with background color based on transparentTreatment
    if (sizeColorState.transparentTreatment !== 'transparent') {
        const bgColor = sizeColorState.transparentTreatment === 'dark'
            ? sizeColorState.darkPalette[0]
            : sizeColorState.lightPalette[0];
        ctx.fillStyle = bgColor;
        ctx.fillRect(offsetPixels, offsetPixels, qrAreaSize, qrAreaSize);
    }

    const sizeFraction = sizeColorState.moduleSize / 100;
    const finderOuterColor = sizeColorState.finderOuterColor;
    const finderMiddleColor = sizeColorState.finderMiddleColor;
    const finderCenterColor = sizeColorState.finderCenterColor;

    // STEP 2: Background modules layer (when logo has transparency)
    if (sizeColorState.logoImg && sizeColorState.logoHasTransparency) {
        const bgSizeFraction = sizeColorState.backgroundModuleSize / 100;
        drawModuleLayer(ctx, modulePixelSize, offsetPixels, size, bgSizeFraction,
                       sizeColorState.backgroundModuleShape, true);

        // Draw finder patterns for background layer
        drawCustomFinderPattern(ctx, 0, 0, modulePixelSize, offsetPixels,
                               finderOuterColor, finderMiddleColor, finderCenterColor, bgSizeFraction, size);
        drawCustomFinderPattern(ctx, 0, size - 7, modulePixelSize, offsetPixels,
                               finderOuterColor, finderMiddleColor, finderCenterColor, bgSizeFraction, size);
        drawCustomFinderPattern(ctx, size - 7, 0, modulePixelSize, offsetPixels,
                               finderOuterColor, finderMiddleColor, finderCenterColor, bgSizeFraction, size);
    }

    // STEP 3: Logo (sandwiched between module layers)
    if (sizeColorState.logoImg) {
        ctx.save();
        ctx.translate(offsetPixels, offsetPixels);
        drawSizeColorLogoBackground(ctx, qrAreaSize, qrAreaSize);
        ctx.restore();
    }

    // Re-apply quiet zone after logo to prevent bleed
    drawSizeColorQuietZoneOverlay(ctx, canvasSize, modulePixelSize, quietZone, quietZoneColor);

    // STEP 4: Foreground modules layer
    drawModuleLayer(ctx, modulePixelSize, offsetPixels, size, sizeFraction,
                   sizeColorState.moduleShape, false);

    // Draw finder patterns for foreground layer on top
    drawCustomFinderPattern(ctx, 0, 0, modulePixelSize, offsetPixels,
                           finderOuterColor, finderMiddleColor, finderCenterColor, sizeFraction, size);
    drawCustomFinderPattern(ctx, 0, size - 7, modulePixelSize, offsetPixels,
                           finderOuterColor, finderMiddleColor, finderCenterColor, sizeFraction, size);
    drawCustomFinderPattern(ctx, size - 7, 0, modulePixelSize, offsetPixels,
                           finderOuterColor, finderMiddleColor, finderCenterColor, sizeFraction, size);
}

// ========== INITIALIZATION ==========

/**
 * Initialize Size & Color editor when tab is opened
 */
function initializeSizeColorEditor() {
    if (!currentMatrix) {
        alert('Please generate a QR code first.');
        return;
    }

    // Copy logo and settings from Padding Editor if available
    // Only copy if the logo has changed (or no logo loaded yet in Size & Color)
    const logoChanged = typeof logoBlendState !== 'undefined' &&
                        logoBlendState.logoImg &&
                        logoBlendState.logoImage !== sizeColorState.logoImage;

    if (logoChanged) {
        // Copy logo data
        sizeColorState.logoImage = logoBlendState.logoImage;
        sizeColorState.logoImg = logoBlendState.logoImg;
        sizeColorState.logoImageData = logoBlendState.logoImageData;
        sizeColorState.logoScale = logoBlendState.logoScale;
        sizeColorState.logoX = logoBlendState.logoX;
        sizeColorState.logoY = logoBlendState.logoY;

        // Copy color mode and settings
        sizeColorState.colorMode = logoBlendState.colorMode;
        sizeColorState.darkMaxLuminosity = logoBlendState.darkMaxLuminosity;
        sizeColorState.lightMinLuminosity = logoBlendState.lightMinLuminosity;
        sizeColorState.transparentTreatment = logoBlendState.transparentTreatment;

        // Copy color palettes if available
        if (logoBlendState.darkPalette) {
            sizeColorState.darkPalette = [...logoBlendState.darkPalette];
        }
        if (logoBlendState.lightPalette) {
            sizeColorState.lightPalette = [...logoBlendState.lightPalette];
        }

        // Update color mode dropdown and luminosity sliders
        const colorModeSelect = document.getElementById('sizeColorColorMode');
        if (colorModeSelect) {
            colorModeSelect.value = sizeColorState.colorMode;
        }

        const darkLumSlider = document.getElementById('sizeColorDarkMaxLum');
        const darkLumLabel = document.getElementById('sizeColorDarkLumLabel');
        if (darkLumSlider && darkLumLabel) {
            darkLumSlider.value = sizeColorState.darkMaxLuminosity;
            darkLumLabel.textContent = sizeColorState.darkMaxLuminosity;
        }

        const lightLumSlider = document.getElementById('sizeColorLightMinLum');
        const lightLumLabel = document.getElementById('sizeColorLightMinLabel');
        if (lightLumSlider && lightLumLabel) {
            lightLumSlider.value = sizeColorState.lightMinLuminosity;
            lightLumLabel.textContent = sizeColorState.lightMinLuminosity;
        }

        // Detect transparency in the copied logo
        if (sizeColorState.logoImageData) {
            sizeColorState.logoHasTransparency = detectLogoTransparency(sizeColorState.logoImageData);
        }
    }

    // Always sync UI controls to current sizeColorState (regardless of logo change)
    // This ensures customizations persist when switching tabs

    const quietZoneSlider = document.getElementById('sizeColorQuietZone');
    const quietZoneLabel = document.getElementById('sizeColorQuietZoneLabel');
    if (quietZoneSlider && quietZoneLabel) {
        quietZoneSlider.value = sizeColorState.quietZone;
        quietZoneLabel.textContent = sizeColorState.quietZone;
    }

    const fullSizeSepCheckbox = document.getElementById('fullSizeSeparators');
    if (fullSizeSepCheckbox) {
        fullSizeSepCheckbox.checked = sizeColorState.fullSizeSeparators;
    }

    const finderShapeSelect = document.getElementById('finderShape');
    if (finderShapeSelect) {
        finderShapeSelect.value = sizeColorState.finderShape;
    }

    // Sync finder color inputs
    const finderOuterInput = document.getElementById('finderOuterColor');
    if (finderOuterInput) {
        finderOuterInput.value = sizeColorState.finderOuterColor;
    }
    const finderMiddleInput = document.getElementById('finderMiddleColor');
    if (finderMiddleInput) {
        finderMiddleInput.value = sizeColorState.finderMiddleColor;
    }
    const finderCenterInput = document.getElementById('finderCenterColor');
    if (finderCenterInput) {
        finderCenterInput.value = sizeColorState.finderCenterColor;
    }

    // Show/hide appropriate controls based on color mode
    const gradientControls = document.getElementById('sizeColorGradientControls');
    const paletteDisplay = document.getElementById('sizeColorPaletteDisplay');

    if (sizeColorState.colorMode === 'gradient') {
        if (gradientControls) gradientControls.style.display = 'block';
        if (paletteDisplay) paletteDisplay.style.display = 'none';
    } else if (sizeColorState.colorMode === 'palette') {
        if (gradientControls) gradientControls.style.display = 'none';
        if (paletteDisplay) paletteDisplay.style.display = 'block';
    } else {
        if (gradientControls) gradientControls.style.display = 'none';
        if (paletteDisplay) paletteDisplay.style.display = 'none';
    }

    // Sync background layer controls
    const bgSizeSlider = document.getElementById('backgroundModuleSize');
    const bgSizeLabel = document.getElementById('backgroundModuleSizeLabel');
    if (bgSizeSlider && bgSizeLabel) {
        bgSizeSlider.value = sizeColorState.backgroundModuleSize;
        bgSizeLabel.textContent = sizeColorState.backgroundModuleSize;
    }

    const bgShapeSelect = document.getElementById('backgroundModuleShape');
    if (bgShapeSelect) {
        bgShapeSelect.value = sizeColorState.backgroundModuleShape;
    }

    // Show/hide background layer controls based on transparency
    updateBackgroundLayerVisibility();

    // Sync palette color inputs to current state
    displaySizeColorPalette();

    // Update info panel
    const size = currentMatrix.length;
    const version = currentVersion || ((size - 17) / 4);
    document.getElementById('sizeColorVersion').textContent = version;
    document.getElementById('sizeColorSize').textContent = `${size}×${size}`;
    document.getElementById('sizeColorEcc').textContent = currentEccLevel || '-';

    // Render QR
    renderSizeColorQR();
}
