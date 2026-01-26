// Visual Padding Editor for QR Code Workbench
// Allows users to visually edit padding codewords while keeping data/ECC modules locked

// ========== STATE MANAGEMENT ==========
let paddingModuleMap = null; // Map: padByteIndex → [{row, col, bitOffset}]
let editableCells = new Set(); // Set of "row,col" strings for padding modules
let paddingEdits = new Map(); // Map: "row,col" → boolean (true=black, false=white)
let originalPaddingBytes = null; // Store original padding bytes before any edits
let originalMatrix = null; // Store original matrix state (masked) before any edits
let isPainting = false;
let currentBrushMode = 'black'; // 'black' or 'white'
let paintUpdateTimeout = null;
let zoomRenderTimeout = null; // Separate timeout for zoom slider
let lastHighlightCell = null;
let isZooming = false; // Flag to prevent updates during zoom
let encodeTabNeedsRefresh = false; // Flag to indicate Encode tab needs updating

// Box selection state
let isBoxSelecting = false;
let boxSelectStart = null; // {row, col}
let boxSelectEnd = null; // {row, col}

// QR module opacity (0-1)
let qrModuleOpacity = 0.8;

// ========== PHASE 1: PADDING MODULE MAPPING ==========

// Identify which bytes in the bitstream are padding bytes
function identifyPaddingBytes(encodedBitstream) {
    // Calculate total message bits (everything before padding)
    const messageBits = encodedBitstream.modeIndicator.length +
                       encodedBitstream.charCount.length +
                       encodedBitstream.messageData.length +
                       encodedBitstream.terminator.length +
                       encodedBitstream.bytePadding.length;

    const messageBytes = Math.ceil(messageBits / 8);
    const paddingByteCount = encodedBitstream.padBytes.length;

    return {
        startByteIndex: messageBytes,
        endByteIndex: messageBytes + paddingByteCount,
        paddingByteIndices: Array.from(
            {length: paddingByteCount},
            (_, i) => messageBytes + i
        )
    };
}

// Track padding bytes through block split and interleaving
function trackPaddingThroughInterleaving(paddingByteIndices, blocks) {
    const paddingInBlocks = [];

    // CRITICAL: We need to track which original dataBytes index each block position corresponds to
    // Blocks are created by sequentially slicing dataBytes, so we need to track the offset

    let originalDataBytesOffset = 0; // Offset into the original dataBytes array

    blocks.forEach((block, blockIdx) => {
        block.data.forEach((byte, localByteIdx) => {
            const originalIndex = originalDataBytesOffset + localByteIdx;

            if (paddingByteIndices.includes(originalIndex)) {
                // This byte is padding! Find which padding byte index it is
                const paddingByteIndex = paddingByteIndices.indexOf(originalIndex);

                paddingInBlocks.push({
                    blockIndex: blockIdx,
                    localByteIndex: localByteIdx,
                    originalDataIndex: originalIndex,
                    paddingByteIndex: paddingByteIndex, // Index in the padBytes array (0, 1, 2, ...)
                    value: byte
                });
            }
        });

        // Move offset forward by this block's data length
        originalDataBytesOffset += block.data.length;
    });

    // Simulate interleaving to find position in interleaved array
    const paddingInInterleaved = [];
    const maxDataLen = Math.max(...blocks.map(b => b.data.length));

    let interleavedIndex = 0;
    for (let i = 0; i < maxDataLen; i++) {
        blocks.forEach((block, blockIdx) => {
            if (i < block.data.length) {
                // Check if this byte is padding
                const isPadding = paddingInBlocks.find(
                    p => p.blockIndex === blockIdx && p.localByteIndex === i
                );
                if (isPadding) {
                    paddingInInterleaved.push({
                        ...isPadding,
                        interleavedIndex
                    });
                }
                interleavedIndex++;
            }
        });
    }

    return paddingInInterleaved;
}

