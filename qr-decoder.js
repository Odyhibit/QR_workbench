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
let currentEccLevel = '';
let deinterleavedDataBits = ''; // Concatenated data bits after de-interleaving
let decodedMessageSize = null;
let lastDeinterleaveMeta = null; // Debug info for block sizing
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

const blockSizeTable = parseBlockSizeTable(blockSizeTableCsv);

// Reed-Solomon math (ported from ZXing's well-tested implementation)
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

    divide(a, b) {
        if (b === 0) throw new Error('Division by zero');
        if (a === 0) return 0;
        return this.expTable[(this.logTable[a] + (this.size - 1) - this.logTable[b]) % (this.size - 1)];
    }

    inverse(a) {
        if (a === 0) throw new Error('Cannot calculate inverse of 0');
        return this.expTable[(this.size - 1) - this.logTable[a]];
    }

    buildMonomial(degree, coefficient) {
        if (degree < 0) throw new Error('Invalid monomial degree');
        if (coefficient === 0) return this.zero;
        const coefficients = new Array(degree + 1).fill(0);
        coefficients[0] = coefficient;
        return new GenericGFPoly(this, coefficients);
    }

    getZero() {
        return this.zero;
    }

    getOne() {
        return this.one;
    }

    getGeneratorBase() {
        return this.generatorBase;
    }

    getSize() {
        return this.size;
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

    getCoefficient(degree) {
        return this.coefficients[this.coefficients.length - 1 - degree];
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
            sumDiff[i + lengthDiff] = this.field.addOrSubtract(smallerCoefficients[i], largerCoefficients[i + lengthDiff]);
        }
        return new GenericGFPoly(this.field, sumDiff);
    }

    multiply(other) {
        if (this.field !== other.field) {
            throw new Error('Fields do not match');
        }
        if (this.isZero() || other.isZero()) return this.field.getZero();

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

    multiplyScalar(scalar) {
        if (scalar === 0) return this.field.getZero();
        if (scalar === 1) return this;
        const product = this.coefficients.map(c => this.field.multiply(c, scalar));
        return new GenericGFPoly(this.field, product);
    }

    multiplyByMonomial(degree, coefficient) {
        if (degree < 0) throw new Error('Invalid monomial degree');
        if (coefficient === 0) return this.field.getZero();

        const product = new Array(this.coefficients.length + degree).fill(0);
        for (let i = 0; i < this.coefficients.length; i++) {
            product[i] = this.field.multiply(this.coefficients[i], coefficient);
        }
        return new GenericGFPoly(this.field, product);
    }

    evaluateAt(x) {
        if (x === 0) {
            return this.getCoefficient(0);
        }
        if (x === 1) {
            return this.coefficients.reduce((acc, c) => this.field.addOrSubtract(acc, c), 0);
        }
        let result = this.coefficients[0];
        for (let i = 1; i < this.coefficients.length; i++) {
            result = this.field.addOrSubtract(this.field.multiply(result, x), this.coefficients[i]);
        }
        return result;
    }
}

class ReedSolomonDecoder {
    constructor(field = new GenericGF(0x011D, 256, 0)) {
        this.field = field;
        this.expTable = field.expTable;
        this.logTable = field.logTable;
    }

    decode(received, twoS) {
        return this.decodeWithECCount(received, twoS);
    }

    decodeWithECCount(received, twoS) {
        const poly = new GenericGFPoly(this.field, received);
        const syndromeCoefficients = new Array(twoS);
        let noError = true;
        for (let i = 0; i < twoS; i++) {
            const evalResult = poly.evaluateAt(this.expTable[i + this.field.getGeneratorBase()]);
            syndromeCoefficients[syndromeCoefficients.length - 1 - i] = evalResult;
            if (evalResult !== 0) noError = false;
        }

        if (noError) {
            return 0;
        }

        const syndrome = new GenericGFPoly(this.field, syndromeCoefficients);
        const [sigma, omega] = this.runEuclideanAlgorithm(
            this.field.buildMonomial(twoS, 1),
            syndrome,
            twoS
        );
        const errorLocations = this.findErrorLocations(sigma);
        const errorMagnitudes = this.findErrorMagnitudes(omega, errorLocations);

        for (let i = 0; i < errorLocations.length; i++) {
            const position = received.length - 1 - this.field.logTable[errorLocations[i]];
            if (position < 0) {
                throw new Error('Bad error location');
            }
            received[position] = this.field.addOrSubtract(received[position], errorMagnitudes[i]);
        }

        return errorLocations.length;
    }

    gfMul(a, b) {
        return this.field.multiply(a, b);
    }

    gfDiv(a, b) {
        return this.field.divide(a, b);
    }

    polyMul(p1, p2) {
        const result = new Array(p1.length + p2.length - 1).fill(0);
        for (let i = 0; i < p1.length; i++) {
            if (p1[i] === 0) continue;
            for (let j = 0; j < p2.length; j++) {
                if (p2[j] === 0) continue;
                result[i + j] ^= this.gfMul(p1[i], p2[j]);
            }
        }
        return result;
    }

    polyEval(poly, x) {
        let result = 0;
        for (let i = poly.length - 1; i >= 0; i--) {
            result = this.gfMul(result, x) ^ poly[i];
        }
        return result;
    }

    calculateSyndromes(received, twoS) {
        const poly = new GenericGFPoly(this.field, received);
        const syndromes = new Array(twoS);
        for (let i = 0; i < twoS; i++) {
            syndromes[i] = poly.evaluateAt(this.expTable[i + this.field.getGeneratorBase()]);
        }
        return syndromes;
    }

    findErrorLocator(syndromes) {
        const degree = syndromes.length;
        const syndromeCoefficients = new Array(degree);
        for (let i = 0; i < degree; i++) {
            syndromeCoefficients[degree - 1 - i] = syndromes[i];
        }

        const syndrome = new GenericGFPoly(this.field, syndromeCoefficients);
        const [sigma] = this.runEuclideanAlgorithm(
            this.field.buildMonomial(degree, 1),
            syndrome,
            degree
        );
        return sigma.getCoefficients().slice();
    }

    findErrors(locatorCoeffs, codewordLength) {
        if (!locatorCoeffs || locatorCoeffs.length <= 1) return [];
        const trySolve = coeffs => {
            const locatorPoly = new GenericGFPoly(this.field, coeffs);
            const errorLocations = this.findErrorLocations(locatorPoly);
            return errorLocations.map(loc => ({
                position: codewordLength - 1 - this.field.logTable[loc],
                locator: loc
            }));
        };
        try {
            return trySolve(locatorCoeffs.slice());
        } catch (err) {
            try {
                return trySolve(locatorCoeffs.slice().reverse());
            } catch (err2) {
                console.warn('findErrors failed:', err2);
                return [];
            }
        }
    }

