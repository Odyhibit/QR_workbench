// decoder.js
// Main decoder file - contains state variables, DOM references, and initialization
// All functions are now in separate modules

// DOM element references
const imageInput = document.getElementById('imageInput');
const versionSelect = document.getElementById('versionSelect');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const cleanCanvas = document.getElementById('cleanCanvas');
const cleanCtx = cleanCanvas.getContext('2d');

const borderTop = document.getElementById('borderTop');
const borderBottom = document.getElementById('borderBottom');
const borderLeft = document.getElementById('borderLeft');
const borderRight = document.getElementById('borderRight');

// State variables - shared across all modules
let currentImage = null;
let imageData = null;
let moduleMatrix = null; // 2D array of module values (true = black, false = white)
let usedModules = null; // 2D array tracking which modules have been decoded/used
let isUnmasked = false;
let isModeDecoded = false;
let isSizeDecoded = false;
let isBitstreamRecovered = false;
let currentMaskPattern = -1;
let currentDataMode = '';
let dataPositions = []; // Ordered list of data modules for recovery
let bitstreamIndex = 0; // Next bit position to consume from dataPositions
let recoveredBitstream = ''; // Accumulated bitstream
let currentHighlight = []; // Modules highlighted for the current byte
let isMarkingCollapsed = false;
let isCleanCanvasCollapsed = false;
let isBlocksCollapsed = false;
let isBitstreamCollapsed = false;
let isFormatInfoCollapsed = false;
let isRecoveryCollapsed = false;
let isErrorCorrectionCollapsed = false;
let currentEccLevel = '';
let deinterleavedDataBits = ''; // Concatenated data bits after de-interleaving
let decodedMessageSize = null;
let lastDeinterleaveMeta = null; // Debug info for block sizing
let eciAssignment = null; // ECI assignment number (null if no ECI)
let eciEncoding = null; // Character encoding from ECI
let markedComponents = {
    finders: false,
    alignment: false,
    format: false,
    timing: false,
    dark: false,
    version: false
};

// Error correction state
let qrBlocks = []; // Array of {dataBytes: [], eccBytes: [], syndromes: [], errorPositions: [], errorValues: [], originalData: []}
let currentEcStep = 0; // 0=none, 1=syndromes calculated, 2=errors located, 3=errors valued, 4=corrected
let syndromeCalculated = false;

// Initialize version dropdown (1-40)
for (let i = 1; i <= 40; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `Version ${i} (${17 + i * 4}x${17 + i * 4})`;
    if (i === 1) option.selected = true;
    versionSelect.appendChild(option);
}

// Event handlers

// Handle image upload
imageInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Reset all state before loading new image
    resetDecoderState();

    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            currentImage = img;

            // Create a temporary canvas to get image data
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(img, 0, 0);
            imageData = tempCtx.getImageData(0, 0, img.width, img.height);

            // Detect borders automatically
            const top = findTopBorder(imageData);
            const bottom = findBottomBorder(imageData);
            const left = findLeftBorder(imageData);
            const right = findRightBorder(imageData);

            // Set border inputs
            borderTop.value = top;
            borderBottom.value = bottom;
            borderLeft.value = left;
            borderRight.value = right;

            // Update detected borders display
            document.getElementById('detectedTop').textContent = top;
            document.getElementById('detectedBottom').textContent = bottom;
            document.getElementById('detectedLeft').textContent = left;
            document.getElementById('detectedRight').textContent = right;

            // Detect version automatically
            const detectedVersion = detectVersion(imageData, top, bottom, left, right);
            versionSelect.value = detectedVersion;

            // Draw the grid
            drawImageWithGrid();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// Redraw when controls change
versionSelect.addEventListener('change', function() {
    drawImageWithGrid();
});
borderTop.addEventListener('input', drawImageWithGrid);
borderBottom.addEventListener('input', drawImageWithGrid);
borderLeft.addEventListener('input', drawImageWithGrid);
borderRight.addEventListener('input', drawImageWithGrid);