// Map an interleaved byte index to its module positions in the matrix
function mapInterleavedToModules(interleavedIndex, size, version) {
    // Each byte = 8 bits = 8 modules
    const startBitIndex = interleavedIndex * 8;
    const modulePositions = [];

    // Simulate the zigzag placement algorithm from encoder-core.js
    let bitIndex = 0;
    let direction = -1; // -1 = up, 1 = down
    let col = size - 1;

    while (col >= 1 && modulePositions.length < 8) {
        for (let count = 0; count < size && modulePositions.length < 8; count++) {
            let row = direction === -1 ? size - 1 - count : count;

            for (let c = 0; c < 2 && modulePositions.length < 8; c++) {
                const currentCol = col - c;

                // Check if this is a function module (skip if it is)
                if (!isFunctionModule(row, currentCol, size, version)) {
                    // This is a data module
                    if (bitIndex >= startBitIndex && bitIndex < startBitIndex + 8) {
                        modulePositions.push({
                            row,
                            col: currentCol,
                            bitOffset: bitIndex - startBitIndex
                        });
                    }
                    bitIndex++;
                }
            }
        }

        col -= 2;
        if (col === 6) col--; // Skip timing column
        direction *= -1;
    }

    return modulePositions;
}

// Build complete mapping: padding byte index → module positions
function buildPaddingModuleMap(encodedBitstream, blocks, version) {
    const size = 21 + (version - 1) * 4;
    const paddingInfo = identifyPaddingBytes(encodedBitstream);
    const paddingInterleaved = trackPaddingThroughInterleaving(
        paddingInfo.paddingByteIndices,
        blocks
    );

    const paddingModuleMap = new Map();

    paddingInterleaved.forEach((padInfo) => {
        const modules = mapInterleavedToModules(
            padInfo.interleavedIndex,
            size,
            version
        );
        // CRITICAL: Use paddingByteIndex (0, 1, 2, ...) not the loop index
        // This ensures we map to the correct index in encodedBitstream.padBytes
        paddingModuleMap.set(padInfo.paddingByteIndex, modules);
    });

    return paddingModuleMap;
}

// ========== PHASE 2: GRID RENDERING ==========

/**
 * Draw logo as background layer on the padding grid canvas
 * MUST match the positioning logic in sampleLogoAtPosition exactly
 */
function drawLogoBackground(ctx, canvasWidth, canvasHeight) {
    if (!logoBlendState || !logoBlendState.logoImg) return;

    const img = logoBlendState.logoImg;
    const scale = logoBlendState.logoScale / 100;

    // Calculate logo size maintaining aspect ratio
    // Use Math.min to match sampleLogoAtPosition
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

    // Center the logo (logoX and logoY are percentages)
    // Use canvasWidth/canvasHeight for positioning (should be same as canvasSize for square canvas)
    const logoX = (canvasWidth * logoBlendState.logoX / 100) - (logoWidth / 2);
    const logoY = (canvasHeight * logoBlendState.logoY / 100) - (logoHeight / 2);

    // Draw logo with slight transparency so QR modules are visible
    ctx.globalAlpha = 0.4;
    ctx.drawImage(img, logoX, logoY, logoWidth, logoHeight);
    ctx.globalAlpha = 1.0;

    // Debug: draw a small dot at the center of the logo
    if (false) { // Set to true to debug
        ctx.fillStyle = 'red';
        ctx.fillRect(logoX + logoWidth/2 - 2, logoY + logoHeight/2 - 2, 4, 4);
    }
}

