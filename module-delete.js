// Module Delete Editor for QR Code Workbench
// Allows users to delete data codewords to utilize error correction capacity

// ========== STATE MANAGEMENT ==========
let deleteState = {
    interactionMode: 'codeword', // 'codeword' or 'module'
    deletedModuleColor: '#ff0000',
    deletedCodewords: new Set(), // Set of codeword indices that are deleted
    deletedModules: new Set(), // Set of "row,col" strings for individual module deletion
    hoveredCodewordIndex: null, // Currently hovered codeword index
    hoveredModuleKey: null, // Currently hovered module "row,col"
    hoveredBlockIndex: null, // Currently hovered block index
    codewordMap: null, // Map from codeword index to {positions, isEcc, blockIndex, byteValue}
    blockInfo: [], // Array of {dataCount, eccCount, deletedCount, color}
    totalCodewords: 0,
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
function renderDeleteCanvas() {
    const canvas = document.getElementById('deleteCanvas');
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

    canvas.width = canvasSize;
    canvas.height = canvasSize;

    // Clear canvas with white (quiet zone)
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Draw logo background if available
    if (sizeColorState.logoImg) {
        ctx.save();
        ctx.translate(offsetPixels, offsetPixels);
        const qrAreaSize = size * modulePixelSize;
        if (typeof drawSizeColorLogoBackground === 'function') {
            drawSizeColorLogoBackground(ctx, qrAreaSize, qrAreaSize);
        }
        ctx.restore();
    }

    // Get finder pattern colors from state
    const finderOuterColor = sizeColorState.finderOuterColor;
    const finderMiddleColor = sizeColorState.finderMiddleColor;
    const finderCenterColor = sizeColorState.finderCenterColor;

    // Draw all modules using Size & Color styling
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            const moduleKey = `${row},${col}`;
            const codewordIndex = getCodewordIndexForModule(row, col);

            // Check if this module is deleted - if so, skip drawing it
            const isDeleted = (deleteState.interactionMode === 'codeword' &&
                              codewordIndex !== null &&
                              deleteState.deletedCodewords.has(codewordIndex)) ||
                             (deleteState.interactionMode === 'module' &&
                              deleteState.deletedModules.has(moduleKey));

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
            const isDark = currentMatrix[row][col];

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

    // Now overlay hover highlights only
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            const moduleKey = `${row},${col}`;
            const codewordIndex = getCodewordIndexForModule(row, col);

            // Check if this module is being hovered
            const isHovered = (deleteState.interactionMode === 'codeword' &&
                              codewordIndex !== null &&
                              codewordIndex === deleteState.hoveredCodewordIndex) ||
                             (deleteState.interactionMode === 'module' &&
                              moduleKey === deleteState.hoveredModuleKey);

            if (isHovered) {
                const moduleX = offsetPixels + (col * modulePixelSize);
                const moduleY = offsetPixels + (row * modulePixelSize);

                // Check if this codeword is deleted
                const isDeleted = (deleteState.interactionMode === 'codeword' &&
                                  codewordIndex !== null &&
                                  deleteState.deletedCodewords.has(codewordIndex)) ||
                                 (deleteState.interactionMode === 'module' &&
                                  deleteState.deletedModules.has(moduleKey));

                // Color by block
                let hoverColor;
                if (isDeleted) {
                    hoverColor = 'rgba(255, 0, 0, 0.5)'; // Red for deleted
                } else if (codewordIndex !== null) {
                    const blockIndex = getBlockIndexForCodeword(codewordIndex);
                    if (blockIndex !== null && deleteState.blockInfo[blockIndex]) {
                        const blockColor = deleteState.blockInfo[blockIndex].color;
                        // Convert hex to rgba with transparency
                        const hex = blockColor.replace('#', '');
                        const r = parseInt(hex.substr(0, 2), 16);
                        const g = parseInt(hex.substr(2, 2), 16);
                        const b = parseInt(hex.substr(4, 2), 16);
                        hoverColor = `rgba(${r}, ${g}, ${b}, 0.4)`;
                    } else {
                        hoverColor = 'rgba(255, 255, 0, 0.4)'; // Fallback
                    }
                } else {
                    hoverColor = 'rgba(255, 255, 0, 0.4)'; // Fallback
                }

                ctx.fillStyle = hoverColor;
                ctx.fillRect(moduleX, moduleY, modulePixelSize, modulePixelSize);
            }
        }
    }
}

/**
 * Fallback basic rendering if Size & Color not available
 */
