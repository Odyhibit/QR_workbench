// decoder-extract.js
// QR code extraction, sampling, and unmasking functions

// Get module count based on version
function getModuleCount(version) {
    return 17 + version * 4;
}

// Check if a pixel is white (or close to white)
function isWhite(data, idx, threshold = 200) {
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    return r > threshold && g > threshold && b > threshold;
}

// Check if a pixel is black (or close to black)
function isBlack(data, idx, threshold = 128) {
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    return r < threshold && g < threshold && b < threshold;
}

// Find the first row with non-white pixels (top border)
function findTopBorder(imageData) {
    const { data, width, height } = imageData;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            if (!isWhite(data, idx)) {
                return y;
            }
        }
    }
    return 0;
}

// Find the first column with non-white pixels (left border)
function findLeftBorder(imageData) {
    const { data, width, height } = imageData;

    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            const idx = (y * width + x) * 4;
            if (!isWhite(data, idx)) {
                return x;
            }
        }
    }
    return 0;
}

// Find the last row with non-white pixels (bottom border)
function findBottomBorder(imageData) {
    const { data, width, height } = imageData;

    for (let y = height - 1; y >= 0; y--) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            if (!isWhite(data, idx)) {
                return height - 1 - y;
            }
        }
    }
    return 0;
}

// Find the last column with non-white pixels (right border)
function findRightBorder(imageData) {
    const { data, width, height } = imageData;

    for (let x = width - 1; x >= 0; x--) {
        for (let y = 0; y < height; y++) {
            const idx = (y * width + x) * 4;
            if (!isWhite(data, idx)) {
                return width - 1 - x;
            }
        }
    }
    return 0;
}

// Calculate module size based on finder pattern (7 modules wide)
function calculateModuleSize(imageData, topBorder, leftBorder) {
    const { data, width } = imageData;

    // Scan multiple rows through the top-left finder pattern to get pattern widths
    const patterns = [];

    for (let scanY = topBorder; scanY < topBorder + 30 && scanY < imageData.height; scanY++) {
        // Scan from left border and detect black-white transitions
        const segments = [];
        let currentColor = null;
        let segmentStart = leftBorder;

        for (let x = leftBorder; x < Math.min(leftBorder + 200, width); x++) {
            const idx = (scanY * width + x) * 4;
            const pixelIsBlack = isBlack(data, idx);

            if (currentColor === null) {
                currentColor = pixelIsBlack;
                segmentStart = x;
            } else if (pixelIsBlack !== currentColor) {
                // Transition detected
                segments.push({
                    color: currentColor ? 'black' : 'white',
                    width: x - segmentStart
                });
                currentColor = pixelIsBlack;
                segmentStart = x;
            }
        }

        // Look for the finder pattern: 1:1:3:1:1 ratio (black:white:black:white:black)
        if (segments.length >= 5) {
            // Check if first 5 segments match the pattern
            const widths = segments.slice(0, 5).map(s => s.width);
            const colors = segments.slice(0, 5).map(s => s.color);

            // Verify color pattern: black-white-black-white-black
            if (colors[0] === 'black' && colors[1] === 'white' &&
                colors[2] === 'black' && colors[3] === 'white' && colors[4] === 'black') {

                // Calculate the module size from the smallest unit (should be width[0] or width[1])
                const unit = Math.min(widths[0], widths[1], widths[3], widths[4]);

                // Verify the 1:1:3:1:1 ratio approximately holds
                const ratio2 = widths[2] / unit; // Should be ~3
                if (ratio2 > 2.5 && ratio2 < 3.5) {
                    patterns.push(unit);
                }
            }
        }
    }

    if (patterns.length === 0) {
        // Fallback: find the total width of the finder pattern
        let startX = leftBorder;
        let y = topBorder + 5; // Use a row a few pixels in

        // Find start of finder pattern (first black)
        while (startX < width && !isBlack(data, (y * width + startX) * 4)) {
            startX++;
        }

        // Find end of finder pattern
        let endX = startX;
        let lastBlack = startX;

        for (let x = startX; x < Math.min(startX + 200, width); x++) {
            const idx = (y * width + x) * 4;
            if (isBlack(data, idx)) {
                lastBlack = x;
            }
            // If we've gone more than 10 pixels past the last black, we're done
            if (x - lastBlack > 10) {
                endX = lastBlack;
                break;
            }
        }

        const finderWidth = endX - startX + 1;
        return finderWidth / 7;
    }

    // Average all detected module sizes
    const avgModuleSize = patterns.reduce((a, b) => a + b, 0) / patterns.length;
    return avgModuleSize;
}

