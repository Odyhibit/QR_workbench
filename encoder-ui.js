// ========== UI AND DISPLAY FUNCTIONS ==========

// Calculate character capacity for a given version, ECC level, and mode
function calculateCapacity(version, eccLevel, mode, capacityTable) {
    const key = `${version}-${eccLevel}`;
    const dataCodewords = capacityTable[key];
    if (!dataCodewords) return 0;

    // Total data bits available
    const totalBits = dataCodewords * 8;

    // Character count indicator size depends on version and mode
    let charCountBits;
    if (mode === 'numeric') {
        if (version <= 9) charCountBits = 10;
        else if (version <= 26) charCountBits = 12;
        else charCountBits = 14;
    } else if (mode === 'alphanumeric') {
        if (version <= 9) charCountBits = 9;
        else if (version <= 26) charCountBits = 11;
        else charCountBits = 13;
    } else { // byte
        if (version <= 9) charCountBits = 8;
        else charCountBits = 16;
    }

    // Mode indicator: 4 bits
    // Terminator: up to 4 bits (we'll account for this conservatively)
    const overheadBits = 4 + charCountBits + 4;
    const availableBits = totalBits - overheadBits;

    // Calculate character capacity based on mode
    let capacity;
    if (mode === 'numeric') {
        // 3 digits per 10 bits
        const groups = Math.floor(availableBits / 10);
        const remainder = availableBits % 10;
        capacity = groups * 3;
        if (remainder >= 7) capacity += 2; // 2 digits fit in 7 bits
        else if (remainder >= 4) capacity += 1; // 1 digit fits in 4 bits
    } else if (mode === 'alphanumeric') {
        // 2 characters per 11 bits
        const groups = Math.floor(availableBits / 11);
        const remainder = availableBits % 11;
        capacity = groups * 2;
        if (remainder >= 6) capacity += 1; // 1 character fits in 6 bits
    } else { // byte
        // 1 byte per 8 bits
        capacity = Math.floor(availableBits / 8);
    }

    return capacity;
}

// Get the minimum version needed for a given message length, ECC level, and mode
function getMinimumVersion(messageLength, eccLevel, mode, capacityTable) {
    for (let version = 1; version <= 40; version++) {
        const capacity = calculateCapacity(version, eccLevel, mode, capacityTable);
        if (capacity >= messageLength) {
            return version;
        }
    }
    return 40; // Maximum version
}

// Populate version dropdown
function populateVersionDropdown(currentMessage, currentMode, currentEccLevel, currentVersion, versionSelect, capacityTable) {
    versionSelect.innerHTML = '';

    const messageLen = currentMessage.length;
    const minVersion = messageLen > 0 ? getMinimumVersion(messageLen, currentEccLevel, currentMode, capacityTable) : 1;

    for (let version = 1; version <= 40; version++) {
        const capacity = calculateCapacity(version, currentEccLevel, currentMode, capacityTable);
        const option = document.createElement('option');

        // Format capacity display based on mode
        let capacityText;
        if (currentMode === 'numeric') {
            capacityText = `${capacity} digits`;
        } else if (currentMode === 'alphanumeric') {
            capacityText = `${capacity} chars`;
        } else {
            capacityText = `${capacity} bytes`;
        }

        option.value = version;
        option.textContent = `Ver ${version} (${capacityText})`;

        // Disable versions that are too small
        if (version < minVersion) {
            option.disabled = true;
            option.textContent += ' - Too small';
        }

        versionSelect.appendChild(option);
    }

    // Set current version (or minimum if current is too small)
    if (currentVersion < minVersion) {
        currentVersion = minVersion;
    }
    versionSelect.value = currentVersion;

    return currentVersion;
}

