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

// QR Code capacity data: version-ecc -> data codewords
const blockSizeTableCsv = `
1-L,19,7,1,19,,,19
1-M,16,10,1,16,,,16
1-Q,13,13,1,13,,,13
1-H,9,17,1,9,,,9
2-L,34,10,1,34,,,34
2-M,28,16,1,28,,,28
2-Q,22,22,1,22,,,22
2-H,16,28,1,16,,,16
3-L,55,15,1,55,,,55
3-M,44,26,1,44,,,44
3-Q,34,18,2,17,,,34
3-H,26,22,2,13,,,26
4-L,80,20,1,80,,,80
4-M,64,18,2,32,,,64
4-Q,48,26,2,24,,,48
4-H,36,16,4,9,,,36
5-L,108,26,1,108,,,108
5-M,86,24,2,43,,,86
5-Q,62,18,2,15,2,16,62
5-H,46,22,2,11,2,12,46
6-L,136,18,2,68,,,136
6-M,108,16,4,27,,,108
6-Q,76,24,4,19,,,76
6-H,60,28,4,15,,,60
7-L,156,20,2,78,,,156
7-M,124,18,4,31,,,124
7-Q,88,18,2,14,4,15,88
7-H,66,26,4,13,1,14,66
8-L,194,24,2,97,,,194
8-M,154,22,2,38,2,39,154
8-Q,110,22,4,18,2,19,110
8-H,86,26,4,14,2,15,86
9-L,232,30,2,116,,,232
9-M,182,22,3,36,2,37,182
9-Q,132,20,4,16,4,17,132
9-H,100,24,4,12,4,13,100
10-L,274,18,2,68,2,69,274
10-M,216,26,4,43,1,44,216
10-Q,154,24,6,19,2,20,154
10-H,122,28,6,15,2,16,122
11-L,324,20,4,81,,,324
11-M,254,30,1,50,4,51,254
11-Q,180,28,4,22,4,23,180
11-H,140,24,3,12,8,13,140
12-L,370,24,2,92,2,93,370
12-M,290,22,6,36,2,37,290
12-Q,206,26,4,20,6,21,206
12-H,158,28,7,14,4,15,158
13-L,428,26,4,107,,,428
13-M,334,22,8,37,1,38,334
13-Q,244,24,8,20,4,21,244
13-H,180,22,12,11,4,12,180
14-L,461,30,3,115,1,116,461
14-M,365,24,4,40,5,41,365
14-Q,261,20,11,16,5,17,261
14-H,197,24,11,12,5,13,197
15-L,523,22,5,87,1,88,523
15-M,415,24,5,41,5,42,415
15-Q,295,30,5,24,7,25,295
15-H,223,24,11,12,7,13,223
16-L,589,24,5,98,1,99,589
16-M,453,28,7,45,3,46,453
16-Q,325,24,15,19,2,20,325
16-H,253,30,3,15,13,16,253
17-L,647,28,1,107,5,108,647
17-M,507,28,10,46,1,47,507
17-Q,367,28,1,22,15,23,367
17-H,283,28,2,14,17,15,283
18-L,721,30,5,120,1,121,721
18-M,563,26,9,43,4,44,563
18-Q,397,28,17,22,1,23,397
18-H,313,28,2,14,19,15,313
19-L,795,28,3,113,4,114,795
19-M,627,26,3,44,11,45,627
19-Q,445,26,17,21,4,22,445
19-H,341,26,9,13,16,14,341
20-L,861,28,3,107,5,108,861
20-M,669,26,3,41,13,42,669
20-Q,485,30,15,24,5,25,485
20-H,385,28,15,15,10,16,385
21-L,932,28,4,116,4,117,932
21-M,714,26,17,42,,,714
21-Q,512,28,17,22,6,23,512
21-H,406,30,19,16,6,17,406
22-L,1006,28,2,111,7,112,1006
22-M,782,28,17,46,,,782
22-Q,568,30,7,24,16,25,568
22-H,442,24,34,13,,,442
23-L,1094,30,4,121,5,122,1094
23-M,860,28,4,47,14,48,860
23-Q,614,30,11,24,14,25,614
23-H,464,30,16,15,14,16,464
24-L,1174,30,6,117,4,118,1174
24-M,914,28,6,45,14,46,914
24-Q,664,30,11,24,16,25,664
24-H,514,30,30,16,2,17,514
25-L,1276,26,8,106,4,107,1276
25-M,1000,28,8,47,13,48,1000
25-Q,718,30,7,24,22,25,718
25-H,538,30,22,15,13,16,538
26-L,1370,28,10,114,2,115,1370
26-M,1062,28,19,46,4,47,1062
26-Q,754,28,28,22,6,23,754
26-H,596,30,33,16,4,17,596
27-L,1468,30,8,122,4,123,1468
27-M,1128,28,22,45,3,46,1128
27-Q,808,30,8,23,26,24,808
27-H,628,30,12,15,28,16,628
28-L,1531,30,3,117,10,118,1531
28-M,1193,28,3,45,23,46,1193
28-Q,871,30,4,24,31,25,871
28-H,661,30,11,15,31,16,661
29-L,1631,30,7,116,7,117,1631
29-M,1267,28,21,45,7,46,1267
29-Q,911,30,1,23,37,24,911
29-H,701,30,19,15,26,16,701
30-L,1735,30,5,115,10,116,1735
30-M,1373,28,19,47,10,48,1373
30-Q,985,30,15,24,25,25,985
30-H,745,30,23,15,25,16,745
31-L,1843,30,13,115,3,116,1843
31-M,1455,28,2,46,29,47,1455
31-Q,1033,30,42,24,1,25,1033
31-H,793,30,23,15,28,16,793
32-L,1955,30,17,115,,,1955
32-M,1541,28,10,46,23,47,1541
32-Q,1115,30,10,24,35,25,1115
32-H,845,30,19,15,35,16,845
33-L,2071,30,17,115,1,116,2071
33-M,1631,28,14,46,21,47,1631
33-Q,1171,30,29,24,19,25,1171
33-H,901,30,11,15,46,16,901
34-L,2191,30,13,115,6,116,2191
34-M,1725,28,14,46,23,47,1725
34-Q,1231,30,44,24,7,25,1231
34-H,961,30,59,16,1,17,961
35-L,2306,30,12,121,7,122,2306
35-M,1812,28,12,47,26,48,1812
35-Q,1286,30,39,24,14,25,1286
35-H,986,30,22,15,41,16,986
36-L,2434,30,6,121,14,122,2434
36-M,1914,28,6,47,34,48,1914
36-Q,1354,30,46,24,10,25,1354
36-H,1054,30,2,15,64,16,1054
37-L,2566,30,17,122,4,123,2566
37-M,1992,28,29,46,14,47,1992
37-Q,1426,30,49,24,10,25,1426
37-H,1096,30,24,15,46,16,1096
38-L,2702,30,4,122,18,123,2702
38-M,2102,28,13,46,32,47,2102
38-Q,1502,30,48,24,14,25,1502
38-H,1142,30,42,15,32,16,1142
39-L,2812,30,20,117,4,118,2812
39-M,2216,28,40,47,7,48,2216
39-Q,1582,30,43,24,22,25,1582
39-H,1222,30,10,15,67,16,1222
40-L,2956,30,19,118,6,119,2956
40-M,2334,28,18,47,31,48,2334
40-Q,1666,30,34,24,34,25,1666
40-H,1276,30,20,15,61,16,1276`;