// Detect the version by calculating module count
function detectVersion(imageData, topBorder, bottomBorder, leftBorder, rightBorder) {
    const moduleSize = calculateModuleSize(imageData, topBorder, leftBorder);

    // Calculate QR code dimensions (excluding quiet zone)
    const qrWidth = imageData.width - leftBorder - rightBorder;
    const qrHeight = imageData.height - topBorder - bottomBorder;

    // Calculate number of modules in each dimension
    const modulesWidth = Math.round(qrWidth / moduleSize);
    const modulesHeight = Math.round(qrHeight / moduleSize);

    // Use the average of both dimensions
    const moduleCount = Math.round((modulesWidth + modulesHeight) / 2);

    // Calculate version: moduleCount = 17 + version * 4
    // So: version = (moduleCount - 17) / 4
    const version = (moduleCount - 17) / 4;

    // Round to nearest integer and clamp to valid range (1-40)
    return Math.max(1, Math.min(40, Math.round(version)));
}

// Sample modules from the original image
function sampleModules() {
    if (!imageData) return null;

    const top = parseInt(borderTop.value) || 0;
    const bottom = parseInt(borderBottom.value) || 0;
    const left = parseInt(borderLeft.value) || 0;
    const right = parseInt(borderRight.value) || 0;

    const version = parseInt(versionSelect.value);
    const moduleCount = getModuleCount(version);

    const gridWidth = imageData.width - left - right;
    const gridHeight = imageData.height - top - bottom;
    const moduleWidth = gridWidth / moduleCount;
    const moduleHeight = gridHeight / moduleCount;

    // Create 2D array for modules
    const matrix = [];
    const { data, width } = imageData;

    for (let row = 0; row < moduleCount; row++) {
        matrix[row] = [];
        for (let col = 0; col < moduleCount; col++) {
            // Sample from the center of each module
            const centerX = Math.round(left + (col + 0.5) * moduleWidth);
            const centerY = Math.round(top + (row + 0.5) * moduleHeight);
            const idx = (centerY * width + centerX) * 4;

            // Check if pixel is black
            matrix[row][col] = isBlack(data, idx);
        }
    }

    return matrix;
}

// Get alignment pattern center positions for a given version
function getAlignmentPatternCenters(version) {
    const alignmentTable = {
        1: [],
        2: [6, 18],
        3: [6, 22],
        4: [6, 26],
        5: [6, 30],
        6: [6, 34],
        7: [6, 22, 38],
        8: [6, 24, 42],
        9: [6, 26, 46],
        10: [6, 28, 50],
        11: [6, 30, 54],
        12: [6, 32, 58],
        13: [6, 34, 62],
        14: [6, 26, 46, 66],
        15: [6, 26, 48, 70],
        16: [6, 26, 50, 74],
        17: [6, 30, 54, 78],
        18: [6, 30, 56, 82],
        19: [6, 30, 58, 86],
        20: [6, 34, 62, 90],
        21: [6, 28, 50, 72, 94],
        22: [6, 26, 50, 74, 98],
        23: [6, 30, 54, 78, 102],
        24: [6, 28, 54, 80, 106],
        25: [6, 32, 58, 84, 110],
        26: [6, 30, 58, 86, 114],
        27: [6, 34, 62, 90, 118],
        28: [6, 26, 50, 74, 98, 122],
        29: [6, 30, 54, 78, 102, 126],
        30: [6, 26, 52, 78, 104, 130],
        31: [6, 30, 56, 82, 108, 134],
        32: [6, 34, 60, 86, 112, 138],
        33: [6, 30, 58, 86, 114, 142],
        34: [6, 34, 62, 90, 118, 146],
        35: [6, 30, 54, 78, 102, 126, 150],
        36: [6, 24, 50, 76, 102, 128, 154],
        37: [6, 28, 54, 80, 106, 132, 158],
        38: [6, 32, 58, 84, 110, 136, 162],
        39: [6, 26, 54, 82, 110, 138, 166],
        40: [6, 30, 58, 86, 114, 142, 170]
    };

    return alignmentTable[version] || [];
}