// Update capacity display panel
function updateCapacityDisplay(currentVersion, currentEccLevel, currentMode, currentMessage, capacityTable) {
    const capacity = calculateCapacity(currentVersion, currentEccLevel, currentMode, capacityTable);
    const messageLen = currentMessage.length;

    document.getElementById('selectedVersion').textContent = currentVersion;

    // Format capacity based on mode
    if (currentMode === 'numeric') {
        document.getElementById('versionCapacity').textContent = `${capacity} digits`;
    } else if (currentMode === 'alphanumeric') {
        document.getElementById('versionCapacity').textContent = `${capacity} characters`;
    } else {
        document.getElementById('versionCapacity').textContent = `${capacity} bytes`;
    }

    // Calculate usage
    if (messageLen === 0) {
        document.getElementById('capacityUsage').textContent = '0%';
    } else {
        const usagePercent = Math.round((messageLen / capacity) * 100);
        document.getElementById('capacityUsage').textContent = `${messageLen} / ${capacity} (${usagePercent}%)`;
    }
}

// Update charset information display
function updateCharsetInfo(currentMode) {
    const info = {
        numeric: 'Allowed: 0-9',
        alphanumeric: 'Allowed: 0-9, A-Z, space, $ % * + - . / :',
        byte: 'Allowed: Any characters (ISO-8859-1)'
    };

    document.getElementById('charsetInfo').textContent = info[currentMode];
}

// Validate character based on current mode
function isCharValid(char, currentMode, NUMERIC_CHARSET, ALPHANUMERIC_CHARSET) {
    switch (currentMode) {
        case 'numeric':
            return NUMERIC_CHARSET.includes(char);
        case 'alphanumeric':
            return ALPHANUMERIC_CHARSET.includes(char);
        case 'byte':
            // Byte mode accepts anything, but technically should be ISO-8859-1
            // For educational purposes, we'll accept all characters
            return true;
        default:
            return false;
    }
}

