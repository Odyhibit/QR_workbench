// Logo Blending for QR Code Padding Editor
// Automatically matches padding module colors to logo underneath

// ========== COLOR UTILITIES ==========

/**
 * RGB to HSL conversion (r, g, b in 0-255 range, returns h in 0-360, s and l in 0-100)
 */
function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    return {
        h: h * 360,
        s: s * 100,
        l: l * 100
    };
}

/**
 * HSL to RGB conversion (h in 0-360, s and l in 0-100, returns r, g, b in 0-255)
 */
function hslToRgb(h, s, l) {
    h /= 360;
    s /= 100;
    l /= 100;

    let r, g, b;

    if (s === 0) {
        r = g = b = l; // achromatic
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

    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}

/**
 * Calculate Euclidean distance between two RGB colors
 */
function colorDistance(c1, c2) {
    const dr = c1[0] - c2[0];
    const dg = c1[1] - c2[1];
    const db = c1[2] - c2[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Calculate hue distance (circular, 0-180)
 */
function hueDistance(h1, h2) {
    const diff = Math.abs(h1 - h2);
    return Math.min(diff, 360 - diff);
}

/**
 * Find best matching color from a palette based on a sampled RGB color
 */
function findBestMatch(sampledRgb, palette) {
    // Convert sampled color to HSL
    const sampledHsl = rgbToHsl(sampledRgb[0], sampledRgb[1], sampledRgb[2]);
    const sampledH = sampledHsl.h;
    const sampledS = sampledHsl.s / 100; // Convert from 0-100 to 0-1
    const sampledL = sampledHsl.l / 100; // Convert from 0-100 to 0-1

    // Convert palette hex colors to RGB and HSL
    const paletteData = palette.map(hex => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const hsl = rgbToHsl(r, g, b);
        return { hex, rgb: [r, g, b], hsl: [hsl.h, hsl.s / 100, hsl.l / 100] };
    });

    // Find best match using weighted distance
    let minDist = Infinity;
    let bestIndex = 0;

    for (let i = 0; i < paletteData.length; i++) {
        const [h, s, l] = paletteData[i].hsl;

        // Use RGB distance if either color is grayscale
        const isGrayscale = sampledS < 0.15 || s < 0.15;

        if (!isGrayscale) {
            // Both colored: weight hue heavily, with saturation and lightness as tiebreakers
            const hueDist = hueDistance(sampledH, h) / 180; // normalize to 0-1
            const satDist = Math.abs(sampledS - s);
            const lightDist = Math.abs(sampledL - l);
            const dist = hueDist * 5 + satDist * 1 + lightDist * 1; // hue weighted 5x

            if (dist < minDist) {
                minDist = dist;
                bestIndex = i;
            }
        } else {
            // At least one is grayscale: use simple RGB distance
            const rgbDist = colorDistance(sampledRgb, paletteData[i].rgb);
            if (rgbDist < minDist) {
                minDist = rgbDist;
                bestIndex = i;
            }
        }
    }

    return palette[bestIndex];
}

// ========== COLOR EXTRACTION ==========

/**
 * Extract dominant dark and light colors from an image using frequency analysis
 */
function extractDominantColors(img) {
    // Create temp canvas to analyze the logo
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;
    tempCtx.drawImage(img, 0, 0);

    const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
    const data = imageData.data;

    // Quantize to reduce near-duplicates
    const quantize = (val) => Math.min(255, Math.round(val / 4) * 4);

    const darkColors = {};
    const lightColors = {};

    for (let i = 0; i < data.length; i += 16) { // Sample every 4 pixels
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // Skip transparent pixels
        if (a < 128) continue;

        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

        // Quantize to reduce near-duplicates
        const qR = quantize(r);
        const qG = quantize(g);
        const qB = quantize(b);
        const colorKey = `${qR},${qG},${qB}`;

        if (luminance < 128) {
            darkColors[colorKey] = (darkColors[colorKey] || 0) + 1;
        } else {
            lightColors[colorKey] = (lightColors[colorKey] || 0) + 1;
        }
    }

    // Extract top colors, filtering out rare colors (anti-aliasing artifacts)
    const getTopColors = (colorFreqMap, count = 4) => {
        const totalPixels = Object.values(colorFreqMap).reduce((a, b) => a + b, 0);
        const minFrequency = Math.max(10, totalPixels * 0.001);

        // Sort by frequency and filter
        const sorted = Object.entries(colorFreqMap)
            .filter(([colorKey, freq]) => freq >= minFrequency)
            .sort((a, b) => b[1] - a[1]);

        // Take top N colors
        const topColors = sorted.slice(0, count);

        // Convert to hex
        return topColors.map(([colorKey, freq]) => {
            const [r, g, b] = colorKey.split(',').map(Number);
            return rgbToHex(r, g, b);
        });
    };

    const rgbToHex = (r, g, b) => {
        return '#' + [r, g, b].map(x => {
            const hex = Math.round(x).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    };

    // Extract 4 most common colors from each category
    const darkPalette = getTopColors(darkColors, 4);
    const lightPalette = getTopColors(lightColors, 4);

    // Helper to get luminance from hex color (0-1 range)
    const getLuminance = (hex) => {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return 0.299 * r + 0.587 * g + 0.114 * b;
    };

    // Validate dark palette
    const validateDarkPalette = (palette) => {
        const validColors = palette.filter(color => getLuminance(color) < 0.5);

        if (validColors.length > 0) {
            while (validColors.length < 4) {
                validColors.push(validColors[validColors.length - 1]);
            }
            return validColors;
        }

        return ['#000000', '#333333', '#1a1a1a', '#0d0d0d'];
    };

    // Validate light palette
    const validateLightPalette = (palette) => {
        const validColors = palette.filter(color => getLuminance(color) > 0.5);

        if (validColors.length > 0) {
            while (validColors.length < 4) {
                validColors.push(validColors[validColors.length - 1]);
            }
            return validColors;
        }

        return ['#ffffff', '#f0f0f0', '#e0e0e0', '#d0d0d0'];
    };

    const finalDarkPalette = validateDarkPalette(darkPalette);
    const finalLightPalette = validateLightPalette(lightPalette);

    // Sort dark palette: darkest to lightest
    finalDarkPalette.sort((a, b) => getLuminance(a) - getLuminance(b));

    // Sort light palette: lightest to darkest
    finalLightPalette.sort((a, b) => getLuminance(b) - getLuminance(a));

    return {
        darkPalette: finalDarkPalette,
        lightPalette: finalLightPalette
    };
}

// ========== LOGO BLEND STATE ==========

let logoBlendState = {
    logoImage: null,
    logoImg: null, // HTMLImageElement
    logoImageData: null,
    colorMode: 'palette', // 'palette' or 'gradient'
    darkPalette: ['#000000', '#333333', '#1a1a1a', '#0d0d0d'],
    lightPalette: ['#ffffff', '#f0f0f0', '#e0e0e0', '#d0d0d0'],
    darkMaxLuminosity: 33, // For gradient mode (0-50)
    lightMinLuminosity: 66, // For gradient mode (50-100)
    logoScale: 100,
    logoX: 50, // Center percentage
    logoY: 50, // Center percentage
    transparentTreatment: 'light' // 'light' or 'dark' - how to treat transparent/outside pixels
};

// ========== STATUS DISPLAY ==========

/**
 * Show status message in the logo blend status div
 * @param {string} message - Message to display
 * @param {string} type - 'success', 'error', 'info'
 */
function showLogoBlendStatus(message, type = 'info') {
    const statusDiv = document.getElementById('logoBlendStatus');
    if (!statusDiv) return;

    statusDiv.textContent = message;
    statusDiv.style.display = 'block';

    // Set colors based on type
    if (type === 'success') {
        statusDiv.style.background = '#d4edda';
        statusDiv.style.border = '1px solid #28a745';
        statusDiv.style.color = '#155724';
    } else if (type === 'error') {
        statusDiv.style.background = '#f8d7da';
        statusDiv.style.border = '1px solid #dc3545';
        statusDiv.style.color = '#721c24';
    } else {
        statusDiv.style.background = '#e8f4f8';
        statusDiv.style.border = '1px solid #4a9eff';
        statusDiv.style.color = '#2c5aa0';
    }
}

// ========== LOGO BLEND FUNCTIONS ==========

/**
 * Load logo image and extract colors
 */
function loadLogoForBlending(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            logoBlendState.logoImage = e.target.result;
            logoBlendState.logoImg = img;

            // Create ImageData for sampling
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            tempCtx.drawImage(img, 0, 0);
            logoBlendState.logoImageData = tempCtx.getImageData(0, 0, img.width, img.height);

            // Extract colors for palette mode
            const colors = extractDominantColors(img);
            logoBlendState.darkPalette = colors.darkPalette;
            logoBlendState.lightPalette = colors.lightPalette;

            if (callback) callback();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

/**
 * Sample logo color at a specific canvas position
 */
function sampleLogoAtPosition(canvasX, canvasY, canvasSize, debug = false) {
    if (!logoBlendState.logoImg || !logoBlendState.logoImageData) {
        return null;
    }

    // Calculate logo bounds on canvas - MUST match drawLogoBackground exactly
    const scale = logoBlendState.logoScale / 100;
    const maxSize = Math.min(canvasSize, canvasSize) * scale; // Use min for consistency

    const aspectRatio = logoBlendState.logoImg.width / logoBlendState.logoImg.height;
    let logoWidth, logoHeight;
    if (aspectRatio > 1) {
        logoWidth = maxSize;
        logoHeight = maxSize / aspectRatio;
    } else {
        logoHeight = maxSize;
        logoWidth = maxSize * aspectRatio;
    }

    const logoX = (canvasSize * logoBlendState.logoX / 100) - (logoWidth / 2);
    const logoY = (canvasSize * logoBlendState.logoY / 100) - (logoHeight / 2);

    if (debug) {
        console.log(`Logo bounds: x=${logoX.toFixed(1)}, y=${logoY.toFixed(1)}, w=${logoWidth.toFixed(1)}, h=${logoHeight.toFixed(1)}`);
        console.log(`Canvas size: ${canvasSize}, Scale: ${scale}`);
    }

    // Check if position is inside logo
    const logoLocalX = canvasX - logoX;
    const logoLocalY = canvasY - logoY;

    const isInsideLogo = logoLocalX >= 0 && logoLocalX < logoWidth &&
                         logoLocalY >= 0 && logoLocalY < logoHeight;

    if (!isInsideLogo) {
        if (debug) {
            console.log(`Position (${canvasX.toFixed(1)}, ${canvasY.toFixed(1)}) is OUTSIDE logo`);
        }
        return null;
    }

    // Convert from scaled logo coordinates to original image coordinates
    const logoOriginalX = Math.floor((logoLocalX / logoWidth) * logoBlendState.logoImg.width);
    const logoOriginalY = Math.floor((logoLocalY / logoHeight) * logoBlendState.logoImg.height);

    // Clamp to logo bounds
    const clampedX = Math.max(0, Math.min(logoBlendState.logoImg.width - 1, logoOriginalX));
    const clampedY = Math.max(0, Math.min(logoBlendState.logoImg.height - 1, logoOriginalY));

    const logoPixelIndex = (clampedY * logoBlendState.logoImg.width + clampedX) * 4;

    const r = logoBlendState.logoImageData.data[logoPixelIndex];
    const g = logoBlendState.logoImageData.data[logoPixelIndex + 1];
    const b = logoBlendState.logoImageData.data[logoPixelIndex + 2];
    const a = logoBlendState.logoImageData.data[logoPixelIndex + 3];

    if (debug) {
        console.log(`Sampled at canvas (${canvasX.toFixed(1)}, ${canvasY.toFixed(1)}) -> logo pixel (${clampedX}, ${clampedY}) = RGBA(${r}, ${g}, ${b}, ${a})`);
    }

    return [r, g, b, a];
}

/**
 * Get color for a module based on logo sampling
 * @param {number} canvasX - X position on canvas (center of module)
 * @param {number} canvasY - Y position on canvas (center of module)
 * @param {boolean} isDark - Whether this is a dark module in the QR code
 * @param {number} canvasSize - Size of canvas
 * @returns {string} Hex color
 */
function getLogoBlendColor(canvasX, canvasY, isDark, canvasSize) {
    const sampledRgba = sampleLogoAtPosition(canvasX, canvasY, canvasSize);

    if (!sampledRgba) {
        // Module is outside logo, use transparentTreatment setting
        const treatAsLight = logoBlendState.transparentTreatment === 'light';
        return treatAsLight ? '#ffffff' : '#000000';
    }

    // Check if pixel is transparent (alpha < 128)
    const alpha = sampledRgba[3];
    if (alpha < 128) {
        // Transparent pixel, use transparentTreatment setting
        const treatAsLight = logoBlendState.transparentTreatment === 'light';
        return treatAsLight ? '#ffffff' : '#000000';
    }

    const sampledRgb = [sampledRgba[0], sampledRgba[1], sampledRgba[2]];

    if (logoBlendState.colorMode === 'gradient') {
        // Gradient mode: preserve hue/saturation, adjust lightness
        const hsl = rgbToHsl(sampledRgb[0], sampledRgb[1], sampledRgb[2]);

        if (isDark) {
            // Dark module: only darken if logo pixel is too bright
            if (hsl.l > logoBlendState.darkMaxLuminosity) {
                hsl.l = logoBlendState.darkMaxLuminosity;
            }
        } else {
            // Light module: only brighten if logo pixel is too dark
            if (hsl.l < logoBlendState.lightMinLuminosity) {
                hsl.l = logoBlendState.lightMinLuminosity;
            }
        }

        // Convert back to RGB then hex
        const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
        const r = rgb.r.toString(16).padStart(2, '0');
        const g = rgb.g.toString(16).padStart(2, '0');
        const b = rgb.b.toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    } else {
        // Palette mode: find best matching color
        const palette = isDark ? logoBlendState.darkPalette : logoBlendState.lightPalette;
        return findBestMatch(sampledRgb, palette);
    }
}

/**
 * Apply logo blend to all padding modules
 * This modifies paddingEdits map to set colors based on logo
 */
function applyLogoBlendToPadding() {
    if (!logoBlendState.logoImg) {
        showLogoBlendStatus('Please upload a logo first.', 'error');
        return;
    }

    if (!originalMatrix || !editableCells) {
        showLogoBlendStatus('Please generate a QR code first.', 'error');
        return;
    }

    const canvas = document.getElementById('paddingGrid');
    if (!canvas) {
        showLogoBlendStatus('Canvas not found.', 'error');
        return;
    }

    const moduleSize = parseInt(document.getElementById('moduleScale').value);
    const size = originalMatrix.length;
    const canvasSize = size * moduleSize; // Actual canvas size

    let paddingCount = 0;
    let changedCount = 0;

    console.log(`Starting logo blend: ${editableCells.size} padding modules`);
    console.log(`Canvas size: ${canvasSize}x${canvasSize}, Module size: ${moduleSize}px`);
    console.log(`Matrix size: ${size}x${size} modules`);

    let debugCount = 0;

    // For each editable (padding) cell, determine color from logo
    editableCells.forEach(cellKey => {
        const [row, col] = cellKey.split(',').map(Number);

        // Calculate module CENTER position on actual canvas
        const canvasX = (col + 0.5) * moduleSize;
        const canvasY = (row + 0.5) * moduleSize;

        // Debug first module with full details
        const isFirstModule = debugCount === 0;

        // Sample the logo directly (don't use current QR value to constrain)
        const sampledRgb = sampleLogoAtPosition(canvasX, canvasY, canvasSize, isFirstModule);

        let moduleValue;

        if (!sampledRgb) {
            // Module is outside logo - keep current value
            moduleValue = Boolean(currentMatrix[row][col]);
        } else {
            // Module is inside logo - determine color from logo
            // Calculate sampled luminance
            const sampledLuminance = 0.299 * sampledRgb[0] + 0.587 * sampledRgb[1] + 0.114 * sampledRgb[2];

            if (logoBlendState.colorMode === 'gradient') {
                // Gradient mode: sample logo color, adjust brightness for readability
                const hsl = rgbToHsl(sampledRgb[0], sampledRgb[1], sampledRgb[2]);

                // Decide if this should be dark or light based on logo luminosity
                // Use a simple threshold for grayscale images
                const logoIsDark = sampledLuminance < 128;

                if (logoIsDark) {
                    // Make sure it's dark enough to be black
                    if (hsl.l > logoBlendState.darkMaxLuminosity) {
                        hsl.l = logoBlendState.darkMaxLuminosity;
                    }
                    // For grayscale, this will already be dark
                } else {
                    // Make sure it's light enough to be white
                    if (hsl.l < logoBlendState.lightMinLuminosity) {
                        hsl.l = logoBlendState.lightMinLuminosity;
                    }
                    // For grayscale, this will already be light
                }

                const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
                const finalLuminance = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
                moduleValue = finalLuminance < 128;
            } else {
                // Palette mode: for grayscale logos, use simple luminance threshold
                // This is more reliable than color matching for B&W logos
                moduleValue = sampledLuminance < 128;
            }
        }

        // Convert current matrix value to boolean for comparison
        const currentValue = Boolean(currentMatrix[row][col]);

        paddingCount++;

        // Debug first few modules with detailed decision info
        if (debugCount < 10) {
            let decisionLog = `Module [${row},${col}] at canvas (${canvasX.toFixed(1)}, ${canvasY.toFixed(1)}): `;
            if (!sampledRgb) {
                decisionLog += 'OUTSIDE logo -> kept current=' + currentValue;
            } else {
                const sampledLum = 0.299 * sampledRgb[0] + 0.587 * sampledRgb[1] + 0.114 * sampledRgb[2];
                decisionLog += `sampled RGB(${sampledRgb.join(',')}) lum=${sampledLum.toFixed(1)} -> ${moduleValue ? 'BLACK' : 'WHITE'} (was ${currentValue ? 'BLACK' : 'WHITE'})`;
            }
            console.log(decisionLog);
            debugCount++;
        }

        // Always set the value to ensure it's in paddingEdits
        paddingEdits.set(cellKey, moduleValue);

        // Track changes - use boolean comparison
        if (currentValue !== moduleValue) {
            changedCount++;
        }
    });

    console.log(`Applied logo blend to ${paddingCount} modules, ${changedCount} changed`);

    if (changedCount === 0) {
        showLogoBlendStatus(`Analyzed ${paddingCount} padding modules. No changes needed (already matching logo).`, 'info');
    } else {
        showLogoBlendStatus(`✓ Applied logo blend: ${changedCount} of ${paddingCount} padding modules changed to match logo.`, 'success');
    }

    // Re-render the grid
    if (typeof renderPaddingGrid === 'function') {
        renderPaddingGrid();
    }

    // Update QR code with debounce
    if (typeof updateQRFromPaddingEdits === 'function') {
        if (typeof paintUpdateTimeout !== 'undefined') {
            clearTimeout(paintUpdateTimeout);
        }
        setTimeout(() => {
            updateQRFromPaddingEdits();
        }, 100);
    }
}
