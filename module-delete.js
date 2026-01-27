// Module Edit/Delete Editor for QR Code Workbench
// Allows users to delete or modify codewords to utilize error correction capacity

// ========== STATE MANAGEMENT ==========
let deleteState = {
    editMode: 'delete', // 'delete' or 'modify'
    deletedModuleColor: '#ff0000',
    deletedCodewords: new Set(), // Set of codeword indices that are deleted
    modifiedCodewords: new Map(), // Map of codewordIndex -> modified byte value
    hoveredCodewordIndex: null, // Currently hovered codeword index
    hoveredBlockIndex: null, // Currently hovered block index
    codewordMap: null, // Map from codeword index to {positions, isEcc, blockIndex, byteValue}
    blockInfo: [], // Array of {dataCount, eccCount, deletedCount, color}
    totalCodewords: 0,
    maskPattern: 0, // Current mask pattern (0-7) for applying to modified bits
    blockColors: [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
        '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#ABEBC6'
    ] // Colors for different blocks (cycles if more than 10 blocks)
};

// ========== CODEWORD MAPPING ==========

/**
 * Interleave blocks and track which block each byte came from
 */
function interleaveBlocksWithTracking(blocks) {
    const result = [];

    // Find the maximum data and ECC lengths
    const maxDataLen = Math.max(...blocks.map(b => b.data.length));
    const maxEccLen = Math.max(...blocks.map(b => b.ecc.length));

    // Interleave data bytes
    for (let i = 0; i < maxDataLen; i++) {
        blocks.forEach((block, blockIndex) => {
            if (i < block.data.length) {
                result.push({
                    value: block.data[i],
                    blockIndex: blockIndex,
                    isEcc: false
                });
            }
        });
    }

    // Interleave ECC bytes
    for (let i = 0; i < maxEccLen; i++) {
        blocks.forEach((block, blockIndex) => {
            if (i < block.ecc.length) {
                result.push({
                    value: block.ecc[i],
                    blockIndex: blockIndex,
                    isEcc: true
                });
            }
        });
    }

    return result;
}

/**
 * Build a map from codeword index to module positions in the matrix
 * This traces where each byte of interleaved data ends up in the QR code
 */
function buildCodewordModuleMap() {
    if (!encodedBitstream || !encodedBitstream.blocks || !currentMatrix) {
        console.error('Missing required data for codeword mapping');
        return null;
    }

    const blocks = encodedBitstream.blocks;
    const version = currentVersion;
    const size = currentMatrix.length;

    // Build block info
    deleteState.blockInfo = blocks.map((block, index) => ({
        dataCount: block.data.length,
        eccCount: block.eccCount,
        deletedCount: 0,
        color: deleteState.blockColors[index % deleteState.blockColors.length]
    }));

    // Interleave all bytes (data + ECC) and track which block each byte came from
    const interleavedWithBlocks = interleaveBlocksWithTracking(blocks);

    const totalCodewords = interleavedWithBlocks.length;
    deleteState.totalCodewords = totalCodewords;

    // Create a map: codeword index -> codeword data
    const codewordMap = new Map();

    for (let codewordIndex = 0; codewordIndex < totalCodewords; codewordIndex++) {
        const interleavedData = interleavedWithBlocks[codewordIndex];
        const byteValue = interleavedData.value;
        const blockIndex = interleavedData.blockIndex;
        const isEcc = interleavedData.isEcc;

        // Find the module positions for this byte's 8 bits
        const modulePositions = [];

        // Calculate bit offset in the total bitstream
        const bitOffset = codewordIndex * 8;

        for (let bitIndex = 0; bitIndex < 8; bitIndex++) {
            const globalBitIndex = bitOffset + bitIndex;
            const modulePos = getModulePositionForBit(globalBitIndex, size, version);
            if (modulePos) {
                modulePositions.push(modulePos);
            }
        }

        codewordMap.set(codewordIndex, {
            positions: modulePositions,
            blockIndex: blockIndex,
            isEcc: isEcc,
            byteValue: byteValue
        });
    }

    return codewordMap;
}

/**
 * Get the module position (row, col) for a given bit index in the interleaved bitstream
 * This reverses the zigzag placement algorithm
 */
