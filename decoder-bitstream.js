// decoder-bitstream.js
// Bitstream recovery, de-interleaving, and mode/size decoding functions

// Get character count bit length based on mode and version
function getCharCountBitLength(mode, version) {
    // Returns the number of bits used for character count based on mode and version
    const bitLengths = {
        'Numeric': [10, 12, 14],        // v1-9, v10-26, v27-40
        'Alphanumeric': [9, 11, 13],    // v1-9, v10-26, v27-40
        'Byte': [8, 16, 16],            // v1-9, v10-40, v10-40
        'Kanji': [8, 10, 12]            // v1-9, v10-26, v27-40
    };

    if (!bitLengths[mode]) return 8; // default

    if (version <= 9) return bitLengths[mode][0];
    if (version <= 26) return bitLengths[mode][1];
    return bitLengths[mode][2];
}

// Decode ECI assignment number from bit string
// Returns { value: number, bitsRead: number }
function decodeECIAssignment(bits, startIndex) {
    if (startIndex >= bits.length) {
        return { value: 0, bitsRead: 0 };
    }

    const firstBit = bits[startIndex];

    if (firstBit === '0') {
        // Value 0-127: 8 bits total (0 + 7 bits)
        if (startIndex + 8 > bits.length) {
            return { value: 0, bitsRead: 0 };
        }
        const valueBits = bits.slice(startIndex + 1, startIndex + 8);
        return {
            value: parseInt(valueBits, 2),
            bitsRead: 8
        };
    } else if (startIndex + 1 < bits.length && bits[startIndex + 1] === '0') {
        // Value 128-16383: 16 bits total (10 + 14 bits)
        if (startIndex + 16 > bits.length) {
            return { value: 0, bitsRead: 0 };
        }
        const valueBits = bits.slice(startIndex + 2, startIndex + 16);
        return {
            value: parseInt(valueBits, 2),
            bitsRead: 16
        };
    } else {
        // Value 16384-999999: 24 bits total (110 + 21 bits)
        if (startIndex + 24 > bits.length) {
            return { value: 0, bitsRead: 0 };
        }
        const valueBits = bits.slice(startIndex + 3, startIndex + 24);
        return {
            value: parseInt(valueBits, 2),
            bitsRead: 24
        };
    }
}

// Get character encoding name from ECI assignment number
function getECIEncoding(eciValue) {
    const eciMap = {
        0: 'CP437',           // Default
        1: 'ISO-8859-1',      // Latin-1 (Western European)
        2: 'CP437',           // US ASCII
        3: 'ISO-8859-1',      // Default (Latin-1)
        4: 'ISO-8859-2',      // Latin-2 (Central European)
        5: 'ISO-8859-3',      // Latin-3 (South European)
        6: 'ISO-8859-4',      // Latin-4 (North European)
        7: 'ISO-8859-5',      // Cyrillic
        8: 'ISO-8859-6',      // Arabic
        9: 'ISO-8859-7',      // Greek
        10: 'ISO-8859-8',     // Hebrew
        11: 'ISO-8859-9',     // Turkish
        12: 'ISO-8859-10',    // Nordic
        13: 'ISO-8859-11',    // Thai
        15: 'ISO-8859-13',    // Baltic
        16: 'ISO-8859-14',    // Celtic
        17: 'ISO-8859-15',    // Western European with Euro
        18: 'ISO-8859-16',    // South-Eastern European
        20: 'Shift_JIS',      // Japanese
        21: 'Windows-1250',   // Central European
        22: 'Windows-1251',   // Cyrillic
        23: 'Windows-1252',   // Western European
        24: 'Windows-1256',   // Arabic
        25: 'UTF-16BE',       // Unicode Big Endian
        26: 'UTF-8',          // Unicode (most common)
        27: 'US-ASCII',       // ASCII
        28: 'Big5',           // Traditional Chinese
        29: 'GB2312',         // Simplified Chinese
        30: 'EUC-KR'          // Korean
    };

    return eciMap[eciValue] || 'ISO-8859-1'; // Default to Latin-1
}