// Parse block size table (shared with Reed-Solomon section)
function parseCapacityTable(csv) {
    const table = {};
    csv.trim().split('\n').forEach(line => {
        const parts = line.trim().split(',');
        const key = parts[0]; // e.g., "1-L"
        table[key] = parseInt(parts[1]); // Just the data codewords count
    });
    return table;
}

const capacityTable = parseCapacityTable(blockSizeTableCsv);

// Current state
let currentMode = 'byte';
let currentEccLevel = 'M';
let currentVersion = 1;
let currentMessage = '';

// Calculate character capacity for a given version, ECC level, and mode
function calculateCapacity(version, eccLevel, mode) {
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
function getMinimumVersion(messageLength, eccLevel, mode) {
    for (let version = 1; version <= 40; version++) {
        const capacity = calculateCapacity(version, eccLevel, mode);
        if (capacity >= messageLength) {
            return version;
        }
    }
    return 40; // Maximum version
}

// Populate version dropdown
function populateVersionDropdown() {
    versionSelect.innerHTML = '';

    const messageLen = currentMessage.length;
    const minVersion = messageLen > 0 ? getMinimumVersion(messageLen, currentEccLevel, currentMode) : 1;

    for (let version = 1; version <= 40; version++) {
        const capacity = calculateCapacity(version, currentEccLevel, currentMode);
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

    updateCapacityDisplay();
}

// Update capacity display panel
function updateCapacityDisplay() {
    const capacity = calculateCapacity(currentVersion, currentEccLevel, currentMode);
    const messageLen = currentMessage.length;

    selectedVersion.textContent = currentVersion;

    // Format capacity based on mode
    if (currentMode === 'numeric') {
        versionCapacity.textContent = `${capacity} digits`;
    } else if (currentMode === 'alphanumeric') {
        versionCapacity.textContent = `${capacity} characters`;
    } else {
        versionCapacity.textContent = `${capacity} bytes`;
    }

    // Calculate usage
    if (messageLen === 0) {
        capacityUsage.textContent = '0%';
    } else {
        const usagePercent = Math.round((messageLen / capacity) * 100);
        capacityUsage.textContent = `${messageLen} / ${capacity} (${usagePercent}%)`;
    }
}

// Initialize
function init() {
    // Set up event listeners
    dataModeSelect.addEventListener('change', onModeChange);
    eccLevelSelect.addEventListener('change', onEccLevelChange);
    versionSelect.addEventListener('change', onVersionChange);
    messageInput.addEventListener('input', onMessageInput);

    // Initial state
    currentEccLevel = eccLevelSelect.value;
    updateCharsetInfo();
    populateVersionDropdown();
}

// Handle mode change
function onModeChange() {
    currentMode = dataModeSelect.value;
    updateCharsetInfo();
    populateVersionDropdown();
    validateMessage();
}

// Handle ECC level change
function onEccLevelChange() {
    currentEccLevel = eccLevelSelect.value;
    populateVersionDropdown();
}

// Handle version change
function onVersionChange() {
    currentVersion = parseInt(versionSelect.value);
    updateCapacityDisplay();
}

// Handle message input
function onMessageInput() {
    currentMessage = messageInput.value;
    populateVersionDropdown();
    validateMessage();
}

// Update charset information display
function updateCharsetInfo() {
    const info = {
        numeric: 'Allowed: 0-9',
        alphanumeric: 'Allowed: 0-9, A-Z, space, $ % * + - . / :',
        byte: 'Allowed: Any characters (ISO-8859-1)'
    };

    charsetInfo.textContent = info[currentMode];
}

// Validate character based on current mode
function isCharValid(char) {
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

// Validate entire message and update display
function validateMessage() {
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
        const valid = isCharValid(char);

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

// Tab switching function (for future use)
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
}

// ========== REED-SOLOMON ENCODER ==========

// Reed-Solomon math classes (copied from decoder)
class GenericGF {
    constructor(primitive, size, genBase) {
        this.primitive = primitive;
        this.size = size;
        this.generatorBase = genBase;
        this.expTable = new Array(size);
        this.logTable = new Array(size);

        let x = 1;
        for (let i = 0; i < size; i++) {
            this.expTable[i] = x;
            x <<= 1;
            if (x >= size) {
                x ^= primitive;
                x &= size - 1;
            }
        }

        for (let i = 0; i < size - 1; i++) {
            this.logTable[this.expTable[i]] = i;
        }

        this.zero = new GenericGFPoly(this, [0]);
        this.one = new GenericGFPoly(this, [1]);
    }

    addOrSubtract(a, b) {
        return a ^ b;
    }

    multiply(a, b) {
        if (a === 0 || b === 0) return 0;
        return this.expTable[(this.logTable[a] + this.logTable[b]) % (this.size - 1)];
    }

    buildMonomial(degree, coefficient) {
        if (degree < 0) throw new Error('Invalid monomial degree');
        if (coefficient === 0) return this.zero;
        const coefficients = new Array(degree + 1).fill(0);
        coefficients[0] = coefficient;
        return new GenericGFPoly(this, coefficients);
    }
}

class GenericGFPoly {
    constructor(field, coefficients) {
        if (!coefficients || coefficients.length === 0) {
            throw new Error('No coefficients provided');
        }
        this.field = field;
        let firstNonZero = 0;
        while (firstNonZero < coefficients.length && coefficients[firstNonZero] === 0) {
            firstNonZero++;
        }
        this.coefficients = firstNonZero === coefficients.length ? [0] : coefficients.slice(firstNonZero);
    }

    getCoefficients() {
        return this.coefficients.slice();
    }

    getDegree() {
        return this.coefficients.length - 1;
    }

    isZero() {
        return this.coefficients[0] === 0;
    }

    multiply(other) {
        if (this.field !== other.field) {
            throw new Error('Fields do not match');
        }
        if (this.isZero() || other.isZero()) return this.field.zero;

        const aCoefficients = this.coefficients;
        const bCoefficients = other.coefficients;
        const product = new Array(aCoefficients.length + bCoefficients.length - 1).fill(0);
        for (let i = 0; i < aCoefficients.length; i++) {
            const aCoeff = aCoefficients[i];
            for (let j = 0; j < bCoefficients.length; j++) {
                product[i + j] = this.field.addOrSubtract(
                    product[i + j],
                    this.field.multiply(aCoeff, bCoefficients[j])
                );
            }
        }
        return new GenericGFPoly(this.field, product);
    }

    multiplyByMonomial(degree, coefficient) {
        if (degree < 0) throw new Error('Invalid monomial degree');
        if (coefficient === 0) return this.field.zero;

        const product = new Array(this.coefficients.length + degree).fill(0);
        for (let i = 0; i < this.coefficients.length; i++) {
            product[i] = this.field.multiply(this.coefficients[i], coefficient);
        }
        return new GenericGFPoly(this.field, product);
    }

    divide(other) {
        if (this.field !== other.field) {
            throw new Error('Fields do not match');
        }
        if (other.isZero()) {
            throw new Error('Divide by zero');
        }

        let quotient = this.field.zero;
        let remainder = this;

        const denominatorLeadingTerm = other.coefficients[0];
        const inverseDenominatorLeadingTerm = this.field.expTable[
            (this.field.size - 1) - this.field.logTable[denominatorLeadingTerm]
        ];

        while (remainder.getDegree() >= other.getDegree() && !remainder.isZero()) {
            const degreeDifference = remainder.getDegree() - other.getDegree();
            const scale = this.field.multiply(
                remainder.coefficients[0],
                inverseDenominatorLeadingTerm
            );
            const term = other.multiplyByMonomial(degreeDifference, scale);
            const iterationQuotient = this.field.buildMonomial(degreeDifference, scale);
            quotient = quotient.addOrSubtract(iterationQuotient);
            remainder = remainder.addOrSubtract(term);
        }

        return [quotient, remainder];
    }

    addOrSubtract(other) {
        if (this.field !== other.field) {
            throw new Error('Fields do not match');
        }
        if (this.isZero()) return other;
        if (other.isZero()) return this;

        let smallerCoefficients = this.coefficients;
        let largerCoefficients = other.coefficients;
        if (smallerCoefficients.length > largerCoefficients.length) {
            [smallerCoefficients, largerCoefficients] = [largerCoefficients, smallerCoefficients];
        }

        const lengthDiff = largerCoefficients.length - smallerCoefficients.length;
        const sumDiff = largerCoefficients.slice();
        for (let i = 0; i < smallerCoefficients.length; i++) {
            sumDiff[i + lengthDiff] = this.field.addOrSubtract(
                smallerCoefficients[i],
                largerCoefficients[i + lengthDiff]
            );
        }
        return new GenericGFPoly(this.field, sumDiff);
    }
}

// Reed-Solomon Encoder (using qrcodegen's algorithm)
class ReedSolomonEncoder {
    constructor() {
        this.field = new GenericGF(0x011D, 256, 0);
    }

    // Build Reed-Solomon generator polynomial (from qrcodegen)
    buildGenerator(degree) {
        if (degree < 1 || degree > 255) {
            throw new RangeError("Degree out of range");
        }

        // Polynomial coefficients stored from highest to lowest power
        let result = [];
        for (let i = 0; i < degree - 1; i++) {
            result.push(0);
        }
        result.push(1); // Start with x^0

        // Compute product polynomial (x - r^0) * (x - r^1) * ... * (x - r^{degree-1})
        let root = 1;
        for (let i = 0; i < degree; i++) {
            // Multiply current product by (x - r^i)
            for (let j = 0; j < result.length; j++) {
                result[j] = this.reedSolomonMultiply(result[j], root);
                if (j + 1 < result.length) {
                    result[j] ^= result[j + 1];
                }
            }
            root = this.reedSolomonMultiply(root, 0x02);
        }
        return result;
    }

    // Compute remainder (ECC bytes) using polynomial division (from qrcodegen)
    encode(data, eccCount) {
        const divisor = this.buildGenerator(eccCount);
        let result = divisor.map(_ => 0);

        for (const b of data) {
            const factor = b ^ result.shift();
            result.push(0);
            divisor.forEach((coef, i) => {
                result[i] ^= this.reedSolomonMultiply(coef, factor);
            });
        }

        return result;
    }

    // Reed-Solomon field multiplication (from qrcodegen)
    reedSolomonMultiply(x, y) {
        if (x >>> 8 !== 0 || y >>> 8 !== 0) {
            throw new RangeError("Byte out of range");
        }
        // Russian peasant multiplication
        let z = 0;
        for (let i = 7; i >= 0; i--) {
            z = (z << 1) ^ ((z >>> 7) * 0x11D);
            z ^= ((y >>> i) & 1) * x;
        }
        return z;
    }
}

// Parse block size table
function parseBlockSizeTable(csv) {
    const table = {};
    csv.trim().split('\n').forEach(line => {
        const parts = line.trim().split(',');
        const key = parts[0]; // e.g., "1-L"
        table[key] = {
            dataCodewords: parseInt(parts[1]),
            eccCodewordsPerBlock: parseInt(parts[2]),
            numBlocks: parseInt(parts[3]),
            dataCodewordsInGroup1: parseInt(parts[4]),
            numBlocksInGroup2: parts[5] ? parseInt(parts[5]) : 0,
            dataCodewordsInGroup2: parts[6] ? parseInt(parts[6]) : 0,
            totalDataCodewords: parseInt(parts[7])
        };
    });
    return table;
}

const blockSizeTable = parseBlockSizeTable(blockSizeTableCsv);

// ========== ENCODING FUNCTIONS ==========

// State for encoded bitstream
let encodedBitstream = null;

// Mode indicator values
const MODE_INDICATORS = {
    numeric: '0001',
    alphanumeric: '0010',
    byte: '0100'
};

// Get character count indicator size
function getCharCountIndicatorSize(version, mode) {
    if (mode === 'numeric') {
        if (version <= 9) return 10;
        else if (version <= 26) return 12;
        else return 14;
    } else if (mode === 'alphanumeric') {
        if (version <= 9) return 9;
        else if (version <= 26) return 11;
        else return 13;
    } else { // byte
        if (version <= 9) return 8;
        else return 16;
    }
}

// Convert number to binary string with specified length
function toBinary(num, length) {
    return num.toString(2).padStart(length, '0');
}

// Encode numeric message
function encodeNumeric(message) {
    let bits = '';
    // Process 3 digits at a time
    for (let i = 0; i < message.length; i += 3) {
        const chunk = message.substring(i, i + 3);
        const value = parseInt(chunk);
        if (chunk.length === 3) {
            bits += toBinary(value, 10);
        } else if (chunk.length === 2) {
            bits += toBinary(value, 7);
        } else {
            bits += toBinary(value, 4);
        }
    }
    return bits;
}

// Alphanumeric character values
const ALPHANUMERIC_TABLE = {
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'A': 10, 'B': 11, 'C': 12, 'D': 13, 'E': 14, 'F': 15, 'G': 16, 'H': 17, 'I': 18,
    'J': 19, 'K': 20, 'L': 21, 'M': 22, 'N': 23, 'O': 24, 'P': 25, 'Q': 26, 'R': 27,
    'S': 28, 'T': 29, 'U': 30, 'V': 31, 'W': 32, 'X': 33, 'Y': 34, 'Z': 35, ' ': 36,
    '$': 37, '%': 38, '*': 39, '+': 40, '-': 41, '.': 42, '/': 43, ':': 44
};

// Encode alphanumeric message
function encodeAlphanumeric(message) {
    let bits = '';
    // Process 2 characters at a time
    for (let i = 0; i < message.length; i += 2) {
        if (i + 1 < message.length) {
            const val1 = ALPHANUMERIC_TABLE[message[i]];
            const val2 = ALPHANUMERIC_TABLE[message[i + 1]];
            const value = val1 * 45 + val2;
            bits += toBinary(value, 11);
        } else {
            const val1 = ALPHANUMERIC_TABLE[message[i]];
            bits += toBinary(val1, 6);
        }
    }
    return bits;
}

// Encode byte message
function encodeByte(message) {
    let bits = '';
    for (let i = 0; i < message.length; i++) {
        const charCode = message.charCodeAt(i);
        bits += toBinary(charCode, 8);
    }
    return bits;
}

// Encode message based on mode
function encodeMessage(message, mode) {
    if (mode === 'numeric') {
        return encodeNumeric(message);
    } else if (mode === 'alphanumeric') {
        return encodeAlphanumeric(message);
    } else { // byte
        return encodeByte(message);
    }
}

// Generate complete bitstream
function generateBitstream() {
    const key = `${currentVersion}-${currentEccLevel}`;
    const dataCodewords = capacityTable[key];
    const totalBits = dataCodewords * 8;

    // 1. Mode indicator
    const modeIndicator = MODE_INDICATORS[currentMode];

    // 2. Character count indicator
    const charCountSize = getCharCountIndicatorSize(currentVersion, currentMode);
    const charCount = toBinary(currentMessage.length, charCountSize);

    // 3. Encoded message data
    const messageData = encodeMessage(currentMessage, currentMode);

    // 4. Terminator (up to 4 bits of zeros)
    let bitstream = modeIndicator + charCount + messageData;
    const terminatorLength = Math.min(4, totalBits - bitstream.length);
    const terminator = '0'.repeat(terminatorLength);
    bitstream += terminator;

    // 5. Pad to byte boundary
    const padToByte = (8 - (bitstream.length % 8)) % 8;
    const bytePadding = '0'.repeat(padToByte);
    bitstream += bytePadding;

    // 6. Pad bytes (0xEC 0x11 pattern)
    const padBytes = [];
    let padByteIndex = 0;
    const padPattern = [0xEC, 0x11];
    while (bitstream.length < totalBits) {
        const padByte = padPattern[padByteIndex % 2];
        padBytes.push(padByte);
        bitstream += toBinary(padByte, 8);
        padByteIndex++;
    }

    // Convert bitstream to byte array
    const dataBytes = [];
    for (let i = 0; i < bitstream.length; i += 8) {
        const byte = parseInt(bitstream.substring(i, i + 8), 2);
        dataBytes.push(byte);
    }

    return {
        modeIndicator,
        charCount,
        messageData,
        terminator,
        bytePadding,
        padBytes,
        dataBytes,
        totalBits: bitstream.length,
        messageBits: modeIndicator.length + charCount.length + messageData.length
    };
}

// Display bitstream with editable components
function displayBitstream(bitstream) {
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

    // Enable ECC calculation button
    document.getElementById('calculateEccButton').disabled = false;
}

// Encode bitstream (called by button)
function encodeBitstream() {
    if (currentMessage.length === 0) {
        alert('Please enter a message first!');
        return;
    }

    // Check for invalid characters
    let hasInvalid = false;
    for (let i = 0; i < currentMessage.length; i++) {
        if (!isCharValid(currentMessage[i])) {
            hasInvalid = true;
            break;
        }
    }

    if (hasInvalid) {
        if (!confirm('Your message contains invalid characters for the selected mode. Encode anyway?')) {
            return;
        }
    }

    // Generate bitstream
    encodedBitstream = generateBitstream();
    displayBitstream(encodedBitstream);

    // Enable the Encode tab button and switch to it
    const encodeTabButton = document.querySelectorAll('.tab-button')[1];
    encodeTabButton.disabled = false;
    switchTab(1);
}

// Split data bytes into blocks (using block size table directly)
function splitIntoBlocks(dataBytes) {
    const key = `${currentVersion}-${currentEccLevel}`;
    const blockInfo = blockSizeTable[key];

    const blocks = [];
    let offset = 0;

    // Group 1 blocks (shorter blocks)
    // Note: blockInfo.numBlocks already represents only Group 1 blocks
    const numBlocksGroup1 = blockInfo.numBlocks;

    for (let i = 0; i < numBlocksGroup1; i++) {
        const blockData = dataBytes.slice(offset, offset + blockInfo.dataCodewordsInGroup1);
        blocks.push({
            data: blockData,
            eccCount: blockInfo.eccCodewordsPerBlock,
            ecc: [],
            isShort: blockInfo.numBlocksInGroup2 > 0 // Only short if there's a group 2
        });
        offset += blockInfo.dataCodewordsInGroup1;
    }

    // Group 2 blocks (one more data codeword)
    if (blockInfo.numBlocksInGroup2 > 0) {
        for (let i = 0; i < blockInfo.numBlocksInGroup2; i++) {
            const blockData = dataBytes.slice(offset, offset + blockInfo.dataCodewordsInGroup2);
            blocks.push({
                data: blockData,
                eccCount: blockInfo.eccCodewordsPerBlock,
                ecc: [],
                isShort: false // Group 2 blocks are "long"
            });
            offset += blockInfo.dataCodewordsInGroup2;
        }
    }

    return blocks;
}

// Calculate ECC for all blocks
function calculateEcc() {
    if (!encodedBitstream) {
        alert('Please encode bitstream first!');
        return;
    }

    // Read any edited values first
    let dataBytes = encodedBitstream.dataBytes;
    if (encodedBitstream.blocks) {
        // If blocks already exist, read edited values
        const edited = readAllEditedValues();
        dataBytes = edited.dataBytes;
    }

    // Split data into blocks
    const blocks = splitIntoBlocks(dataBytes);

    // Calculate ECC for each block
    const encoder = new ReedSolomonEncoder();
    blocks.forEach((block, index) => {
        // Compute ECC on the data bytes
        block.ecc = encoder.encode(block.data, block.eccCount);
    });

    // Store blocks
    encodedBitstream.blocks = blocks;

    // Update display
    displayEcc(blocks);
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
function readAllEditedValues() {
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
    const blocks = splitIntoBlocks(dataBytes);

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

// ========== QR CODE GENERATION ==========

// Interleave blocks (properly interleave data then ECC)
function interleaveBlocks(blocks) {
    const interleaved = [];

    // Find the maximum data and ECC lengths
    const maxDataLen = Math.max(...blocks.map(b => b.data.length));
    const maxEccLen = Math.max(...blocks.map(b => b.ecc.length));

    // Interleave data bytes
    for (let i = 0; i < maxDataLen; i++) {
        blocks.forEach(block => {
            if (i < block.data.length) {
                interleaved.push(block.data[i]);
            }
        });
    }

    // Interleave ECC bytes
    for (let i = 0; i < maxEccLen; i++) {
        blocks.forEach(block => {
            if (i < block.ecc.length) {
                interleaved.push(block.ecc[i]);
            }
        });
    }

    return interleaved;
}

// Get QR code size for version
function getQrSize(version) {
    return 21 + (version - 1) * 4;
}

// Create empty QR matrix
function createMatrix(size) {
    const matrix = [];
    for (let i = 0; i < size; i++) {
        matrix[i] = new Array(size).fill(null);
    }
    return matrix;
}

// Place finder pattern with separator
function placeFinder(matrix, row, col) {
    for (let i = -1; i <= 7; i++) {
        for (let j = -1; j <= 7; j++) {
            const r = row + i;
            const c = col + j;
            if (r >= 0 && r < matrix.length && c >= 0 && c < matrix.length) {
                // Separator (outer border) - WHITE
                if (i === -1 || i === 7 || j === -1 || j === 7) {
                    matrix[r][c] = false;
                }
                // Finder pattern (7×7 bullseye)
                else if ((i === 0 || i === 6 || j === 0 || j === 6)) {
                    // Outer square - BLACK
                    matrix[r][c] = true;
                } else if (i >= 2 && i <= 4 && j >= 2 && j <= 4) {
                    // Center 3×3 square - BLACK
                    matrix[r][c] = true;
                } else {
                    // Gap between outer and inner - WHITE
                    matrix[r][c] = false;
                }
            }
        }
    }
}

// Place alignment pattern
function placeAlignment(matrix, row, col) {
    for (let i = -2; i <= 2; i++) {
        for (let j = -2; j <= 2; j++) {
            const r = row + i;
            const c = col + j;
            if (r >= 0 && r < matrix.length && c >= 0 && c < matrix.length) {
                if ((i === -2 || i === 2 || j === -2 || j === 2) || (i === 0 && j === 0)) {
                    matrix[r][c] = true;
                } else {
                    matrix[r][c] = false;
                }
            }
        }
    }
}

// Note: getAlignmentPatternCenters is now in qr-utils.js

// Place function patterns (finders, timing, alignment)
function placeFunctionPatterns(matrix, version) {
    const size = matrix.length;

    // Finder patterns (top-left, top-right, bottom-left)
    placeFinder(matrix, 0, 0);
    placeFinder(matrix, 0, size - 7);
    placeFinder(matrix, size - 7, 0);

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
        matrix[6][i] = (i % 2 === 0);
        matrix[i][6] = (i % 2 === 0);
    }

    // Dark module
    matrix[4 * version + 9][8] = true;

    // Alignment patterns
    const alignments = getAlignmentPatternCenters(version);
    alignments.forEach((row, i) => {
        alignments.forEach((col, j) => {
            // Skip if overlaps with finder
            if ((i === 0 && j === 0) ||
                (i === 0 && j === alignments.length - 1) ||
                (i === alignments.length - 1 && j === 0)) {
                return;
            }
            placeAlignment(matrix, row, col);
        });
    });

    // Reserve format information areas
    for (let i = 0; i < 8; i++) {
        if (matrix[8][i] === null) matrix[8][i] = false;
        if (matrix[i][8] === null) matrix[i][8] = false;
        if (matrix[8][size - 1 - i] === null) matrix[8][size - 1 - i] = false;
        if (matrix[size - 1 - i][8] === null) matrix[size - 1 - i][8] = false;
    }
    // Also reserve the (8,8) position which is part of format info
    if (matrix[8][8] === null) matrix[8][8] = false;

    // Reserve version information areas (for version 7+)
    if (version >= 7) {
        // Bottom-left version info area (3 cols x 6 rows)
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 3; col++) {
                if (matrix[size - 11 + row][col] === null) {
                    matrix[size - 11 + row][col] = false;
                }
            }
        }
        // Top-right version info area (6 cols x 3 rows)
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 6; col++) {
                if (matrix[row][size - 11 + col] === null) {
                    matrix[row][size - 11 + col] = false;
                }
            }
        }
    }
}

