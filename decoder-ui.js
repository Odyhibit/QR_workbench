// decoder-ui.js
// UI functions, event handlers, and display updates

// Update ECC level dropdowns (syncs both Tab 1 and Tab 2)
function updateEccDropdowns(eccLevel) {
    const select1 = document.getElementById('eccLevelSelect');
    const select2 = document.getElementById('eccLevelSelect2');
    if (select1) select1.value = eccLevel || '';
    if (select2) select2.value = eccLevel || '';
}

// Update mask pattern dropdowns (syncs both Tab 1 and Tab 2)
function updateMaskDropdowns(maskPattern) {
    const select1 = document.getElementById('maskPatternSelect');
    const select2 = document.getElementById('maskPatternSelect2');
    const value = maskPattern !== undefined && maskPattern !== null ? maskPattern.toString() : '-1';
    if (select1) select1.value = value;
    if (select2) select2.value = value;
}

// Handle ECC dropdown change
function onEccLevelChange(newValue, sourceId) {
    const oldValue = currentEccLevel;
    currentEccLevel = newValue;

    // Sync the other dropdown
    const otherId = sourceId === 'eccLevelSelect' ? 'eccLevelSelect2' : 'eccLevelSelect';
    const otherSelect = document.getElementById(otherId);
    if (otherSelect) otherSelect.value = newValue;

    // Reset decoder state if value actually changed and we have a matrix
    if (oldValue !== newValue && originalMatrix) {
        resetToOriginalMatrix();
    }
}

// Handle mask pattern dropdown change
function onMaskPatternChange(newValue, sourceId) {
    const maskValue = parseInt(newValue);
    const oldValue = currentMaskPattern;
    currentMaskPattern = maskValue;

    // Sync the other dropdown
    const otherId = sourceId === 'maskPatternSelect' ? 'maskPatternSelect2' : 'maskPatternSelect';
    const otherSelect = document.getElementById(otherId);
    if (otherSelect) otherSelect.value = newValue;

    // Update unmask button text
    const unmaskButton = document.getElementById('unmaskButton');
    if (unmaskButton && maskValue >= 0) {
        unmaskButton.textContent = `Unmask ${maskValue}`;
        unmaskButton.disabled = false;
    }

    // Reset decoder state if value actually changed and we have a matrix
    if (oldValue !== maskValue && originalMatrix) {
        resetToOriginalMatrix();
    }
}

// Reset to original matrix state (before unmasking) and clear all downstream state
function resetToOriginalMatrix() {
    if (!originalMatrix) return;

    // Restore matrix from original
    const moduleCount = originalMatrix.length;
    moduleMatrix = originalMatrix.map(row => [...row]);

    // Reset used modules
    usedModules = Array(moduleCount).fill(null).map(() => Array(moduleCount).fill(false));

    // Reset state flags
    isUnmasked = false;
    isModeDecoded = false;
    isSizeDecoded = false;
    isBitstreamRecovered = false;
    currentDataMode = '';
    eciAssignment = null;
    eciEncoding = null;
    dataPositions = [];
    bitstreamIndex = 0;
    currentHighlight = [];
    recoveredBitstream = '';
    deinterleavedDataBits = '';
    decodedMessageSize = null;
    lastDeinterleaveMeta = null;
    qrBlocks = [];
    currentEcStep = 0;
    syndromeCalculated = false;
    errorCodewordOutlines = [];

    // Reset buttons - Tab 2/3
    const unmaskButton = document.getElementById('unmaskButton');
    if (unmaskButton) {
        unmaskButton.disabled = currentMaskPattern < 0;
        if (currentMaskPattern >= 0) {
            unmaskButton.textContent = `Unmask ${currentMaskPattern}`;
        }
    }

    document.getElementById('recoverAllButton').disabled = true;
    document.getElementById('nextByteButton').disabled = true;
    document.getElementById('deinterleaveButton').disabled = true;
    document.getElementById('decodeModeButton').disabled = true;
    document.getElementById('decodeSizeButton').disabled = true;

    // Reset buttons - Tab 4
    document.getElementById('calculateSyndromesButton').disabled = true;
    document.getElementById('findErrorLocationsButton').disabled = true;
    document.getElementById('calculateErrorValuesButton').disabled = true;
    document.getElementById('applyCorrectionsButton').disabled = true;
    document.getElementById('decodeMessageButton').disabled = true;

    // Clear display panels
    document.getElementById('codewordDisplay').innerHTML = '';
    document.getElementById('blockDisplay').innerHTML = '';
    document.getElementById('ecStatus').style.display = 'none';
    document.getElementById('ecStatusContent').innerHTML = '';
    document.getElementById('decodedMessageBox').style.display = 'none';
    document.getElementById('decodedMessageContent').innerHTML = '';

    // Hide legend
    const legend = document.getElementById('bitstreamLegend');
    if (legend) legend.style.display = 'none';

    // Reset info displays
    document.getElementById('blockCount').textContent = '-';
    document.getElementById('dataMode').textContent = '-';
    document.getElementById('messageSize').textContent = '-';

    // Reset marked components visuals (keep the toggle state)
    // Redraw the cleaned QR
    drawCleanQR();
}