    forneyAlgorithm(syndromes, errorLocators, codewordLength, locatorCoeffs) {
        if (!errorLocators || errorLocators.length === 0) return [];
        if (!locatorCoeffs || locatorCoeffs.length === 0) return [];

        const twoS = syndromes.length;
        const syndromeCoefficients = new Array(twoS);
        for (let i = 0; i < twoS; i++) {
            syndromeCoefficients[twoS - 1 - i] = syndromes[i];
        }

        const syndromePoly = new GenericGFPoly(this.field, syndromeCoefficients);
        const locatorPoly = new GenericGFPoly(this.field, (locatorCoeffs || []).slice());
        const errorEvaluator = syndromePoly.multiply(locatorPoly);
        const evaluatorCoeffs = errorEvaluator.getCoefficients();
        const start = Math.max(0, evaluatorCoeffs.length - twoS);
        const omegaCoeffs = evaluatorCoeffs.slice(start);
        const omegaPoly = new GenericGFPoly(this.field, omegaCoeffs);

        return this.findErrorMagnitudes(omegaPoly, errorLocators);
    }

    generateGeneratorPoly(eccLength) {
        let gen = [1];
        for (let i = 0; i < eccLength; i++) {
            gen = this.polyMul(gen, [1, this.expTable[i]]);
        }
        return gen;
    }

    runEuclideanAlgorithm(a, b, R) {
        if (a.getDegree() < b.getDegree()) {
            [a, b] = [b, a];
        }

        let rLast = a;
        let r = b;
        let tLast = this.field.getZero();
        let t = this.field.getOne();

        while (2 * r.getDegree() >= R) {
            const rLastLast = rLast;
            const tLastLast = tLast;
            rLast = r;
            tLast = t;

            if (rLast.isZero()) {
                throw new Error('r_{i-1} was zero');
            }
            r = rLastLast;
            let q = this.field.getZero();
            const denominatorLeadingTerm = rLast.getCoefficient(rLast.getDegree());
            const dltInverse = this.field.inverse(denominatorLeadingTerm);
            while (r.getDegree() >= rLast.getDegree() && !r.isZero()) {
                const degreeDiff = r.getDegree() - rLast.getDegree();
                const scale = this.field.multiply(r.getCoefficient(r.getDegree()), dltInverse);
                q = q.addOrSubtract(this.field.buildMonomial(degreeDiff, scale));
                r = r.addOrSubtract(rLast.multiplyByMonomial(degreeDiff, scale));
            }

            t = q.multiply(tLast).addOrSubtract(tLastLast);

            if (r.getDegree() >= rLast.getDegree()) {
                throw new Error('Division algorithm failed to reduce polynomial');
            }
        }

        const sigmaTildeAtZero = t.getCoefficient(0);
        if (sigmaTildeAtZero === 0) {
            throw new Error('sigmaTilde(0) was zero');
        }

        const inverse = this.field.inverse(sigmaTildeAtZero);
        const sigma = t.multiplyScalar(inverse);
        const omega = r.multiplyScalar(inverse);
        return [sigma, omega];
    }

    findErrorLocations(errorLocator) {
        const numErrors = errorLocator.getDegree();
        if (numErrors === 1) {
            return [errorLocator.getCoefficient(1)];
        }
        const result = [];
        for (let i = 1; i < this.field.getSize() && result.length < numErrors; i++) {
            if (errorLocator.evaluateAt(i) === 0) {
                result.push(this.field.inverse(i));
            }
        }
        if (result.length !== numErrors) {
            throw new Error('Error locator degree does not match number of roots');
        }
        return result;
    }

    findErrorMagnitudes(errorEvaluator, errorLocations) {
        const s = errorLocations.length;
        const result = new Array(s).fill(0);
        for (let i = 0; i < s; i++) {
            const xiInverse = this.field.inverse(errorLocations[i]);
            let denominator = 1;
            for (let j = 0; j < s; j++) {
                if (i === j) continue;
                const term = this.field.multiply(errorLocations[j], xiInverse);
                const termPlus1 = (term & 0x1) === 0 ? term | 1 : term & ~1;
                denominator = this.field.multiply(denominator, termPlus1);
            }
            result[i] = this.field.multiply(
                errorEvaluator.evaluateAt(xiInverse),
                this.field.inverse(denominator)
            );
            if (this.field.getGeneratorBase() !== 0) {
                result[i] = this.field.multiply(result[i], xiInverse);
            }
        }
        return result;
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

function parseBlockSizeTable(csv) {
    const map = {};
    const lines = csv.trim().split(/\r?\n/);
    for (const line of lines) {
        const parts = line.split(',');
        if (!parts.length || parts[0].includes('Version and EC Level')) continue;
        const key = parts[0].trim();
        if (!key) continue;

        const [versionStr, eccLevel] = key.split('-');
        const version = parseInt(versionStr, 10);
        if (!version || !eccLevel) continue;

        const ecPerBlock = parseInt(parts[2], 10) || 0;
        const g1Blocks = parseInt(parts[3], 10) || 0;
        const g1Data = parseInt(parts[4], 10) || 0;
        const g2Blocks = parseInt(parts[5], 10) || 0;
        const g2Data = parseInt(parts[6], 10) || 0;

        if (!map[version]) map[version] = {};
        map[version][eccLevel] = { ecPerBlock, g1Blocks, g1Data, g2Blocks, g2Data };
    }
    return map;
}

function getBlockConfig(version, eccLevel) {
    if (!blockSizeTable[version]) return null;
    return blockSizeTable[version][eccLevel] || null;
}

function hasMultipleBlocks(version, eccLevel) {
    const config = getBlockConfig(version, eccLevel);
    if (!config) return false;
    return (config.g1Blocks || 0) + (config.g2Blocks || 0) > 1;
}

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

function finalizeBitstreamRecovery() {
    isBitstreamRecovered = true;
    updateDeinterleaveAvailability();

    const decodeModeButton = document.getElementById('decodeModeButton');
    const version = parseInt(versionSelect.value, 10);
    const multi = hasMultipleBlocks(version, currentEccLevel);

    if (!multi) {
        // Single block: we can decode directly from recovered bits
        const cleanBits = recoveredBitstream.replace(/\s+/g, '');
        setDeinterleavedBits(cleanBits);
        const deinterleaveButton = document.getElementById('deinterleaveButton');
        if (deinterleaveButton) deinterleaveButton.disabled = false;
    } else {
        // Multi-block: wait for de-interleave step
        if (decodeModeButton) decodeModeButton.disabled = true;
    }
}

// Initialize version dropdown (1-40)
for (let i = 1; i <= 40; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `Version ${i} (${17 + i * 4}x${17 + i * 4})`;
    if (i === 1) option.selected = true;
    versionSelect.appendChild(option);
}

// Calculate module count based on version
function getModuleCount(version) {
    return 17 + version * 4;
}

// Check if a pixel is white (or close to white)
function isWhite(data, idx, threshold = 200) {
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    return r > threshold && g > threshold && b > threshold;
}

// Check if a pixel is black (or close to black)
function isBlack(data, idx, threshold = 128) {
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    return r < threshold && g < threshold && b < threshold;
}

// Find the first row with non-white pixels (top border)
function findTopBorder(imageData) {
    const { data, width, height } = imageData;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            if (!isWhite(data, idx)) {
                return y;
            }
        }
    }
    return 0;
}