function getModulePositionForBit(bitIndex, size, version) {
    let bitCounter = 0;
    let col = size - 1;
    let direction = -1; // -1 for up, 1 for down

    while (col >= 0) {
        // Skip timing column
        if (col === 6) {
            col--;
            continue;
        }

        // Process two columns at a time (right, then left)
        for (let row = (direction === -1 ? size - 1 : 0);
             direction === -1 ? row >= 0 : row < size;
             row += direction) {

            // Right column
            if (!isFunctionModule(row, col, size, version)) {
                if (bitCounter === bitIndex) {
                    return { row, col };
                }
                bitCounter++;
            }

            // Left column
            if (!isFunctionModule(row, col - 1, size, version)) {
                if (bitCounter === bitIndex) {
                    return { row, col: col - 1 };
                }
                bitCounter++;
            }
        }

        col -= 2;
        direction *= -1;
    }

    return null;
}

/**
 * Get the codeword index for a given module position
 */
function getCodewordIndexForModule(row, col) {
    if (!deleteState.codewordMap) return null;

    for (const [codewordIndex, codewordData] of deleteState.codewordMap.entries()) {
        if (codewordData.positions.some(pos => pos.row === row && pos.col === col)) {
            return codewordIndex;
        }
    }

    return null;
}

function getBitIndexForModule(row, col, codewordIndex) {
    if (!deleteState.codewordMap) return null;
    const codewordData = deleteState.codewordMap.get(codewordIndex);
    if (!codewordData) return null;
    return codewordData.positions.findIndex(pos => pos.row === row && pos.col === col);
}

function getOriginalCodewordByte(codewordIndex) {
    if (!deleteState.codewordMap) return 0;
    const codewordData = deleteState.codewordMap.get(codewordIndex);
    return codewordData ? codewordData.byteValue : 0;
}

function getModifiedCodewordByte(codewordIndex) {
    if (deleteState.modifiedCodewords.has(codewordIndex)) {
        return deleteState.modifiedCodewords.get(codewordIndex);
    }
    return getOriginalCodewordByte(codewordIndex);
}

function refreshBlockCounts() {
    if (!deleteState.blockInfo) return;
    deleteState.blockInfo.forEach(block => {
        block.deletedCount = 0;
    });

    if (deleteState.editMode === 'delete') {
        deleteState.deletedCodewords.forEach(codewordIndex => {
            const blockIndex = getBlockIndexForCodeword(codewordIndex);
            if (blockIndex !== null && deleteState.blockInfo[blockIndex]) {
                deleteState.blockInfo[blockIndex].deletedCount++;
            }
        });
    } else {
        deleteState.modifiedCodewords.forEach((_, codewordIndex) => {
            const blockIndex = getBlockIndexForCodeword(codewordIndex);
            if (blockIndex !== null && deleteState.blockInfo[blockIndex]) {
                deleteState.blockInfo[blockIndex].deletedCount++;
            }
        });
    }
}

/**
 * Get the block index for a codeword
 */
function getBlockIndexForCodeword(codewordIndex) {
    if (!deleteState.codewordMap) return null;
    const codewordData = deleteState.codewordMap.get(codewordIndex);
    return codewordData ? codewordData.blockIndex : null;
}

/**
 * Check if a codeword is an ECC codeword
 */
function isEccCodeword(codewordIndex) {
    if (!deleteState.codewordMap) return false;
    const codewordData = deleteState.codewordMap.get(codewordIndex);
    return codewordData ? codewordData.isEcc : false;
}

// ========== RENDERING ==========

/**
 * Render the delete canvas using Size & Color styling
 */
