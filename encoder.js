// DOM elements
const dataModeSelect = document.getElementById('dataModeSelect');
const eccLevelSelect = document.getElementById('eccLevelSelect');
const versionSelect = document.getElementById('versionSelect');
const messageInput = document.getElementById('messageInput');
const charDisplay = document.getElementById('charDisplay');
const charsetInfo = document.getElementById('charsetInfo');
const messageLength = document.getElementById('messageLength');
const validCount = document.getElementById('validCount');
const invalidCount = document.getElementById('invalidCount');
const validationMessage = document.getElementById('validationMessage');
const selectedVersion = document.getElementById('selectedVersion');
const versionCapacity = document.getElementById('versionCapacity');
const capacityUsage = document.getElementById('capacityUsage');

// Character sets for each mode
const NUMERIC_CHARSET = '0123456789';
const ALPHANUMERIC_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

// Tables are loaded from qr-block-tables.js
// capacityTable and blockSizeTable are now available globally

// Current state
let currentMode = 'byte';
let currentEccLevel = 'M';
let currentVersion = 1;
let currentMessage = '';

// State for encoded bitstream
let encodedBitstream = null;

// State for padding editor
let currentMatrix = null;

// Initialize
function init() {
    // Set up event listeners
    dataModeSelect.addEventListener('change', onModeChange);
    eccLevelSelect.addEventListener('change', onEccLevelChange);
    versionSelect.addEventListener('change', onVersionChange);
    messageInput.addEventListener('input', onMessageInput);

    // Custom padding hex input validation
    const customPaddingInput = document.getElementById('customPaddingInput');
    customPaddingInput.addEventListener('input', function() {
        const isValid = validateHexInput(this.value);
        if (isValid) {
            this.style.outline = '';
        } else {
            this.style.outline = '2px solid red';
        }
    });

    // Initial state
    currentEccLevel = eccLevelSelect.value;
    updateCharsetInfo(currentMode);
    currentVersion = populateVersionDropdown(currentMessage, currentMode, currentEccLevel, currentVersion, versionSelect, capacityTable);
    updateCapacityDisplay(currentVersion, currentEccLevel, currentMode, currentMessage, capacityTable);
}

// Handle mode change
function onModeChange() {
    currentMode = dataModeSelect.value;
    updateCharsetInfo(currentMode);
    currentVersion = populateVersionDropdown(currentMessage, currentMode, currentEccLevel, currentVersion, versionSelect, capacityTable);
    updateCapacityDisplay(currentVersion, currentEccLevel, currentMode, currentMessage, capacityTable);
    validateMessage(currentMessage, currentMode, NUMERIC_CHARSET, ALPHANUMERIC_CHARSET);
}

// Handle ECC level change
function onEccLevelChange() {
    currentEccLevel = eccLevelSelect.value;
    currentVersion = populateVersionDropdown(currentMessage, currentMode, currentEccLevel, currentVersion, versionSelect, capacityTable);
    updateCapacityDisplay(currentVersion, currentEccLevel, currentMode, currentMessage, capacityTable);
}

// Handle version change
function onVersionChange() {
    currentVersion = parseInt(versionSelect.value);
    updateCapacityDisplay(currentVersion, currentEccLevel, currentMode, currentMessage, capacityTable);
}

// Handle message input
function onMessageInput() {
    currentMessage = messageInput.value;
    currentVersion = populateVersionDropdown(currentMessage, currentMode, currentEccLevel, currentVersion, versionSelect, capacityTable);
    updateCapacityDisplay(currentVersion, currentEccLevel, currentMode, currentMessage, capacityTable);
    validateMessage(currentMessage, currentMode, NUMERIC_CHARSET, ALPHANUMERIC_CHARSET);
}

// Button handlers - these are called from HTML onclick attributes
function onEncodeBitstreamClick() {
    const result = encodeBitstream(currentMessage, currentMode, currentVersion, currentEccLevel, capacityTable, NUMERIC_CHARSET, ALPHANUMERIC_CHARSET);
    if (result) {
        encodedBitstream = result;
    }
}

