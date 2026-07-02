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
    originalLogoImage: null,
    originalLogoImg: null,
    originalLogoImageData: null,
    logoImage: null,
    logoImg: null, // HTMLImageElement
    logoImageData: null,
    prep: {
        backgroundMode: 'none', // 'none', 'white', or 'black'
        tolerance: 32,
        fillHoles: true,
        outlineEnabled: true,
        outlineColor: '#ffffff',
        outlineWidth: 4
    },
    colorMode: 'palette', // 'palette' or 'gradient'
    darkPalette: ['#000000', '#333333', '#1a1a1a', '#0d0d0d'],
    lightPalette: ['#ffffff', '#f0f0f0', '#e0e0e0', '#d0d0d0'],
    darkMaxLuminosity: 33, // For gradient mode (0-50)
    lightMinLuminosity: 66, // For gradient mode (50-100)
    logoScale: 100,
    logoX: 50, // Center percentage
    logoY: 50, // Center percentage
    transparentTreatment: 'transparent' // 'transparent', 'light', or 'dark' - background fill for areas not covered by logo
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

function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    return {
        r: parseInt(clean.slice(0, 2), 16),
        g: parseInt(clean.slice(2, 4), 16),
        b: parseInt(clean.slice(4, 6), 16)
    };
}

function cloneImageData(imageData) {
    return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
}

function imageDataToImage(imageData, callback) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);

    const img = new Image();
    img.onload = () => callback(img, canvas.toDataURL('image/png'), imageData);
    img.src = canvas.toDataURL('image/png');
}

function resetLogoPrepControls() {
    const prep = logoBlendState.prep;

    const background = document.getElementById('logoPrepBackground');
    if (background) background.value = prep.backgroundMode;

    const tolerance = document.getElementById('logoPrepTolerance');
    if (tolerance) tolerance.value = prep.tolerance;
    const toleranceLabel = document.getElementById('logoPrepToleranceLabel');
    if (toleranceLabel) toleranceLabel.textContent = prep.tolerance;

    const fillHoles = document.getElementById('logoPrepFillHoles');
    if (fillHoles) fillHoles.checked = prep.fillHoles;

    const outlineEnabled = document.getElementById('logoPrepOutlineEnabled');
    if (outlineEnabled) outlineEnabled.checked = prep.outlineEnabled;

    const outlineColor = document.getElementById('logoPrepOutlineColor');
    if (outlineColor) outlineColor.value = prep.outlineColor;

    const outlineWidth = document.getElementById('logoPrepOutlineWidth');
    if (outlineWidth) outlineWidth.value = prep.outlineWidth;
    const outlineWidthLabel = document.getElementById('logoPrepOutlineWidthLabel');
    if (outlineWidthLabel) outlineWidthLabel.textContent = prep.outlineWidth;
}

function buildOutsideTransparentMask(opaque, width, height) {
    const outside = new Uint8Array(width * height);
    const queue = [];

    const enqueue = (x, y) => {
        if (x < 0 || y < 0 || x >= width || y >= height) return;
        const index = y * width + x;
        if (opaque[index] || outside[index]) return;
        outside[index] = 1;
        queue.push(index);
    };

    for (let x = 0; x < width; x++) {
        enqueue(x, 0);
        enqueue(x, height - 1);
    }
    for (let y = 1; y < height - 1; y++) {
        enqueue(0, y);
        enqueue(width - 1, y);
    }

    for (let i = 0; i < queue.length; i++) {
        const index = queue[i];
        const x = index % width;
        const y = Math.floor(index / width);
        enqueue(x + 1, y);
        enqueue(x - 1, y);
        enqueue(x, y + 1);
        enqueue(x, y - 1);
    }

    return outside;
}