function renderDeleteCanvas(options = {}) {
    const canvas = options.canvas || document.getElementById('deleteCanvas');
    const showOverlays = options.showOverlays !== false;
    if (!canvas || !currentMatrix) return;

    // Check if Size & Color editor has been initialized
    if (typeof sizeColorState === 'undefined' || typeof renderSizeColorQR === 'undefined') {
        console.warn('Size & Color editor not available, using basic rendering');
        renderDeleteCanvasBasic();
        return;
    }

    const ctx = canvas.getContext('2d');
    const size = currentMatrix.length;
    const canvasSize = 600;

    // Use Size & Color settings
    const quietZone = sizeColorState.quietZone;
    const totalSize = size + (quietZone * 2);
    const modulePixelSize = canvasSize / totalSize;
    const offsetPixels = quietZone * modulePixelSize;
    const sizeFraction = sizeColorState.moduleSize / 100;
    const quietZoneColor = typeof getSizeColorQuietZoneColor === 'function'
        ? getSizeColorQuietZoneColor()
        : '#ffffff';

    canvas.width = canvasSize;
    canvas.height = canvasSize;

    const qrAreaSize = size * modulePixelSize;

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

    // Get finder pattern colors from state
    const finderOuterColor = sizeColorState.finderOuterColor;
    const finderMiddleColor = sizeColorState.finderMiddleColor;
    const finderCenterColor = sizeColorState.finderCenterColor;

    // STEP 2: Background modules layer (when logo has transparency)
    if (sizeColorState.logoImg && sizeColorState.logoHasTransparency && typeof drawModuleLayer === 'function') {
        const bgSizeFraction = sizeColorState.backgroundModuleSize / 100;
        drawModuleLayer(ctx, modulePixelSize, offsetPixels, size, bgSizeFraction,
                       sizeColorState.backgroundModuleShape, true);

        // Draw finder patterns for background layer
        if (typeof drawCustomFinderPattern === 'function') {
            drawCustomFinderPattern(ctx, 0, 0, modulePixelSize, offsetPixels,
                                   finderOuterColor, finderMiddleColor, finderCenterColor, bgSizeFraction, size);
            drawCustomFinderPattern(ctx, 0, size - 7, modulePixelSize, offsetPixels,
                                   finderOuterColor, finderMiddleColor, finderCenterColor, bgSizeFraction, size);
            drawCustomFinderPattern(ctx, size - 7, 0, modulePixelSize, offsetPixels,
                                   finderOuterColor, finderMiddleColor, finderCenterColor, bgSizeFraction, size);
        }
    }

    // STEP 3: Logo (sandwiched between module layers)
    if (sizeColorState.logoImg) {
        ctx.save();
        ctx.translate(offsetPixels, offsetPixels);
        if (typeof drawSizeColorLogoBackground === 'function') {
            drawSizeColorLogoBackground(ctx, qrAreaSize, qrAreaSize);
        }
        ctx.restore();
    }

    // Re-apply quiet zone after logo to prevent bleed
    if (typeof drawSizeColorQuietZoneOverlay === 'function') {
        drawSizeColorQuietZoneOverlay(ctx, canvasSize, modulePixelSize, quietZone, quietZoneColor);
    } else if (quietZone > 0) {
        const quietZonePixels = quietZone * modulePixelSize;
        ctx.fillStyle = quietZoneColor;
        ctx.fillRect(0, 0, canvasSize, quietZonePixels);
        ctx.fillRect(0, canvasSize - quietZonePixels, canvasSize, quietZonePixels);
        ctx.fillRect(0, 0, quietZonePixels, canvasSize);
        ctx.fillRect(canvasSize - quietZonePixels, 0, quietZonePixels, canvasSize);
    }

    // STEP 4: Foreground modules using Size & Color styling
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            const codewordIndex = getCodewordIndexForModule(row, col);

            // Check if this module is deleted - if so, skip drawing it
            const isDeleted = deleteState.editMode === 'delete' &&
                codewordIndex !== null &&
                deleteState.deletedCodewords.has(codewordIndex);

            if (isDeleted) continue; // Don't draw deleted modules at all

            const isFinderOnly = typeof isFinderPatternOnly === 'function' ? isFinderPatternOnly(row, col, size) : false;
            if (isFinderOnly) continue;

            const isSeparator = typeof isSeparatorModule === 'function' ? isSeparatorModule(row, col, size) : false;

            // Skip separators if using rounded finders with full separators
            if (isSeparator && sizeColorState.finderShape === 'rounded' && sizeColorState.fullSizeSeparators) {
                continue;
            }

            const moduleX = offsetPixels + (col * modulePixelSize);
            const moduleY = offsetPixels + (row * modulePixelSize);
            let isDark = currentMatrix[row][col];
            if (codewordIndex !== null && deleteState.modifiedCodewords.has(codewordIndex)) {
                const bitIndex = getBitIndexForModule(row, col, codewordIndex);
                if (bitIndex !== null && bitIndex >= 0) {
                    const byteValue = getModifiedCodewordByte(codewordIndex);
                    // Get the raw (unmasked) bit value
                    const rawBit = ((byteValue >> (7 - bitIndex)) & 1) === 1;
                    // Apply mask pattern to get the display value
                    const maskFlip = shouldFlipModule(row, col, deleteState.maskPattern);
                    isDark = maskFlip ? !rawBit : rawBit;
                }
            }

            let currentSizeFraction;
            let currentShape;

            if (isSeparator && sizeColorState.fullSizeSeparators && sizeColorState.finderShape !== 'rounded') {
                currentSizeFraction = 1.0;
                currentShape = 'square';
            } else {
                currentSizeFraction = sizeFraction;
                currentShape = sizeColorState.moduleShape;
            }

            const moduleCenterX = (col * modulePixelSize) + modulePixelSize / 2;
            const moduleCenterY = (row * modulePixelSize) + modulePixelSize / 2;

            let color;
            if (isSeparator && sizeColorState.fullSizeSeparators && sizeColorState.finderShape !== 'rounded') {
                // Full-size separators use the middle (light) finder color
                color = finderMiddleColor;
            } else {
                const qrAreaSize = size * modulePixelSize;
                color = typeof getSizeColorModuleColor === 'function'
                    ? getSizeColorModuleColor(moduleCenterX, moduleCenterY, isDark, qrAreaSize)
                    : (isDark ? '#000000' : '#ffffff');
            }

            const shouldRemoveGridLines = isSeparator && sizeColorState.fullSizeSeparators && sizeColorState.finderShape !== 'rounded';

            if (typeof drawStyledModule === 'function') {
                drawStyledModule(ctx, moduleX, moduleY, modulePixelSize, modulePixelSize,
                    color, currentShape, currentSizeFraction, shouldRemoveGridLines);
            } else {
                ctx.fillStyle = color;
                ctx.fillRect(moduleX, moduleY, modulePixelSize, modulePixelSize);
            }
        }
    }

    // Draw custom finder patterns
    if (typeof drawCustomFinderPattern === 'function') {
        drawCustomFinderPattern(ctx, 0, 0, modulePixelSize, offsetPixels, finderOuterColor, finderMiddleColor, finderCenterColor, sizeFraction, size);
        drawCustomFinderPattern(ctx, 0, size - 7, modulePixelSize, offsetPixels, finderOuterColor, finderMiddleColor, finderCenterColor, sizeFraction, size);
        drawCustomFinderPattern(ctx, size - 7, 0, modulePixelSize, offsetPixels, finderOuterColor, finderMiddleColor, finderCenterColor, sizeFraction, size);
    }

    if (showOverlays) {
        // Now overlay hover highlights and deleted indicators
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                const codewordIndex = getCodewordIndexForModule(row, col);

                // Check if this module is deleted
                const isDeleted = deleteState.editMode === 'delete' &&
                    codewordIndex !== null &&
                    deleteState.deletedCodewords.has(codewordIndex);

                // Check if this module is being hovered
                const isHovered = codewordIndex !== null &&
                    codewordIndex === deleteState.hoveredCodewordIndex;

                const isModified = codewordIndex !== null &&
                    deleteState.modifiedCodewords.has(codewordIndex);

                const moduleX = offsetPixels + (col * modulePixelSize);
                const moduleY = offsetPixels + (row * modulePixelSize);

                // Draw red outline for deleted modules (original color still visible)
                if (isDeleted && !isHovered) {
                    ctx.strokeStyle = '#ff0000';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(moduleX + 1, moduleY + 1, modulePixelSize - 2, modulePixelSize - 2);
                }

                // Draw blue outline for modified modules in modify mode
                if (deleteState.editMode === 'modify' && isModified && !isHovered) {
                    ctx.strokeStyle = '#2563eb';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(moduleX + 1, moduleY + 1, modulePixelSize - 2, modulePixelSize - 2);
                }

                // Draw outline for hovered modules (block color outline)
                if (isHovered) {
                    let strokeColor;
                    if (codewordIndex !== null) {
                        const blockIndex = getBlockIndexForCodeword(codewordIndex);
                        if (blockIndex !== null && deleteState.blockInfo[blockIndex]) {
                            strokeColor = deleteState.blockInfo[blockIndex].color;
                        } else {
                            strokeColor = '#ffff00'; // Fallback yellow
                        }
                    } else {
                        strokeColor = '#ffff00'; // Fallback yellow
                    }

                    // Draw outline
                    ctx.strokeStyle = strokeColor;
                    ctx.lineWidth = 2;
                    ctx.strokeRect(moduleX + 1, moduleY + 1, modulePixelSize - 2, modulePixelSize - 2);

                    // If deleted and hovered, add inner red outline to show both states
                    if (isDeleted) {
                        ctx.strokeStyle = '#ff0000';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(moduleX + 3, moduleY + 3, modulePixelSize - 6, modulePixelSize - 6);
                    }

                    // If modified and hovered in modify mode, add inner blue outline
                    if (deleteState.editMode === 'modify' && isModified) {
                        ctx.strokeStyle = '#2563eb';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(moduleX + 3, moduleY + 3, modulePixelSize - 6, modulePixelSize - 6);
                    }
                }
            }
        }
    }
}