// Escape HTML special characters
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
        '\n': '<br>',
        ' ': '&nbsp;'
    };
    return text.replace(/[&<>"'\n ]/g, m => map[m]);
}

// Validate entire message and update display
function validateMessage(currentMessage, currentMode, NUMERIC_CHARSET, ALPHANUMERIC_CHARSET) {
    const charDisplay = document.getElementById('charDisplay');
    const messageLength = document.getElementById('messageLength');
    const validCount = document.getElementById('validCount');
    const invalidCount = document.getElementById('invalidCount');
    const validationMessage = document.getElementById('validationMessage');

    if (currentMessage.length === 0) {
        charDisplay.innerHTML = '<span style="color: #999;">Enter a message to see character validation...</span>';
        messageLength.textContent = '0';
        validCount.textContent = '0';
        invalidCount.textContent = '0';
        validationMessage.style.display = 'none';
        return;
    }

    let validChars = 0;
    let invalidChars = 0;
    let html = '';

    // Process each character
    for (let i = 0; i < currentMessage.length; i++) {
        const char = currentMessage[i];
        const valid = isCharValid(char, currentMode, NUMERIC_CHARSET, ALPHANUMERIC_CHARSET);

        if (valid) {
            validChars++;
            html += `<span class="char-valid">${escapeHtml(char)}</span>`;
        } else {
            invalidChars++;
            html += `<span class="char-invalid">${escapeHtml(char)}</span>`;
        }
    }

    // Update display
    charDisplay.innerHTML = html;
    messageLength.textContent = currentMessage.length;
    validCount.textContent = validChars;
    invalidCount.textContent = invalidChars;

    // Update validation message
    if (invalidChars === 0) {
        validationMessage.textContent = 'All characters are valid for the selected mode.';
        validationMessage.className = 'validation-info success';
        validationMessage.style.display = 'block';
    } else {
        validationMessage.textContent = `${invalidChars} character${invalidChars > 1 ? 's are' : ' is'} invalid for ${currentMode} mode. Invalid characters are shown in red.`;
        validationMessage.className = 'validation-info warning';
        validationMessage.style.display = 'block';
    }
}

// Tab switching function
function switchTab(index) {
    const tabs = document.querySelectorAll('.tab-button');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach((tab, i) => {
        if (i === index) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    contents.forEach((content, i) => {
        if (i === index) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });

    // If switching to Encode tab, refresh it if padding was edited
    if (index === 1) {
        console.log('Switched to Encode tab (index 1)');
        if (typeof performEncodeTabRefresh === 'function') {
            setTimeout(() => {
                console.log('Triggering performEncodeTabRefresh...');
                performEncodeTabRefresh();
            }, 50); // Increased delay to ensure DOM is ready
        } else {
            console.warn('performEncodeTabRefresh function not found!');
        }
    }

    // If switching to Padding Editor tab, initialize it
    if (index === 2 && currentMatrix) {
        setTimeout(() => {
            initializePaddingEditor();
        }, 10);
    }

    // If switching to Size & Color tab, initialize it
    if (index === 3 && currentMatrix) {
        setTimeout(() => {
            if (typeof initializeSizeColorEditor === 'function') {
                initializeSizeColorEditor();
            }
        }, 10);
    }

    // If switching to Module Delete tab, initialize it
    if (index === 4 && currentMatrix) {
        setTimeout(() => {
            if (typeof initModuleDeleteEditor === 'function') {
                initModuleDeleteEditor();
            }
        }, 10);
    }
}

// Toggle custom padding section
let isCustomPaddingCollapsed = false;
function toggleCustomPadding() {
    isCustomPaddingCollapsed = !isCustomPaddingCollapsed;
    const content = document.getElementById('customPaddingContent');
    const toggle = document.getElementById('toggleCustomPadding');
    if (isCustomPaddingCollapsed) {
        content.style.display = 'none';
        toggle.textContent = 'Show';
    } else {
        content.style.display = 'block';
        toggle.textContent = 'Hide';
    }
}

// Validate hex input (accepts space and comma delimiters)
function validateHexInput(input) {
    // Remove spaces and commas, check if remaining characters are valid hex
    const cleaned = input.replace(/[\s,]/g, '');
    // Valid if empty or all hex characters
    return cleaned.length === 0 || /^[0-9A-Fa-f]*$/.test(cleaned);
}

// Parse custom padding hex (accepts space or comma delimiters)
function parseCustomPaddingHex(input) {
    // Remove all spaces and commas, then split into pairs
    const cleaned = input.replace(/[\s,]/g, '').toUpperCase();
    const bytes = [];

    for (let i = 0; i < cleaned.length; i += 2) {
        const hexByte = cleaned.substring(i, i + 2);
        if (hexByte.length === 2) {
            bytes.push(parseInt(hexByte, 16));
        } else if (hexByte.length === 1) {
            // Single character, treat as 0X
            bytes.push(parseInt(hexByte, 16));
        }
    }

    return bytes;
}

// Update padding byte count display
function updatePaddingByteCount(encodedBitstream) {
    const countElement = document.getElementById('paddingByteCount');
    if (encodedBitstream && encodedBitstream.padBytes) {
        countElement.textContent = `Padding bytes: ${encodedBitstream.padBytes.length}`;
    } else {
        countElement.textContent = 'Padding bytes: -';
    }
}

// Display bitstream with editable components
function displayBitstream(bitstream, currentMode, currentMessage) {
    const display = document.getElementById('bitstreamDisplay');

    let html = '';

    // Mode Indicator section
    html += `
        <div class="bitstream-section section-mode">
            <h4>1. Mode Indicator</h4>
            <div class="bit-info">4 bits - Identifies the encoding mode</div>
            <div class="bitstream-field" contenteditable="true" data-section="mode" spellcheck="false">${bitstream.modeIndicator}</div>
            <div class="bit-info" style="margin-top: 5px;">
                Numeric=0001, Alphanumeric=0010, Byte=0100
            </div>
        </div>
    `;

    // Character Count Indicator section
    html += `
        <div class="bitstream-section section-count">
            <h4>2. Character Count Indicator</h4>
            <div class="bit-info">${bitstream.charCount.length} bits - Number of characters in message</div>
            <div class="bitstream-field" contenteditable="true" data-section="count" spellcheck="false">${bitstream.charCount}</div>
            <div class="bit-info" style="margin-top: 5px;">
                Decimal: ${parseInt(bitstream.charCount, 2)} characters
            </div>
        </div>
    `;

    // Message Data section
    html += `
        <div class="bitstream-section section-data">
            <h4>3. Encoded Message Data</h4>
            <div class="bit-info">${bitstream.messageData.length} bits - Your message encoded in ${currentMode} mode</div>
            <div class="bitstream-field" contenteditable="true" data-section="data" spellcheck="false">${bitstream.messageData}</div>
            <div class="bit-info" style="margin-top: 5px;">
                Original message: "${currentMessage}"
            </div>
        </div>
    `;

    // Terminator section
    html += `
        <div class="bitstream-section section-padding">
            <h4>4. Terminator</h4>
            <div class="bit-info">${bitstream.terminator.length} bits - Signals end of message (up to 4 zeros)</div>
            <div class="bitstream-field" contenteditable="true" data-section="terminator" spellcheck="false">${bitstream.terminator}</div>
        </div>
    `;

    // Byte alignment padding section
    html += `
        <div class="bitstream-section section-mode">
            <h4>5. Byte Alignment Padding</h4>
            <div class="bit-info">${bitstream.bytePadding.length} bits - Pads to byte boundary</div>
            <div class="bitstream-field" contenteditable="true" data-section="byte-padding" spellcheck="false">${bitstream.bytePadding}</div>
        </div>
    `;

    // Pad bytes section
    html += `
        <div class="bitstream-section section-count">
            <h4>6. Pad Bytes</h4>
            <div class="bit-info">${bitstream.padBytes.length} bytes - Fills remaining capacity (Pattern: 0xEC 0x11)</div>
            <div class="hex-grid">
    `;

    bitstream.padBytes.forEach((byte, i) => {
        html += `<div class="hex-byte" contenteditable="true" data-section="pad-byte" data-index="${i}" spellcheck="false">${byte.toString(16).toUpperCase().padStart(2, '0')}</div>`;
    });

    html += `
            </div>
        </div>
    `;

    // ECC section (placeholder for now) - using neutral grey
    html += `
        <div class="bitstream-section" style="border-color: #999; background: #f5f5f5;">
            <h4>7. Error Correction Codewords (ECC)</h4>
            <div class="bit-info">Click "Calculate ECC" to generate error correction bytes</div>
            <div id="eccDisplay" class="hex-grid">
                <p style="color: #999; margin: 10px 0;">ECC not yet calculated...</p>
            </div>
        </div>
    `;

    display.innerHTML = html;

    // Update info panel
    document.getElementById('totalDataCodewords').textContent = bitstream.dataBytes.length;
    document.getElementById('messageBits').textContent = bitstream.messageBits;

    // Update padding byte count
    updatePaddingByteCount(bitstream);

    // Enable ECC calculation button, custom padding buttons
    document.getElementById('calculateEccButton').disabled = false;
    document.getElementById('generateQrButton').disabled = true;
    document.getElementById('zeroPaddingButton').disabled = false;
    document.getElementById('applyCustomPaddingButton').disabled = false;
}

// Encode bitstream (called by button)
function encodeBitstream(currentMessage, currentMode, currentVersion, currentEccLevel, capacityTable, NUMERIC_CHARSET, ALPHANUMERIC_CHARSET) {
    if (currentMessage.length === 0) {
        alert('Please enter a message first!');
        return null;
    }

    // Check for invalid characters
    let hasInvalid = false;
    for (let i = 0; i < currentMessage.length; i++) {
        if (!isCharValid(currentMessage[i], currentMode, NUMERIC_CHARSET, ALPHANUMERIC_CHARSET)) {
            hasInvalid = true;
            break;
        }
    }

    if (hasInvalid) {
        if (!confirm('Your message contains invalid characters for the selected mode. Encode anyway?')) {
            return null;
        }
    }

    // Generate bitstream
    const encodedBitstream = generateBitstream(currentMessage, currentMode, currentVersion, currentEccLevel, capacityTable);
    displayBitstream(encodedBitstream, currentMode, currentMessage);

    // Enable the Encode tab button and switch to it
    const encodeTabButton = document.querySelectorAll('.tab-button')[1];
    encodeTabButton.disabled = false;
    switchTab(1);

    return encodedBitstream;
}

// Display ECC in both editable and block views
function displayEcc(blocks) {
    // Color palette for blocks (same as decoder)
    const blockColors = [
        { bg: '#E3F2FD', border: '#1976D2' }, // Blue
        { bg: '#E8F5E9', border: '#388E3C' }, // Green
        { bg: '#FFF9C4', border: '#F9A825' }, // Yellow
        { bg: '#FCE4EC', border: '#C2185B' }  // Pink
    ];

    // Update the editable ECC display
    const eccDisplay = document.getElementById('eccDisplay');
    let eccHtml = '';

    blocks.forEach((block, blockIndex) => {
        const color = blockColors[blockIndex % blockColors.length];
        eccHtml += `<div style="grid-column: 1 / -1; margin: 10px 0 5px 0; padding: 5px; background: ${color.bg}; border-left: 4px solid ${color.border}; font-weight: bold; font-size: 12px;">Block ${blockIndex + 1} ECC (${block.ecc.length} bytes)</div>`;

        block.ecc.forEach((byte, byteIndex) => {
            eccHtml += `<div class="hex-byte" contenteditable="true" data-section="ecc-byte" data-block="${blockIndex}" data-index="${byteIndex}" spellcheck="false">${byte.toString(16).toUpperCase().padStart(2, '0')}</div>`;
        });
    });

    eccDisplay.innerHTML = eccHtml;

    // Update total ECC codewords
    const totalEcc = blocks.reduce((sum, block) => sum + block.ecc.length, 0);
    document.getElementById('totalEccCodewords').textContent = totalEcc;

    // Enable QR code generation button
    document.getElementById('generateQrButton').disabled = false;

    // Add block structure display below
    addBlockStructureDisplay(blocks);
}

// Read all edited values from contenteditable fields
function readAllEditedValues(encodedBitstream, blockSizeTable, currentVersion, currentEccLevel) {
    // If no blocks exist yet, return the original data
    if (!encodedBitstream || !encodedBitstream.blocks) {
        return { dataBytes: [], blocks: [] };
    }

    // Read bitstream sections
    const modeElem = document.querySelector('[data-section="mode"]');
    const countElem = document.querySelector('[data-section="count"]');
    const dataElem = document.querySelector('[data-section="data"]');
    const terminatorElem = document.querySelector('[data-section="terminator"]');
    const bytePaddingElem = document.querySelector('[data-section="byte-padding"]');

    // Helper function to clean bit strings (remove all non-01 characters)
    const cleanBitString = (str) => str.replace(/[^01]/g, '');

    if (modeElem) encodedBitstream.modeIndicator = cleanBitString(modeElem.textContent);
    if (countElem) encodedBitstream.charCount = cleanBitString(countElem.textContent);
    if (dataElem) encodedBitstream.messageData = cleanBitString(dataElem.textContent);
    if (terminatorElem) encodedBitstream.terminator = cleanBitString(terminatorElem.textContent);
    if (bytePaddingElem) encodedBitstream.bytePadding = cleanBitString(bytePaddingElem.textContent);

    // Read pad bytes
    document.querySelectorAll('[data-section="pad-byte"]').forEach(elem => {
        const index = parseInt(elem.getAttribute('data-index'));
        const hexValue = elem.textContent.trim();
        try {
            encodedBitstream.padBytes[index] = parseInt(hexValue, 16);
        } catch (e) {
            console.warn('Invalid hex value in pad byte:', hexValue);
        }
    });

    // Reconstruct data bytes from bitstream
    const dataBits = encodedBitstream.modeIndicator +
                     encodedBitstream.charCount +
                     encodedBitstream.messageData +
                     encodedBitstream.terminator +
                     encodedBitstream.bytePadding;

    const dataBytes = [];
    for (let i = 0; i < dataBits.length; i += 8) {
        const bitString = dataBits.substring(i, i + 8);
        if (bitString.length === 8) {
            const byte = parseInt(bitString, 2);
            if (!isNaN(byte)) {
                dataBytes.push(byte);
            } else {
                dataBytes.push(0); // Use 0 as fallback
            }
        }
    }

    encodedBitstream.padBytes.forEach(b => {
        dataBytes.push(isNaN(b) ? 0 : b);
    });

    // Update the existing blocks with new data from edited values
    const blocks = splitIntoBlocks(dataBytes, currentVersion, currentEccLevel, blockSizeTable);

    // Copy over ECC from old blocks and read edited ECC values
    encodedBitstream.blocks.forEach((oldBlock, blockIndex) => {
        if (blocks[blockIndex]) {
            // Copy ECC array (create a new copy to avoid reference issues)
            if (oldBlock.ecc && Array.isArray(oldBlock.ecc)) {
                blocks[blockIndex].ecc = [...oldBlock.ecc];
            } else {
                blocks[blockIndex].ecc = [];
            }
        }
    });

    // Read edited ECC bytes from UI
    document.querySelectorAll('[data-section="ecc-byte"]').forEach(elem => {
        const blockIndex = parseInt(elem.getAttribute('data-block'));
        const byteIndex = parseInt(elem.getAttribute('data-index'));
        const hexValue = elem.textContent.trim();
        try {
            if (blocks[blockIndex] && blocks[blockIndex].ecc) {
                blocks[blockIndex].ecc[byteIndex] = parseInt(hexValue, 16);
            }
        } catch (e) {
            console.warn('Invalid hex value in ECC:', hexValue);
        }
    });

    return { dataBytes, blocks };
}

// Add non-editable block structure display
function addBlockStructureDisplay(blocks) {
    const bitstreamDisplay = document.getElementById('bitstreamDisplay');

    // Remove existing block structure display if it exists
    const existingBlockDisplay = document.getElementById('blockStructureDisplay');
    if (existingBlockDisplay) {
        existingBlockDisplay.remove();
    }

    // Color palette (same as above)
    const blockColors = [
        { bg: '#E3F2FD', border: '#1976D2' },
        { bg: '#E8F5E9', border: '#388E3C' },
        { bg: '#FFF9C4', border: '#F9A825' },
        { bg: '#FCE4EC', border: '#C2185B' }
    ];

    let html = `
        <div id="blockStructureDisplay" style="margin-top: 30px; padding-top: 20px; border-top: 3px solid #ddd;">
            <h2>Block Structure (Read-Only View)</h2>
            <p style="color: #666; margin-bottom: 20px;">This shows the current data values (including any edits) organized into blocks before interleaving. Each block contains its data codewords followed by its ECC codewords.</p>
    `;

    blocks.forEach((block, blockIndex) => {
        const color = blockColors[blockIndex % blockColors.length];

        html += `
            <div style="margin-bottom: 20px; padding: 15px; background: ${color.bg}; border: 2px solid ${color.border}; border-radius: 4px;">
                <h3 style="margin: 0 0 10px 0;">Block ${blockIndex + 1}${block.isShort ? ' (Short)' : ' (Long)'}</h3>

                <div style="margin-bottom: 15px;">
                    <h4 style="margin: 0 0 5px 0; font-size: 13px;">Data Codewords (${block.data.length} bytes)</h4>
                    <div class="hex-grid" style="background: white; padding: 8px; border-radius: 3px;">
        `;

        block.data.forEach(byte => {
            html += `<div class="hex-byte" style="cursor: default; background: #f9f9f9;">${byte.toString(16).toUpperCase().padStart(2, '0')}</div>`;
        });

        html += `
                    </div>
                </div>
        `;

        html += `
                <div>
                    <h4 style="margin: 0 0 5px 0; font-size: 13px;">ECC Codewords (${block.ecc.length} bytes)</h4>
                    <div class="hex-grid" style="background: white; padding: 8px; border-radius: 3px;">
        `;

        block.ecc.forEach(byte => {
            html += `<div class="hex-byte" style="cursor: default; background: #f9f9f9;">${byte.toString(16).toUpperCase().padStart(2, '0')}</div>`;
        });

        html += `
                    </div>
                </div>
            </div>
        `;
    });

    html += '</div>';

    // Append to existing bitstream display
    bitstreamDisplay.innerHTML += html;
}

// Display interleaved bytes for debugging
function displayInterleavedBytes(interleaved, blocks) {
    // Find or create the display container
    let container = document.getElementById('interleavedDisplay');
    if (!container) {
        // Create it if it doesn't exist
        const bitstreamDisplay = document.getElementById('bitstreamDisplay');
        const newContainer = document.createElement('div');
        newContainer.id = 'interleavedDisplay';
        newContainer.style.marginTop = '30px';
        newContainer.style.paddingTop = '20px';
        newContainer.style.borderTop = '3px solid #ddd';
        bitstreamDisplay.parentNode.appendChild(newContainer);
        container = newContainer;
    }

    // Calculate where data ends and ECC begins
    const totalDataBytes = blocks.reduce((sum, block) => sum + block.data.length, 0);
    const totalEccBytes = blocks.reduce((sum, block) => sum + block.ecc.length, 0);

    let html = `
        <h2>Interleaved Byte Stream (Debug)</h2>
        <p style="color: #666; margin-bottom: 20px;">
            Total: ${interleaved.length} bytes
            (${totalDataBytes} data + ${totalEccBytes} ECC)
        </p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 4px;">
            <h3 style="margin-top: 0; font-size: 14px;">Data Bytes (${totalDataBytes} bytes)</h3>
            <div class="hex-grid" style="margin-bottom: 20px;">
    `;

    // Display data bytes
    for (let i = 0; i < totalDataBytes; i++) {
        const byte = interleaved[i];
        html += `<div class="hex-byte" style="cursor: default; background: #e3f2fd;">${byte.toString(16).toUpperCase().padStart(2, '0')}</div>`;
    }

    html += `
            </div>
            <h3 style="font-size: 14px;">ECC Bytes (${totalEccBytes} bytes)</h3>
            <div class="hex-grid">
    `;

    // Display ECC bytes
    for (let i = totalDataBytes; i < interleaved.length; i++) {
        const byte = interleaved[i];
        html += `<div class="hex-byte" style="cursor: default; background: #e8f5e9;">${byte.toString(16).toUpperCase().padStart(2, '0')}</div>`;
    }

    html += `
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// Render QR code to canvas
function renderQrCode(matrix) {
    const canvas = document.getElementById('qrCanvas');
    const ctx = canvas.getContext('2d');

    const size = matrix.length;
    const quietZone = 4; // 4 modules on each side as per QR spec
    const moduleSize = Math.floor(Math.min(canvas.width, canvas.height) / (size + quietZone * 2));

    // Calculate total QR code size including quiet zone
    const totalSize = (size + quietZone * 2) * moduleSize;

    // Center the QR code on the canvas with even margins
    const offsetX = Math.floor((canvas.width - totalSize) / 2) + (quietZone * moduleSize);
    const offsetY = Math.floor((canvas.height - totalSize) / 2) + (quietZone * moduleSize);

    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw modules
    ctx.fillStyle = 'black';
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            if (matrix[row][col]) {
                ctx.fillRect(
                    offsetX + col * moduleSize,
                    offsetY + row * moduleSize,
                    moduleSize,
                    moduleSize
                );
            }
        }
    }

    // Show canvas
    canvas.style.display = 'block';
    document.getElementById('qrPlaceholder').style.display = 'none';
}