function onCalculateEccClick() {
    if (!encodedBitstream) {
        alert('Please encode bitstream first!');
        return;
    }

    // Read any edited values first
    let dataBytes = encodedBitstream.dataBytes;
    if (encodedBitstream.blocks) {
        // If blocks already exist, read edited values
        const edited = readAllEditedValues(encodedBitstream, blockSizeTable, currentVersion, currentEccLevel);
        dataBytes = edited.dataBytes;
    }

    // Split data into blocks
    const blocks = splitIntoBlocks(dataBytes, currentVersion, currentEccLevel, blockSizeTable);

    // Calculate ECC for each block
    calculateEccForBlocks(blocks);

    // Store blocks
    encodedBitstream.blocks = blocks;

    // Update display
    displayEcc(blocks);
}

function onGenerateQrCodeClick() {
    if (!encodedBitstream || !encodedBitstream.blocks) {
        alert('Please calculate ECC first!');
        return;
    }

    // Read any edited values
    const { blocks } = readAllEditedValues(encodedBitstream, blockSizeTable, currentVersion, currentEccLevel);

    // Interleave blocks
    const interleaved = interleaveBlocks(blocks);

    // Display interleaved bytes for debugging
    displayInterleavedBytes(interleaved, blocks);

    // Create QR matrix
    const size = getQrSize(currentVersion);
    const matrix = createMatrix(size);

    // Place function patterns (reserves their positions)
    placeFunctionPatterns(matrix, currentVersion);

    // Place data bits
    placeDataBits(matrix, interleaved);

    // Get selected mask pattern
    const maskPattern = parseInt(document.getElementById('maskPatternSelect').value);

    // Apply mask (only to data modules - function patterns are automatically skipped)
    applyMask(matrix, maskPattern, currentVersion);

    // Place format information (must be after mask since it encodes the mask pattern)
    placeFormatInfo(matrix, currentEccLevel, maskPattern, currentVersion);

    // Place version information (for version 7+)
    placeVersionInfo(matrix, currentVersion);

    // Show the QR code container
    document.getElementById('qrCodeContainer').style.display = 'block';

    // Render to canvas
    renderQrCode(matrix);

    // Store matrix globally for padding editor
    currentMatrix = matrix;

    // Enable Padding Editor tab
    const paddingEditorTab = document.querySelectorAll('.tab-button')[2];
    if (paddingEditorTab) {
        paddingEditorTab.disabled = false;
    }

    // Build padding editor data
    buildPaddingEditorData();
}

function buildPaddingEditorData() {
    if (!encodedBitstream || !encodedBitstream.blocks) {
        return;
    }

    // Check if there are any padding bytes
    if (encodedBitstream.padBytes.length === 0) {
        return; // No padding to edit
    }

    // Build the padding module map
    paddingModuleMap = buildPaddingModuleMap(
        encodedBitstream,
        encodedBitstream.blocks,
        currentVersion
    );

    // Build editable cells set
    editableCells.clear();
    paddingModuleMap.forEach((modules) => {
        modules.forEach(m => {
            editableCells.add(`${m.row},${m.col}`);
        });
    });

    // Store original padding bytes (deep copy)
    originalPaddingBytes = [...encodedBitstream.padBytes];

    // Store original matrix state (deep copy) - this is the masked matrix we'll display
    originalMatrix = currentMatrix.map(row => [...row]);

    // Clear any previous edits when generating a new QR code
    paddingEdits.clear();

    // Update info panel
    const size = 21 + (currentVersion - 1) * 4;
    document.getElementById('padEditorVersion').textContent = currentVersion;
    document.getElementById('padEditorSize').textContent = `${size}×${size}`;
    document.getElementById('padEditorByteCount').textContent = encodedBitstream.padBytes.length;
    document.getElementById('padEditorModuleCount').textContent = editableCells.size;
}