/**
 * Fallback basic rendering if Size & Color not available
 */
function renderDeleteCanvasBasic(options = {}) {
    const canvas = options.canvas || document.getElementById('deleteCanvas');
    const showOverlays = options.showOverlays !== false;
    if (!canvas || !currentMatrix) return;

    const ctx = canvas.getContext('2d');
    const moduleSize = 10;
    const size = currentMatrix.length;

    canvas.width = size * moduleSize;
    canvas.height = size * moduleSize;

    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            const codewordIndex = getCodewordIndexForModule(row, col);
            const isDeleted = deleteState.editMode === 'delete' &&
                codewordIndex !== null &&
                deleteState.deletedCodewords.has(codewordIndex);

            if (isDeleted) continue;

            let isDark = currentMatrix[row][col];
            if (codewordIndex !== null && deleteState.modifiedCodewords.has(codewordIndex)) {
                const bitIndex = getBitIndexForModule(row, col, codewordIndex);
                if (bitIndex !== null && bitIndex >= 0) {
                    const byteValue = getModifiedCodewordByte(codewordIndex);
                    // Get the raw (unmasked) bit value
                    const rawBit = ((byteValue >> (7 - bitIndex)) & 1) === 1;
                    // Apply mask pattern to get the display value
                    const maskFlip = shouldFlipModule(row, col, deleteState.maskPattern);
                    isDark = maskFlip ? !rawBit : rawBit;
                }
            }

            ctx.fillStyle = isDark ? 'black' : 'white';
            ctx.fillRect(col * moduleSize, row * moduleSize, moduleSize, moduleSize);

            ctx.strokeStyle = '#ddd';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(col * moduleSize, row * moduleSize, moduleSize, moduleSize);
        }
    }

    if (showOverlays) {
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                const codewordIndex = getCodewordIndexForModule(row, col);
                const isDeleted = deleteState.editMode === 'delete' &&
                    codewordIndex !== null &&
                    deleteState.deletedCodewords.has(codewordIndex);
                const isModified = codewordIndex !== null &&
                    deleteState.modifiedCodewords.has(codewordIndex);
                const isHovered = codewordIndex !== null &&
                    codewordIndex === deleteState.hoveredCodewordIndex;

                const x = col * moduleSize;
                const y = row * moduleSize;

                if (isDeleted && !isHovered) {
                    ctx.strokeStyle = '#ff0000';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x + 1, y + 1, moduleSize - 2, moduleSize - 2);
                }

                if (deleteState.editMode === 'modify' && isModified && !isHovered) {
                    ctx.strokeStyle = '#2563eb';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x + 1, y + 1, moduleSize - 2, moduleSize - 2);
                }

                if (isHovered) {
                    ctx.strokeStyle = '#ffff00';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x + 1, y + 1, moduleSize - 2, moduleSize - 2);

                    if (isDeleted) {
                        ctx.strokeStyle = '#ff0000';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(x + 3, y + 3, moduleSize - 6, moduleSize - 6);
                    }

                    if (deleteState.editMode === 'modify' && isModified) {
                        ctx.strokeStyle = '#2563eb';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(x + 3, y + 3, moduleSize - 6, moduleSize - 6);
                    }
                }
            }
        }
    }
}