// Calculate which mask patterns would result in byte mode (0100)
function calculateByteMaskHint() {
    if (!moduleMatrix) return null;

    const moduleCount = moduleMatrix.length;

    // Build data positions to find first 4 data bits
    // This replicates buildDataPositions logic but we just need first 4
    const positions = [];
    let row = moduleCount - 1;
    let col = moduleCount - 1;
    let goingUp = true;
    let inRightColumn = true;
    let safetyCounter = 0;
    const maxModules = moduleCount * moduleCount;

    while (safetyCounter < maxModules && col >= 0 && positions.length < 4) {
        safetyCounter++;

        const currentCol = inRightColumn ? col : col - 1;

        if (!isFunctionModule(row, currentCol, moduleCount)) {
            positions.push({
                row,
                col: currentCol,
                bit: moduleMatrix[row][currentCol] ? 1 : 0
            });
        }

        if (inRightColumn) {
            inRightColumn = false;
        } else {
            inRightColumn = true;

            if (goingUp) {
                row--;
                if (row < 0) {
                    goingUp = false;
                    col -= 2;
                    if (col === 6) col--;
                    row = 0;
                }
            } else {
                row++;
                if (row >= moduleCount) {
                    goingUp = true;
                    col -= 2;
                    if (col === 6) col--;
                    row = moduleCount - 1;
                }
            }

            if (col < 0) break;
        }
    }

    if (positions.length < 4) return null;

    // For each mask pattern, calculate what the unmasked mode indicator would be
    const validMasks = [];

    for (let mask = 0; mask < 8; mask++) {
        let modeValue = 0;
        for (let i = 0; i < 4; i++) {
            const pos = positions[i];
            let bitValue = pos.bit;

            // Apply mask pattern to see what the unmasked value would be
            if (shouldFlipModule(pos.row, pos.col, mask)) {
                bitValue = bitValue ? 0 : 1;
            }

            modeValue = (modeValue << 1) | bitValue;
        }

        // Check if this would be byte mode (0100 = 4)
        if (modeValue === 0b0100) {
            validMasks.push(mask);
        }
    }

    return validMasks;
}

// Update the byte mask hint display
function updateByteMaskHint() {
    const hintSpan = document.getElementById('byteMaskHint');
    const hintSpan2 = document.getElementById('byteMaskHint2');

    if (!moduleMatrix) {
        if (hintSpan) hintSpan.textContent = '-';
        if (hintSpan2) hintSpan2.textContent = '-';
        return;
    }

    const validMasks = calculateByteMaskHint();

    let hintText = '-';
    if (validMasks && validMasks.length > 0) {
        hintText = validMasks.join(', ');
    } else if (validMasks && validMasks.length === 0) {
        hintText = 'none';
    }

    if (hintSpan) hintSpan.textContent = hintText;
    if (hintSpan2) hintSpan2.textContent = hintText;
}

// Initialize dropdown event listeners (called from decoder.js)
function initFormatDropdowns() {
    const eccSelect1 = document.getElementById('eccLevelSelect');
    const eccSelect2 = document.getElementById('eccLevelSelect2');
    const maskSelect1 = document.getElementById('maskPatternSelect');
    const maskSelect2 = document.getElementById('maskPatternSelect2');

    if (eccSelect1) {
        eccSelect1.addEventListener('change', function() {
            onEccLevelChange(this.value, 'eccLevelSelect');
        });
    }
    if (eccSelect2) {
        eccSelect2.addEventListener('change', function() {
            onEccLevelChange(this.value, 'eccLevelSelect2');
        });
    }
    if (maskSelect1) {
        maskSelect1.addEventListener('change', function() {
            onMaskPatternChange(this.value, 'maskPatternSelect');
        });
    }
    if (maskSelect2) {
        maskSelect2.addEventListener('change', function() {
            onMaskPatternChange(this.value, 'maskPatternSelect2');
        });
    }
}