// Find the first column with non-white pixels (left border)
function findLeftBorder(imageData) {
    const { data, width, height } = imageData;

    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            const idx = (y * width + x) * 4;
            if (!isWhite(data, idx)) {
                return x;
            }
        }
    }
    return 0;
}

// Find the last row with non-white pixels (bottom border)
function findBottomBorder(imageData) {
    const { data, width, height } = imageData;

    for (let y = height - 1; y >= 0; y--) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            if (!isWhite(data, idx)) {
                return height - 1 - y;
            }
        }
    }
    return 0;
}

// Find the last column with non-white pixels (right border)
function findRightBorder(imageData) {
    const { data, width, height } = imageData;

    for (let x = width - 1; x >= 0; x--) {
        for (let y = 0; y < height; y++) {
            const idx = (y * width + x) * 4;
            if (!isWhite(data, idx)) {
                return width - 1 - x;
            }
        }
    }
    return 0;
}

// Calculate module size based on finder pattern (7 modules wide)
function calculateModuleSize(imageData, topBorder, leftBorder) {
    const { data, width } = imageData;

    // Scan multiple rows through the top-left finder pattern to get pattern widths
    const patterns = [];

    for (let scanY = topBorder; scanY < topBorder + 30 && scanY < imageData.height; scanY++) {
        // Scan from left border and detect black-white transitions
        const segments = [];
        let currentColor = null;
        let segmentStart = leftBorder;

        for (let x = leftBorder; x < Math.min(leftBorder + 200, width); x++) {
            const idx = (scanY * width + x) * 4;
            const pixelIsBlack = isBlack(data, idx);

            if (currentColor === null) {
                currentColor = pixelIsBlack;
                segmentStart = x;
            } else if (pixelIsBlack !== currentColor) {
                // Transition detected
                segments.push({
                    color: currentColor ? 'black' : 'white',
                    width: x - segmentStart
                });
                currentColor = pixelIsBlack;
                segmentStart = x;
            }
        }

        // Look for the finder pattern: 1:1:3:1:1 ratio (black:white:black:white:black)
        if (segments.length >= 5) {
            // Check if first 5 segments match the pattern
            const widths = segments.slice(0, 5).map(s => s.width);
            const colors = segments.slice(0, 5).map(s => s.color);

            // Verify color pattern: black-white-black-white-black
            if (colors[0] === 'black' && colors[1] === 'white' &&
                colors[2] === 'black' && colors[3] === 'white' && colors[4] === 'black') {

                // Calculate the module size from the smallest unit (should be width[0] or width[1])
                const unit = Math.min(widths[0], widths[1], widths[3], widths[4]);

                // Verify the 1:1:3:1:1 ratio approximately holds
                const ratio2 = widths[2] / unit; // Should be ~3
                if (ratio2 > 2.5 && ratio2 < 3.5) {
                    patterns.push(unit);
                }
            }
        }
    }

    if (patterns.length === 0) {
        // Fallback: find the total width of the finder pattern
        let startX = leftBorder;
        let y = topBorder + 5; // Use a row a few pixels in

        // Find start of finder pattern (first black)
        while (startX < width && !isBlack(data, (y * width + startX) * 4)) {
            startX++;
        }

        // Find end of finder pattern
        let endX = startX;
        let lastBlack = startX;

        for (let x = startX; x < Math.min(startX + 200, width); x++) {
            const idx = (y * width + x) * 4;
            if (isBlack(data, idx)) {
                lastBlack = x;
            }
            // If we've gone more than 10 pixels past the last black, we're done
            if (x - lastBlack > 10) {
                endX = lastBlack;
                break;
            }
        }

        const finderWidth = endX - startX + 1;
        return finderWidth / 7;
    }

    // Average all detected module sizes
    const avgModuleSize = patterns.reduce((a, b) => a + b, 0) / patterns.length;
    return avgModuleSize;
}

// Detect the version by calculating module count
function detectVersion(imageData, topBorder, bottomBorder, leftBorder, rightBorder) {
    const moduleSize = calculateModuleSize(imageData, topBorder, leftBorder);

    // Calculate QR code dimensions (excluding quiet zone)
    const qrWidth = imageData.width - leftBorder - rightBorder;
    const qrHeight = imageData.height - topBorder - bottomBorder;

    // Calculate number of modules in each dimension
    const modulesWidth = Math.round(qrWidth / moduleSize);
    const modulesHeight = Math.round(qrHeight / moduleSize);

    // Use the average of both dimensions
    const moduleCount = Math.round((modulesWidth + modulesHeight) / 2);

    // Calculate version: moduleCount = 17 + version * 4
    // So: version = (moduleCount - 17) / 4
    const version = (moduleCount - 17) / 4;

    // Round to nearest integer and clamp to valid range (1-40)
    return Math.max(1, Math.min(40, Math.round(version)));
}

// Sample modules from the original image
function sampleModules() {
    if (!imageData) return null;

    const top = parseInt(borderTop.value) || 0;
    const bottom = parseInt(borderBottom.value) || 0;
    const left = parseInt(borderLeft.value) || 0;
    const right = parseInt(borderRight.value) || 0;

    const version = parseInt(versionSelect.value);
    const moduleCount = getModuleCount(version);

    const gridWidth = imageData.width - left - right;
    const gridHeight = imageData.height - top - bottom;
    const moduleWidth = gridWidth / moduleCount;
    const moduleHeight = gridHeight / moduleCount;

    // Create 2D array for modules
    const matrix = [];
    const { data, width } = imageData;

    for (let row = 0; row < moduleCount; row++) {
        matrix[row] = [];
        for (let col = 0; col < moduleCount; col++) {
            // Sample from the center of each module
            const centerX = Math.round(left + (col + 0.5) * moduleWidth);
            const centerY = Math.round(top + (row + 0.5) * moduleHeight);
            const idx = (centerY * width + centerX) * 4;

            // Check if pixel is black
            matrix[row][col] = isBlack(data, idx);
        }
    }

    return matrix;
}