function downloadDeleteCanvasClean() {
    const sourceCanvas = document.getElementById('deleteCanvas');
    if (!sourceCanvas || !currentMatrix) return;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = sourceCanvas.width;
    exportCanvas.height = sourceCanvas.height;

    if (typeof sizeColorState === 'undefined' || typeof renderSizeColorQR === 'undefined') {
        renderDeleteCanvasBasic({ canvas: exportCanvas, showOverlays: false });
    } else {
        renderDeleteCanvas({ canvas: exportCanvas, showOverlays: false });
    }

    const dataURL = exportCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'qr-code-clean.png';
    link.href = dataURL;
    link.click();
}

// ========== EVENT HANDLERS ==========

/**
 * Set up event handlers for the delete canvas
 */
function setupDeleteCanvasEvents() {
    const canvas = document.getElementById('deleteCanvas');
    if (!canvas) return;

    // Mouse move - highlight codeword
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();

        // Get mouse position relative to canvas
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Scale from display size to internal canvas size
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = mouseX * scaleX;
        const y = mouseY * scaleY;

        // Calculate module position accounting for quiet zone
        const size = currentMatrix.length;
        const canvasSize = 600;
        const quietZone = typeof sizeColorState !== 'undefined' ? sizeColorState.quietZone : 2;
        const totalSize = size + (quietZone * 2);
        const modulePixelSize = canvasSize / totalSize;
        const offsetPixels = quietZone * modulePixelSize;

        const col = Math.floor((x - offsetPixels) / modulePixelSize);
        const row = Math.floor((y - offsetPixels) / modulePixelSize);

        if (row >= 0 && row < size && col >= 0 && col < size) {
            const codewordIndex = getCodewordIndexForModule(row, col);
            const blockIndex = codewordIndex !== null ? getBlockIndexForCodeword(codewordIndex) : null;

            if (codewordIndex !== deleteState.hoveredCodewordIndex || blockIndex !== deleteState.hoveredBlockIndex) {
                deleteState.hoveredCodewordIndex = codewordIndex;
                deleteState.hoveredBlockIndex = blockIndex;
                updateHoverIndicator();
                renderDeleteCanvas();
            }
        }
    });

    // Mouse leave - clear highlight
    canvas.addEventListener('mouseleave', () => {
        deleteState.hoveredCodewordIndex = null;
        deleteState.hoveredBlockIndex = null;
        updateHoverIndicator();
        renderDeleteCanvas();
    });

    // Click - toggle deletion
    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();

        // Get mouse position relative to canvas
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Scale from display size to internal canvas size
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = mouseX * scaleX;
        const y = mouseY * scaleY;

        // Calculate module position accounting for quiet zone
        const size = currentMatrix.length;
        const canvasSize = 600;
        const quietZone = typeof sizeColorState !== 'undefined' ? sizeColorState.quietZone : 2;
        const totalSize = size + (quietZone * 2);
        const modulePixelSize = canvasSize / totalSize;
        const offsetPixels = quietZone * modulePixelSize;

        const col = Math.floor((x - offsetPixels) / modulePixelSize);
        const row = Math.floor((y - offsetPixels) / modulePixelSize);

        if (row >= 0 && row < size && col >= 0 && col < size) {
            const codewordIndex = getCodewordIndexForModule(row, col);
            if (codewordIndex === null) return;

            if (deleteState.editMode === 'delete') {
                const blockIndex = getBlockIndexForCodeword(codewordIndex);

                // Toggle deletion
                if (deleteState.deletedCodewords.has(codewordIndex)) {
                    // Restore the codeword
                    deleteState.deletedCodewords.delete(codewordIndex);
                    if (blockIndex !== null && deleteState.blockInfo[blockIndex]) {
                        deleteState.blockInfo[blockIndex].deletedCount--;
                    }
                } else {
                    // Check if we can delete from this block
                    if (blockIndex !== null && deleteState.blockInfo[blockIndex]) {
                        const block = deleteState.blockInfo[blockIndex];
                        const maxErrors = Math.floor(block.eccCount / 2);

                        if (block.deletedCount >= maxErrors) {
                            // Beyond error correction capacity - require confirmation
                            const confirmMsg = block.deletedCount >= maxErrors
                                ? `Warning: Block ${blockIndex + 1} is at or beyond error correction capacity!\n\n` +
                                  `Max correctable errors: ${maxErrors}\n` +
                                  `Currently deleted: ${block.deletedCount}\n\n` +
                                  `Deleting more codewords will likely make the QR code unscannable.\n\n` +
                                  `Continue anyway?`
                                : null;

                            if (confirmMsg && !confirm(confirmMsg)) {
                                return;
                            }
                        }
                        deleteState.deletedCodewords.add(codewordIndex);
                        block.deletedCount++;
                    } else {
                        deleteState.deletedCodewords.add(codewordIndex);
                    }
                }
            } else {
                const bitIndex = getBitIndexForModule(row, col, codewordIndex);
                if (bitIndex === null || bitIndex < 0) return;

                const originalByte = getOriginalCodewordByte(codewordIndex);
                const currentByte = getModifiedCodewordByte(codewordIndex);
                const toggledByte = currentByte ^ (1 << (7 - bitIndex));

                if (toggledByte === originalByte) {
                    if (deleteState.modifiedCodewords.has(codewordIndex)) {
                        deleteState.modifiedCodewords.delete(codewordIndex);
                        const blockIndex = getBlockIndexForCodeword(codewordIndex);
                        if (blockIndex !== null && deleteState.blockInfo[blockIndex]) {
                            deleteState.blockInfo[blockIndex].deletedCount--;
                        }
                    }
                } else {
                    if (!deleteState.modifiedCodewords.has(codewordIndex)) {
                        const blockIndex = getBlockIndexForCodeword(codewordIndex);
                        if (blockIndex !== null && deleteState.blockInfo[blockIndex]) {
                            deleteState.blockInfo[blockIndex].deletedCount++;
                        }
                    }
                    deleteState.modifiedCodewords.set(codewordIndex, toggledByte);
                }
            }

            updateDeleteInfo();
            renderDeleteCanvas();
        }
    });

    // Edit mode
    document.getElementById('deleteInteractionMode')?.addEventListener('change', (e) => {
        deleteState.editMode = e.target.value;
        refreshBlockCounts();
        updateDeleteInfo();
        renderDeleteCanvas();
    });
}