// Tab switching
function switchTab(tabIndex) {
    const tabs = document.querySelectorAll('.tab-button');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach((tab, index) => {
        if (index === tabIndex) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    contents.forEach((content, index) => {
        if (index === tabIndex) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });

    // Redraw appropriate canvas when switching tabs
    if (tabIndex === 0) {
        // Tab 1: Redraw original image with grid
        if (currentImage && imageData) {
            drawImageWithGrid();
        }
    } else if (tabIndex === 1 || tabIndex === 2) {
        // Tabs 2-3: Redraw cleaned QR canvas
        if (moduleMatrix) {
            drawCleanQR();
        }
    } else if (tabIndex === 3) {
        drawErrorCorrectionQR();
    }
    // Tab 4: No canvas redraw needed
}

function readCornersFromInputs() {
    const corners = {};

    Object.keys(cornerInputs).forEach(key => {
        corners[key] = {
            x: Math.round(parseFloat(cornerInputs[key].x.value) || 0),
            y: Math.round(parseFloat(cornerInputs[key].y.value) || 0)
        };
    });

    return corners;
}

function writeCornersToInputs(corners) {
    Object.keys(cornerInputs).forEach(key => {
        if (!corners || !corners[key]) return;
        cornerInputs[key].x.value = Math.round(corners[key].x);
        cornerInputs[key].y.value = Math.round(corners[key].y);
    });
}

function setCornersFromBorders(top, bottom, left, right) {
    if (!currentImage) return;

    const x1 = left;
    const y1 = top;
    const x2 = currentImage.width - right;
    const y2 = currentImage.height - bottom;

    qrCorners = {
        topLeft: { x: x1, y: y1 },
        topRight: { x: x2, y: y1 },
        bottomRight: { x: x2, y: y2 },
        bottomLeft: { x: x1, y: y2 }
    };

    writeCornersToInputs(qrCorners);
}

function onCornerInputChange() {
    qrCorners = readCornersFromInputs();
    writeCornersToInputs(qrCorners);
    drawImageWithGrid();
}

function advanceCornerSelection(currentCorner) {
    const order = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];
    const nextIndex = (order.indexOf(currentCorner) + 1) % order.length;
    cornerSelect.value = order[nextIndex];
}

// Toggle marking components
function toggleMark(component) {
    markedComponents[component] = !markedComponents[component];
    const button = document.getElementById('mark' + component.charAt(0).toUpperCase() + component.slice(1));
    if (markedComponents[component]) {
        button.classList.add('active');
    } else {
        button.classList.remove('active');
    }
    drawCleanQR();
}

// Get color for module based on marking state
function getModuleColor(row, col, isBlack, moduleCount) {
    // Highlight modules currently being read for the next byte
    const isHighlighted = currentHighlight.some(pos => pos.row === row && pos.col === col);
    if (isHighlighted) {
        return isBlack ? '#B8860B' : '#FFF8B5'; // Dark yellow / Light yellow
    }

    // Check if module has been used/decoded (always show this first)
    if (usedModules && usedModules[row] && usedModules[row][col]) {
        return isBlack ? '#404040' : '#D3D3D3'; // Dark grey / Light grey
    }

    // Check each component in order of priority
    if (markedComponents.finders && isFinderModule(row, col, moduleCount)) {
        return isBlack ? '#006400' : '#90EE90'; // Dark green / Light green
    }

    if (markedComponents.alignment && isAlignmentModule(row, col, moduleCount)) {
        return isBlack ? '#800080' : '#DDA0DD'; // Dark purple / Light purple
    }

    if (markedComponents.format && isFormatModule(row, col, moduleCount)) {
        return isBlack ? '#8B0000' : '#FFB6C1'; // Dark red / Light red
    }

    if (markedComponents.timing && isTimingModule(row, col, moduleCount)) {
        return isBlack ? '#00008B' : '#ADD8E6'; // Dark blue / Light blue
    }

    if (markedComponents.dark && isDarkModule(row, col, moduleCount)) {
        return '#FF0000'; // 100% red - always red regardless of black/white
    }

    if (markedComponents.version && isVersionModule(row, col, moduleCount)) {
        return isBlack ? '#FF8C00' : '#FFE4B5'; // Dark orange / Light orange
    }

    // Default colors
    return isBlack ? 'black' : 'white';
}

// Draw cleaned QR code with 4-module quiet zone
function drawCleanQR() {
    if (!moduleMatrix) return;

    const moduleCount = moduleMatrix.length;
    const quietZone = 4; // 4 modules as per QR spec
    const modulePixelSize = 10; // Size of each module in pixels

    // Canvas size includes quiet zone
    const totalModules = moduleCount + (quietZone * 2);
    const canvasSize = totalModules * modulePixelSize;

    // Helper function to draw to a specific canvas
    const drawToCanvas = (canvas, ctx) => {
        canvas.width = canvasSize;
        canvas.height = canvasSize;

        // Fill with white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvasSize, canvasSize);

        // Draw modules with appropriate colors
        for (let row = 0; row < moduleCount; row++) {
            for (let col = 0; col < moduleCount; col++) {
                const isBlack = moduleMatrix[row][col];
                const color = getModuleColor(row, col, isBlack, moduleCount);

                if (color !== 'white') {
                    ctx.fillStyle = color;
                    const x = (quietZone + col) * modulePixelSize;
                    const y = (quietZone + row) * modulePixelSize;
                    ctx.fillRect(x, y, modulePixelSize, modulePixelSize);
                }
            }
        }

        // Draw outlines around highlighted modules (current byte being read)
        if (currentHighlight.length > 0) {
            ctx.strokeStyle = '#FF8C00'; // Dark orange
            ctx.lineWidth = 2;
            for (const pos of currentHighlight) {
                const x = (quietZone + pos.col) * modulePixelSize;
                const y = (quietZone + pos.row) * modulePixelSize;
                ctx.strokeRect(x, y, modulePixelSize, modulePixelSize);
            }
        }
    };

    // Draw to both canvases (Tab 2 and Tab 3)
    drawToCanvas(cleanCanvas, cleanCtx);
    drawToCanvas(cleanCanvas3, cleanCtx3);
    drawErrorCorrectionQR();
}

function getCodewordOutlineBounds(positions) {
    if (!positions || !positions.length) return null;

    const rows = positions.map(pos => pos.row);
    const cols = positions.map(pos => pos.col);

    return {
        minRow: Math.min(...rows),
        maxRow: Math.max(...rows),
        minCol: Math.min(...cols),
        maxCol: Math.max(...cols)
    };
}

function updateErrorCodewordOutlines() {
    errorCodewordOutlines = [];

    if (!qrBlocks || !qrBlocks.length) return;

    qrBlocks.forEach((block, blockIdx) => {
        if (!block.errorPositions || !block.errorPositions.length) return;

        block.errorPositions.forEach(pos => {
            const positions = pos < block.dataBytes.length
                ? block.dataModulePositions && block.dataModulePositions[pos]
                : block.eccModulePositions && block.eccModulePositions[pos - block.dataBytes.length];
            const bounds = getCodewordOutlineBounds(positions);
            if (!bounds) return;

            errorCodewordOutlines.push({
                ...bounds,
                positions,
                blockIdx,
                codewordLabel: pos < block.dataBytes.length ? `D${pos}` : `E${pos - block.dataBytes.length}`
            });
        });
    });
}

function drawErrorCorrectionQR() {
    if (!errorCanvas || !errorCtx || !moduleMatrix) return;

    const moduleCount = moduleMatrix.length;
    const quietZone = 4;
    const modulePixelSize = 10;
    const totalModules = moduleCount + (quietZone * 2);
    const canvasSize = totalModules * modulePixelSize;

    errorCanvas.width = canvasSize;
    errorCanvas.height = canvasSize;

    errorCtx.fillStyle = 'white';
    errorCtx.fillRect(0, 0, canvasSize, canvasSize);

    for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
            errorCtx.fillStyle = moduleMatrix[row][col] ? 'black' : 'white';
            errorCtx.fillRect(
                (quietZone + col) * modulePixelSize,
                (quietZone + row) * modulePixelSize,
                modulePixelSize,
                modulePixelSize
            );
        }
    }

    if (!errorCodewordOutlines || !errorCodewordOutlines.length) return;

    errorCtx.save();
    errorCtx.fillStyle = 'rgba(255, 0, 0, 0.28)';

    // Fill corrected modules as one path so overlapping codewords
    // are painted once and stay a uniform shade.
    const covered = new Set();
    errorCtx.beginPath();
    errorCodewordOutlines.forEach(codeword => {
        if (!codeword.positions || !codeword.positions.length) return;

        codeword.positions.forEach(pos => {
            const key = pos.row * moduleCount + pos.col;
            if (covered.has(key)) return;

            covered.add(key);
            errorCtx.rect(
                (quietZone + pos.col) * modulePixelSize,
                (quietZone + pos.row) * modulePixelSize,
                modulePixelSize,
                modulePixelSize
            );
        });
    });
    errorCtx.fill();

    // Outline the union: stroke each edge where a covered
    // module borders an uncovered one
    errorCtx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
    errorCtx.lineWidth = 2;
    errorCtx.beginPath();
    covered.forEach(key => {
        const row = Math.floor(key / moduleCount);
        const col = key % moduleCount;
        const x = (quietZone + col) * modulePixelSize;
        const y = (quietZone + row) * modulePixelSize;
        if (!covered.has((row - 1) * moduleCount + col)) {
            errorCtx.moveTo(x, y);
            errorCtx.lineTo(x + modulePixelSize, y);
        }
        if (!covered.has((row + 1) * moduleCount + col)) {
            errorCtx.moveTo(x, y + modulePixelSize);
            errorCtx.lineTo(x + modulePixelSize, y + modulePixelSize);
        }
        if (col === 0 || !covered.has(row * moduleCount + (col - 1))) {
            errorCtx.moveTo(x, y);
            errorCtx.lineTo(x, y + modulePixelSize);
        }
        if (col === moduleCount - 1 || !covered.has(row * moduleCount + (col + 1))) {
            errorCtx.moveTo(x + modulePixelSize, y);
            errorCtx.lineTo(x + modulePixelSize, y + modulePixelSize);
        }
    });
    errorCtx.stroke();

    errorCtx.restore();
}