function renderPaddingGrid() {
    const canvas = document.getElementById('paddingGrid');
    if (!canvas || !originalMatrix) return;

    const ctx = canvas.getContext('2d');
    const moduleSize = parseInt(document.getElementById('moduleScale').value);

    const size = originalMatrix.length;
    canvas.width = size * moduleSize;
    canvas.height = size * moduleSize;

    // Clear canvas with white
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Fill with background color based on transparentTreatment
    if (typeof logoBlendState !== 'undefined' && logoBlendState.transparentTreatment !== 'transparent') {
        const bgColor = logoBlendState.transparentTreatment === 'dark'
            ? (logoBlendState.darkPalette ? logoBlendState.darkPalette[0] : '#000000')
            : (logoBlendState.lightPalette ? logoBlendState.lightPalette[0] : '#ffffff');
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw logo as background layer if loaded
    if (typeof logoBlendState !== 'undefined' && logoBlendState.logoImg) {
        drawLogoBackground(ctx, canvas.width, canvas.height);
    }

    // Draw all modules
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            const cellKey = `${row},${col}`;
            const isEditable = editableCells.has(cellKey);

            // Get module value:
            // - For editable (padding) modules: show user's edits, or current state if not edited
            // - For locked (data/ECC/function) modules: show current state (with updated ECC)
            let moduleValue;
            if (isEditable && paddingEdits.has(cellKey)) {
                // User manually edited this padding module - show their edit
                moduleValue = paddingEdits.get(cellKey);
            } else if (currentMatrix) {
                // Show current state (includes recalculated ECC for locked modules)
                moduleValue = currentMatrix[row][col];
            } else {
                // Fallback to original if currentMatrix not available
                moduleValue = originalMatrix[row][col];
            }

            drawSingleModule(ctx, row, col, moduleValue, !isEditable, moduleSize);
        }
    }

    // Draw grid lines at full opacity
    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= size; i++) {
        ctx.beginPath();
        ctx.moveTo(i * moduleSize, 0);
        ctx.lineTo(i * moduleSize, canvas.height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i * moduleSize);
        ctx.lineTo(canvas.width, i * moduleSize);
        ctx.stroke();
    }
}

function drawSingleModule(ctx, row, col, isBlack, isLocked, moduleSize) {
    const x = col * moduleSize;
    const y = row * moduleSize;

    // Draw base module color with opacity
    ctx.globalAlpha = qrModuleOpacity;
    ctx.fillStyle = isBlack ? 'black' : 'white';
    ctx.fillRect(x, y, moduleSize, moduleSize);
    ctx.globalAlpha = 1.0;

    // Draw lock overlay if locked
    if (isLocked) {
        ctx.fillStyle = 'rgba(200, 200, 200, 0.6)';
        ctx.fillRect(x, y, moduleSize, moduleSize);
    }
}

function drawModuleHighlight(row, col) {
    const canvas = document.getElementById('paddingGrid');
    if (!canvas || !originalMatrix) return;

    const cellKey = `${row},${col}`;

    // Only redraw if we moved to a different cell
    if (lastHighlightCell === cellKey) {
        return;
    }

    // Re-render entire grid to clear any artifacts
    renderPaddingGrid();

    // Now draw the highlight on top
    const ctx = canvas.getContext('2d');
    const moduleSize = parseInt(document.getElementById('moduleScale').value);

    if (row < originalMatrix.length && col < originalMatrix.length) {
        const x = col * moduleSize;
        const y = row * moduleSize;

        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = '#4a9eff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, moduleSize - 2, moduleSize - 2);
    }

    lastHighlightCell = cellKey;
}

// ========== PHASE 3: PAINT MODE INTERACTION ==========

function setupPaddingGridInteractions() {
    const canvas = document.getElementById('paddingGrid');
    if (!canvas) return;

    canvas.addEventListener('mousedown', (e) => {
        if (e.shiftKey) {
            // Start box selection mode
            isBoxSelecting = true;
            const coords = getModuleCoordinates(e);
            if (coords) {
                boxSelectStart = coords;
                boxSelectEnd = coords;
            }
        } else {
            // Normal paint mode
            isPainting = true;
            paintModule(e);
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (isBoxSelecting) {
            // Update box selection end coordinates
            const coords = getModuleCoordinates(e);
            if (coords) {
                boxSelectEnd = coords;
                renderPaddingGridWithSelection();
            }
        } else if (isPainting) {
            paintModule(e);
        } else {
            highlightModule(e);
        }
    });

    canvas.addEventListener('mouseup', () => {
        if (isBoxSelecting) {
            // Apply brush to all padding modules in the box
            applyBoxSelection();
            isBoxSelecting = false;
            boxSelectStart = null;
            boxSelectEnd = null;
            renderPaddingGrid();
        } else {
            isPainting = false;
        }
    });

    canvas.addEventListener('mouseleave', () => {
        if (isBoxSelecting) {
            isBoxSelecting = false;
            boxSelectStart = null;
            boxSelectEnd = null;
            renderPaddingGrid();
        }
        isPainting = false;
        clearHighlight();
    });

    // Touch support (no box selection on touch devices)
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (!isBoxSelecting) {
            isPainting = true;
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            const mouseEvent = {
                clientX: touch.clientX,
                clientY: touch.clientY
            };
            paintModule(mouseEvent);
        }
    });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (isPainting && !isBoxSelecting) {
            const touch = e.touches[0];
            const mouseEvent = {
                clientX: touch.clientX,
                clientY: touch.clientY
            };
            paintModule(mouseEvent);
        }
    });

    canvas.addEventListener('touchend', () => {
        isPainting = false;
    });
}