/**
 * Update the hover indicator to show which block is being hovered
 */
function updateHoverIndicator() {
    const indicator = document.getElementById('hoverBlockIndicator');
    if (!indicator) return;

    if (deleteState.hoveredBlockIndex !== null && deleteState.blockInfo[deleteState.hoveredBlockIndex]) {
        const block = deleteState.blockInfo[deleteState.hoveredBlockIndex];
        const isEcc = deleteState.hoveredCodewordIndex !== null && isEccCodeword(deleteState.hoveredCodewordIndex);
        const codewordType = isEcc ? 'ECC' : 'Data';
        const maxErrors = Math.floor(block.eccCount / 2);
        const status = getBlockDeletionStatus(block.deletedCount, block.eccCount);

        indicator.style.display = 'block';
        indicator.style.background = status.bgColor;
        indicator.style.borderLeft = `4px solid ${block.color}`;
        const countLabel = deleteState.editMode === 'modify' ? 'modified' : 'deleted';
        indicator.innerHTML = `
            <div style="font-weight: bold; color: ${block.color};">Block ${deleteState.hoveredBlockIndex + 1}</div>
            <div style="font-size: 10px;">${codewordType} Codeword</div>
            <div style="font-size: 10px; color: ${status.color}; font-weight: bold;">${block.deletedCount}/${maxErrors} ${countLabel}</div>
            <div style="font-size: 9px; color: ${status.color};">${status.label}</div>
        `;
    } else {
        indicator.style.display = 'none';
    }
}