// Get alignment pattern center positions for a given version
function getAlignmentPatternCenters(version) {
    const alignmentTable = {
        1: [],
        2: [6, 18],
        3: [6, 22],
        4: [6, 26],
        5: [6, 30],
        6: [6, 34],
        7: [6, 22, 38],
        8: [6, 24, 42],
        9: [6, 26, 46],
        10: [6, 28, 50],
        11: [6, 30, 54],
        12: [6, 32, 58],
        13: [6, 34, 62],
        14: [6, 26, 46, 66],
        15: [6, 26, 48, 70],
        16: [6, 26, 50, 74],
        17: [6, 30, 54, 78],
        18: [6, 30, 56, 82],
        19: [6, 30, 58, 86],
        20: [6, 34, 62, 90],
        21: [6, 28, 50, 72, 94],
        22: [6, 26, 50, 74, 98],
        23: [6, 30, 54, 78, 102],
        24: [6, 28, 54, 80, 106],
        25: [6, 32, 58, 84, 110],
        26: [6, 30, 58, 86, 114],
        27: [6, 34, 62, 90, 118],
        28: [6, 26, 50, 74, 98, 122],
        29: [6, 30, 54, 78, 102, 126],
        30: [6, 26, 52, 78, 104, 130],
        31: [6, 30, 56, 82, 108, 134],
        32: [6, 34, 60, 86, 112, 138],
        33: [6, 30, 58, 86, 114, 142],
        34: [6, 34, 62, 90, 118, 146],
        35: [6, 30, 54, 78, 102, 126, 150],
        36: [6, 24, 50, 76, 102, 128, 154],
        37: [6, 28, 54, 80, 106, 132, 158],
        38: [6, 32, 58, 84, 110, 136, 162],
        39: [6, 26, 54, 82, 110, 138, 166],
        40: [6, 30, 58, 86, 114, 142, 170]
    };

    return alignmentTable[version] || [];
}

// Check if a module is part of a finder pattern (including separator)
function isFinderModule(row, col, moduleCount) {
    // Top-left finder (0-7, 0-7) with separator
    if (row <= 7 && col <= 7) return true;

    // Top-right finder (0-7, moduleCount-8 to moduleCount-1) with separator
    if (row <= 7 && col >= moduleCount - 8) return true;

    // Bottom-left finder (moduleCount-8 to moduleCount-1, 0-7) with separator
    if (row >= moduleCount - 8 && col <= 7) return true;

    return false;
}

// Check if a module is part of an alignment pattern
function isAlignmentModule(row, col, moduleCount) {
    const version = parseInt(versionSelect.value);
    if (version < 2) return false;

    const alignmentCenters = getAlignmentPatternCenters(version);

    for (let cy of alignmentCenters) {
        for (let cx of alignmentCenters) {
            // Skip if overlaps with finder patterns
            if ((cx < 10 && cy < 10) ||
                (cx < 10 && cy >= moduleCount - 9) ||
                (cx >= moduleCount - 9 && cy < 10)) {
                continue;
            }
            // Check if (col, row) is within 5×5 alignment pattern centered at (cx, cy)
            if (Math.abs(col - cx) <= 2 && Math.abs(row - cy) <= 2) {
                return true;
            }
        }
    }

    return false;
}

// Check if a module is part of format information
function isFormatModule(row, col, moduleCount) {
    // Horizontal strip (row 8, columns 0-8 and moduleCount-8 to moduleCount-1)
    if (row === 8 && (col <= 8 || col >= moduleCount - 8)) return true;

    // Vertical strip (column 8, rows 0-8 and moduleCount-7 to moduleCount-1)
    if (col === 8 && (row <= 8 || row >= moduleCount - 7)) return true;

    return false;
}

// Check if a module is part of timing patterns
function isTimingModule(row, col, moduleCount) {
    // Horizontal timing (row 6, between finders)
    if (row === 6 && col >= 8 && col <= moduleCount - 9) return true;

    // Vertical timing (column 6, between finders)
    if (col === 6 && row >= 8 && row <= moduleCount - 9) return true;

    return false;
}

// Check if a module is the dark module (always black)
function isDarkModule(row, col, moduleCount) {
    const version = parseInt(versionSelect.value);
    // Dark module is always at position (4 * version + 9, 8)
    const darkRow = 4 * version + 9;
    const darkCol = 8;

    return row === darkRow && col === darkCol;
}

// Check if a module is part of version information (only version 7+)
function isVersionModule(row, col, moduleCount) {
    const version = parseInt(versionSelect.value);
    if (version < 7) return false;

    // Bottom-left version info (3 columns x 6 rows near bottom-left)
    // Rows: moduleCount-11 to moduleCount-9, Columns: 0-5
    if (row >= moduleCount - 11 && row <= moduleCount - 9 && col >= 0 && col <= 5) return true;

    // Top-right version info (6 columns x 3 rows near top-right)
    // Rows: 0-5, Columns: moduleCount-11 to moduleCount-9
    if (row >= 0 && row <= 5 && col >= moduleCount - 11 && col <= moduleCount - 9) return true;

    return false;
}

// Check if a module is a function module (should not be unmasked)
function isFunctionModule(row, col, moduleCount) {
    // Check all function patterns
    if (isFinderModule(row, col, moduleCount)) return true;
    if (isAlignmentModule(row, col, moduleCount)) return true;
    if (isFormatModule(row, col, moduleCount)) return true;
    if (isTimingModule(row, col, moduleCount)) return true;
    if (isDarkModule(row, col, moduleCount)) return true;
    if (isVersionModule(row, col, moduleCount)) return true;

    return false;
}

// Apply mask pattern formula to determine if module should be flipped
function shouldFlipModule(row, col, maskPattern) {
    // x = col, y = row
    const x = col;
    const y = row;

    switch(maskPattern) {
        case 0:
            return (x + y) % 2 === 0;
        case 1:
            return y % 2 === 0;
        case 2:
            return x % 3 === 0;
        case 3:
            return (x + y) % 3 === 0;
        case 4:
            return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
        case 5:
            return ((x * y) % 2) + ((x * y) % 3) === 0;
        case 6:
            return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
        case 7:
            return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
        default:
            return false;
    }
}

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

function updateBitstreamOutput() {
    const output = document.getElementById('bitstreamOutput');
    if (output) {
        output.value = formatBitstream(recoveredBitstream);
    }
}

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