function paintModule(e) {
    const canvas = document.getElementById('paddingGrid');
    if (!canvas || isZooming || !originalMatrix) return; // Don't paint while zooming

    const rect = canvas.getBoundingClientRect();
    const moduleSize = parseInt(document.getElementById('moduleScale').value);

    // Calculate mouse position relative to canvas
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    // Scale coordinates if canvas is scaled by CSS
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const scaledX = canvasX * scaleX;
    const scaledY = canvasY * scaleY;

    const col = Math.floor(scaledX / moduleSize);
    const row = Math.floor(scaledY / moduleSize);

    // Bounds check
    if (row < 0 || row >= originalMatrix.length || col < 0 || col >= originalMatrix.length) {
        return;
    }

    const cellKey = `${row},${col}`;

    // Only allow editing padding modules
    if (!editableCells.has(cellKey)) {
        return;
    }

    // Apply brush
    const newValue = currentBrushMode === 'black';

    // Always set the value (even if unchanged) to ensure it's registered
    paddingEdits.set(cellKey, newValue);

    // Redraw just this module
    const ctx = canvas.getContext('2d');
    drawSingleModule(ctx, row, col, newValue, false, moduleSize);

    // Debounced QR update (100ms after painting stops)
    clearTimeout(paintUpdateTimeout);
    paintUpdateTimeout = setTimeout(() => {
        updateQRFromPaddingEdits();
    }, 100);
}

function highlightModule(e) {
    const canvas = document.getElementById('paddingGrid');
    if (!canvas || !originalMatrix) return;

    const rect = canvas.getBoundingClientRect();
    const moduleSize = parseInt(document.getElementById('moduleScale').value);

    // Calculate mouse position relative to canvas
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    // Scale coordinates if canvas is scaled by CSS
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const scaledX = canvasX * scaleX;
    const scaledY = canvasY * scaleY;

    const col = Math.floor(scaledX / moduleSize);
    const row = Math.floor(scaledY / moduleSize);

    // Bounds check
    if (row >= 0 && row < originalMatrix.length && col >= 0 && col < originalMatrix.length) {
        drawModuleHighlight(row, col);
    }
}

function clearHighlight() {
    if (lastHighlightCell && originalMatrix) {
        const [row, col] = lastHighlightCell.split(',').map(Number);
        const canvas = document.getElementById('paddingGrid');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            const moduleSize = parseInt(document.getElementById('moduleScale').value);
            const isEditable = editableCells.has(lastHighlightCell);
            // Use same logic as renderPaddingGrid for consistency
            let moduleValue;
            if (isEditable && paddingEdits.has(lastHighlightCell)) {
                moduleValue = paddingEdits.get(lastHighlightCell);
            } else if (currentMatrix) {
                moduleValue = currentMatrix[row][col];
            } else {
                moduleValue = originalMatrix[row][col];
            }
            drawSingleModule(ctx, row, col, moduleValue, !isEditable, moduleSize);
        }
    }
    lastHighlightCell = null;
}

// ========== BOX SELECTION FUNCTIONS ==========