// Place data bits on matrix
function placeDataBits(matrix, data) {
    const size = matrix.length;
    let bitIndex = 0;

    // Convert data bytes to bit string
    let bits = '';
    data.forEach(byte => {
        bits += toBinary(byte, 8);
    });

    // Place bits in zigzag pattern (right to left, bottom to top)
    let direction = -1; // -1 = up, 1 = down
    let col = size - 1;

    while (col >= 1) {
        for (let count = 0; count < size; count++) {
            let row = direction === -1 ? size - 1 - count : count;

            for (let c = 0; c < 2; c++) {
                const currentCol = col - c;

                if (matrix[row][currentCol] === null) {
                    if (bitIndex < bits.length) {
                        matrix[row][currentCol] = bits[bitIndex] === '1';
                        bitIndex++;
                    } else {
                        // Ran out of bits - fill with 0
                        matrix[row][currentCol] = false;
                    }
                }
            }
        }

        col -= 2;
        // Skip timing column (check AFTER decrementing)
        if (col === 6) col--;
        direction *= -1;
    }
}

// Apply mask pattern only to data modules (skip function patterns)
function applyMask(matrix, pattern, version) {
    const size = matrix.length;

    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            // Skip function modules - they should never be masked
            if (isFunctionModule(row, col, size, version)) {
                continue;
            }

            // Check if this module should be flipped according to mask pattern
            if (shouldFlipModule(row, col, pattern)) {
                matrix[row][col] = !matrix[row][col];
            }
        }
    }
}