/**
 * Get the status color and label for a block's deletion count
 * Based on Reed-Solomon error correction capacity: maxErrors = floor(eccCount / 2)
 */
function getBlockDeletionStatus(deletedCount, eccCount) {
    const maxErrors = Math.floor(eccCount / 2);

    if (deletedCount > maxErrors) {
        return {
            color: '#d32f2f',
            bgColor: '#ffcdd2',
            barColor: '#d32f2f',
            label: 'OVER LIMIT',
            status: 'danger'
        };
    } else if (deletedCount === maxErrors) {
        return {
            color: '#d32f2f',
            bgColor: '#ffcdd2',
            barColor: '#d32f2f',
            label: 'AT LIMIT',
            status: 'red'
        };
    } else if (deletedCount >= maxErrors - 2 && maxErrors > 2) {
        return {
            color: '#f57c00',
            bgColor: '#fff3e0',
            barColor: '#ff9800',
            label: 'WARNING',
            status: 'yellow'
        };
    } else {
        return {
            color: '#388e3c',
            bgColor: '#e8f5e9',
            barColor: '#4caf50',
            label: 'OK',
            status: 'green'
        };
    }
}

/**
 * Update the delete info panel
 */
function updateDeleteInfo() {
    const deletedCount = deleteState.editMode === 'modify'
        ? deleteState.modifiedCodewords.size
        : deleteState.deletedCodewords.size;

    document.getElementById('deleteInfoTotalCodewords').textContent = deleteState.totalCodewords;
    document.getElementById('deleteInfoDeletedCount').textContent = deletedCount;
    const labelEl = document.getElementById('deleteInfoCountLabel');
    if (labelEl) {
        labelEl.textContent = deleteState.editMode === 'modify' ? 'Total Modified:' : 'Total Deleted:';
    }

    // Update block legend
    const blockLegend = document.getElementById('blockLegend');
    if (blockLegend && deleteState.blockInfo) {
        let legendHtml = '';
        deleteState.blockInfo.forEach((block, index) => {
            const maxErrors = Math.floor(block.eccCount / 2);
            const percentage = maxErrors > 0 ? Math.min(100, (block.deletedCount / maxErrors) * 100).toFixed(0) : 0;
            const status = getBlockDeletionStatus(block.deletedCount, block.eccCount);

            legendHtml += `
                <div style="margin-bottom: 8px; padding: 6px; background: ${status.bgColor}; border-left: 4px solid ${block.color}; border-radius: 3px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>Block ${index + 1}</strong>
                            <div style="font-size: 10px; color: #666; margin-top: 2px;">
                                ${block.dataCount} data + ${block.eccCount} ECC
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-weight: bold; color: ${status.color};">
                                ${block.deletedCount} / ${maxErrors}
                            </div>
                            <div style="font-size: 10px; color: ${status.color}; font-weight: bold;">${status.label}</div>
                        </div>
                    </div>
                    <div style="background: #e0e0e0; height: 6px; border-radius: 3px; overflow: hidden; margin-top: 4px;">
                        <div style="background: ${status.barColor}; height: 100%; width: ${percentage}%; transition: width 0.3s;"></div>
                    </div>
                    <div style="font-size: 9px; color: #888; margin-top: 2px; text-align: right;">
                        max correctable: ${maxErrors}
                    </div>
                </div>
            `;
        });
        blockLegend.innerHTML = legendHtml;
    }
}