// Get module coordinates from mouse event
function getModuleCoordinates(e) {
    const canvas = document.getElementById('paddingGrid');
    if (!canvas || !originalMatrix) return null;

    const rect = canvas.getBoundingClientRect();
    const moduleSize = parseInt(document.getElementById('moduleScale').value);

    // Calculate mouse position relative to canvas
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    // Scale coordinates if canvas is scaled by CSS
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const scaledX = canvasX * scaleX;
    const scaledY = canvasY * scaleY;

    const col = Math.floor(scaledX / moduleSize);
    const row = Math.floor(scaledY / moduleSize);

    // Bounds check
    if (row < 0 || row >= originalMatrix.length || col < 0 || col >= originalMatrix.length) {
        return null;
    }

    return { row, col };
}

// Render grid with selection box overlay
function renderPaddingGridWithSelection() {
    // First render the normal grid
    renderPaddingGrid();

    if (!boxSelectStart || !boxSelectEnd) return;

    const canvas = document.getElementById('paddingGrid');
    const ctx = canvas.getContext('2d');
    const moduleSize = parseInt(document.getElementById('moduleScale').value);

    // Calculate selection rectangle
    const minRow = Math.min(boxSelectStart.row, boxSelectEnd.row);
    const maxRow = Math.max(boxSelectStart.row, boxSelectEnd.row);
    const minCol = Math.min(boxSelectStart.col, boxSelectEnd.col);
    const maxCol = Math.max(boxSelectStart.col, boxSelectEnd.col);

    const x = minCol * moduleSize;
    const y = minRow * moduleSize;
    const width = (maxCol - minCol + 1) * moduleSize;
    const height = (maxRow - minRow + 1) * moduleSize;

    // Draw selection rectangle with dashed border and semi-transparent fill (full opacity)
    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(x, y, width, height);
    ctx.setLineDash([]); // Reset dash

    // Add semi-transparent overlay
    ctx.fillStyle = 'rgba(74, 158, 255, 0.2)';
    ctx.fillRect(x, y, width, height);
}

// Apply brush to all padding modules in the selected box
function applyBoxSelection() {
    if (!boxSelectStart || !boxSelectEnd) return;

    const minRow = Math.min(boxSelectStart.row, boxSelectEnd.row);
    const maxRow = Math.max(boxSelectStart.row, boxSelectEnd.row);
    const minCol = Math.min(boxSelectStart.col, boxSelectEnd.col);
    const maxCol = Math.max(boxSelectStart.col, boxSelectEnd.col);

    const newValue = currentBrushMode === 'black';
    let editCount = 0;

    // Paint all editable cells in the box
    for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
            const cellKey = `${row},${col}`;

            // Only paint if it's an editable padding module
            if (editableCells.has(cellKey)) {
                paddingEdits.set(cellKey, newValue);
                editCount++;
            }
        }
    }

    if (editCount > 0) {
        // Debounced QR update
        clearTimeout(paintUpdateTimeout);
        paintUpdateTimeout = setTimeout(() => {
            updateQRFromPaddingEdits();
        }, 100);
    }
}

// ========== PHASE 4: MATRIX UPDATE AND ECC RECALCULATION ==========

function updateQRFromPaddingEdits() {
    if (!encodedBitstream || !encodedBitstream.blocks || !currentMatrix) {
        return;
    }

    // Check for required global variables
    if (typeof currentVersion === 'undefined' || typeof currentEccLevel === 'undefined' || typeof blockSizeTable === 'undefined') {
        alert('Error: Missing required global variables. Make sure all scripts are loaded.');
        return;
    }

    // Don't update if there are no edits
    if (paddingEdits.size === 0) {
        return;
    }

    try {
        // Step 1: Convert edited modules back to bits
        const editedBits = convertModulesToBits();

        // Step 2: Convert bits to bytes
        const newPaddingBytes = convertBitsToBytes(editedBits);

        // Step 3: Update dataBytes with new padding
        updatePaddingBytes(newPaddingBytes);

        // Step 4: CRITICAL - Recalculate ECC
        const blocks = splitIntoBlocks(
            encodedBitstream.dataBytes,
            currentVersion,
            currentEccLevel,
            blockSizeTable
        );
        calculateEccForBlocks(blocks);
        encodedBitstream.blocks = blocks;

        // Step 5: Regenerate QR matrix
        regenerateQRMatrix();

        // Step 6: Update main canvas
        renderQrCode(currentMatrix);

        // Step 7: Refresh Encode tab displays
        refreshEncodeTabDisplays();

    } catch (error) {
        alert('Error updating QR code: ' + error.message);
    }
}