// Check if a module is part of a finder pattern (including separator)
function isFinderModule(row, col, moduleCount) {
    // Top-left finder (0-7, 0-7) with separator
    if (row <= 7 && col <= 7) return true;

    // Top-right finder (0-7, moduleCount-8 to moduleCount-1) with separator
    if (row <= 7 && col >= moduleCount - 8) return true;

    // Bottom-left finder (moduleCount-8 to moduleCount-1, 0-7) with separator
    if (row >= moduleCount - 8 && col <= 7) return true;

    return false;
}

// Check if a module is part of an alignment pattern
function isAlignmentModule(row, col, moduleCount) {
    const version = parseInt(versionSelect.value);
    if (version < 2) return false;

    const alignmentCenters = getAlignmentPatternCenters(version);

    for (let cy of alignmentCenters) {
        for (let cx of alignmentCenters) {
            // Skip if overlaps with finder patterns
            if ((cx < 10 && cy < 10) ||
                (cx < 10 && cy >= moduleCount - 9) ||
                (cx >= moduleCount - 9 && cy < 10)) {
                continue;
            }
            // Check if (col, row) is within 5×5 alignment pattern centered at (cx, cy)
            if (Math.abs(col - cx) <= 2 && Math.abs(row - cy) <= 2) {
                return true;
            }
        }
    }

    return false;
}

// Check if a module is part of format information
function isFormatModule(row, col, moduleCount) {
    // Horizontal strip (row 8, columns 0-8 and moduleCount-8 to moduleCount-1)
    if (row === 8 && (col <= 8 || col >= moduleCount - 8)) return true;

    // Vertical strip (column 8, rows 0-8 and moduleCount-7 to moduleCount-1)
    if (col === 8 && (row <= 8 || row >= moduleCount - 7)) return true;

    return false;
}

// Check if a module is part of timing patterns
function isTimingModule(row, col, moduleCount) {
    // Horizontal timing (row 6, between finders)
    if (row === 6 && col >= 8 && col <= moduleCount - 9) return true;

    // Vertical timing (column 6, between finders)
    if (col === 6 && row >= 8 && row <= moduleCount - 9) return true;

    return false;
}

// Check if a module is the dark module (always black)
function isDarkModule(row, col, moduleCount) {
    const version = parseInt(versionSelect.value);
    // Dark module is always at position (4 * version + 9, 8)
    const darkRow = 4 * version + 9;
    const darkCol = 8;

    return row === darkRow && col === darkCol;
}

// Check if a module is part of version information (only version 7+)
function isVersionModule(row, col, moduleCount) {
    const version = parseInt(versionSelect.value);
    if (version < 7) return false;

    // Bottom-left version info (3 columns x 6 rows near bottom-left)
    // Rows: moduleCount-11 to moduleCount-9, Columns: 0-5
    if (row >= moduleCount - 11 && row <= moduleCount - 9 && col >= 0 && col <= 5) return true;

    // Top-right version info (6 columns x 3 rows near top-right)
    // Rows: 0-5, Columns: moduleCount-11 to moduleCount-9
    if (row >= 0 && row <= 5 && col >= moduleCount - 11 && col <= moduleCount - 9) return true;

    return false;
}

// Check if a module is a function module (should not be unmasked)
function isFunctionModule(row, col, moduleCount) {
    // Check all function patterns
    if (isFinderModule(row, col, moduleCount)) return true;
    if (isAlignmentModule(row, col, moduleCount)) return true;
    if (isFormatModule(row, col, moduleCount)) return true;
    if (isTimingModule(row, col, moduleCount)) return true;
    if (isDarkModule(row, col, moduleCount)) return true;
    if (isVersionModule(row, col, moduleCount)) return true;

    return false;
}