// Format bitstream with spaces every 8 bits
function formatBitstream(bits) {
    let formatted = '';
    for (let i = 0; i < bits.length; i++) {
        if (i > 0 && i % 8 === 0) {
            formatted += ' ';
        }
        formatted += bits[i];
    }
    return formatted;
}

// Update bitstream output display
function updateBitstreamOutput() {
    const output = document.getElementById('bitstreamOutput');
    if (output) {
        output.value = formatBitstream(recoveredBitstream);
    }
}

// Build ordered list of data module positions
function buildDataPositions() {
    if (!moduleMatrix) return [];

    const moduleCount = moduleMatrix.length;
    const positions = [];
    let row = moduleCount - 1;
    let col = moduleCount - 1;
    let goingUp = true;
    let inRightColumn = true;
    let safetyCounter = 0;
    const maxModules = moduleCount * moduleCount;

    while (safetyCounter < maxModules && col >= 0) {
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

    return positions;
}

// Reset bitstream state
function resetBitstreamState() {
    dataPositions = [];
    bitstreamIndex = 0;
    recoveredBitstream = '';
    currentHighlight = [];
    isBitstreamRecovered = false;
    deinterleavedDataBits = '';
    decodedMessageSize = null;

    const recoverAllButton = document.getElementById('recoverAllButton');
    const nextByteButton = document.getElementById('nextByteButton');
    if (recoverAllButton && nextByteButton) {
        recoverAllButton.disabled = true;
        nextByteButton.disabled = true;
    }

    const deinterleaveButton = document.getElementById('deinterleaveButton');
    if (deinterleaveButton) {
        deinterleaveButton.disabled = true;
    }

    const decodeModeButton = document.getElementById('decodeModeButton');
    const decodeSizeButton = document.getElementById('decodeSizeButton');
    if (decodeModeButton) decodeModeButton.disabled = true;
    if (decodeSizeButton) decodeSizeButton.disabled = true;

    // Clear visual codeword display
    const codewordDisplay = document.getElementById('codewordDisplay');
    const legend = document.getElementById('bitstreamLegend');
    if (codewordDisplay) codewordDisplay.innerHTML = '';
    if (legend) legend.style.display = 'none';

    updateBitstreamOutput();
}

// Sync recovered bitstream prefix from used modules
function syncRecoveredPrefixFromUsed() {
    dataPositions = buildDataPositions();
    recoveredBitstream = '';
    bitstreamIndex = 0;

    if (!usedModules || !dataPositions.length) {
        updateBitstreamOutput();
        return;
    }

    for (const pos of dataPositions) {
        if (usedModules[pos.row] && usedModules[pos.row][pos.col]) {
            recoveredBitstream += pos.bit ? '1' : '0';
            bitstreamIndex++;
        } else {
            break;
        }
    }

    updateBitstreamOutput();
}

// Recover the next byte from the bitstream
function recoverNextByte() {
    if (!moduleMatrix || isBitstreamRecovered) return;

    // Move previous highlights to "used"
    if (currentHighlight.length && usedModules) {
        currentHighlight.forEach(pos => {
            usedModules[pos.row][pos.col] = true;
        });
    }

    currentHighlight = [];
    dataPositions = dataPositions.length ? dataPositions : buildDataPositions();

    if (bitstreamIndex >= dataPositions.length) {
        document.getElementById('nextByteButton').disabled = true;
        document.getElementById('recoverAllButton').disabled = true;
        document.getElementById('deinterleaveButton').disabled = false;
        finalizeBitstreamRecovery();
        drawCleanQR();
        return;
    }

    const byteBits = [];
    while (byteBits.length < 8 && bitstreamIndex < dataPositions.length) {
        const pos = dataPositions[bitstreamIndex];
        byteBits.push(pos.bit ? '1' : '0');
        currentHighlight.push(pos);
        bitstreamIndex++;
    }

    recoveredBitstream += byteBits.join('');

    // Add visual codeword display
    addCodewordToDisplay(byteBits.join(''));

    updateBitstreamOutput();

    if (bitstreamIndex >= dataPositions.length) {
        document.getElementById('nextByteButton').disabled = true;
        document.getElementById('recoverAllButton').disabled = true;
        document.getElementById('deinterleaveButton').disabled = false;
        finalizeBitstreamRecovery();
    }

    drawCleanQR();
}

// Recover all remaining bitstream at once
function recoverAllBitstream() {
    if (!moduleMatrix || isBitstreamRecovered) return;

    // Commit any in-flight highlight to used/grey
    if (currentHighlight.length && usedModules) {
        currentHighlight.forEach(pos => {
            usedModules[pos.row][pos.col] = true;
        });
    }
    currentHighlight = [];

    dataPositions = dataPositions.length ? dataPositions : buildDataPositions();

    if (bitstreamIndex < dataPositions.length) {
        const remainingPositions = dataPositions.slice(bitstreamIndex);

        const remainingBits = remainingPositions
            .map(pos => (pos.bit ? '1' : '0'))
            .join('');

        // Mark all remaining positions as used (grey them out)
        if (usedModules) {
            remainingPositions.forEach(pos => {
                usedModules[pos.row][pos.col] = true;
            });
        }

        // Add visual codewords for all remaining bytes
        for (let i = 0; i < remainingBits.length; i += 8) {
            const codeword = remainingBits.slice(i, i + 8);
            if (codeword.length === 8) {
                recoveredBitstream += codeword;
                addCodewordToDisplay(codeword);
            }
        }

        bitstreamIndex = dataPositions.length;
        updateBitstreamOutput();
    }

    document.getElementById('nextByteButton').disabled = true;
    document.getElementById('recoverAllButton').disabled = true;
    document.getElementById('deinterleaveButton').disabled = false;
    finalizeBitstreamRecovery();

    // Redraw to show all modules as grey (used)
    drawCleanQR();
}

// Finalize bitstream recovery
function finalizeBitstreamRecovery() {
    isBitstreamRecovered = true;
    updateDeinterleaveAvailability();

    const cleanBits = recoveredBitstream.replace(/\s+/g, '');
    const decodeModeButton = document.getElementById('decodeModeButton');
    const version = parseInt(versionSelect.value, 10);
    const multi = hasMultipleBlocks(version, currentEccLevel);

    if (!multi) {
        // Single block: we can decode directly from recovered bits
        setDeinterleavedBits(cleanBits);
        const deinterleaveButton = document.getElementById('deinterleaveButton');
        if (deinterleaveButton) deinterleaveButton.disabled = false;
    } else {
        // Multi-block: wait for de-interleave step
        if (decodeModeButton) decodeModeButton.disabled = true;
    }
}

// Set deinterleaved data bits
function setDeinterleavedBits(bits) {
    deinterleavedDataBits = bits || '';
    // Preserve previously decoded size if available
    if (!isSizeDecoded) {
        decodedMessageSize = null;
    }
    if (deinterleavedDataBits.length >= 4) {
        const decodeModeButton = document.getElementById('decodeModeButton');
        if (decodeModeButton) decodeModeButton.disabled = false;
    }
}

// Update deinterleave button availability
function updateDeinterleaveAvailability() {
    const version = parseInt(versionSelect.value, 10);
    const deinterleaveButton = document.getElementById('deinterleaveButton');
    if (!deinterleaveButton) return;
    if (!currentEccLevel || !isBitstreamRecovered) {
        deinterleaveButton.disabled = true;
        return;
    }
    const multi = hasMultipleBlocks(version, currentEccLevel);
    // For single-block codes, still allow de-interleave to be clicked after recovery
    deinterleaveButton.disabled = false;
}

// De-interleave data from multiple blocks
function deinterleaveData() {
    if (!isBitstreamRecovered) {
        alert('Recover the full bitstream before de-interleaving.');
        return;
    }

    const version = parseInt(versionSelect.value, 10);
    const ecc = currentEccLevel;
    const config = getBlockConfig(version, ecc);
    if (!config) {
        alert(`No block size entry found for version ${version} and ECC ${ecc}.`);
        return;
    }

    const totalBlocks = (config.g1Blocks || 0) + (config.g2Blocks || 0);
    if (!totalBlocks) {
        alert('Block information is missing or invalid for this version/ECC.');
        return;
    }
    const blockCountSpan = document.getElementById('blockCount');
    if (blockCountSpan) {
        blockCountSpan.textContent = totalBlocks;
    }

    const dataLens = [];
    for (let i = 0; i < (config.g1Blocks || 0); i++) dataLens.push(config.g1Data || 0);
    for (let i = 0; i < (config.g2Blocks || 0); i++) dataLens.push(config.g2Data || 0);
    const maxDataLen = dataLens.length ? Math.max(...dataLens) : 0;
    const totalData = (config.g1Blocks || 0) * (config.g1Data || 0) + (config.g2Blocks || 0) * (config.g2Data || 0);
    const totalEc = totalBlocks * (config.ecPerBlock || 0);
    const expectedTotal = totalData + totalEc;

    const rawBits = recoveredBitstream.replace(/\s+/g, '');
    const requiredBits = expectedTotal * 8;
    if (expectedTotal && rawBits.length < requiredBits) {
        alert(`Bitstream has fewer bits (${rawBits.length}) than expected (${requiredBits}).`);
        return;
    }

    const usableBits = expectedTotal ? rawBits.slice(0, requiredBits) : rawBits;
    const bytes = [];
    for (let i = 0; i < usableBits.length; i += 8) {
        bytes.push(usableBits.slice(i, i + 8));
    }

    const blocks = Array.from({ length: totalBlocks }, (_, idx) => ({
        dataLen: dataLens[idx] || 0,
        data: [],
        ec: [],
        dataPhysicalIndexes: [],
        ecPhysicalIndexes: []
    }));

    let cursor = 0;
    // Data codewords (interleaved round-robin)
    for (let i = 0; i < maxDataLen; i++) {
        for (let b = 0; b < blocks.length; b++) {
            if (blocks[b].dataLen > i && cursor < bytes.length) {
                blocks[b].dataPhysicalIndexes.push(cursor);
                blocks[b].data.push(bytes[cursor++]);
            }
        }
    }

    // Error-correction codewords (same length per block)
    for (let i = 0; i < (config.ecPerBlock || 0); i++) {
        for (let b = 0; b < blocks.length; b++) {
            if (cursor < bytes.length) {
                blocks[b].ecPhysicalIndexes.push(cursor);
                blocks[b].ec.push(bytes[cursor++]);
            }
        }
    }

    let modeBitsNeeded = 4; // First 4 data bits are the mode indicator
    let bitsIntoByte = 0;   // Tracks bit count toward next byte boundary across blocks

    function formatDataBits(bitString) {
        // If we are mid-byte, prefix spaces so the next bits right-align to byte boundary
        let out = '';
        if (bitsIntoByte > 0) {
            const remaining = 8 - bitsIntoByte;
            out += ' '.repeat(remaining);
        }

        let i = 0;

        // Consume remaining mode bits first
        while (modeBitsNeeded > 0 && i < bitString.length) {
            out += bitString[i];
            modeBitsNeeded--;
            i++;
        }
        if (modeBitsNeeded === 0 && !out.endsWith(' ')) {
            out += ' ';
        }

        // After mode bits, group every 8 bits, carrying across blocks
        for (; i < bitString.length; i++) {
            out += bitString[i];
            bitsIntoByte++;
            if (bitsIntoByte === 8 && i < bitString.length - 1) {
                out += ' ';
                bitsIntoByte = 0;
            }
        }

        return out.trimEnd();
    }

    const dataStream = blocks.map(block => block.data.join('')).join('');
    setDeinterleavedBits(dataStream);
    isModeDecoded = false;
    isSizeDecoded = false;
    currentDataMode = '';
    decodedMessageSize = null;
    eciAssignment = null;
    eciEncoding = null;
    document.getElementById('dataMode').textContent = '-';
    document.getElementById('messageSize').textContent = '-';
    const decodeSizeButton = document.getElementById('decodeSizeButton');
    if (decodeSizeButton) decodeSizeButton.disabled = true;

    lastDeinterleaveMeta = {
        version,
        ecc: ecc,
        g1Blocks: config.g1Blocks || 0,
        g1Data: config.g1Data || 0,
        g2Blocks: config.g2Blocks || 0,
        g2Data: config.g2Data || 0,
        ecPerBlock: config.ecPerBlock || 0,
        totalBlocks,
        totalData,
        totalEc,
        expectedTotal,
        rawBitsLen: rawBits.length,
        usableBitsLen: usableBits.length,
        bytesLen: bytes.length
    };

    // Convert bit strings to byte values and store in qrBlocks for error correction
    qrBlocks = blocks.map(block => ({
        dataBytes: block.data.map(bits => parseInt(bits, 2)),
        eccBytes: block.ec.map(bits => parseInt(bits, 2)),
        originalData: block.data.map(bits => parseInt(bits, 2)), // Keep original for comparison
        dataModulePositions: block.dataPhysicalIndexes.map(getModulePositionsForRecoveredCodeword),
        eccModulePositions: block.ecPhysicalIndexes.map(getModulePositionsForRecoveredCodeword),
        syndromes: [],
        errorPositions: [],
        errorValues: []
    }));

    // Display blocks as hex
    displayBlocksAsHex();

    // Reorganize bitstream display to match block order
    reorganizeBitstreamDisplay(blocks);

    // Reset error correction state
    currentEcStep = 0;
    syndromeCalculated = false;
    errorCodewordOutlines = [];
    drawErrorCorrectionQR();

    // Enable Calculate Syndromes button
    const calculateSyndromesButton = document.getElementById('calculateSyndromesButton');
    if (calculateSyndromesButton) {
        calculateSyndromesButton.disabled = false;
    }

    // Allow message decoding demo right after de-interleave (before and after EC)
    const decodeMessageButton = document.getElementById('decodeMessageButton');
    if (decodeMessageButton) {
        decodeMessageButton.disabled = false;
    }

    // Disable after use to match other one-time actions
    const deinterleaveButton = document.getElementById('deinterleaveButton');
    if (deinterleaveButton) {
        deinterleaveButton.disabled = true;
    }
}

function getModulePositionsForRecoveredCodeword(byteIndex) {
    dataPositions = dataPositions.length ? dataPositions : buildDataPositions();
    return dataPositions
        .slice(byteIndex * 8, byteIndex * 8 + 8)
        .map(pos => ({ row: pos.row, col: pos.col }));
}

// Decode the mode indicator (first 4 bits from bottom-right)
function decodeMode() {
    if (isModeDecoded) return;
    if (!deinterleavedDataBits || deinterleavedDataBits.length < 4) {
        alert('De-interleave data (or recover bitstream for single-block codes) before decoding mode.');
        return;
    }

    // Ensure module positions are tracked for coloring
    if (!dataPositions || !dataPositions.length) {
        dataPositions = buildDataPositions();
    }
    if (!usedModules && moduleMatrix) {
        const moduleCount = moduleMatrix.length;
        usedModules = Array(moduleCount).fill(null).map(() => Array(moduleCount).fill(false));
    }

    let bitOffset = 0;
    let totalBitsUsed = 0;
    let displayLabel = '';

    // Read first mode indicator
    const modeBitsString = deinterleavedDataBits.slice(0, 4);
    const modeBits = parseInt(modeBitsString, 2);
    bitOffset = 4;
    totalBitsUsed = 4;

    // Decode the mode
    let modeName = 'Unknown';
    let hasECI = false;

    switch (modeBits) {
        case 0b0001:
            modeName = 'Numeric';
            break;
        case 0b0010:
            modeName = 'Alphanumeric';
            break;
        case 0b0100:
            modeName = 'Byte';
            break;
        case 0b1000:
            modeName = 'Kanji';
            break;
        case 0b0111:
            // ECI mode - need to read ECI assignment and then the actual mode
            hasECI = true;
            const eciResult = decodeECIAssignment(deinterleavedDataBits, bitOffset);
            if (eciResult.bitsRead === 0) {
                alert('Failed to decode ECI assignment number.');
                return;
            }

            eciAssignment = eciResult.value;
            eciEncoding = getECIEncoding(eciAssignment);
            bitOffset += eciResult.bitsRead;
            totalBitsUsed += eciResult.bitsRead;

            displayLabel = `ECI (0111) → ${eciEncoding} (${eciAssignment})\n`;

            // Now read the actual data mode (next 4 bits)
            if (bitOffset + 4 > deinterleavedDataBits.length) {
                alert('Not enough bits to read data mode after ECI.');
                return;
            }

            const actualModeBitsString = deinterleavedDataBits.slice(bitOffset, bitOffset + 4);
            const actualModeBits = parseInt(actualModeBitsString, 2);
            bitOffset += 4;
            totalBitsUsed += 4;

            switch (actualModeBits) {
                case 0b0001:
                    modeName = 'Numeric';
                    break;
                case 0b0010:
                    modeName = 'Alphanumeric';
                    break;
                case 0b0100:
                    modeName = 'Byte';
                    break;
                case 0b1000:
                    modeName = 'Kanji';
                    break;
                default:
                    modeName = `Unknown (${actualModeBits.toString(2).padStart(4, '0')})`;
            }

            displayLabel += `${modeName} (${actualModeBitsString})`;
            break;
        default:
            modeName = `Unknown (${modeBits.toString(2).padStart(4, '0')})`;
    }

    // Display the mode (with ECI info if applicable)
    currentDataMode = modeName;
    if (hasECI) {
        document.getElementById('dataMode').textContent = `${modeName} (ECI ${eciAssignment}: ${eciEncoding})`;
    } else {
        document.getElementById('dataMode').textContent = modeName;
        // Reset ECI state if no ECI
        eciAssignment = null;
        eciEncoding = null;
    }

    // Enable decode size button for supported modes
    const decodeSizeButton = document.getElementById('decodeSizeButton');
    if (['Numeric', 'Alphanumeric', 'Byte'].includes(modeName)) {
        decodeSizeButton.disabled = false;
    } else {
        decodeSizeButton.disabled = true;
    }

    // Mark all used bits for coloring
    if (usedModules && dataPositions && dataPositions.length >= totalBitsUsed) {
        for (let i = 0; i < totalBitsUsed; i++) {
            const pos = dataPositions[i];
            if (usedModules[pos.row]) {
                usedModules[pos.row][pos.col] = true;
            }
        }
    }

    // Update the bitstream display to replace mode bits with mode name
    const outputArea = document.getElementById('bitstreamOutput');
    if (outputArea && outputArea.value) {
        const currentOutput = outputArea.value;
        // Create label for display
        const modeLabel = hasECI ? displayLabel : `${modeName} (${modeBitsString})`;

        // Find where the bitstream starts (could be in block format or plain format)
        const blockMatch = currentOutput.match(/^Block \d+ data:\s*/);
        if (blockMatch) {
            // Multi-block format: replace bits after "Block 1 data:"
            const afterLabel = currentOutput.substring(blockMatch[0].length);
            const firstLineMatch = afterLabel.match(/^([^\n]*)/);
            const firstLine = firstLineMatch ? firstLineMatch[1] : afterLabel;
            const restOfOutput = afterLabel.substring(firstLine.length);
            const cleanBits = firstLine.replace(/\s+/g, '');
            const rest = cleanBits.substring(totalBitsUsed);
            outputArea.value = blockMatch[0] + modeLabel + '\n' + formatBitstream(rest) + restOfOutput;
        } else {
            // Single block or raw bitstream: replace bits
            const cleanOutput = currentOutput.replace(/\s+/g, '');
            if (cleanOutput.length >= totalBitsUsed) {
                const rest = cleanOutput.substring(totalBitsUsed);
                outputArea.value = modeLabel + '\n' + formatBitstream(rest);
            }
        }
    }

    // Mark as decoded and disable button
    isModeDecoded = true;
    const decodeModeButton = document.getElementById('decodeModeButton');
    decodeModeButton.disabled = true;

    // Redraw the cleaned QR to show used modules
    drawCleanQR();
}

// Decode the message size/character count
function decodeSize() {
    if (isSizeDecoded) return;

    // Only decode for supported modes
    if (!['Numeric', 'Alphanumeric', 'Byte'].includes(currentDataMode)) {
        alert(`Size decoding not yet supported for ${currentDataMode} mode.`);
        return;
    }

    if (!deinterleavedDataBits || deinterleavedDataBits.length < 12) {
        alert('Decode mode first, then ensure de-interleaved data is available.');
        return;
    }

    const version = parseInt(versionSelect.value, 10);
    const bitCount = getCharCountBitLength(currentDataMode, version);

    // Calculate start position (accounting for ECI if present)
    let start = 4; // Initial mode bits
    if (eciAssignment !== null) {
        // ECI is present, need to skip ECI assignment and actual mode bits
        const eciResult = decodeECIAssignment(deinterleavedDataBits, 4);
        start = 4 + eciResult.bitsRead + 4; // mode + ECI assignment + actual mode
    }

    if (deinterleavedDataBits.length < start + bitCount) {
        alert('Not enough bits to decode size.');
        return;
    }

    const sizeBitsStr = deinterleavedDataBits.slice(start, start + bitCount);
    const sizeValue = parseInt(sizeBitsStr, 2);
    decodedMessageSize = sizeValue;

    // Mark bits used for coloring (including header bits already marked in decodeMode)
    if (!dataPositions || !dataPositions.length) {
        dataPositions = buildDataPositions();
    }
    if (usedModules && dataPositions && dataPositions.length >= start + bitCount) {
        for (let i = start; i < start + bitCount; i++) {
            const pos = dataPositions[i];
            if (usedModules[pos.row]) {
                usedModules[pos.row][pos.col] = true;
            }
        }
    }

    // Display the size with appropriate units
    const unit = currentDataMode === 'Byte' ? 'bytes' : 'characters';
    document.getElementById('messageSize').textContent = `${sizeValue} ${unit}`;

    // Update the bitstream display to replace size bits with size label
    const outputArea = document.getElementById('bitstreamOutput');
    if (outputArea && outputArea.value) {
        const currentOutput = outputArea.value;
        const sizeLabel = `${sizeValue} ${unit} (${sizeBitsStr})`;

        // Find where the bitstream starts (could be in block format or plain format)
        const blockMatch = currentOutput.match(/^Block \d+ data:\s*/);
        if (blockMatch) {
            // Multi-block format: need to find and replace size bits after mode label
            const afterLabel = currentOutput.substring(blockMatch[0].length);
            // Find the mode label (ends with parentheses and newline)
            const modeMatch = afterLabel.match(/^([^\(]+\([01]{4}\))\n/);
            if (modeMatch) {
                const modeLabel = modeMatch[1];
                const afterMode = afterLabel.substring(modeMatch[0].length);
                // Get just the first line of bits (before the first newline)
                const firstLineMatch = afterMode.match(/^([^\n]*)/);
                const firstLine = firstLineMatch ? firstLineMatch[1] : afterMode;
                const restOfOutput = afterMode.substring(firstLine.length);
                // Strip spaces from just this line
                const cleanFirstLine = firstLine.replace(/\s+/g, '');
                const rest = cleanFirstLine.substring(bitCount);
                outputArea.value = blockMatch[0] + modeLabel + '\n' + sizeLabel + '\n' + formatBitstream(rest) + restOfOutput;
            }
        } else {
            // Single block: replace bits after mode label
            const modeMatch = currentOutput.match(/^([^\(]+\([01]{4}\))\n/);
            if (modeMatch) {
                const modeLabel = modeMatch[1];
                const afterMode = currentOutput.substring(modeMatch[0].length);
                const cleanAfterMode = afterMode.replace(/\s+/g, '');
                if (cleanAfterMode.length >= bitCount) {
                    const rest = cleanAfterMode.substring(bitCount);
                    outputArea.value = modeLabel + '\n' + sizeLabel + '\n' + formatBitstream(rest);
                }
            }
        }
    }

    // Mark as decoded and disable button
    isSizeDecoded = true;
    const decodeSizeButton = document.getElementById('decodeSizeButton');
    decodeSizeButton.disabled = true;

    // Redraw the cleaned QR to show used modules
    drawCleanQR();
}