// Refresh the Encode tab to show updated padding and ECC values
function refreshEncodeTabDisplays(forceUpdate = false) {
    try {
        console.log('Refreshing Encode tab displays... (force=' + forceUpdate + ')');
        console.log('  encodedBitstream.padBytes:', encodedBitstream.padBytes.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' '));

        // Mark that encode tab needs refresh
        encodeTabNeedsRefresh = true;

        // If forcing update (tab is visible), do it now
        if (forceUpdate) {
            performEncodeTabRefresh();
        } else {
            console.log('  Marked for refresh when user switches to Encode tab');
        }
    } catch (error) {
        console.error('Error refreshing Encode tab displays:', error);
    }
}

// Actually perform the refresh (called when Encode tab is visible)
function performEncodeTabRefresh() {
    if (!encodeTabNeedsRefresh) {
        return;
    }

    console.log('Performing Encode tab refresh NOW...');
    console.log('  Current encodedBitstream.padBytes:', encodedBitstream.padBytes.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' '));

    try {
        // Force update the padding bytes in the DOM directly
        updatePaddingBytesInDOM();

        // Refresh bitstream display
        if (typeof displayBitstream === 'function') {
            console.log('  Calling displayBitstream...');
            displayBitstream(encodedBitstream, currentMode, currentMessage);

            // Verify the DOM was updated
            setTimeout(() => {
                const hexBytes = document.querySelectorAll('.hex-byte[data-section="pad-byte"]');
                console.log('  DOM now shows', hexBytes.length, 'padding bytes');
                if (hexBytes.length > 0) {
                    const first3 = Array.from(hexBytes).slice(0, 3).map(el => el.textContent).join(' ');
                    console.log('  First 3 bytes in DOM:', first3);
                }
            }, 50);
        } else {
            console.warn('  displayBitstream function not found!');
        }

        // Refresh ECC display
        if (typeof displayEcc === 'function' && encodedBitstream.blocks) {
            console.log('  Calling displayEcc...');
            displayEcc(encodedBitstream.blocks);
        } else {
            console.warn('  displayEcc function not found or no blocks!');
        }

        // Refresh interleaved bytes display
        if (typeof displayInterleavedBytes === 'function') {
            console.log('  Calling displayInterleavedBytes...');
            const interleaved = interleaveBlocks(encodedBitstream.blocks);
            displayInterleavedBytes(interleaved, encodedBitstream.blocks);
        } else {
            console.warn('  displayInterleavedBytes function not found!');
        }

        // CRITICAL: Re-render the QR code canvas with the updated matrix
        if (typeof renderQrCode === 'function' && currentMatrix) {
            console.log('  Re-rendering QR code canvas...');
            renderQrCode(currentMatrix);
            console.log('  QR code canvas re-rendered');
        } else {
            console.warn('  renderQrCode function or currentMatrix not available!');
        }

        encodeTabNeedsRefresh = false;
        console.log('Encode tab displays refreshed successfully!');
    } catch (error) {
        console.error('Error performing encode tab refresh:', error);
    }
}