// Draw the image and grid
function drawImageWithGrid() {
    if (!currentImage || !imageData) return;

    const version = parseInt(versionSelect.value);
    const moduleCount = getModuleCount(version);
    qrCorners = readCornersFromInputs();
    gridHomography = getGridHomography(qrCorners);

    // Update info display
    document.getElementById('moduleSize').textContent = getApproxModuleSize(qrCorners, moduleCount);
    document.getElementById('versionInfo').textContent = `${moduleCount}x${moduleCount}`;
    document.getElementById('versionLabel').textContent = `Version ${version}:`;

    // Set canvas size to match image
    canvas.width = currentImage.width;
    canvas.height = currentImage.height;
    setDecoderCanvasDisplaySize();

    // Draw the image
    ctx.drawImage(currentImage, 0, 0);

    if (!gridHomography) return;

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.lineWidth = 1;

    // Draw vertical lines
    for (let i = 0; i <= moduleCount; i++) {
        const p1 = applyHomography(gridHomography, i / moduleCount, 0);
        const p2 = applyHomography(gridHomography, i / moduleCount, 1);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
    }

    // Draw horizontal lines
    for (let i = 0; i <= moduleCount; i++) {
        const p1 = applyHomography(gridHomography, 0, i / moduleCount);
        const p2 = applyHomography(gridHomography, 1, i / moduleCount);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
    }

    // Draw border outline
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(qrCorners.topLeft.x, qrCorners.topLeft.y);
    ctx.lineTo(qrCorners.topRight.x, qrCorners.topRight.y);
    ctx.lineTo(qrCorners.bottomRight.x, qrCorners.bottomRight.y);
    ctx.lineTo(qrCorners.bottomLeft.x, qrCorners.bottomLeft.y);
    ctx.closePath();
    ctx.stroke();

    drawCornerHandles(qrCorners);

    // Sample modules and draw clean QR
    moduleMatrix = sampleModules();

    // Store original matrix for reset functionality
    if (moduleMatrix) {
        originalMatrix = moduleMatrix.map(row => [...row]);
    }

    // Reset usedModules for new image
    usedModules = Array(moduleCount).fill(null).map(() => Array(moduleCount).fill(false));
    isModeDecoded = false;
    isSizeDecoded = false;
    isBitstreamRecovered = false;
    currentDataMode = '';
    currentEccLevel = '';
    eciAssignment = null;
    eciEncoding = null;
    dataPositions = [];
    bitstreamIndex = 0;
    currentHighlight = [];
    recoveredBitstream = '';
    deinterleavedDataBits = '';

    resetBitstreamState();
    drawCleanQR();

    // Calculate byte mode mask hint
    updateByteMaskHint();

    // Extract and display format information
    const formatBits = extractFormatInfo();
    if (formatBits) {
        const formatInfo = decodeFormatInfo(formatBits);
        if (formatInfo) {
            // Update dropdowns with detected values
            updateEccDropdowns(formatInfo.eccLevel);
            updateMaskDropdowns(formatInfo.maskPattern);
            currentEccLevel = formatInfo.eccLevel;

            // Update unmask button
            currentMaskPattern = formatInfo.maskPattern;
            const unmaskButton = document.getElementById('unmaskButton');
            unmaskButton.textContent = `Unmask ${currentMaskPattern}`;
            unmaskButton.disabled = false;
            isUnmasked = false; // Reset unmask state when new image loaded

            // Reset decode mode button
            const decodeModeButton = document.getElementById('decodeModeButton');
            decodeModeButton.disabled = true; // Disabled until unmask is clicked
            document.getElementById('dataMode').textContent = '-';

            // Reset decode size button
            const decodeSizeButton = document.getElementById('decodeSizeButton');
            decodeSizeButton.disabled = true;
            document.getElementById('messageSize').textContent = '-';
        }
    }

    // Update tab 2 version info
    document.getElementById('versionInfo2').textContent = `${moduleCount}x${moduleCount}`;
    document.getElementById('versionLabel2').textContent = `Version ${version}:`;
    // Reset block count display until deinterleave sets it
    const blockCountSpan = document.getElementById('blockCount');
    if (blockCountSpan) blockCountSpan.textContent = '-';

    // Enable/disable alignment button based on version (version 2+)
    const markAlignmentButton = document.getElementById('markAlignment');
    if (version >= 2) {
        markAlignmentButton.disabled = false;
    } else {
        markAlignmentButton.disabled = true;
        markedComponents.alignment = false;
        markAlignmentButton.classList.remove('active');
    }

    // Enable/disable version button based on version
    const markVersionButton = document.getElementById('markVersion');
    if (version >= 7) {
        markVersionButton.disabled = false;
    } else {
        markVersionButton.disabled = true;
        markedComponents.version = false;
        markVersionButton.classList.remove('active');
    }
}

