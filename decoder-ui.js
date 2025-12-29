// decoder-ui.js
// UI functions, event handlers, and display updates

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

function toggleMarking() {
    isMarkingCollapsed = !isMarkingCollapsed;
    const content = document.getElementById('markingContent');
    const toggle = document.getElementById('toggleMarking');
    if (isMarkingCollapsed) {
        content.classList.add('collapsed');
        toggle.textContent = 'Show';
    } else {
        content.classList.remove('collapsed');
        toggle.textContent = 'Hide';
    }
}

// Toggle bitstream recovery panel
function toggleBitstreamPanel() {
    isBitstreamCollapsed = !isBitstreamCollapsed;
    const panel = document.getElementById('bitstreamPanel');
    const toggle = document.getElementById('toggleBitstream');
    if (panel && toggle) {
        if (isBitstreamCollapsed) {
            panel.classList.add('collapsed');
            toggle.textContent = 'Show';
        } else {
            panel.classList.remove('collapsed');
            toggle.textContent = 'Hide';
        }
    }
}

// Toggle cleaned canvas visibility
function toggleCleanCanvas() {
    isCleanCanvasCollapsed = !isCleanCanvasCollapsed;
    const panel = document.getElementById('cleanCanvasWrapper');
    const toggle = document.getElementById('toggleCleanCanvas');
    if (panel && toggle) {
        if (isCleanCanvasCollapsed) {
            panel.classList.add('collapsed');
            toggle.textContent = 'Show';
        } else {
            panel.classList.remove('collapsed');
            toggle.textContent = 'Hide';
        }
    }
}

// Toggle error-correction blocks visibility
function toggleBlocksPanel() {
    isBlocksCollapsed = !isBlocksCollapsed;
    const panel = document.getElementById('blocksPanel');
    const toggle = document.getElementById('toggleBlocks');
    if (panel && toggle) {
        if (isBlocksCollapsed) {
            panel.classList.add('collapsed');
            toggle.textContent = 'Show';
        } else {
            panel.classList.remove('collapsed');
            toggle.textContent = 'Hide';
        }
    }
}

// Toggle format information visibility
function toggleFormatInfo() {
    isFormatInfoCollapsed = !isFormatInfoCollapsed;
    const content = document.getElementById('formatInfoContent');
    const toggle = document.getElementById('toggleFormatInfo');
    if (content && toggle) {
        if (isFormatInfoCollapsed) {
            content.classList.add('collapsed');
            toggle.textContent = 'Show';
        } else {
            content.classList.remove('collapsed');
            toggle.textContent = 'Hide';
        }
    }
}

// Toggle recovery controls visibility
function toggleRecovery() {
    isRecoveryCollapsed = !isRecoveryCollapsed;
    const content = document.getElementById('recoveryContent');
    const toggle = document.getElementById('toggleRecovery');
    if (content && toggle) {
        if (isRecoveryCollapsed) {
            content.classList.add('collapsed');
            toggle.textContent = 'Show';
        } else {
            content.classList.remove('collapsed');
            toggle.textContent = 'Hide';
        }
    }
}

// Toggle error correction controls visibility
function toggleErrorCorrection() {
    isErrorCorrectionCollapsed = !isErrorCorrectionCollapsed;
    const content = document.getElementById('errorCorrectionContent');
    const toggle = document.getElementById('toggleErrorCorrection');
    if (content && toggle) {
        if (isErrorCorrectionCollapsed) {
            content.classList.add('collapsed');
            toggle.textContent = 'Show';
        } else {
            content.classList.remove('collapsed');
            toggle.textContent = 'Hide';
        }
    }
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

    cleanCanvas.width = canvasSize;
    cleanCanvas.height = canvasSize;

    // Fill with white background
    cleanCtx.fillStyle = 'white';
    cleanCtx.fillRect(0, 0, canvasSize, canvasSize);

    // Draw modules with appropriate colors
    for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
            const isBlack = moduleMatrix[row][col];
            const color = getModuleColor(row, col, isBlack, moduleCount);

            if (color !== 'white') {
                cleanCtx.fillStyle = color;
                const x = (quietZone + col) * modulePixelSize;
                const y = (quietZone + row) * modulePixelSize;
                cleanCtx.fillRect(x, y, modulePixelSize, modulePixelSize);
            }
        }
    }

    // Draw outlines around highlighted modules (current byte being read)
    if (currentHighlight.length > 0) {
        cleanCtx.strokeStyle = '#FF8C00'; // Dark orange
        cleanCtx.lineWidth = 2;
        for (const pos of currentHighlight) {
            const x = (quietZone + pos.col) * modulePixelSize;
            const y = (quietZone + pos.row) * modulePixelSize;
            cleanCtx.strokeRect(x, y, modulePixelSize, modulePixelSize);
        }
    }
}

// Draw the image and grid
function drawImageWithGrid() {
    if (!currentImage || !imageData) return;

    const top = parseInt(borderTop.value) || 0;
    const bottom = parseInt(borderBottom.value) || 0;
    const left = parseInt(borderLeft.value) || 0;
    const right = parseInt(borderRight.value) || 0;

    const version = parseInt(versionSelect.value);
    const moduleCount = getModuleCount(version);

    // Calculate module size
    const moduleSize = calculateModuleSize(imageData, top, left);

    // Update info display
    document.getElementById('moduleSize').textContent = moduleSize.toFixed(2);
    document.getElementById('versionInfo').textContent = `${moduleCount}x${moduleCount}`;
    document.getElementById('versionLabel').textContent = `Version ${version}:`;

    // Set canvas size to match image
    canvas.width = currentImage.width;
    canvas.height = currentImage.height;

    // Draw the image
    ctx.drawImage(currentImage, 0, 0);

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.lineWidth = 1;

    const startX = left;
    const startY = top;
    const gridWidth = canvas.width - left - right;
    const gridHeight = canvas.height - top - bottom;

    // Draw vertical lines
    for (let i = 0; i <= moduleCount; i++) {
        const x = startX + (i * gridWidth / moduleCount);
        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, startY + gridHeight);
        ctx.stroke();
    }

    // Draw horizontal lines
    for (let i = 0; i <= moduleCount; i++) {
        const y = startY + (i * gridHeight / moduleCount);
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(startX + gridWidth, y);
        ctx.stroke();
    }

    // Draw border outline
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(left, top, gridWidth, gridHeight);

    // Sample modules and draw clean QR
    moduleMatrix = sampleModules();

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

    // Extract and display format information
    const formatBits = extractFormatInfo();
    if (formatBits) {
        const formatInfo = decodeFormatInfo(formatBits);
        if (formatInfo) {
            document.getElementById('eccLevel').textContent = formatInfo.eccLevel;
            document.getElementById('maskPattern').textContent = formatInfo.maskPattern;
            // Update tab 2 info as well
            document.getElementById('eccLevel2').textContent = formatInfo.eccLevel;
            document.getElementById('maskPattern2').textContent = formatInfo.maskPattern;
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
    usedModules = null;
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

    // Clear canvases
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cleanCtx = cleanCanvas.getContext('2d');
    cleanCtx.clearRect(0, 0, cleanCanvas.width, cleanCanvas.height);

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
    document.getElementById('eccLevel').textContent = '-';
    document.getElementById('eccLevel2').textContent = '-';
    document.getElementById('maskPattern').textContent = '-';
    document.getElementById('maskPattern2').textContent = '-';
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