// Calculate format information bits
function calculateFormatBits(eccLevel, maskPattern) {
    // ECC level indicators
    const eccBits = { 'L': 0b01, 'M': 0b00, 'Q': 0b11, 'H': 0b10 };

    const formatInfo = (eccBits[eccLevel] << 3) | maskPattern;

    // BCH error correction for format info
    let bch = formatInfo << 10;
    let g = 0b10100110111;

    for (let i = 0; i < 5; i++) {
        if ((bch >> (14 - i)) & 1) {
            bch ^= g << (4 - i);
        }
    }

    let bits = ((formatInfo << 10) | bch) ^ 0b101010000010010;

    return bits;
}

// Calculate version information bits (for version 7+)
function calculateVersionBits(version) {
    if (version < 7) return 0;

    // BCH error correction for version info
    // Version is 6 bits, BCH adds 12 bits = 18 bits total
    let bch = version << 12;
    let g = 0b1111100100101; // Generator polynomial for version info

    for (let i = 0; i < 6; i++) {
        if ((bch >> (17 - i)) & 1) {
            bch ^= g << (5 - i);
        }
    }

    let bits = (version << 12) | bch;
    return bits;
}

// Place version information (for version 7+)
function placeVersionInfo(matrix, version) {
    if (version < 7) return;

    const size = matrix.length;
    const versionBits = calculateVersionBits(version);

    // Version info is 18 bits total, placed in two locations
    // Bottom-left: 3 columns x 6 rows (rows: size-11 to size-9, cols: 0-5)
    // Top-right: 6 columns x 3 rows (rows: 0-5, cols: size-11 to size-9)

    // Place in bottom-left area (reading column by column, bottom to top)
    for (let col = 0; col < 6; col++) {
        for (let row = 0; row < 3; row++) {
            const bitIndex = col * 3 + row;
            const bit = (versionBits >> bitIndex) & 1;
            matrix[size - 11 + row][col] = bit === 1;
        }
    }

    // Place in top-right area (reading row by row, right to left)
    for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 3; col++) {
            const bitIndex = row * 3 + col;
            const bit = (versionBits >> bitIndex) & 1;
            matrix[row][size - 11 + col] = bit === 1;
        }
    }
}