function setDecoderCanvasDisplaySize() {
    const minDisplaySize = 520;
    const shortestSide = Math.min(currentImage.width, currentImage.height);
    const scale = shortestSide > 0 ? Math.max(1, minDisplaySize / shortestSide) : 1;

    canvas.style.width = `${Math.round(currentImage.width * scale)}px`;
    canvas.style.height = `${Math.round(currentImage.height * scale)}px`;
}

function getApproxModuleSize(corners, moduleCount) {
    if (!corners || !corners.topLeft || !corners.topRight || !corners.bottomLeft) {
        return '-';
    }

    const topWidth = Math.hypot(corners.topRight.x - corners.topLeft.x, corners.topRight.y - corners.topLeft.y);
    const leftHeight = Math.hypot(corners.bottomLeft.x - corners.topLeft.x, corners.bottomLeft.y - corners.topLeft.y);
    const moduleSize = ((topWidth + leftHeight) / 2) / moduleCount;
    return Number.isFinite(moduleSize) ? moduleSize.toFixed(2) : '-';
}

function drawCornerHandles(corners) {
    const labels = [
        ['topLeft', 'TL'],
        ['topRight', 'TR'],
        ['bottomRight', 'BR'],
        ['bottomLeft', 'BL']
    ];

    const rect = canvas.getBoundingClientRect();
    const displayScale = rect.width ? Math.max(canvas.width / rect.width, canvas.height / rect.height, 1) : 1;
    const handleRadius = Math.max(6, 7 * displayScale);
    const labelOffset = Math.max(8, 10 * displayScale);
    const labelSize = Math.max(13, 13 * displayScale);

    ctx.font = `bold ${labelSize}px Arial`;
    ctx.textBaseline = 'middle';
    labels.forEach(([key, label]) => {
        const point = corners[key];
        const isSelected = cornerSelect && cornerSelect.value === key;
        ctx.fillStyle = isSelected ? '#ff8c00' : '#4a9eff';
        ctx.beginPath();
        ctx.arc(point.x, point.y, isSelected ? handleRadius * 1.15 : handleRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.strokeStyle = '#1a3a6b';
        ctx.lineWidth = Math.max(3, 3 * displayScale);
        ctx.strokeText(label, point.x + labelOffset, point.y);
        ctx.fillText(label, point.x + labelOffset, point.y);
    });
}

// Add a codeword to the visual display
function addCodewordToDisplay(codeword) {
    const container = document.getElementById('codewordDisplay');
    const legend = document.getElementById('bitstreamLegend');
    if (!container) return;

    // Show legend on first codeword and update it for current block count
    if (legend && container.children.length === 0) {
        const version = parseInt(versionSelect.value, 10);
        const config = getBlockConfig(version, currentEccLevel);
        const totalBlocks = config ? ((config.g1Blocks || 0) + (config.g2Blocks || 0)) : 1;

        // Show only the legend items for actual blocks
        const legendItems = legend.querySelectorAll('.legend-item');
        legendItems.forEach((item, index) => {
            item.style.display = index < totalBlocks ? 'flex' : 'none';
        });

        legend.style.display = 'flex';
    }

    // Calculate which block this codeword belongs to
    const version = parseInt(versionSelect.value, 10);
    const config = getBlockConfig(version, currentEccLevel);

    let blockIndex = 0;
    if (config) {
        const totalBlocks = (config.g1Blocks || 0) + (config.g2Blocks || 0);
        const codewordNumber = Math.floor(recoveredBitstream.replace(/\s+/g, '').length / 8) - 1;

        // Determine block based on interleaving pattern
        // Data codewords are interleaved round-robin across blocks
        if (totalBlocks > 1) {
            const maxDataLen = Math.max(config.g1Data || 0, config.g2Data || 0);
            const totalData = (config.g1Blocks || 0) * (config.g1Data || 0) +
                            (config.g2Blocks || 0) * (config.g2Data || 0);

            if (codewordNumber < totalData) {
                // Data codeword
                const whichRound = Math.floor(codewordNumber / totalBlocks);
                blockIndex = codewordNumber % totalBlocks;
            } else {
                // ECC codeword
                const eccOffset = codewordNumber - totalData;
                blockIndex = eccOffset % totalBlocks;
            }
        }
    }

    // Create codeword box
    const box = document.createElement('div');
    box.className = `codeword-box block-${blockIndex} current`;
    box.textContent = codeword;

    container.appendChild(box);

    // Remove "current" class after animation
    setTimeout(() => {
        box.classList.remove('current');
    }, 500);

    // Auto-scroll to show new codeword
    container.scrollTop = container.scrollHeight;
}

// Reorganize the bitstream display to show blocks in order (block 1, then block 2, etc.)
function reorganizeBitstreamDisplay(blocks) {
    const container = document.getElementById('codewordDisplay');
    if (!container) return;

    // Clear the existing display
    container.innerHTML = '';

    // Rebuild the display with blocks in order
    blocks.forEach((block, blockIdx) => {
        // Add data codewords for this block
        block.data.forEach((codeword) => {
            const box = document.createElement('div');
            box.className = `codeword-box block-${blockIdx % 5}`;
            box.textContent = codeword;

            container.appendChild(box);
        });

        // Add EC codewords for this block
        block.ec.forEach((codeword) => {
            const box = document.createElement('div');
            box.className = `codeword-box block-${blockIdx % 5}`;
            box.textContent = codeword;

            const label = document.createElement('span');
            label.className = 'block-label';
            label.textContent = `EC`;
            box.appendChild(label);

            container.appendChild(box);
        });
    });
}

// Display blocks as hex bytes
function displayBlocksAsHex() {
    const blockDisplay = document.getElementById('blockDisplay');
    if (!blockDisplay || !qrBlocks.length) return;

    let html = '';
    qrBlocks.forEach((block, idx) => {
        html += `<div class="block-container">`;
        html += `<div class="block-header">Block ${idx + 1}</div>`;

        // Data section
        html += `<div class="block-section">`;
        html += `<div class="block-section-label">Data (${block.dataBytes.length} bytes):</div>`;
        html += `<div class="byte-row">`;
        block.dataBytes.forEach((byte, i) => {
            const hexValue = byte.toString(16).toUpperCase().padStart(2, '0');
            let classes = 'byte-box';
            const dataId = `block${idx}-data${i}`;
            html += `<span class="${classes} block-${idx % 5}" id="${dataId}">${hexValue}</span>`;
        });
        html += `</div></div>`;

        // ECC section
        html += `<div class="block-section">`;
        html += `<div class="block-section-label">ECC (${block.eccBytes.length} bytes):</div>`;
        html += `<div class="byte-row">`;
        block.eccBytes.forEach((byte, i) => {
            const hexValue = byte.toString(16).toUpperCase().padStart(2, '0');
            const eccId = `block${idx}-ecc${i}`;
            html += `<span class="byte-box block-${idx % 5}" id="${eccId}">${hexValue}</span>`;
        });
        html += `</div></div>`;

        // Syndromes section (initially empty)
        html += `<div class="block-section" id="block${idx}-syndromes-section" style="display: none;">`;
        html += `<div class="block-section-label">Syndromes:</div>`;
        html += `<div class="syndrome-row" id="block${idx}-syndromes"></div>`;
        html += `</div>`;

        html += `</div>`;
    });

    blockDisplay.innerHTML = html;
}

// Copy data codewords to clipboard as space-delimited hex
function copyDataToClipboard(button) {
    if (!qrBlocks || qrBlocks.length === 0) {
        alert('No data blocks available. Please decode a QR code first.');
        return;
    }

    const allDataBytes = [];
    qrBlocks.forEach(block => {
        allDataBytes.push(...block.dataBytes);
    });

    const hexString = allDataBytes
        .map(byte => byte.toString(16).toUpperCase().padStart(2, '0'))
        .join(' ');

    navigator.clipboard.writeText(hexString).then(() => {
        // Visual feedback
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => {
            button.textContent = originalText;
        }, 1500);
    }).catch(err => {
        alert('Failed to copy to clipboard: ' + err);
    });
}