// Directly update padding bytes in the DOM (backup method)
// This ensures the contenteditable fields stay in sync with encodedBitstream
// so that if the user clicks "Generate QR Code" again, it uses the edited values
function updatePaddingBytesInDOM() {
    const hexBytes = document.querySelectorAll('.hex-byte[data-section="pad-byte"]');
    if (hexBytes.length === 0) {
        console.warn('  No padding byte elements found in DOM');
        return;
    }

    console.log('  Directly updating', hexBytes.length, 'padding bytes in DOM (contenteditable fields)');
    hexBytes.forEach((element, index) => {
        if (index < encodedBitstream.padBytes.length) {
            const newValue = encodedBitstream.padBytes[index].toString(16).toUpperCase().padStart(2, '0');
            const oldValue = element.textContent;

            if (oldValue !== newValue) {
                element.textContent = newValue;
                console.log(`    Updated pad byte ${index}: ${oldValue} → ${newValue}`);
            }
        }
    });
    console.log('  Direct DOM update complete - contenteditable fields now match encodedBitstream.padBytes');
}

function convertModulesToBits() {
    const editedBits = new Map();

    // Get mask pattern
    const maskPattern = parseInt(document.getElementById('maskPatternSelect')?.value || 0);

    // For each padding byte, check if any of its modules have been edited
    paddingModuleMap.forEach((modules, padByteIdx) => {
        // Check if this byte has any edited modules
        const hasEdits = modules.some(module => {
            const cellKey = `${module.row},${module.col}`;
            return paddingEdits.has(cellKey);
        });

        // Only reconstruct bytes that have been edited
        if (!hasEdits) {
            return; // Skip this byte, we'll use the original value
        }

        const bits = new Array(8).fill(0); // Initialize with zeros

        if (modules.length !== 8) {
            console.warn(`Padding byte ${padByteIdx} has ${modules.length} modules instead of 8`);
        }

        modules.forEach((module) => {
            const cellKey = `${module.row},${module.col}`;

            let bitValue;
            if (paddingEdits.has(cellKey)) {
                // User edited - this is the masked value they painted
                const maskedValue = paddingEdits.get(cellKey);
                const shouldFlip = shouldFlipModule(module.row, module.col, maskPattern);
                // Unmask to get the original bit value
                bitValue = shouldFlip ? !maskedValue : maskedValue;

                // Debug log for first byte only
                if (padByteIdx === 0) {
                    console.log(`  Bit ${module.bitOffset} at (${module.row},${module.col}): masked=${maskedValue}, shouldFlip=${shouldFlip}, unmasked=${bitValue}`);
                }
            } else {
                // Use original bit value from originalPaddingBytes
                const originalByte = originalPaddingBytes[padByteIdx];
                const bitInByte = (originalByte >> (7 - module.bitOffset)) & 1;
                bitValue = bitInByte === 1;
            }

            bits[module.bitOffset] = bitValue ? 1 : 0;
        });

        editedBits.set(padByteIdx, bits);
    });

    return editedBits;
}

function convertBitsToBytes(editedBits) {
    // Start with original padding bytes
    const newPaddingBytes = [...originalPaddingBytes];

    // Only update the bytes that have edits
    editedBits.forEach((bits, padByteIdx) => {
        // Convert 8 bits to byte value (MSB first)
        let byteValue = 0;
        for (let i = 0; i < 8; i++) {
            byteValue = (byteValue << 1) | bits[i];
        }
        newPaddingBytes[padByteIdx] = byteValue;
        const bitsStr = bits.join('');
        console.log(`Padding byte ${padByteIdx}: [${bitsStr}] = 0x${byteValue.toString(16).toUpperCase().padStart(2, '0')} (was 0x${originalPaddingBytes[padByteIdx].toString(16).toUpperCase().padStart(2, '0')})`);
    });

    return newPaddingBytes;
}

function updatePaddingBytes(newPaddingBytes) {
    // Calculate where padding starts in dataBytes
    const messageBits = encodedBitstream.modeIndicator.length +
                       encodedBitstream.charCount.length +
                       encodedBitstream.messageData.length +
                       encodedBitstream.terminator.length +
                       encodedBitstream.bytePadding.length;
    const messageBytes = Math.ceil(messageBits / 8);

    console.log('Updating padding bytes in encodedBitstream:');
    console.log('  Message bytes:', messageBytes);
    console.log('  Old padBytes:', encodedBitstream.padBytes.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' '));
    console.log('  New padBytes:', newPaddingBytes.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' '));

    // Update dataBytes array
    const newDataBytes = [...encodedBitstream.dataBytes];
    newPaddingBytes.forEach((byte, idx) => {
        newDataBytes[messageBytes + idx] = byte;
    });

    encodedBitstream.dataBytes = newDataBytes;
    encodedBitstream.padBytes = newPaddingBytes;

    console.log('  Updated encodedBitstream.padBytes:', encodedBitstream.padBytes.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' '));
}