// Place format information
function placeFormatInfo(matrix, eccLevel, maskPattern, version) {
    const size = matrix.length;
    const formatBits = calculateFormatBits(eccLevel, maskPattern);

    // Calculate dark module position
    const darkRow = 4 * version + 9;
    const darkCol = 8;

    // The decoder reads format bits in this specific order to build MSB-first
    // So we need to place bit 14 at position 0, bit 13 at position 1, etc.

    // Positions 0-5: row 8, columns 0-5
    for (let i = 0; i < 6; i++) {
        const bit = (formatBits >> (14 - i)) & 1;
        matrix[8][i] = bit === 1;
        // Also place on bottom-left for redundancy
        matrix[size - 1 - i][8] = bit === 1;
    }

    // Position 6: row 8, column 7 (skip column 6 for timing)
    const bit6 = (formatBits >> (14 - 6)) & 1;
    matrix[8][7] = bit6 === 1;
    matrix[size - 7][8] = bit6 === 1;

    // Position 7: row 8, column 8
    const bit7 = (formatBits >> (14 - 7)) & 1;
    matrix[8][8] = bit7 === 1;
    matrix[size - 8][8] = bit7 === 1;

    // Position 8: row 7, column 8
    const bit8 = (formatBits >> (14 - 8)) & 1;
    matrix[7][8] = bit8 === 1;
    matrix[8][size - 8] = bit8 === 1;

    // Positions 9-14: column 8, rows 5,4,3,2,1,0 (skip row 6 for timing)
    const rows = [5, 4, 3, 2, 1, 0];
    for (let i = 0; i < 6; i++) {
        const bit = (formatBits >> (14 - (9 + i))) & 1;
        matrix[rows[i]][8] = bit === 1;
        matrix[8][size - 7 + i] = bit === 1;
    }

    // Ensure dark module is always black (re-assert after format placement)
    matrix[darkRow][darkCol] = true;
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
    const moduleSize = Math.floor(canvas.width / (size + 8)); // Add quiet zone
    const offset = moduleSize * 4; // Quiet zone

    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw modules
    ctx.fillStyle = 'black';
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            if (matrix[row][col]) {
                ctx.fillRect(
                    offset + col * moduleSize,
                    offset + row * moduleSize,
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

// Main QR code generation function
function generateQrCode() {
    if (!encodedBitstream || !encodedBitstream.blocks) {
        alert('Please calculate ECC first!');
        return;
    }

    // Read any edited values
    const { blocks } = readAllEditedValues();

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
}

// Initialize on load
init();