function prepareLogoImageData(sourceImageData) {
    const prep = logoBlendState.prep;
    const sourceWidth = sourceImageData.width;
    const sourceHeight = sourceImageData.height;
    const outlineWidth = prep.outlineEnabled ? Math.max(0, parseInt(prep.outlineWidth) || 0) : 0;
    const border = outlineWidth;
    const width = sourceWidth + border * 2;
    const height = sourceHeight + border * 2;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < sourceHeight; y++) {
        for (let x = 0; x < sourceWidth; x++) {
            const sourceIndex = (y * sourceWidth + x) * 4;
            const targetIndex = ((y + border) * width + (x + border)) * 4;
            data[targetIndex] = sourceImageData.data[sourceIndex];
            data[targetIndex + 1] = sourceImageData.data[sourceIndex + 1];
            data[targetIndex + 2] = sourceImageData.data[sourceIndex + 2];
            data[targetIndex + 3] = sourceImageData.data[sourceIndex + 3];
        }
    }

    const backgroundRgb = prep.backgroundMode === 'white'
        ? { r: 255, g: 255, b: 255 }
        : prep.backgroundMode === 'black'
            ? { r: 0, g: 0, b: 0 }
            : null;

    if (backgroundRgb) {
        const tolerance = Math.max(0, parseInt(prep.tolerance) || 0);
        const feather = 32;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0) continue;
            const distance = colorDistance(
                [data[i], data[i + 1], data[i + 2]],
                [backgroundRgb.r, backgroundRgb.g, backgroundRgb.b]
            );
            if (distance <= tolerance) {
                data[i + 3] = 0;
            } else if (distance <= tolerance + feather) {
                const alphaScale = (distance - tolerance) / feather;
                data[i + 3] = Math.round(data[i + 3] * alphaScale);
            }
        }
    }

    const outlineRgb = hexToRgb(prep.outlineColor || '#ffffff');
    const opaque = new Uint8Array(width * height);
    for (let index = 0; index < width * height; index++) {
        opaque[index] = data[index * 4 + 3] >= 128 ? 1 : 0;
    }

    if (prep.fillHoles) {
        const outside = buildOutsideTransparentMask(opaque, width, height);
        for (let index = 0; index < width * height; index++) {
            if (!opaque[index] && !outside[index]) {
                const dataIndex = index * 4;
                data[dataIndex] = outlineRgb.r;
                data[dataIndex + 1] = outlineRgb.g;
                data[dataIndex + 2] = outlineRgb.b;
                data[dataIndex + 3] = 255;
                opaque[index] = 1;
            }
        }
    }

    const output = new Uint8ClampedArray(data);
    if (outlineWidth > 0) {
        const radiusSq = outlineWidth * outlineWidth;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                if (opaque[index]) continue;

                let nearLogo = false;
                for (let dy = -outlineWidth; dy <= outlineWidth && !nearLogo; dy++) {
                    const yy = y + dy;
                    if (yy < 0 || yy >= height) continue;
                    for (let dx = -outlineWidth; dx <= outlineWidth; dx++) {
                        if (dx * dx + dy * dy > radiusSq) continue;
                        const xx = x + dx;
                        if (xx < 0 || xx >= width) continue;
                        if (opaque[yy * width + xx]) {
                            nearLogo = true;
                            break;
                        }
                    }
                }

                if (nearLogo) {
                    const dataIndex = index * 4;
                    output[dataIndex] = outlineRgb.r;
                    output[dataIndex + 1] = outlineRgb.g;
                    output[dataIndex + 2] = outlineRgb.b;
                    output[dataIndex + 3] = 255;
                }
            }
        }
    }

    return new ImageData(output, width, height);
}

function applyLogoPrep(callback) {
    if (!logoBlendState.originalLogoImageData) {
        if (callback) callback();
        return;
    }

    const preparedImageData = prepareLogoImageData(cloneImageData(logoBlendState.originalLogoImageData));
    imageDataToImage(preparedImageData, (img, dataUrl, imageData) => {
        logoBlendState.logoImage = dataUrl;
        logoBlendState.logoImg = img;
        logoBlendState.logoImageData = imageData;

        const colors = extractDominantColors(img);
        logoBlendState.darkPalette = colors.darkPalette;
        logoBlendState.lightPalette = colors.lightPalette;

        if (callback) callback();
    });
}

function resetLogoPrep() {
    logoBlendState.prep = {
        backgroundMode: 'none',
        tolerance: 32,
        fillHoles: true,
        outlineEnabled: true,
        outlineColor: '#ffffff',
        outlineWidth: 4
    };
    resetLogoPrepControls();
    applyLogoPrep(() => {
        const previewImg = document.getElementById('logoBlendPreviewImg');
        if (previewImg) previewImg.src = logoBlendState.logoImage;
        if (logoBlendState.colorMode === 'palette' && typeof displayExtractedPalette === 'function') {
            displayExtractedPalette();
        }
        if (typeof renderPaddingGrid === 'function') {
            renderPaddingGrid();
        }
        if (typeof syncLogoToOtherTabs === 'function') {
            syncLogoToOtherTabs();
        }
    });
}