function regenerateQRMatrix() {
    // Re-interleave blocks (data + ECC)
    const interleaved = interleaveBlocks(encodedBitstream.blocks);

    // Create new matrix
    const size = 21 + (currentVersion - 1) * 4;
    currentMatrix = createMatrix(size);

    // Place function patterns
    placeFunctionPatterns(currentMatrix, currentVersion);

    // Place data bits
    placeDataBits(currentMatrix, interleaved);

    // Apply mask
    const maskPattern = parseInt(document.getElementById('maskPatternSelect')?.value || 0);
    applyMask(currentMatrix, maskPattern, currentVersion);

    // Place format and version info
    placeFormatInfo(currentMatrix, currentEccLevel, maskPattern, currentVersion);
    if (currentVersion >= 7) {
        placeVersionInfo(currentMatrix, currentVersion);
    }
}

// ========== UTILITY FUNCTIONS ==========

function setBrushMode(mode) {
    currentBrushMode = mode;
    document.getElementById('brushBlack').classList.toggle('active', mode === 'black');
    document.getElementById('brushWhite').classList.toggle('active', mode === 'white');
}

function resetPaddingEdits() {
    if (paddingEdits.size === 0) {
        alert('No edits to reset.');
        return;
    }

    if (confirm('Clear all padding edits and restore original values?')) {
        paddingEdits.clear();
        renderPaddingGrid();
        updateQRFromPaddingEdits();
    }
}

function randomizePadding() {
    if (editableCells.size === 0) {
        alert('No padding modules available.');
        return;
    }

    editableCells.forEach(cellKey => {
        paddingEdits.set(cellKey, Math.random() > 0.5);
    });
    renderPaddingGrid();
    updateQRFromPaddingEdits();
}

function exportPaddingHex() {
    if (!encodedBitstream || !encodedBitstream.padBytes) {
        alert('No padding bytes available.');
        return;
    }

    const hexValues = encodedBitstream.padBytes.map(b =>
        b.toString(16).toUpperCase().padStart(2, '0')
    ).join(' ');

    document.getElementById('paddingHexValue').value = hexValues;
    document.getElementById('paddingHexDisplay').style.display = 'block';
}

function updateModuleScaleDisplay() {
    const value = document.getElementById('moduleScale').value;
    document.getElementById('moduleScaleValue').textContent = `${value}px`;

    isZooming = true; // Set flag to prevent painting during zoom

    // Debounced re-render (use separate timeout, only re-render grid)
    clearTimeout(zoomRenderTimeout);
    zoomRenderTimeout = setTimeout(() => {
        renderPaddingGrid();
        isZooming = false; // Clear flag after render completes
    }, 150);
}

// Initialize padding editor when tab is opened
function initializePaddingEditor() {
    if (!originalMatrix || !encodedBitstream) {
        alert('Please generate a QR code first.');
        return;
    }

    // Setup interactions
    setupPaddingGridInteractions();

    // Setup zoom slider
    const scaleSlider = document.getElementById('moduleScale');
    if (scaleSlider) {
        scaleSlider.addEventListener('input', updateModuleScaleDisplay);
    }

    // Setup opacity slider
    const opacitySlider = document.getElementById('qrOpacity');
    if (opacitySlider) {
        opacitySlider.addEventListener('input', updateQrOpacity);
    }

    // Render grid
    renderPaddingGrid();
}

function updateQrOpacity() {
    const value = document.getElementById('qrOpacity').value;
    qrModuleOpacity = parseInt(value) / 100;
    document.getElementById('qrOpacityValue').textContent = value;

    // Re-render grid with new opacity
    renderPaddingGrid();
}