/**
 * Reset all deletions
 */
function resetAllDeletes() {
    if (deleteState.deletedCodewords.size === 0 && deleteState.modifiedCodewords.size === 0) {
        return;
    }

    if (confirm('Reset all changes?')) {
        deleteState.deletedCodewords.clear();
        deleteState.modifiedCodewords.clear();

        // Reset block deleted counts
        if (deleteState.blockInfo) {
            deleteState.blockInfo.forEach(block => {
                block.deletedCount = 0;
            });
        }

        updateDeleteInfo();
        renderDeleteCanvas();
    }
}

/**
 * Initialize the module delete editor
 */
function initModuleDeleteEditor() {
    if (!encodedBitstream || !encodedBitstream.blocks || !currentMatrix) {
        console.warn('Cannot initialize module delete editor: missing data');
        return;
    }

    // Store the current mask pattern for applying to modified bits
    const maskSelect = document.getElementById('maskPatternSelect');
    deleteState.maskPattern = maskSelect ? parseInt(maskSelect.value) : 0;

    // Build codeword mapping
    deleteState.codewordMap = buildCodewordModuleMap();

    if (!deleteState.codewordMap) {
        console.error('Failed to build codeword map');
        return;
    }

    // Don't clear deletions when switching tabs - they should persist
    deleteState.hoveredCodewordIndex = null;
    deleteState.hoveredBlockIndex = null;

    // Update block deleted counts based on current mode
    refreshBlockCounts();

    const modeSelect = document.getElementById('deleteInteractionMode');
    if (modeSelect) {
        modeSelect.value = deleteState.editMode;
    }

    // Update info panel
    updateDeleteInfo();

    // Set up event handlers (only once)
    if (!window.deleteEventsInitialized) {
        setupDeleteCanvasEvents();
        window.deleteEventsInitialized = true;
    }

    // Render
    renderDeleteCanvas();
}