// Unmask the QR code data
function unmaskQRCode() {
    if (!moduleMatrix || currentMaskPattern < 0 || isUnmasked) return;

    const moduleCount = moduleMatrix.length;

    // Flip modules based on mask pattern (skip function modules)
    for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
            // Skip function modules
            if (isFunctionModule(row, col, moduleCount)) continue;

            // Check if this module should be flipped
            if (shouldFlipModule(row, col, currentMaskPattern)) {
                moduleMatrix[row][col] = !moduleMatrix[row][col];
            }
        }
    }

    // Mark as unmasked and disable button
    isUnmasked = true;
    const unmaskButton = document.getElementById('unmaskButton');
    unmaskButton.disabled = true;

    // Reset recovery state since data values changed after unmasking
    dataPositions = [];
    bitstreamIndex = 0;
    recoveredBitstream = '';
    currentHighlight = [];
    isBitstreamRecovered = false;
    updateBitstreamOutput();

    // Enable decode mode button after unmasking
    const decodeModeButton = document.getElementById('decodeModeButton');
    decodeModeButton.disabled = true;

    // Allow bitstream recovery right after unmasking
    const recoverAllButton = document.getElementById('recoverAllButton');
    const nextByteButton = document.getElementById('nextByteButton');
    if (recoverAllButton && nextByteButton) {
        recoverAllButton.disabled = false;
        nextByteButton.disabled = false;
    }

    updateDeinterleaveAvailability();

    // Redraw the cleaned QR
    drawCleanQR();
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

    const modeBitsString = deinterleavedDataBits.slice(0, 4);
    const modeBits = parseInt(modeBitsString, 2);

    // Decode the mode
    let modeName = 'Unknown';
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
            modeName = 'ECI';
            break;
        default:
            modeName = `Unknown (${modeBits.toString(2).padStart(4, '0')})`;
    }

    // Display the mode
    currentDataMode = modeName;
    document.getElementById('dataMode').textContent = modeName;

    // Enable decode size button only if mode is Byte
    const decodeSizeButton = document.getElementById('decodeSizeButton');
    if (modeName === 'Byte') {
        decodeSizeButton.disabled = false;
    } else {
        decodeSizeButton.disabled = true;
    }

    // Mark the first 4 bits as used for coloring
    if (usedModules && dataPositions && dataPositions.length >= 4) {
        for (let i = 0; i < 4; i++) {
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
        // Replace the first 4 bits with the mode name
        const modeLabel = `${modeName} (${modeBitsString})`;
        // Find where the bitstream starts (could be in block format or plain format)
        const blockMatch = currentOutput.match(/^Block \d+ data:\s*/);
        if (blockMatch) {
            // Multi-block format: replace first 4 bits after "Block 1 data:"
            const afterLabel = currentOutput.substring(blockMatch[0].length);
            // Get just the first line of bits (before the first newline)
            const firstLineMatch = afterLabel.match(/^([^\n]*)/);
            const firstLine = firstLineMatch ? firstLineMatch[1] : afterLabel;
            const restOfOutput = afterLabel.substring(firstLine.length);
            // Strip spaces from just this line
            const cleanBits = firstLine.replace(/\s+/g, '');
            const rest = cleanBits.substring(4);
            outputArea.value = blockMatch[0] + modeLabel + '\n' + formatBitstream(rest) + restOfOutput;
        } else {
            // Single block or raw bitstream: replace first 4 bits
            const cleanOutput = currentOutput.replace(/\s+/g, '');
            if (cleanOutput.length >= 4) {
                const rest = cleanOutput.substring(4);
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

// Decode the message size (8 bits for v1-9, 16 bits for v10-40)
function decodeSize() {
    if (isSizeDecoded || currentDataMode !== 'Byte') return;
    if (!deinterleavedDataBits || deinterleavedDataBits.length < 12) {
        alert('Decode mode first, then ensure de-interleaved data is available.');
        return;
    }

    const version = parseInt(versionSelect.value, 10);
    const bitCount = version <= 9 ? 8 : 16;
    const start = 4; // after mode bits
    if (deinterleavedDataBits.length < start + bitCount) {
        alert('Not enough bits to decode size.');
        return;
    }

    const sizeBitsStr = deinterleavedDataBits.slice(start, start + bitCount);
    const sizeValue = parseInt(sizeBitsStr, 2);
    decodedMessageSize = sizeValue;

    // Mark bits used for coloring
    if (!dataPositions || !dataPositions.length) {
        dataPositions = buildDataPositions();
    }
    if (usedModules && dataPositions && dataPositions.length >= start + bitCount) {
        for (let i = 0; i < start + bitCount; i++) {
            const pos = dataPositions[i];
            if (usedModules[pos.row]) {
                usedModules[pos.row][pos.col] = true;
            }
        }
    }

    // Display the size
    document.getElementById('messageSize').textContent = `${sizeValue} bytes`;

    // Update the bitstream display to replace size bits with size label
    const outputArea = document.getElementById('bitstreamOutput');
    if (outputArea && outputArea.value) {
        const currentOutput = outputArea.value;
        const sizeLabel = `${sizeValue} bytes (${sizeBitsStr})`;

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

    // Add block label
    const label = document.createElement('span');
    label.className = 'block-label';
    label.textContent = `B${blockIndex + 1}`;
    box.appendChild(label);

    container.appendChild(box);

    // Remove "current" class after animation
    setTimeout(() => {
        box.classList.remove('current');
    }, 500);

    // Auto-scroll to show new codeword
    container.scrollTop = container.scrollHeight;
}

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
        ec: []
    }));

    let cursor = 0;
    // Data codewords (interleaved round-robin)
    for (let i = 0; i < maxDataLen; i++) {
        for (let b = 0; b < blocks.length; b++) {
            if (blocks[b].dataLen > i && cursor < bytes.length) {
                blocks[b].data.push(bytes[cursor++]);
            }
        }
    }

    // Error-correction codewords (same length per block)
    for (let i = 0; i < (config.ecPerBlock || 0); i++) {
        for (let b = 0; b < blocks.length; b++) {
            if (cursor < bytes.length) {
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
        syndromes: [],
        errorPositions: [],
        errorValues: []
    }));

    // Display blocks as hex
    displayBlocksAsHex();

    // Reset error correction state
    currentEcStep = 0;
    syndromeCalculated = false;

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

// Extract format information from QR code
function extractFormatInfo() {
    if (!moduleMatrix) return null;

    // Format information is 15 bits stored in two locations
    // Location 1: Around top-left finder pattern
    const formatBits = [];

    // Read format bits from around top-left finder
    // Bits 0-5: vertical strip next to top-left finder
    for (let i = 0; i <= 5; i++) {
        formatBits.push(moduleMatrix[8][i] ? 1 : 0);
    }
    // Bit 6: skip timing pattern at (8,6)
    // Bits 7-8: continue vertical
    formatBits.push(moduleMatrix[8][7] ? 1 : 0);
    formatBits.push(moduleMatrix[8][8] ? 1 : 0);

    // Bits 9-14: horizontal strip below top-left finder
    formatBits.push(moduleMatrix[7][8] ? 1 : 0);
    formatBits.push(moduleMatrix[5][8] ? 1 : 0);
    formatBits.push(moduleMatrix[4][8] ? 1 : 0);
    formatBits.push(moduleMatrix[3][8] ? 1 : 0);
    formatBits.push(moduleMatrix[2][8] ? 1 : 0);
    formatBits.push(moduleMatrix[1][8] ? 1 : 0);
    formatBits.push(moduleMatrix[0][8] ? 1 : 0);

    return formatBits;
}

// Decode format information
function decodeFormatInfo(formatBits) {
    if (!formatBits || formatBits.length < 15) return null;

    // XOR mask that's applied to format info
    const mask = 0b101010000010010;

    // Convert bits to number
    let formatValue = 0;
    for (let i = 0; i < 15; i++) {
        formatValue = (formatValue << 1) | formatBits[i];
    }

    // Remove mask
    formatValue ^= mask;

    // Extract ECC level (bits 14-13, which are now at positions 0-1 after shift)
    const eccBits = (formatValue >> 13) & 0b11;
    const eccLevels = ['M', 'L', 'H', 'Q'];
    const eccLevel = eccLevels[eccBits];

    // Extract mask pattern (bits 12-10, which are now at positions 2-4)
    const maskBits = (formatValue >> 10) & 0b111;

    return {
        eccLevel: eccLevel,
        maskPattern: maskBits
    };
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
            html += `<span class="${classes} block-${idx % 4}" id="${dataId}">${hexValue}</span>`;
        });
        html += `</div></div>`;

        // ECC section
        html += `<div class="block-section">`;
        html += `<div class="block-section-label">ECC (${block.eccBytes.length} bytes):</div>`;
        html += `<div class="byte-row">`;
        block.eccBytes.forEach((byte, i) => {
            const hexValue = byte.toString(16).toUpperCase().padStart(2, '0');
            const eccId = `block${idx}-ecc${i}`;
            html += `<span class="byte-box block-${idx % 4}" id="${eccId}">${hexValue}</span>`;
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

// Using ReedSolomonDecoder GF tables
const rsDecoder = new ReedSolomonDecoder();

function computeErrorMagnitudes(errLocator, syndromes, errorPositions, codewordLen) {
    if (!errLocator || errLocator.length === 0) return [];
    const eccLen = syndromes.length;

    // Omega(x) = (S(x) * Lambda(x)) mod x^(eccLen)
    const omegaFull = rsDecoder.polyMul([1, ...syndromes], errLocator);
    const omega = omegaFull.slice(0, eccLen);

    // Lambda'(x): derivative (only odd powers survive in GF(2^m))
    const locatorDeriv = [];
    for (let i = 1; i < errLocator.length; i += 2) {
        locatorDeriv.push(errLocator[i]);
    }

    const magnitudes = [];
    errorPositions.forEach(pos => {
        const xiInv = rsDecoder.expTable[(255 - pos) % 255];
        const numerator = rsDecoder.polyEval(omega, xiInv);
        const denominator = rsDecoder.polyEval(locatorDeriv, xiInv);
        if (denominator === 0) {
            magnitudes.push(0);
        } else {
            const magnitude = rsDecoder.gfDiv(numerator, denominator);
            magnitudes.push(magnitude);
        }
    });

    return magnitudes;
}

// Decode and correct a full codeword (data + ecc). Returns corrected codeword and details.
function rsDecodeCorrected(codeword, eccLen, locatorHint = null, positionsHint = null) {
    const syndromes = rsDecoder.calculateSyndromes(codeword, eccLen);
    const hasErrors = syndromes.some(s => s !== 0);
    if (!hasErrors) {
        return {
            codeword: [...codeword],
            errorPositions: [],
            errorValues: [],
            syndromes
        };
    }

    let locator = locatorHint || rsDecoder.findErrorLocator(syndromes);
    let errorResults = positionsHint
        ? positionsHint.map(p => ({
            position: p,
            locator: rsDecoder.expTable[(255 - (codeword.length - 1 - p)) % 255]
        }))
        : rsDecoder.findErrors(locator, codeword.length);

    if (errorResults.length === 0 && locator.length > 1) {
        const reversed = [...locator].reverse();
        const altResults = rsDecoder.findErrors(reversed, codeword.length);
        if (altResults.length > 0) {
            locator = reversed;
            errorResults = altResults;
        }
    }

    // Extract positions and locators
    const errorPositions = errorResults.map(r => r.position !== undefined ? r.position : r);
    const locators = errorResults.map(r => {
        if (r.locator !== undefined && r.locator !== null) return r.locator;
        const pos = r.position !== undefined ? r.position : r;
        const i = codeword.length - 1 - pos;
        const expIdx = (255 - i) % 255;
        return rsDecoder.expTable[expIdx];
    });

    const errorValues = rsDecoder.forneyAlgorithm(syndromes, locators, codeword.length, locator);
    const corrected = [...codeword];
    errorPositions.forEach((pos, i) => {
        const val = errorValues[i] || 0;
        // positions from findErrors already map to codeword indices (0 = leftmost)
        const idx = pos;
        corrected[idx] ^= val;
    });

    return {
        codeword: corrected,
        errorPositions,
        errorValues,
        locator,
        syndromes
    };
}

// Generate RS parity using ReedSolomonDecoder utilities
function rsEncode(dataBytes, eccLen) {
    const gen = rsDecoder.generateGeneratorPoly(eccLen); // roots α^0..α^(t-1)
    const msg = dataBytes.concat(new Array(eccLen).fill(0));

    for (let i = 0; i < dataBytes.length; i++) {
        const coef = msg[i];
        if (coef !== 0) {
            for (let j = 1; j < gen.length; j++) {
                msg[i + j] ^= rsDecoder.gfMul(gen[j], coef);
            }
        }
    }

    return msg.slice(msg.length - eccLen);
}

// Calculate Reed-Solomon syndromes
function calculateSyndromes() {
    if (!qrBlocks.length) {
        alert('De-interleave data first to prepare blocks for error correction.');
        return;
    }

    qrBlocks.forEach((block, idx) => {
        const eccLen = block.eccBytes.length;
        block.syndromes = new Array(eccLen);

        // Combine data and ECC into received codeword
        const received = [...block.dataBytes, ...block.eccBytes];

        // Calculate syndromes using ReedSolomonDecoder
        block.syndromes = rsDecoder.calculateSyndromes(received, eccLen);

        // Display syndromes
        const syndromesDiv = document.getElementById(`block${idx}-syndromes`);
        const syndromesSection = document.getElementById(`block${idx}-syndromes-section`);
        if (syndromesDiv && syndromesSection) {
            syndromesSection.style.display = 'block';
            let html = '';
            block.syndromes.forEach((s, i) => {
                const hexValue = s.toString(16).toUpperCase().padStart(2, '0');
                const cssClass = s === 0 ? 'syndrome-box zero' : 'syndrome-box nonzero';
                html += `<span class="${cssClass}">S${i}=${hexValue}</span>`;
            });
            syndromesDiv.innerHTML = html;
        }
    });

    // Update status
    const ecStatus = document.getElementById('ecStatus');
    const ecStatusContent = document.getElementById('ecStatusContent');
    if (ecStatus && ecStatusContent) {
        ecStatus.style.display = 'block';
        let statusHtml = '';
        qrBlocks.forEach((block, idx) => {
            const hasErrors = block.syndromes.some(s => s !== 0);
            const errorCount = hasErrors ? 'Errors detected' : 'No errors';
            const maxCorrectableOct = Math.floor(block.eccBytes.length / 2);
            statusHtml += `<p><strong>Block ${idx + 1}:</strong> ${errorCount}. Can correct up to ${maxCorrectableOct} errors.</p>`;
        });
        ecStatusContent.innerHTML = statusHtml;
    }

    currentEcStep = 1;
    syndromeCalculated = true;

    // Disable Calculate Syndromes, enable Find Error Locations
    document.getElementById('calculateSyndromesButton').disabled = true;
    document.getElementById('findErrorLocationsButton').disabled = false;

    // Debug: re-encode data and compare ECC to received
}

// Find error locations using Berlekamp-Massey and Chien search
function findErrorLocations() {
    if (!syndromeCalculated || currentEcStep < 1) {
        alert('Calculate syndromes first.');
        return;
    }

    qrBlocks.forEach((block, blockIdx) => {
        // Check if there are errors
        const hasErrors = block.syndromes.some(s => s !== 0);
        if (!hasErrors) {
            block.errorPositions = [];
            return;
        }

        // Use helper's Berlekamp-Massey to find error locator polynomial
        const errorLocator = rsDecoder.findErrorLocator(block.syndromes);

        console.log(`Block ${blockIdx + 1}: Error locator polynomial:`, errorLocator);
        console.log(`Block ${blockIdx + 1}: Syndromes:`, block.syndromes.map(s => s.toString(16)));

        if (!errorLocator || errorLocator.length === 1) {
            block.errorPositions = [];
            console.warn(`Block ${blockIdx + 1}: No error locator found`);
            return;
        }

        // Use built-in Chien search from ReedSolomonDecoder
        const n = block.dataBytes.length + block.eccBytes.length;
        let errorResults = rsDecoder.findErrors(errorLocator, n);
        let locatorUsed = errorLocator;
        if (errorResults.length === 0 && errorLocator.length > 1) {
            // Try reversed coefficient order (common convention mismatch)
            const reversedLocator = [...errorLocator].reverse();
            const altResults = rsDecoder.findErrors(reversedLocator, n);
            if (altResults.length > 0) {
                locatorUsed = reversedLocator;
                errorResults = altResults;
            }
        }

        // Extract positions and Xi roots
        const errorPositions = errorResults.map(r => r.position !== undefined ? r.position : r);
        const errorLocators = errorResults.map(r => r.locator !== undefined ? r.locator : null);

        console.log(`Block ${blockIdx + 1}: Found ${errorPositions.length} error positions:`, errorPositions);
        console.log(`Block ${blockIdx + 1}: Max correctable: ${Math.floor(block.eccBytes.length / 2)}`);

        block.errorPositions = Array.isArray(errorPositions) ? [...errorPositions] : [];
        block.errorLocators = errorLocators;
        block.errorLocator = locatorUsed;

        // Visual feedback: highlight error positions with yellow outline
        errorPositions.forEach(pos => {
            let elementId;
            if (pos < block.dataBytes.length) {
                // Error in data
                elementId = `block${blockIdx}-data${pos}`;
            } else {
                // Error in ECC
                const eccPos = pos - block.dataBytes.length;
                elementId = `block${blockIdx}-ecc${eccPos}`;
            }

            const element = document.getElementById(elementId);
            if (element) {
                element.classList.add('error-located');
            }
        });
    });

    // Update status
    const ecStatusContent = document.getElementById('ecStatusContent');
    if (ecStatusContent) {
        let statusHtml = '';
        qrBlocks.forEach((block, idx) => {
            const hasErrors = block.syndromes.some(s => s !== 0);
            const errorCount = block.errorPositions.length;
            const maxCorrectable = Math.floor(block.eccBytes.length / 2);

            if (!hasErrors) {
                statusHtml += `<p><strong>Block ${idx + 1}:</strong> No errors detected.</p>`;
            } else if (errorCount === 0) {
                statusHtml += `<p><strong>Block ${idx + 1}:</strong> Errors detected but could not locate them.</p>`;
            } else if (errorCount > maxCorrectable) {
                statusHtml += `<p style="color: #cc0000;"><strong>Block ${idx + 1}:</strong> ${errorCount} errors found - TOO MANY to correct (max ${maxCorrectable}).</p>`;
            } else {
                const positions = block.errorPositions.map(p => {
                    if (p < block.dataBytes.length) return `D${p}`;
                    return `E${p - block.dataBytes.length}`;
                }).join(', ');
                statusHtml += `<p><strong>Block ${idx + 1}:</strong> ${errorCount} error(s) at positions: [${positions}]</p>`;
            }
        });
        ecStatusContent.innerHTML = statusHtml;
    }

    currentEcStep = 2;

    // Disable Find Error Locations, enable Calculate Error Values
    document.getElementById('findErrorLocationsButton').disabled = true;
    document.getElementById('calculateErrorValuesButton').disabled = false;
}

// Calculate error values using Forney algorithm
function calculateErrorValues() {
    if (currentEcStep < 2) {
        alert('Find error locations first.');
        return;
    }

    qrBlocks.forEach((block, blockIdx) => {
        if (block.errorPositions.length === 0) {
            block.errorValues = [];
            return;
        }

        const codewordLen = block.dataBytes.length + block.eccBytes.length;

        const locator = block.errorLocator || rsDecoder.findErrorLocator(block.syndromes);
        const locatorsForForney = (block.errorLocators && block.errorLocators.length ? block.errorLocators : block.errorPositions)
            .map(val => {
                if (val === null || val === undefined) return null;
                if (block.errorLocators && block.errorLocators.length) return val;
                const pos = val;
                const i = codewordLen - 1 - pos;
                const expIdx = (255 - i) % 255;
                return rsDecoder.expTable[expIdx];
            });
        block.errorValues = rsDecoder.forneyAlgorithm(
            block.syndromes,
            locatorsForForney,
            codewordLen,
            locator
        );

        // Display error values above the corrupted bytes
        block.errorPositions.forEach((pos, i) => {
            const errorValue = block.errorValues[i];
            let elementId;
            if (pos < block.dataBytes.length) {
                elementId = `block${blockIdx}-data${pos}`;
            } else {
                const eccPos = pos - block.dataBytes.length;
                elementId = `block${blockIdx}-ecc${eccPos}`;
            }

            const element = document.getElementById(elementId);
            if (element) {
                // Add error class for red background
                element.classList.add('error');
                // Add error value display
                const errorHex = errorValue.toString(16).toUpperCase().padStart(2, '0');
                const errorSpan = document.createElement('span');
                errorSpan.className = 'error-value';
                errorSpan.textContent = `Δ${errorHex}`;
                element.appendChild(errorSpan);
            }
        });
    });

    // Update status
    const ecStatusContent = document.getElementById('ecStatusContent');
    if (ecStatusContent) {
        let statusHtml = '';
        qrBlocks.forEach((block, idx) => {
            if (block.errorPositions.length === 0) {
                statusHtml += `<p><strong>Block ${idx + 1}:</strong> No errors to calculate.</p>`;
            } else {
                const errorDetails = block.errorPositions.map((p, i) => {
                    const val = block.errorValues[i] !== undefined ? block.errorValues[i].toString(16).toUpperCase().padStart(2, '0') : '??';
                    if (p < block.dataBytes.length) return `D${p}=Δ${val}`;
                    return `E${p - block.dataBytes.length}=Δ${val}`;
                }).join(', ');
                statusHtml += `<p><strong>Block ${idx + 1}:</strong> Error values: ${errorDetails}</p>`;
            }
        });
        ecStatusContent.innerHTML = statusHtml;
    }

    currentEcStep = 3;

    // Disable Calculate Error Values, enable Apply Corrections
    document.getElementById('calculateErrorValuesButton').disabled = true;
    document.getElementById('applyCorrectionsButton').disabled = false;
}

// Apply corrections to fix errors
function applyCorrections() {
    if (currentEcStep < 3) {
        alert('Calculate error values first.');
        return;
    }

    qrBlocks.forEach((block, blockIdx) => {
        const codeword = [...block.dataBytes, ...block.eccBytes];
        if (block.errorPositions && block.errorPositions.length && block.errorValues && block.errorValues.length) {
            // Apply previously computed deltas directly so the same signs are used as displayed
            block.errorPositions.forEach((pos, i) => {
                if (pos < 0 || pos >= codeword.length) return;
                const delta = block.errorValues[i] || 0;
                codeword[pos] = rsDecoder.field.addOrSubtract(codeword[pos], delta);
            });
            block.dataBytes = codeword.slice(0, block.dataBytes.length);
            block.eccBytes = codeword.slice(block.dataBytes.length);
        } else {
            // Fallback: run decoder again if we somehow lack stored deltas
            const correctedInfo = rsDecodeCorrected(codeword, block.eccBytes.length, block.errorLocator, block.errorPositions);
            block.dataBytes = correctedInfo.codeword.slice(0, block.dataBytes.length);
            block.eccBytes = correctedInfo.codeword.slice(block.dataBytes.length);
            block.errorPositions = correctedInfo.errorPositions || [];
            block.errorValues = correctedInfo.errorValues || [];
        }

        // Update display for data bytes
        block.dataBytes.forEach((byte, pos) => {
            const elementId = `block${blockIdx}-data${pos}`;
            const element = document.getElementById(elementId);
            if (element) {
                element.classList.remove('error', 'error-located');
                element.classList.add('corrected');
                element.childNodes[0].textContent = byte.toString(16).toUpperCase().padStart(2, '0');
                const errorSpan = element.querySelector('.error-value');
                if (errorSpan) errorSpan.remove();
            }
        });

        // Update display for ECC bytes
        block.eccBytes.forEach((byte, pos) => {
            const elementId = `block${blockIdx}-ecc${pos}`;
            const element = document.getElementById(elementId);
            if (element) {
                element.classList.remove('error', 'error-located');
                element.classList.add('corrected');
                element.childNodes[0].textContent = byte.toString(16).toUpperCase().padStart(2, '0');
                const errorSpan = element.querySelector('.error-value');
                if (errorSpan) errorSpan.remove();
            }
        });
    });

    // Update status
    const ecStatusContent = document.getElementById('ecStatusContent');
    if (ecStatusContent) {
        let statusHtml = '<p style="color: #00aa00; font-weight: bold;">✓ All correctable errors have been fixed!</p>';
        qrBlocks.forEach((block, idx) => {
            const correctedCount = block.errorValues ? block.errorValues.length : 0;
            statusHtml += `<p><strong>Block ${idx + 1}:</strong> ${correctedCount} error(s) corrected.</p>`;
        });
        ecStatusContent.innerHTML = statusHtml;
    }

    currentEcStep = 4;

    // Disable Apply Corrections
    document.getElementById('applyCorrectionsButton').disabled = true;

    // Enable Decode Message button
    const decodeMessageButton = document.getElementById('decodeMessageButton');
    if (decodeMessageButton) {
        decodeMessageButton.disabled = false;
    }

    // Re-enable Decode Mode with corrected data
    updateDeinterleavedBitsFromCorrectedBlocks();
}

// Decode the final message from corrected data
function decodeMessage() {
    if (!qrBlocks.length) {
        alert('No data blocks available.');
        return;
    }

    // Check if we have mode and size decoded
    if (!currentDataMode || currentDataMode === '-') {
        alert('Please decode the data mode first.');
        return;
    }

    if (!decodedMessageSize) {
        alert('Please decode the message size first.');
        return;
    }

    if (currentDataMode !== 'Byte') {
        alert(`Message decoding is currently only supported for Byte mode. Current mode: ${currentDataMode}`);
        return;
    }

    // Concatenate all corrected data bytes from all blocks
    const allDataBytes = [];
    qrBlocks.forEach(block => {
        allDataBytes.push(...block.dataBytes);
    });

    // Calculate how many bits to skip (mode + size)
    const version = parseInt(versionSelect.value, 10);
    const modeBits = 4;
    const sizeBits = version <= 9 ? 8 : 16;
    const headerBits = modeBits + sizeBits;
    const headerBytes = Math.floor(headerBits / 8);
    const headerBitOffset = headerBits % 8;

    // Extract message bytes
    let messageBytes = [];
    let bitOffset = headerBitOffset;
    let byteIndex = headerBytes;

    for (let i = 0; i < decodedMessageSize; i++) {
        if (bitOffset === 0) {
            // Byte-aligned, just take the byte
            if (byteIndex < allDataBytes.length) {
                messageBytes.push(allDataBytes[byteIndex]);
                byteIndex++;
            }
        } else {
            // Not byte-aligned, need to combine bits from two bytes
            if (byteIndex < allDataBytes.length - 1) {
                const byte1 = allDataBytes[byteIndex];
                const byte2 = allDataBytes[byteIndex + 1];
                // Take remaining bits from byte1 and first bits from byte2
                const combined = ((byte1 << bitOffset) | (byte2 >> (8 - bitOffset))) & 0xFF;
                messageBytes.push(combined);
                byteIndex++;
            }
        }
    }

    // Try to decode as UTF-8
    let decodedText = '';
    try {
        // Try UTF-8 decoding using TextDecoder
        const decoder = new TextDecoder('utf-8', { fatal: true });
        decodedText = decoder.decode(new Uint8Array(messageBytes));
    } catch (e) {
        // Fall back to ISO-8859-1 (Latin-1) - standard for QR Byte mode
        decodedText = messageBytes.map(b => String.fromCharCode(b)).join('');
    }

    // Display the message
    const messageBox = document.getElementById('decodedMessageBox');
    const messageContent = document.getElementById('decodedMessageContent');
    if (messageBox && messageContent) {
        messageBox.style.display = 'block';
        messageContent.textContent = decodedText;
    }

    // Disable the button after decoding
    const decodeMessageButton = document.getElementById('decodeMessageButton');
    if (decodeMessageButton) {
        decodeMessageButton.disabled = true;
    }

    console.log('Decoded message:', decodedText);
    console.log('Message bytes:', messageBytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')));
}

// Update deinterleaved bits from corrected blocks
function updateDeinterleavedBitsFromCorrectedBlocks() {
    if (!qrBlocks.length) return;

    // Convert corrected data bytes back to bit string
    const dataStream = qrBlocks.map(block => {
        return block.dataBytes.map(byte => {
            return byte.toString(2).padStart(8, '0');
        }).join('');
    }).join('');

    setDeinterleavedBits(dataStream);

    // Re-enable decode mode button with corrected data (only if not already decoded)
    const decodeModeButton = document.getElementById('decodeModeButton');
    if (decodeModeButton && !isModeDecoded) {
        decodeModeButton.disabled = false;
    }

    // Keep existing mode/size if already decoded - no need to reset
}

// Handle image upload
imageInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

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