function renderDeleteCanvasBasic() {
    const canvas = document.getElementById('deleteCanvas');
    if (!canvas || !currentMatrix) return;

    const ctx = canvas.getContext('2d');
    const moduleSize = 10;
    const size = currentMatrix.length;

    canvas.width = size * moduleSize;
    canvas.height = size * moduleSize;

    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            const isDark = currentMatrix[row][col];
            ctx.fillStyle = isDark ? 'black' : 'white';
            ctx.fillRect(col * moduleSize, row * moduleSize, moduleSize, moduleSize);

            ctx.strokeStyle = '#ddd';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(col * moduleSize, row * moduleSize, moduleSize, moduleSize);
        }
    }
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
            if (deleteState.interactionMode === 'codeword') {
                const codewordIndex = getCodewordIndexForModule(row, col);
                const blockIndex = codewordIndex !== null ? getBlockIndexForCodeword(codewordIndex) : null;

                if (codewordIndex !== deleteState.hoveredCodewordIndex || blockIndex !== deleteState.hoveredBlockIndex) {
                    deleteState.hoveredCodewordIndex = codewordIndex;
                    deleteState.hoveredBlockIndex = blockIndex;
                    updateHoverIndicator();
                    renderDeleteCanvas();
                }
            } else {
                const moduleKey = `${row},${col}`;
                if (moduleKey !== deleteState.hoveredModuleKey) {
                    deleteState.hoveredModuleKey = moduleKey;
                    renderDeleteCanvas();
                }
            }
        }
    });

    // Mouse leave - clear highlight
    canvas.addEventListener('mouseleave', () => {
        deleteState.hoveredCodewordIndex = null;
        deleteState.hoveredModuleKey = null;
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
            if (deleteState.interactionMode === 'codeword') {
                const codewordIndex = getCodewordIndexForModule(row, col);
                if (codewordIndex !== null) {
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
                            if (block.deletedCount >= block.eccCount) {
                                alert(`Cannot delete more codewords from Block ${blockIndex + 1}.\nECC capacity: ${block.eccCount}\nAlready deleted: ${block.deletedCount}`);
                                return;
                            }
                            deleteState.deletedCodewords.add(codewordIndex);
                            block.deletedCount++;
                        } else {
                            deleteState.deletedCodewords.add(codewordIndex);
                        }
                    }
                    updateDeleteInfo();
                    renderDeleteCanvas();
                }
            } else {
                // Module mode
                const moduleKey = `${row},${col}`;
                if (deleteState.deletedModules.has(moduleKey)) {
                    deleteState.deletedModules.delete(moduleKey);
                } else {
                    deleteState.deletedModules.add(moduleKey);
                }
                updateDeleteInfo();
                renderDeleteCanvas();
            }
        }
    });

    // Interaction mode
    document.getElementById('deleteInteractionMode')?.addEventListener('change', (e) => {
        deleteState.interactionMode = e.target.value;
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

        indicator.style.display = 'block';
        indicator.style.background = block.color;
        indicator.innerHTML = `
            <div style="font-weight: bold;">Block ${deleteState.hoveredBlockIndex + 1}</div>
            <div style="font-size: 10px;">${codewordType} Codeword</div>
            <div style="font-size: 10px;">${block.deletedCount}/${block.eccCount} deleted</div>
        `;
    } else {
        indicator.style.display = 'none';
    }
}

/**
 * Update the delete info panel
 */
function updateDeleteInfo() {
    const deletedCount = deleteState.interactionMode === 'codeword'
        ? deleteState.deletedCodewords.size
        : Math.floor(deleteState.deletedModules.size / 8);

    document.getElementById('deleteInfoTotalCodewords').textContent = deleteState.totalCodewords;
    document.getElementById('deleteInfoDeletedCount').textContent = deletedCount;

    // Update block legend
    const blockLegend = document.getElementById('blockLegend');
    if (blockLegend && deleteState.blockInfo) {
        let legendHtml = '';
        deleteState.blockInfo.forEach((block, index) => {
            const percentage = block.eccCount > 0 ? ((block.deletedCount / block.eccCount) * 100).toFixed(0) : 0;
            const isAtCapacity = block.deletedCount >= block.eccCount;

            legendHtml += `
                <div style="margin-bottom: 8px; padding: 6px; background: ${isAtCapacity ? '#ffe0e0' : 'white'}; border-left: 4px solid ${block.color}; border-radius: 3px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>Block ${index + 1}</strong>
                            <div style="font-size: 10px; color: #666; margin-top: 2px;">
                                ${block.dataCount} data + ${block.eccCount} ECC
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-weight: bold; color: ${isAtCapacity ? '#d32f2f' : '#333'};">
                                ${block.deletedCount} / ${block.eccCount}
                            </div>
                            <div style="font-size: 10px; color: #666;">deleted</div>
                        </div>
                    </div>
                    <div style="background: #e0e0e0; height: 6px; border-radius: 3px; overflow: hidden; margin-top: 4px;">
                        <div style="background: ${block.color}; height: 100%; width: ${percentage}%; transition: width 0.3s;"></div>
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
    if (deleteState.deletedCodewords.size === 0 && deleteState.deletedModules.size === 0) {
        return;
    }

    if (confirm('Reset all deletions?')) {
        deleteState.deletedCodewords.clear();
        deleteState.deletedModules.clear();

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

    // Build codeword mapping
    deleteState.codewordMap = buildCodewordModuleMap();

    if (!deleteState.codewordMap) {
        console.error('Failed to build codeword map');
        return;
    }

    // Don't clear deletions when switching tabs - they should persist
    deleteState.hoveredCodewordIndex = null;
    deleteState.hoveredModuleKey = null;

    // Update block deleted counts based on current deletions
    if (deleteState.blockInfo) {
        deleteState.blockInfo.forEach(block => {
            block.deletedCount = 0;
        });

        deleteState.deletedCodewords.forEach(codewordIndex => {
            const blockIndex = getBlockIndexForCodeword(codewordIndex);
            if (blockIndex !== null && deleteState.blockInfo[blockIndex]) {
                deleteState.blockInfo[blockIndex].deletedCount++;
            }
        });
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
