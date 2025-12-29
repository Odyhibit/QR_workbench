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

// Initialize
function init() {
    // Set up event listeners
    dataModeSelect.addEventListener('change', onModeChange);
    eccLevelSelect.addEventListener('change', onEccLevelChange);
    versionSelect.addEventListener('change', onVersionChange);
    messageInput.addEventListener('input', onMessageInput);

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

    // Disable zero padding button until QR is generated
    document.getElementById('zeroPaddingButton').disabled = true;
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

    // Enable the zero padding button
    document.getElementById('zeroPaddingButton').disabled = false;
}

function onZeroPaddingClick() {
    if (!encodedBitstream || !encodedBitstream.blocks) {
        alert('Please generate QR code first!');
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

// Initialize on load
init();
