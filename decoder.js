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
const cleanCanvas3 = document.getElementById('cleanCanvas3');
const cleanCtx3 = cleanCanvas3.getContext('2d');
const errorCanvas = document.getElementById('errorCanvas');
const errorCtx = errorCanvas ? errorCanvas.getContext('2d') : null;

const borderTop = document.getElementById('borderTop');
const borderBottom = document.getElementById('borderBottom');
const borderLeft = document.getElementById('borderLeft');
const borderRight = document.getElementById('borderRight');
const cornerSelect = document.getElementById('cornerSelect');
const cornerInputs = {
    topLeft: {
        x: document.getElementById('cornerTopLeftX'),
        y: document.getElementById('cornerTopLeftY')
    },
    topRight: {
        x: document.getElementById('cornerTopRightX'),
        y: document.getElementById('cornerTopRightY')
    },
    bottomRight: {
        x: document.getElementById('cornerBottomRightX'),
        y: document.getElementById('cornerBottomRightY')
    },
    bottomLeft: {
        x: document.getElementById('cornerBottomLeftX'),
        y: document.getElementById('cornerBottomLeftY')
    }
};

// State variables - shared across all modules
let currentImage = null;
let imageData = null;
let moduleMatrix = null; // 2D array of module values (true = black, false = white)
let originalMatrix = null; // Copy of matrix before unmasking (for reset)
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
let qrCorners = null;
let gridHomography = null;
let errorCodewordOutlines = [];
let draggingCorner = null;
let didDragCorner = false;

const CORNER_HANDLE_RADIUS = 14;

// Initialize version dropdown (1-40)
for (let i = 1; i <= 40; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `Version ${i} (${17 + i * 4}x${17 + i * 4})`;
    if (i === 1) option.selected = true;
    versionSelect.appendChild(option);
}

// Initialize format dropdown event listeners
initFormatDropdowns();

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
            setCornersFromBorders(top, bottom, left, right);

            // Update detected borders display
            document.getElementById('detectedTop').textContent = top;
            document.getElementById('detectedBottom').textContent = bottom;
            document.getElementById('detectedLeft').textContent = left;
            document.getElementById('detectedRight').textContent = right;

            // Detect version automatically
            const detectedVersion = detectVersionFromCorners(imageData, qrCorners) ||
                detectVersion(imageData, top, bottom, left, right);
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

Object.values(cornerInputs).forEach(pair => {
    pair.x.addEventListener('input', onCornerInputChange);
    pair.y.addEventListener('input', onCornerInputChange);
});

document.getElementById('useDetectedBorders').addEventListener('click', function() {
    const top = parseInt(borderTop.value) || 0;
    const bottom = parseInt(borderBottom.value) || 0;
    const left = parseInt(borderLeft.value) || 0;
    const right = parseInt(borderRight.value) || 0;
    setCornersFromBorders(top, bottom, left, right);
    drawImageWithGrid();
});

function getCanvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: Math.round((event.clientX - rect.left) * scaleX),
        y: Math.round((event.clientY - rect.top) * scaleY)
    };
}

function getCanvasDisplayScale() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return 1;
    return Math.max(canvas.width / rect.width, canvas.height / rect.height, 1);
}

function getNearestCornerKey(point, maxDistance = null) {
    if (!qrCorners) return null;

    const hitRadius = maxDistance || CORNER_HANDLE_RADIUS * getCanvasDisplayScale();
    let nearestKey = null;
    let nearestDistance = Infinity;

    Object.entries(qrCorners).forEach(([key, corner]) => {
        if (!corner) return;
        const distance = Math.hypot(point.x - corner.x, point.y - corner.y);
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestKey = key;
        }
    });

    return nearestDistance <= hitRadius ? nearestKey : null;
}

function updateSingleCorner(cornerKey, point) {
    if (!qrCorners) qrCorners = readCornersFromInputs();
    qrCorners[cornerKey] = point;
    cornerSelect.value = cornerKey;
    writeCornersToInputs(qrCorners);
    drawImageWithGrid();
}

canvas.addEventListener('mousedown', function(event) {
    if (!currentImage) return;

    const point = getCanvasPoint(event);
    const nearestCorner = getNearestCornerKey(point);

    if (nearestCorner) {
        draggingCorner = nearestCorner;
        didDragCorner = false;
        cornerSelect.value = nearestCorner;
        drawImageWithGrid();
        canvas.style.cursor = 'grabbing';
        event.preventDefault();
    }
});

canvas.addEventListener('mousemove', function(event) {
    if (!currentImage) return;

    const point = getCanvasPoint(event);

    if (draggingCorner) {
        didDragCorner = true;
        updateSingleCorner(draggingCorner, point);
        return;
    }

    canvas.style.cursor = getNearestCornerKey(point) ? 'grab' : 'crosshair';
});

window.addEventListener('mouseup', function() {
    if (!draggingCorner) return;
    draggingCorner = null;
    canvas.style.cursor = 'crosshair';
});

canvas.addEventListener('mouseleave', function() {
    if (!draggingCorner) {
        canvas.style.cursor = 'crosshair';
    }
});

canvas.addEventListener('click', function(event) {
    if (!currentImage) return;

    if (didDragCorner) {
        didDragCorner = false;
        return;
    }

    const point = getCanvasPoint(event);
    const nearestCorner = getNearestCornerKey(point);

    if (nearestCorner) {
        cornerSelect.value = nearestCorner;
        drawImageWithGrid();
        return;
    }

    updateSingleCorner(cornerSelect.value, point);
});