// Apply mask pattern formula to determine if module should be flipped
function shouldFlipModule(row, col, maskPattern) {
    // x = col, y = row
    const x = col;
    const y = row;

    switch(maskPattern) {
        case 0:
            return (x + y) % 2 === 0;
        case 1:
            return y % 2 === 0;
        case 2:
            return x % 3 === 0;
        case 3:
            return (x + y) % 3 === 0;
        case 4:
            return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
        case 5:
            return ((x * y) % 2) + ((x * y) % 3) === 0;
        case 6:
            return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
        case 7:
            return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
        default:
            return false;
    }
}

// Unmask the QR code data
function unmaskQRCode() {
    if (!moduleMatrix || currentMaskPattern < 0 || isUnmasked) return;

    const moduleCount = moduleMatrix.length;

    // Flip modules based on mask pattern (skip function modules)
    for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
            // Skip function modules
            if (isFunctionModule(row, col, moduleCount)) continue;

            // Check if this module should be flipped
            if (shouldFlipModule(row, col, currentMaskPattern)) {
                moduleMatrix[row][col] = !moduleMatrix[row][col];
            }
        }
    }

    // Mark as unmasked and disable button
    isUnmasked = true;
    const unmaskButton = document.getElementById('unmaskButton');
    unmaskButton.disabled = true;

    // Reset recovery state since data values changed after unmasking
    dataPositions = [];
    bitstreamIndex = 0;
    recoveredBitstream = '';
    currentHighlight = [];
    isBitstreamRecovered = false;
    updateBitstreamOutput();

    // Enable decode mode button after unmasking
    const decodeModeButton = document.getElementById('decodeModeButton');
    decodeModeButton.disabled = true;

    // Allow bitstream recovery right after unmasking
    const recoverAllButton = document.getElementById('recoverAllButton');
    const nextByteButton = document.getElementById('nextByteButton');
    if (recoverAllButton && nextByteButton) {
        recoverAllButton.disabled = false;
        nextByteButton.disabled = false;
    }

    updateDeinterleaveAvailability();

    // Redraw the cleaned QR
    drawCleanQR();
}

// Extract format information from QR code
function extractFormatInfo() {
    if (!moduleMatrix) return null;

    // Format information is 15 bits stored in two locations
    // Location 1: Around top-left finder pattern
    const formatBits = [];

    // Read format bits from around top-left finder
    // Bits 0-5: vertical strip next to top-left finder
    for (let i = 0; i <= 5; i++) {
        formatBits.push(moduleMatrix[8][i] ? 1 : 0);
    }
    // Bit 6: skip timing pattern at (8,6)
    // Bits 7-8: continue vertical
    formatBits.push(moduleMatrix[8][7] ? 1 : 0);
    formatBits.push(moduleMatrix[8][8] ? 1 : 0);

    // Bits 9-14: horizontal strip below top-left finder
    formatBits.push(moduleMatrix[7][8] ? 1 : 0);
    formatBits.push(moduleMatrix[5][8] ? 1 : 0);
    formatBits.push(moduleMatrix[4][8] ? 1 : 0);
    formatBits.push(moduleMatrix[3][8] ? 1 : 0);
    formatBits.push(moduleMatrix[2][8] ? 1 : 0);
    formatBits.push(moduleMatrix[1][8] ? 1 : 0);
    formatBits.push(moduleMatrix[0][8] ? 1 : 0);

    return formatBits;
}

// Decode format information
function decodeFormatInfo(formatBits) {
    if (!formatBits || formatBits.length < 15) return null;

    // XOR mask that's applied to format info
    const mask = 0b101010000010010;

    // Convert bits to number
    let formatValue = 0;
    for (let i = 0; i < 15; i++) {
        formatValue = (formatValue << 1) | formatBits[i];
    }

    // Remove mask
    formatValue ^= mask;

    // Extract ECC level (bits 14-13, which are now at positions 0-1 after shift)
    const eccBits = (formatValue >> 13) & 0b11;
    const eccLevels = ['M', 'L', 'H', 'Q'];
    const eccLevel = eccLevels[eccBits];

    // Extract mask pattern (bits 12-10, which are now at positions 2-4)
    const maskBits = (formatValue >> 10) & 0b111;

    return {
        eccLevel: eccLevel,
        maskPattern: maskBits
    };
}