/**
 * Load logo image and extract colors
 */
/**
 * Auto-detect the best background fill setting based on logo analysis
 * Returns: 'transparent', 'dark', or 'light'
 */
function autoDetectBackgroundFill(imageData) {
    const data = imageData.data;
    let hasTransparency = false;
    let totalLuminance = 0;
    let opaquePixelCount = 0;

    // Sample every 16th pixel for performance
    for (let i = 0; i < data.length; i += 64) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a < 250) {
            hasTransparency = true;
        }

        if (a > 128) {
            // Calculate luminance for opaque-ish pixels
            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
            totalLuminance += luminance;
            opaquePixelCount++;
        }
    }

    // If logo has transparency, default to transparent
    if (hasTransparency) {
        return 'transparent';
    }

    // Calculate average luminance (0-255)
    const avgLuminance = opaquePixelCount > 0 ? totalLuminance / opaquePixelCount : 128;

    // If mostly dark (< 85, roughly 1/3 of 255), default to dark
    if (avgLuminance < 85) {
        return 'dark';
    }

    // Otherwise default to light
    return 'light';
}

function loadLogoForBlending(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            logoBlendState.originalLogoImage = e.target.result;
            logoBlendState.originalLogoImg = img;

            // Create ImageData for sampling
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            tempCtx.drawImage(img, 0, 0);
            logoBlendState.originalLogoImageData = tempCtx.getImageData(0, 0, img.width, img.height);

            logoBlendState.prep = {
                backgroundMode: 'none',
                tolerance: 32,
                fillHoles: true,
                outlineEnabled: true,
                outlineColor: '#ffffff',
                outlineWidth: 4
            };
            resetLogoPrepControls();

            applyLogoPrep(() => {
                // Auto-detect best background fill setting from the prepared logo
                const detectedFill = autoDetectBackgroundFill(logoBlendState.logoImageData);
                logoBlendState.transparentTreatment = detectedFill;

                // Update the dropdown to reflect the auto-detected value
                const dropdown = document.getElementById('logoBlendTransparentTreatment');
                if (dropdown) {
                    dropdown.value = detectedFill;
                }

                if (callback) callback();
            });
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
        // 'transparent' and 'light' both show light background, 'dark' shows dark
        const treatAsLight = logoBlendState.transparentTreatment !== 'dark';
        return treatAsLight ? '#ffffff' : '#000000';
    }

    // Check if pixel is transparent (alpha < 128)
    const alpha = sampledRgba[3];
    if (alpha < 128) {
        // Transparent pixel, use transparentTreatment setting
        // 'transparent' and 'light' both show light background, 'dark' shows dark
        const treatAsLight = logoBlendState.transparentTreatment !== 'dark';
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
 * Get the desired color (dark/light) for ALL modules based on the logo
 * Returns a Map: cellKey -> boolean (true=dark, false=light)
 * Only includes modules that are inside the logo (not outside/transparent)
 */
function getDesiredLogoColors(moduleSize, canvasSize, matrixSize) {
    const desiredValues = new Map();

    for (let row = 0; row < matrixSize; row++) {
        for (let col = 0; col < matrixSize; col++) {
            const canvasX = (col + 0.5) * moduleSize;
            const canvasY = (row + 0.5) * moduleSize;

            const sampledRgb = sampleLogoAtPosition(canvasX, canvasY, canvasSize);

            if (!sampledRgb) {
                // Outside logo - skip
                continue;
            }

            const alpha = sampledRgb[3];
            if (alpha < 128) {
                // Transparent pixel - skip
                continue;
            }

            // Determine if the logo wants this to be dark or light
            const sampledLuminance = 0.299 * sampledRgb[0] + 0.587 * sampledRgb[1] + 0.114 * sampledRgb[2];
            const wantsDark = sampledLuminance < 128;

            desiredValues.set(`${row},${col}`, wantsDark);
        }
    }

    return desiredValues;
}

/**
 * Count how many modules in a matrix match the desired logo colors
 */
function countLogoMatches(matrix, desiredColors) {
    let matches = 0;

    desiredColors.forEach((wantsDark, cellKey) => {
        const [row, col] = cellKey.split(',').map(Number);
        const moduleValue = Boolean(matrix[row][col]);

        if (moduleValue === wantsDark) {
            matches++;
        }
    });

    return matches;
}

/**
 * Simulate applying a mask, updating padding to match logo, recalculating ECC,
 * and count how many modules match the logo.
 *
 * Order: raw data → apply mask → update padding → recalculate ECC → count matches
 */
function simulateMaskWithLogoBlend(maskPattern, desiredColors, moduleSize, canvasSize) {
    const version = currentVersion;
    const eccLevel = currentEccLevel;
    const size = 21 + (version - 1) * 4;

    // Save original dataBytes
    const originalDataBytes = [...encodedBitstream.dataBytes];

    // Step 1: Create raw unmasked matrix from original data
    const interleaved = interleaveBlocks(encodedBitstream.blocks);
    let testMatrix = createMatrix(size);
    placeFunctionPatterns(testMatrix, version);
    placeDataBits(testMatrix, interleaved);

    // Step 2: Apply the test mask
    applyMask(testMatrix, maskPattern, version);
    placeFormatInfo(testMatrix, eccLevel, maskPattern, version);
    if (version >= 7) {
        placeVersionInfo(testMatrix, version);
    }

    // Step 3: Determine padding edits to match logo (on the masked matrix)
    const testPaddingEdits = new Map();

    editableCells.forEach(cellKey => {
        const [row, col] = cellKey.split(',').map(Number);
        const canvasX = (col + 0.5) * moduleSize;
        const canvasY = (row + 0.5) * moduleSize;

        const sampledRgb = sampleLogoAtPosition(canvasX, canvasY, canvasSize);

        let moduleValue;
        if (!sampledRgb || sampledRgb[3] < 128) {
            // Outside logo or transparent - keep current masked value
            moduleValue = Boolean(testMatrix[row][col]);
        } else {
            // Match logo luminance
            const sampledLuminance = 0.299 * sampledRgb[0] + 0.587 * sampledRgb[1] + 0.114 * sampledRgb[2];
            moduleValue = sampledLuminance < 128; // true = dark
        }

        testPaddingEdits.set(cellKey, moduleValue);
    });

    // Step 4: Convert padding edits to unmasked bytes
    const newPaddingBytes = convertPaddingEditsToBytes(testPaddingEdits, maskPattern);

    // Step 5: Update dataBytes with new padding
    const messageBits = encodedBitstream.modeIndicator.length +
                       encodedBitstream.charCount.length +
                       encodedBitstream.messageData.length +
                       encodedBitstream.terminator.length +
                       encodedBitstream.bytePadding.length;
    const messageBytes = Math.ceil(messageBits / 8);

    const testDataBytes = [...originalDataBytes];
    newPaddingBytes.forEach((byte, idx) => {
        testDataBytes[messageBytes + idx] = byte;
    });

    // Step 6: Recalculate ECC with new padding
    const testBlocks = splitIntoBlocks(testDataBytes, version, eccLevel, blockSizeTable);
    calculateEccForBlocks(testBlocks);

    // Step 7: Regenerate matrix with new data+ECC
    const newInterleaved = interleaveBlocks(testBlocks);
    testMatrix = createMatrix(size);
    placeFunctionPatterns(testMatrix, version);
    placeDataBits(testMatrix, newInterleaved);

    // Step 8: Apply the mask again
    applyMask(testMatrix, maskPattern, version);
    placeFormatInfo(testMatrix, eccLevel, maskPattern, version);
    if (version >= 7) {
        placeVersionInfo(testMatrix, version);
    }

    // Step 9: Count how many modules match the logo
    const matches = countLogoMatches(testMatrix, desiredColors);

    return {
        matches: matches,
        paddingBytes: newPaddingBytes,
        paddingEdits: testPaddingEdits
    };
}

/**
 * Convert padding edits (displayed/masked values) to unmasked byte values
 */
function convertPaddingEditsToBytes(edits, maskPattern) {
    const newPaddingBytes = [...originalPaddingBytes];

    paddingModuleMap.forEach((modules, padByteIdx) => {
        // Check if this byte has any edited modules
        const hasEdits = modules.some(module => {
            const cellKey = `${module.row},${module.col}`;
            return edits.has(cellKey);
        });

        if (!hasEdits) {
            return; // Keep original value
        }

        const bits = new Array(8).fill(0);

        modules.forEach((module) => {
            const cellKey = `${module.row},${module.col}`;

            let bitValue;
            if (edits.has(cellKey)) {
                // This is the masked (displayed) value we want
                const maskedValue = edits.get(cellKey);
                const shouldFlip = shouldFlipModule(module.row, module.col, maskPattern);
                // Unmask to get the raw bit value
                bitValue = shouldFlip ? !maskedValue : maskedValue;
            } else {
                // Use original bit value
                const originalByte = originalPaddingBytes[padByteIdx];
                const bitInByte = (originalByte >> (7 - module.bitOffset)) & 1;
                bitValue = bitInByte === 1;
            }

            bits[module.bitOffset] = bitValue ? 1 : 0;
        });

        // Convert bits to byte
        let byteValue = 0;
        for (let i = 0; i < 8; i++) {
            byteValue = (byteValue << 1) | bits[i];
        }
        newPaddingBytes[padByteIdx] = byteValue;
    });

    return newPaddingBytes;
}

/**
 * Test all 8 mask patterns and find the one that best matches the logo colors
 * after applying padding edits and recalculating ECC.
 *
 * Order for each mask: raw data → apply mask → update padding → recalculate ECC → count matches
 */
function findBestMaskForLogo() {
    if (!logoBlendState.logoImg || !encodedBitstream || !encodedBitstream.blocks || !currentMatrix) {
        return null;
    }

    if (!paddingModuleMap || !editableCells || editableCells.size === 0) {
        return null;
    }

    const moduleSize = parseInt(document.getElementById('moduleScale').value);
    const size = currentMatrix.length;
    const canvasSize = size * moduleSize;

    // Get desired colors for ALL modules based on logo
    const desiredColors = getDesiredLogoColors(moduleSize, canvasSize, size);

    // If no modules are inside the logo, no point in optimizing
    if (desiredColors.size === 0) {
        return null;
    }

    const scores = [];
    let bestResult = null;

    // For each mask pattern 0-7, simulate the full pipeline
    for (let maskPattern = 0; maskPattern < 8; maskPattern++) {
        const result = simulateMaskWithLogoBlend(maskPattern, desiredColors, moduleSize, canvasSize);

        const score = {
            mask: maskPattern,
            matches: result.matches,
            total: desiredColors.size,
            percentage: Math.round((result.matches / desiredColors.size) * 100),
            paddingBytes: result.paddingBytes,
            paddingEdits: result.paddingEdits
        };

        scores.push(score);

        if (!bestResult || result.matches > bestResult.matches) {
            bestResult = score;
        }
    }

    return {
        bestMask: bestResult.mask,
        bestMatches: bestResult.matches,
        bestPaddingBytes: bestResult.paddingBytes,
        bestPaddingEdits: bestResult.paddingEdits,
        total: desiredColors.size,
        scores: scores,
        desiredColors
    };
}

/**
 * Display the mask optimization scores in the UI
 */
function displayMaskScores(result, selectedMask) {
    const statusDiv = document.getElementById('logoBlendStatus');
    if (!statusDiv || !result) return;

    // Build the scores table
    let scoresHtml = '<div style="margin-top: 8px; font-size: 11px;">';
    scoresHtml += '<strong>Mask Pattern Scores:</strong><br>';
    scoresHtml += '<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-top: 4px;">';

    result.scores.forEach(score => {
        const isSelected = score.mask === selectedMask;
        const isBest = score.mask === result.bestMask;
        const bgColor = isSelected ? '#c8e6c9' : (isBest ? '#fff3e0' : '#f5f5f5');
        const border = isSelected ? '2px solid #4caf50' : (isBest ? '2px solid #ff9800' : '1px solid #ddd');

        scoresHtml += `<div style="padding: 4px; background: ${bgColor}; border: ${border}; border-radius: 3px; text-align: center;">`;
        scoresHtml += `<div style="font-weight: bold;">Mask ${score.mask}</div>`;
        scoresHtml += `<div>${score.matches}/${score.total}</div>`;
        scoresHtml += `<div style="color: #666;">${score.percentage}%</div>`;
        scoresHtml += '</div>';
    });

    scoresHtml += '</div>';
    scoresHtml += '<div style="margin-top: 6px; font-size: 10px; color: #666;">';
    scoresHtml += '<span style="display: inline-block; width: 12px; height: 12px; background: #c8e6c9; border: 2px solid #4caf50; vertical-align: middle; margin-right: 4px;"></span>Selected ';
    scoresHtml += '<span style="display: inline-block; width: 12px; height: 12px; background: #fff3e0; border: 2px solid #ff9800; vertical-align: middle; margin-left: 8px; margin-right: 4px;"></span>Best match';
    scoresHtml += '</div></div>';

    return scoresHtml;
}

function applyAdvancedLogoBlendWithEcc(desiredColors, selectedMask) {
    if (typeof buildGJMaps !== 'function' || typeof gjSolveModuleBits !== 'function') {
        return null;
    }
    if (!encodedBitstream || !encodedBitstream.dataBytes || !paddingModuleMap || !editableCells) {
        return null;
    }

    const version = currentVersion;
    const eccLevel = currentEccLevel;
    const size = currentMatrix.length;
    const maps = buildGJMaps(version, eccLevel, encodedBitstream.dataBytes.length);

    const paddingTargets = new Map();
    const eccTargets = new Map();

    desiredColors.forEach((isDark, cellKey) => {
        if (editableCells.has(cellKey)) {
            paddingTargets.set(cellKey, isDark);
        } else if (maps.eccModuleMap.has(cellKey)) {
            eccTargets.set(cellKey, isDark);
        }
    });

    if (eccTargets.size === 0) {
        return null;
    }

    const messageBits = encodedBitstream.modeIndicator.length +
                       encodedBitstream.charCount.length +
                       encodedBitstream.messageData.length +
                       encodedBitstream.terminator.length +
                       encodedBitstream.bytePadding.length;
    const messageByteCount = Math.ceil(messageBits / 8);

    const solvedDataBytes = gjSolveModuleBits({
        dataBytes: [...encodedBitstream.dataBytes],
        version,
        eccLevel,
        maskPattern: selectedMask,
        messageByteCount,
        targets: paddingTargets,
        moduleToInterleavedBit: maps.moduleToInterleavedBit,
        interleavedBitToBlock: maps.interleavedBitToBlock,
        eccTargets,
        eccModuleMap: maps.eccModuleMap
    });

    const blocks = splitIntoBlocks(solvedDataBytes, version, eccLevel, blockSizeTable);
    calculateEccForBlocks(blocks);

    const interleaved = interleaveBlocks(blocks);
    const matrix = createMatrix(size);
    placeFunctionPatterns(matrix, version);
    placeDataBits(matrix, interleaved);
    applyMask(matrix, selectedMask, version);
    placeFormatInfo(matrix, eccLevel, selectedMask, version);
    if (version >= 7) {
        placeVersionInfo(matrix, version);
    }

    const paddingByteCount = encodedBitstream.padBytes.length;
    const solvedPaddingBytes = solvedDataBytes.slice(messageByteCount, messageByteCount + paddingByteCount);

    let matches = 0;
    desiredColors.forEach((wantsDark, cellKey) => {
        const [row, col] = cellKey.split(',').map(Number);
        if (Boolean(matrix[row][col]) === wantsDark) matches++;
    });

    return {
        matrix,
        blocks,
        dataBytes: solvedDataBytes,
        paddingBytes: solvedPaddingBytes,
        matches,
        total: desiredColors.size,
        paddingTargets: paddingTargets.size,
        eccTargets: eccTargets.size
    };
}

/**
 * Apply logo blend to all padding modules
 * Tests all 8 mask patterns, simulates the full pipeline for each, and picks the best.
 *
 * For each mask: raw data → apply mask → update padding → recalculate ECC → count matches
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

    // Find the best mask pattern by simulating all 8
    const maskResult = findBestMaskForLogo();

    if (!maskResult) {
        showLogoBlendStatus('Could not optimize mask - no modules inside logo area.', 'error');
        return;
    }

    const selectedMask = maskResult.bestMask;
    const currentMask = parseInt(document.getElementById('maskPatternSelect')?.value || 0);

    console.log(`Mask optimization complete: best=${selectedMask} (${maskResult.bestMatches}/${maskResult.total} matches)`);
    console.log(`Scores: ${maskResult.scores.map(s => `M${s.mask}:${s.matches}`).join(', ')}`);

    // Update the mask dropdown
    const maskSelect = document.getElementById('maskPatternSelect');
    if (maskSelect) {
        maskSelect.value = selectedMask;
    }

    // Apply the pre-computed padding edits from the best mask simulation
    paddingEdits.clear();
    maskResult.bestPaddingEdits.forEach((value, key) => {
        paddingEdits.set(key, value);
    });

    const advancedResult = applyAdvancedLogoBlendWithEcc(maskResult.desiredColors, selectedMask);

    if (advancedResult) {
        encodedBitstream.dataBytes = [...advancedResult.dataBytes];
        encodedBitstream.padBytes = [...advancedResult.paddingBytes];
        encodedBitstream.blocks = advancedResult.blocks;
        currentMatrix = advancedResult.matrix;

        // Reflect the final regenerated matrix in the editable padding overlay.
        paddingEdits.clear();
        editableCells.forEach(cellKey => {
            const [row, col] = cellKey.split(',').map(Number);
            paddingEdits.set(cellKey, Boolean(currentMatrix[row][col]));
        });
    } else {
        // Update the padding bytes in encodedBitstream
        const messageBits = encodedBitstream.modeIndicator.length +
                           encodedBitstream.charCount.length +
                           encodedBitstream.messageData.length +
                           encodedBitstream.terminator.length +
                           encodedBitstream.bytePadding.length;
        const messageBytes = Math.ceil(messageBits / 8);

        maskResult.bestPaddingBytes.forEach((byte, idx) => {
            encodedBitstream.dataBytes[messageBytes + idx] = byte;
        });
        encodedBitstream.padBytes = [...maskResult.bestPaddingBytes];

        // Recalculate ECC with the new padding
        const blocks = splitIntoBlocks(encodedBitstream.dataBytes, currentVersion, currentEccLevel, blockSizeTable);
        calculateEccForBlocks(blocks);
        encodedBitstream.blocks = blocks;

        // Regenerate matrix with new data+ECC and the best mask
        const interleaved = interleaveBlocks(blocks);
        const size = 21 + (currentVersion - 1) * 4;
        currentMatrix = createMatrix(size);
        placeFunctionPatterns(currentMatrix, currentVersion);
        placeDataBits(currentMatrix, interleaved);
        applyMask(currentMatrix, selectedMask, currentVersion);
        placeFormatInfo(currentMatrix, currentEccLevel, selectedMask, currentVersion);
        if (currentVersion >= 7) {
            placeVersionInfo(currentMatrix, currentVersion);
        }
    }

    if (typeof originalPaddingBytes !== 'undefined') {
        originalPaddingBytes = [...encodedBitstream.padBytes];
    }

    // Update originalMatrix
    originalMatrix = currentMatrix.map(row => [...row]);

    // Build status message
    const matchCount = advancedResult ? advancedResult.matches : maskResult.bestMatches;
    const totalCount = advancedResult ? advancedResult.total : maskResult.total;
    const eccText = advancedResult ? `, including ${advancedResult.eccTargets} ECC module targets` : '';
    const statusMessage = `✓ Applied logo blend using mask ${selectedMask} (${matchCount}/${totalCount} modules match logo${eccText}).`;

    showLogoBlendStatus(statusMessage, 'success');

    // Append mask scores to the status
    const statusDiv = document.getElementById('logoBlendStatus');
    if (statusDiv) {
        statusDiv.innerHTML += displayMaskScores(maskResult, selectedMask);
    }

    // Re-render the grid
    if (typeof renderPaddingGrid === 'function') {
        renderPaddingGrid();
    }

    // Render the main QR code
    if (typeof renderQrCode === 'function') {
        renderQrCode(currentMatrix);
    }

    // Refresh encode tab displays
    if (typeof refreshEncodeTabDisplays === 'function') {
        refreshEncodeTabDisplays();
    }

    // Keep downstream tabs on the regenerated matrix, mask, and logo settings.
    if (typeof syncLogoToOtherTabs === 'function') {
        syncLogoToOtherTabs();
    }
}
