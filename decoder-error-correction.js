// decoder-error-correction.js
// Reed-Solomon error correction functions for QR code decoding

// Using ReedSolomonDecoder GF tables
const rsDecoder = new ReedSolomonDecoder();

// Compute error magnitudes using Forney algorithm
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
                errorSpan.textContent = `${errorHex}`;
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

// Decode numeric mode message
function decodeNumericMessage(dataBits, charCount) {
    let result = '';
    let bitIndex = 0;
    let remainingChars = charCount;

    while (remainingChars > 0) {
        if (remainingChars >= 3) {
            // 3 digits encoded in 10 bits
            if (bitIndex + 10 <= dataBits.length) {
                const bits = dataBits.slice(bitIndex, bitIndex + 10);
                const value = parseInt(bits, 2);
                result += value.toString().padStart(3, '0');
                bitIndex += 10;
                remainingChars -= 3;
            } else {
                break;
            }
        } else if (remainingChars === 2) {
            // 2 digits encoded in 7 bits
            if (bitIndex + 7 <= dataBits.length) {
                const bits = dataBits.slice(bitIndex, bitIndex + 7);
                const value = parseInt(bits, 2);
                result += value.toString().padStart(2, '0');
                bitIndex += 7;
                remainingChars -= 2;
            } else {
                break;
            }
        } else {
            // 1 digit encoded in 4 bits
            if (bitIndex + 4 <= dataBits.length) {
                const bits = dataBits.slice(bitIndex, bitIndex + 4);
                const value = parseInt(bits, 2);
                result += value.toString();
                bitIndex += 4;
                remainingChars -= 1;
            } else {
                break;
            }
        }
    }

    return result;
}

// Decode alphanumeric mode message
function decodeAlphanumericMessage(dataBits, charCount) {
    // Alphanumeric character set (45 characters)
    const alphanumericTable = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

    let result = '';
    let bitIndex = 0;
    let remainingChars = charCount;

    while (remainingChars > 0) {
        if (remainingChars >= 2) {
            // 2 characters encoded in 11 bits
            if (bitIndex + 11 <= dataBits.length) {
                const bits = dataBits.slice(bitIndex, bitIndex + 11);
                const value = parseInt(bits, 2);
                // Split into two characters: first = value / 45, second = value % 45
                const char1 = alphanumericTable[Math.floor(value / 45)];
                const char2 = alphanumericTable[value % 45];
                result += char1 + char2;
                bitIndex += 11;
                remainingChars -= 2;
            } else {
                break;
            }
        } else {
            // 1 character encoded in 6 bits
            if (bitIndex + 6 <= dataBits.length) {
                const bits = dataBits.slice(bitIndex, bitIndex + 6);
                const value = parseInt(bits, 2);
                result += alphanumericTable[value];
                bitIndex += 6;
                remainingChars -= 1;
            } else {
                break;
            }
        }
    }

    return result;
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

    if (!['Numeric', 'Alphanumeric', 'Byte'].includes(currentDataMode)) {
        alert(`Message decoding is not yet supported for ${currentDataMode} mode.`);
        return;
    }

    // Concatenate all corrected data bytes from all blocks as bit string
    const allDataBits = qrBlocks.map(block => {
        return block.dataBytes.map(byte => {
            return byte.toString(2).padStart(8, '0');
        }).join('');
    }).join('');

    // Calculate how many bits to skip (mode + ECI + actual mode + size)
    const version = parseInt(versionSelect.value, 10);
    let headerBits = 4; // Initial mode indicator

    // Account for ECI if present
    if (eciAssignment !== null) {
        const eciResult = decodeECIAssignment(allDataBits, 4);
        headerBits += eciResult.bitsRead; // ECI assignment bits
        headerBits += 4; // Actual mode indicator after ECI
    }

    // Add character count bits
    const sizeBits = getCharCountBitLength(currentDataMode, version);
    headerBits += sizeBits;

    // Extract message data bits (after header)
    const messageBits = allDataBits.slice(headerBits);

    // Decode based on mode
    let decodedText = '';
    if (currentDataMode === 'Numeric') {
        decodedText = decodeNumericMessage(messageBits, decodedMessageSize);
    } else if (currentDataMode === 'Alphanumeric') {
        decodedText = decodeAlphanumericMessage(messageBits, decodedMessageSize);
    } else if (currentDataMode === 'Byte') {
        // For Byte mode, extract bytes from the bit string
        const messageBytes = [];
        for (let i = 0; i < decodedMessageSize && i * 8 < messageBits.length; i++) {
            const byteBits = messageBits.slice(i * 8, (i + 1) * 8);
            if (byteBits.length === 8) {
                messageBytes.push(parseInt(byteBits, 2));
            }
        }

        // Decode using ECI encoding if available, otherwise try UTF-8 then fallback
        let encodingUsed = eciEncoding || 'utf-8';
        try {
            const decoder = new TextDecoder(encodingUsed, { fatal: true });
            decodedText = decoder.decode(new Uint8Array(messageBytes));
        } catch (e) {
            // If ECI encoding fails or we tried UTF-8, fall back to ISO-8859-1
            if (encodingUsed !== 'ISO-8859-1') {
                try {
                    const fallbackDecoder = new TextDecoder('ISO-8859-1', { fatal: false });
                    decodedText = fallbackDecoder.decode(new Uint8Array(messageBytes));
                } catch (e2) {
                    // Last resort: direct character mapping
                    decodedText = messageBytes.map(b => String.fromCharCode(b)).join('');
                }
            } else {
                decodedText = messageBytes.map(b => String.fromCharCode(b)).join('');
            }
        }
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

    console.log(`Decoded ${currentDataMode} message:`, decodedText);
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