function onZeroPaddingClick() {
    if (!encodedBitstream) {
        alert('Please encode bitstream first!');
        return;
    }

    // Zero out the padding bytes in the data
    encodedBitstream = zeroPaddingBytes(encodedBitstream);

    // Update the editable padding bytes display to show 00
    const padByteElements = document.querySelectorAll('[data-section="pad-byte"]');
    padByteElements.forEach(elem => {
        elem.textContent = '00';
    });

    // Recalculate ECC with the new zeroed padding data
    const blocks = splitIntoBlocks(encodedBitstream.dataBytes, currentVersion, currentEccLevel, blockSizeTable);
    calculateEccForBlocks(blocks);
    encodedBitstream.blocks = blocks;

    // Update display to show the new data and ECC
    displayEcc(blocks);

    // Regenerate QR code with the new data (don't read from contenteditable fields)
    const interleaved = interleaveBlocks(blocks);
    displayInterleavedBytes(interleaved, blocks);

    const size = getQrSize(currentVersion);
    const matrix = createMatrix(size);
    placeFunctionPatterns(matrix, currentVersion);
    placeDataBits(matrix, interleaved);

    const maskPattern = parseInt(document.getElementById('maskPatternSelect').value);
    applyMask(matrix, maskPattern, currentVersion);
    placeFormatInfo(matrix, currentEccLevel, maskPattern, currentVersion);
    placeVersionInfo(matrix, currentVersion);

    document.getElementById('qrCodeContainer').style.display = 'block';
    renderQrCode(matrix);
}

function onApplyCustomPaddingClick() {
    if (!encodedBitstream) {
        alert('Please encode bitstream first!');
        return;
    }

    const customPaddingInput = document.getElementById('customPaddingInput');
    const inputValue = customPaddingInput.value.trim();

    // Check if input is valid
    if (!validateHexInput(inputValue)) {
        alert('Invalid hex characters detected. Please use only 0-9 and A-F, separated by spaces or commas.');
        return;
    }

    // Parse the hex input
    const customBytes = parseCustomPaddingHex(inputValue);

    if (customBytes.length === 0) {
        alert('No hex values provided.');
        return;
    }

    // Calculate where padding starts (mode + count + data + terminator + byte padding)
    const messageBits = encodedBitstream.modeIndicator.length +
                       encodedBitstream.charCount.length +
                       encodedBitstream.messageData.length +
                       encodedBitstream.terminator.length +
                       encodedBitstream.bytePadding.length;
    const messageBytes = Math.ceil(messageBits / 8);

    // Apply custom padding to data bytes
    const newDataBytes = [...encodedBitstream.dataBytes];
    const paddingLength = encodedBitstream.padBytes.length;

    // Replace padding bytes with custom values
    // If too short: leave remainder unchanged
    // If too long: truncate
    for (let i = 0; i < Math.min(customBytes.length, paddingLength); i++) {
        newDataBytes[messageBytes + i] = customBytes[i];
    }

    // Update the encodedBitstream
    encodedBitstream.dataBytes = newDataBytes;

    // Update the padBytes array for display
    const newPadBytes = [...encodedBitstream.padBytes];
    for (let i = 0; i < Math.min(customBytes.length, paddingLength); i++) {
        newPadBytes[i] = customBytes[i];
    }
    encodedBitstream.padBytes = newPadBytes;

    // Update the editable padding bytes display
    const padByteElements = document.querySelectorAll('[data-section="pad-byte"]');
    padByteElements.forEach((elem, index) => {
        if (index < customBytes.length) {
            elem.textContent = customBytes[index].toString(16).toUpperCase().padStart(2, '0');
        }
        // If customBytes is shorter, leave the rest unchanged (already displayed)
    });

    // Recalculate ECC with the new custom padding data
    const blocks = splitIntoBlocks(encodedBitstream.dataBytes, currentVersion, currentEccLevel, blockSizeTable);
    calculateEccForBlocks(blocks);
    encodedBitstream.blocks = blocks;

    // Update display to show the new data and ECC
    displayEcc(blocks);

    // Regenerate QR code with the new data
    const interleaved = interleaveBlocks(blocks);
    displayInterleavedBytes(interleaved, blocks);

    const size = getQrSize(currentVersion);
    const matrix = createMatrix(size);
    placeFunctionPatterns(matrix, currentVersion);
    placeDataBits(matrix, interleaved);

    const maskPattern = parseInt(document.getElementById('maskPatternSelect').value);
    applyMask(matrix, maskPattern, currentVersion);
    placeFormatInfo(matrix, currentEccLevel, maskPattern, currentVersion);
    placeVersionInfo(matrix, currentVersion);

    document.getElementById('qrCodeContainer').style.display = 'block';
    renderQrCode(matrix);
}

// Initialize on load
init();