// Copy ECC codewords to clipboard as space-delimited hex
function copyEccToClipboard(button) {
    if (!qrBlocks || qrBlocks.length === 0) {
        alert('No ECC blocks available. Please decode a QR code first.');
        return;
    }

    const allEccBytes = [];
    qrBlocks.forEach(block => {
        allEccBytes.push(...block.eccBytes);
    });

    const hexString = allEccBytes
        .map(byte => byte.toString(16).toUpperCase().padStart(2, '0'))
        .join(' ');

    navigator.clipboard.writeText(hexString).then(() => {
        // Visual feedback
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => {
            button.textContent = originalText;
        }, 1500);
    }).catch(err => {
        alert('Failed to copy to clipboard: ' + err);
    });
}

// Reset all decoder state when loading a new image
function resetDecoderState() {
    // Reset state variables
    moduleMatrix = null;
    originalMatrix = null;
    usedModules = null;
    qrCorners = null;
    gridHomography = null;
    isUnmasked = false;
    isModeDecoded = false;
    isSizeDecoded = false;
    isBitstreamRecovered = false;
    currentMaskPattern = -1;
    currentDataMode = '';
    currentEccLevel = '';
    dataPositions = [];
    bitstreamIndex = 0;
    recoveredBitstream = '';
    currentHighlight = [];
    deinterleavedDataBits = '';
    decodedMessageSize = null;
    lastDeinterleaveMeta = null;
    eciAssignment = null;
    eciEncoding = null;
    qrBlocks = [];
    currentEcStep = 0;
    syndromeCalculated = false;
    errorCodewordOutlines = [];

    // Clear canvases
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cleanCtx = cleanCanvas.getContext('2d');
    cleanCtx.clearRect(0, 0, cleanCanvas.width, cleanCanvas.height);
    const cleanCtx3 = cleanCanvas3.getContext('2d');
    cleanCtx3.clearRect(0, 0, cleanCanvas3.width, cleanCanvas3.height);
    if (errorCtx && errorCanvas) {
        errorCtx.clearRect(0, 0, errorCanvas.width, errorCanvas.height);
    }

    // Reset button states - Tab 1
    // (All Tab 1 buttons are always enabled)

    // Reset button states - Tab 2
    document.getElementById('unmaskButton').disabled = true;
    document.getElementById('recoverAllButton').disabled = true;
    document.getElementById('nextByteButton').disabled = true;
    document.getElementById('deinterleaveButton').disabled = true;
    document.getElementById('decodeModeButton').disabled = true;
    document.getElementById('decodeSizeButton').disabled = true;
    document.getElementById('calculateSyndromesButton').disabled = true;
    document.getElementById('findErrorLocationsButton').disabled = true;
    document.getElementById('calculateErrorValuesButton').disabled = true;
    document.getElementById('applyCorrectionsButton').disabled = true;
    document.getElementById('decodeMessageButton').disabled = true;

    // Clear display panels
    document.getElementById('codewordDisplay').innerHTML = '';
    document.getElementById('blockDisplay').innerHTML = '';
    document.getElementById('ecStatus').style.display = 'none';
    document.getElementById('ecStatusContent').innerHTML = '';
    document.getElementById('decodedMessageBox').style.display = 'none';
    document.getElementById('decodedMessageContent').innerHTML = '';

    // Hide legend
    const legend = document.getElementById('bitstreamLegend');
    if (legend) legend.style.display = 'none';

    // Clear format information
    document.getElementById('versionInfo').textContent = '-';
    document.getElementById('versionInfo2').textContent = '-';
    Object.values(cornerInputs).forEach(pair => {
        pair.x.value = 0;
        pair.y.value = 0;
    });
    if (cornerSelect) cornerSelect.value = 'topLeft';
    // Reset dropdowns
    updateEccDropdowns('');
    updateMaskDropdowns(-1);
    // Reset byte mask hint
    const byteMaskHint = document.getElementById('byteMaskHint');
    const byteMaskHint2 = document.getElementById('byteMaskHint2');
    if (byteMaskHint) byteMaskHint.textContent = '-';
    if (byteMaskHint2) byteMaskHint2.textContent = '-';
    document.getElementById('blockCount').textContent = '-';
    document.getElementById('dataMode').textContent = '-';
    document.getElementById('messageSize').textContent = '-';

    // Reset marked components
    markedComponents = {
        finders: false,
        alignment: false,
        format: false,
        timing: false,
        dark: false,
        version: false
    };

    // Reset mark buttons
    document.getElementById('markFinders').classList.remove('active');
    document.getElementById('markAlignment').classList.remove('active');
    document.getElementById('markFormat').classList.remove('active');
    document.getElementById('markTiming').classList.remove('active');
    document.getElementById('markDark').classList.remove('active');
    document.getElementById('markVersion').classList.remove('active');
}
