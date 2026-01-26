// QR Code Generator - Main Application
// Orchestrates the 3-step wizard and connects all components

const App = {
    // Application state
    state: {
        currentStep: 1,
        currentType: 'text',
        formData: {},
        qrContent: '',
        matrix: null,
        version: null,
        debounceTimer: null,
        // Logo dragging state
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        logoStartX: 50,
        logoStartY: 50,
        // Encoding state for padding modification
        bitstreamData: null,
        blocks: null,
        maskPattern: 0,
        eccLevel: 'M',
        paddingModuleMap: null,
        editableCells: new Set(),
        originalPaddingBytes: null
    },

    // Initialize application
    init() {
        this.setupTypeSelector();
        this.setupStepNavigation();
        this.setupFormHandlers();
        this.setupLogoControls();
        this.setupStyleControls();
        this.setupExportButtons();

        // Render initial form
        this.renderForm('text');
    },

    // Setup type selector cards
    setupTypeSelector() {
        const cards = document.querySelectorAll('.type-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                // Update active state
                cards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');

                // Update type and render form
                const type = card.dataset.type;
                this.state.currentType = type;
                this.renderForm(type);
            });
        });
    },

    // Setup step navigation
    setupStepNavigation() {
        const stepBtns = document.querySelectorAll('.step-btn');

        stepBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const step = parseInt(btn.dataset.step);
                this.goToStep(step);
            });
        });

        // Step 1 buttons
        document.getElementById('nextBtn1').addEventListener('click', () => {
            if (this.validateForm()) {
                this.goToStep(2);
            }
        });

        // Step 2 buttons
        document.getElementById('backBtn2').addEventListener('click', () => {
            this.goToStep(1);
        });

        document.getElementById('skipLogoBtn').addEventListener('click', () => {
            this.goToStep(3);
        });

        document.getElementById('nextBtn2').addEventListener('click', () => {
            this.goToStep(3);
        });

        // Step 3 buttons
        document.getElementById('backBtn3').addEventListener('click', () => {
            this.goToStep(2);
        });
    },

    // Go to specific step
    goToStep(step) {
        this.state.currentStep = step;

        // Update step buttons
        document.querySelectorAll('.step-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.step) === step);
        });

        // Update sections
        document.querySelectorAll('.step-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`step${step}`).classList.add('active');

        // Actions per step
        if (step === 2) {
            // Only regenerate if we don't have a matrix yet
            if (!this.state.matrix) {
                this.generateQR();
            }
            this.renderLogoCanvas();
        } else if (step === 3) {
            // Don't regenerate - use the existing (possibly optimized) matrix
            this.renderMainCanvas();
        }
    },

    // Render dynamic form based on type
    renderForm(typeKey) {
        const type = QRTypes.getType(typeKey);
        if (!type) return;

        const form = document.getElementById('inputForm');
        form.innerHTML = '';

        // Group fields into rows for certain types
        const fieldsPerRow = {
            vcard: [['firstName', 'lastName'], ['phone', 'email'], ['company', 'title'], ['website'], ['address']],
            event: [['title'], ['startDate', 'startTime'], ['endDate', 'endTime'], ['location'], ['description']],
            geo: [['latitude', 'longitude'], ['label']]
        };

        const rows = fieldsPerRow[typeKey];

        if (rows) {
            // Use predefined row groupings
            rows.forEach(rowFields => {
                if (rowFields.length === 1) {
                    const field = type.fields.find(f => f.name === rowFields[0]);
                    if (field) form.appendChild(this.createFieldElement(field));
                } else {
                    const rowDiv = document.createElement('div');
                    rowDiv.className = 'form-row';
                    rowFields.forEach(fieldName => {
                        const field = type.fields.find(f => f.name === fieldName);
                        if (field) rowDiv.appendChild(this.createFieldElement(field));
                    });
                    form.appendChild(rowDiv);
                }
            });
        } else {
            // Single column for simple types
            type.fields.forEach(field => {
                form.appendChild(this.createFieldElement(field));
            });
        }

        // Setup input handlers
        this.setupFormHandlers();

        // Clear form data for new type
        this.state.formData = {};

        // Set default values
        type.fields.forEach(field => {
            if (field.type === 'select' && field.options && field.options.length > 0) {
                this.state.formData[field.name] = field.options[0].value;
            }
        });

        // Trigger initial generation
        this.scheduleQRUpdate();
    },

    // Create a single form field element
    createFieldElement(field) {
        const div = document.createElement('div');
        div.className = 'form-group';

        const label = document.createElement('label');
        label.textContent = field.label;
        if (field.required) {
            label.innerHTML += ' <span style="color: #ef4444">*</span>';
        }
        div.appendChild(label);

        let input;

        if (field.type === 'textarea') {
            input = document.createElement('textarea');
            input.placeholder = field.placeholder || '';
        } else if (field.type === 'select') {
            input = document.createElement('select');
            field.options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.label;
                input.appendChild(option);
            });
        } else if (field.type === 'checkbox') {
            const checkWrapper = document.createElement('div');
            checkWrapper.style.display = 'flex';
            checkWrapper.style.alignItems = 'center';

            input = document.createElement('input');
            input.type = 'checkbox';
            input.id = `field-${field.name}`;

            const checkLabel = document.createElement('label');
            checkLabel.htmlFor = `field-${field.name}`;
            checkLabel.textContent = field.label;
            checkLabel.style.marginBottom = '0';

            checkWrapper.appendChild(input);
            checkWrapper.appendChild(checkLabel);

            // Replace label with wrapper
            div.innerHTML = '';
            div.appendChild(checkWrapper);
        } else {
            input = document.createElement('input');
            input.type = field.type || 'text';
            input.placeholder = field.placeholder || '';
            if (field.step) input.step = field.step;
        }

        input.name = field.name;
        input.dataset.fieldName = field.name;
        if (field.required) input.required = true;

        if (field.type !== 'checkbox') {
            div.appendChild(input);
        } else {
            // Checkbox already added in wrapper
            div.querySelector('input').dataset.fieldName = field.name;
        }

        return div;
    },

    // Setup form input handlers
    setupFormHandlers() {
        const form = document.getElementById('inputForm');
        const inputs = form.querySelectorAll('input, textarea, select');

        inputs.forEach(input => {
            const eventType = input.type === 'checkbox' ? 'change' : 'input';
            input.addEventListener(eventType, (e) => {
                const fieldName = e.target.dataset.fieldName;
                const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
                this.state.formData[fieldName] = value;
                this.scheduleQRUpdate();
            });
        });
    },

    // Debounced QR update
    scheduleQRUpdate() {
        clearTimeout(this.state.debounceTimer);
        this.state.debounceTimer = setTimeout(() => {
            this.generateQR();
            this.renderPreview();
        }, 300);
    },

    // Validate form
    validateForm() {
        const type = QRTypes.getType(this.state.currentType);
        const validation = QRTypes.validate(this.state.currentType, this.state.formData);

        if (!validation.valid) {
            alert(validation.errors.join('\n'));
            return false;
        }

        return true;
    },

    // Generate QR code
    generateQR() {
        try {
            // Format content based on type
            const content = QRTypes.format(this.state.currentType, this.state.formData);
            if (!content || content.trim() === '') {
                this.state.matrix = null;
                this.state.qrContent = '';
                return;
            }

            this.state.qrContent = content;

            // Determine version
            let version = this.getSelectedVersion();
            const mode = this.detectMode(content);

            // Get selected ECC level
            const eccLevel = this.getSelectedEccLevel();
            this.state.eccLevel = eccLevel;

            // Find minimum version that fits
            if (version === 'auto') {
                version = this.findMinVersion(content, mode, eccLevel);
            } else {
                version = parseInt(version);
            }

            this.state.version = version;
            this.state.maskPattern = 0; // Default mask pattern

            // Generate bitstream
            const bitstreamData = generateBitstream(content, mode, version, eccLevel, capacityTable);

            // Store bitstreamData for padding modification
            this.state.bitstreamData = bitstreamData;

            // Split into blocks and calculate ECC
            let blocks = splitIntoBlocks(bitstreamData.dataBytes, version, eccLevel, blockSizeTable);
            blocks = calculateEccForBlocks(blocks);

            // Store blocks for padding modification
            this.state.blocks = blocks;

            // Interleave
            const interleaved = interleaveBlocks(blocks);

            // Create matrix
            const size = getQrSize(version);
            const matrix = createMatrix(size);

            // Place patterns and data
            placeFunctionPatterns(matrix, version);
            placeDataBits(matrix, interleaved);
            applyMask(matrix, this.state.maskPattern, version);
            placeFormatInfo(matrix, eccLevel, this.state.maskPattern, version);
            placeVersionInfo(matrix, version);

            this.state.matrix = matrix;

            // Build padding module map if there are padding bytes
            if (bitstreamData.padBytes && bitstreamData.padBytes.length > 0) {
                this.buildPaddingModuleMap();
            } else {
                this.state.paddingModuleMap = null;
                this.state.editableCells = new Set();
                this.state.originalPaddingBytes = null;
            }
        } catch (e) {
            console.error('QR generation error:', e);
            this.state.matrix = null;
        }
    },

    // Detect encoding mode
    detectMode(text) {
        if (/^\d+$/.test(text)) return 'numeric';
        if (/^[0-9A-Z $%*+\-./:]+$/.test(text)) return 'alphanumeric';
        return 'byte';
    },

    // Find minimum version that fits content
    findMinVersion(content, mode, eccLevel) {
        for (let v = 1; v <= 40; v++) {
            const key = `${v}-${eccLevel}`;
            const capacity = capacityTable[key];
            if (!capacity) continue;

            const charCountBits = getCharCountIndicatorSize(v, mode);
            let dataBits;

            if (mode === 'numeric') {
                dataBits = Math.ceil(content.length / 3) * 10;
                if (content.length % 3 === 1) dataBits += 4 - 10;
                if (content.length % 3 === 2) dataBits += 7 - 10;
            } else if (mode === 'alphanumeric') {
                dataBits = Math.floor(content.length / 2) * 11 + (content.length % 2) * 6;
            } else {
                dataBits = content.length * 8;
            }

            const totalBits = 4 + charCountBits + dataBits;
            const availableBits = capacity * 8;

            if (totalBits <= availableBits) {
                return v;
            }
        }
        return 10; // Default to version 10
    },

    // Get selected version
    getSelectedVersion() {
        const select = document.getElementById('versionSelect');
        return select ? select.value : 'auto';
    },

    // Get selected ECC level
    getSelectedEccLevel() {
        const select = document.getElementById('eccSelect');
        return select ? select.value : 'M';
    },

    // Render small preview (step 1)
    renderPreview() {
        const canvas = document.getElementById('previewCanvas');
        if (!canvas || !this.state.matrix) {
            // Clear canvas if no matrix
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#f3f4f6';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#9ca3af';
                ctx.font = '14px system-ui';
                ctx.textAlign = 'center';
                ctx.fillText('Enter content above', canvas.width / 2, canvas.height / 2);
            }
            return;
        }

        // Simple B&W render for preview
        const ctx = canvas.getContext('2d');
        const size = this.state.matrix.length;
        const quietZone = 2;
        const totalSize = size + (quietZone * 2);
        const moduleSize = canvas.width / totalSize;
        const offset = quietZone * moduleSize;

        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = 'black';
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                if (this.state.matrix[row][col]) {
                    ctx.fillRect(
                        offset + col * moduleSize,
                        offset + row * moduleSize,
                        moduleSize,
                        moduleSize
                    );
                }
            }
        }
    },

    // ========== Logo Controls (Step 2) ==========
    setupLogoControls() {
        const logoInput = document.getElementById('logoInput');
        const uploadBtn = document.getElementById('uploadLogoBtn');
        const clearBtn = document.getElementById('clearLogoBtn');
        const logoAdjustments = document.getElementById('logoAdjustments');
        const logoCanvas = document.getElementById('logoCanvas');
        const canvasHint = document.getElementById('logoCanvasHint');

        uploadBtn.addEventListener('click', () => logoInput.click());

        logoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                QRRenderer.loadLogo(file, () => {
                    clearBtn.style.display = 'inline-flex';
                    logoAdjustments.style.display = 'block';
                    canvasHint.style.display = 'none';
                    logoCanvas.classList.add('draggable');

                    // Show module color mode control and optimize section
                    const moduleColorMode = document.getElementById('moduleColorMode');
                    if (moduleColorMode) moduleColorMode.style.display = 'block';
                    const optimizeMaskSection = document.getElementById('optimizeMaskSection');
                    if (optimizeMaskSection) optimizeMaskSection.style.display = 'block';

                    // Auto-detect background fill
                    this.autoDetectBackgroundFill();

                    this.renderLogoCanvas();
                });
            }
        });

        clearBtn.addEventListener('click', () => {
            QRRenderer.clearLogo();
            logoInput.value = '';
            clearBtn.style.display = 'none';
            logoAdjustments.style.display = 'none';
            canvasHint.style.display = 'block';
            logoCanvas.classList.remove('draggable');

            // Hide module color mode control and optimize section, reset to default
            const moduleColorMode = document.getElementById('moduleColorMode');
            if (moduleColorMode) moduleColorMode.style.display = 'none';
            const optimizeMaskSection = document.getElementById('optimizeMaskSection');
            if (optimizeMaskSection) optimizeMaskSection.style.display = 'none';
            const optimizeResult = document.getElementById('optimizeResult');
            if (optimizeResult) optimizeResult.style.display = 'none';
            document.getElementById('colorMode').value = 'default';
            QRRenderer.state.colorMode = 'default';

            this.renderLogoCanvas();
        });

        // Optimize mask button
        document.getElementById('optimizeMaskBtn').addEventListener('click', () => {
            this.optimizeMaskForLogo();
        });

        // Logo scale
        const logoScale = document.getElementById('logoScale');
        const logoScaleValue = document.getElementById('logoScaleValue');
        logoScale.addEventListener('input', (e) => {
            QRRenderer.state.logoScale = parseInt(e.target.value);
            logoScaleValue.textContent = e.target.value;
            this.renderLogoCanvas();
        });

        // Background fill
        const backgroundFill = document.getElementById('backgroundFill');
        backgroundFill.addEventListener('change', (e) => {
            QRRenderer.state.backgroundFill = e.target.value;
            this.renderLogoCanvas();
        });

        // Version select (in logo step)
        document.getElementById('versionSelect').addEventListener('change', () => {
            this.generateQR();
            if (this.state.currentStep === 2) {
                this.renderLogoCanvas();
            } else if (this.state.currentStep === 3) {
                this.renderMainCanvas();
            }
        });

        // ECC level select (in logo step)
        document.getElementById('eccSelect').addEventListener('change', () => {
            this.generateQR();
            if (this.state.currentStep === 2) {
                this.renderLogoCanvas();
            } else if (this.state.currentStep === 3) {
                this.renderMainCanvas();
            }
        });

        // Color mode (in logo step)
        document.getElementById('colorMode').addEventListener('change', (e) => {
            QRRenderer.state.colorMode = e.target.value;
            this.renderLogoCanvas();
        });

        // Logo dragging
        this.setupLogoDragging(logoCanvas);
    },

    // Auto-detect best background fill based on logo
    autoDetectBackgroundFill() {
        if (!QRRenderer.state.logoImageData) return;

        const data = QRRenderer.state.logoImageData.data;
        let hasTransparency = false;
        let totalLuminance = 0;
        let opaquePixels = 0;

        // Sample every 16th pixel for performance
        for (let i = 0; i < data.length; i += 64) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a < 128) {
                hasTransparency = true;
            } else {
                totalLuminance += (0.299 * r + 0.587 * g + 0.114 * b);
                opaquePixels++;
            }
        }

        const avgLuminance = opaquePixels > 0 ? totalLuminance / opaquePixels : 128;

        let fill = 'transparent';
        if (hasTransparency) {
            fill = 'transparent';
        } else if (avgLuminance < 85) {
            fill = 'dark';
        } else {
            fill = 'light';
        }

        QRRenderer.state.backgroundFill = fill;
        document.getElementById('backgroundFill').value = fill;
    },

    // Setup logo drag functionality
    setupLogoDragging(canvas) {
        const getMousePos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            return {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY
            };
        };

        canvas.addEventListener('mousedown', (e) => {
            if (!QRRenderer.state.logoImg) return;

            this.state.isDragging = true;
            this.state.dragStartX = e.clientX;
            this.state.dragStartY = e.clientY;
            this.state.logoStartX = QRRenderer.state.logoX;
            this.state.logoStartY = QRRenderer.state.logoY;
            canvas.classList.add('dragging');
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.state.isDragging) return;

            const canvas = document.getElementById('logoCanvas');
            const rect = canvas.getBoundingClientRect();

            // Calculate movement as percentage of canvas
            const deltaX = (e.clientX - this.state.dragStartX) / rect.width * 100;
            const deltaY = (e.clientY - this.state.dragStartY) / rect.height * 100;

            // Update logo position (clamped to 0-100)
            QRRenderer.state.logoX = Math.max(0, Math.min(100, this.state.logoStartX + deltaX));
            QRRenderer.state.logoY = Math.max(0, Math.min(100, this.state.logoStartY + deltaY));

            this.renderLogoCanvas();
        });

        document.addEventListener('mouseup', () => {
            if (this.state.isDragging) {
                this.state.isDragging = false;
                const canvas = document.getElementById('logoCanvas');
                canvas.classList.remove('dragging');
            }
        });

        // Touch support
        canvas.addEventListener('touchstart', (e) => {
            if (!QRRenderer.state.logoImg) return;

            const touch = e.touches[0];
            this.state.isDragging = true;
            this.state.dragStartX = touch.clientX;
            this.state.dragStartY = touch.clientY;
            this.state.logoStartX = QRRenderer.state.logoX;
            this.state.logoStartY = QRRenderer.state.logoY;
            canvas.classList.add('dragging');
            e.preventDefault();
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (!this.state.isDragging) return;

            const touch = e.touches[0];
            const canvas = document.getElementById('logoCanvas');
            const rect = canvas.getBoundingClientRect();

            const deltaX = (touch.clientX - this.state.dragStartX) / rect.width * 100;
            const deltaY = (touch.clientY - this.state.dragStartY) / rect.height * 100;

            QRRenderer.state.logoX = Math.max(0, Math.min(100, this.state.logoStartX + deltaX));
            QRRenderer.state.logoY = Math.max(0, Math.min(100, this.state.logoStartY + deltaY));

            this.renderLogoCanvas();
        }, { passive: true });

        document.addEventListener('touchend', () => {
            if (this.state.isDragging) {
                this.state.isDragging = false;
                const canvas = document.getElementById('logoCanvas');
                canvas.classList.remove('dragging');
            }
        });
    },

    // Render logo canvas (step 2) - transparent modules
    renderLogoCanvas() {
        const canvas = document.getElementById('logoCanvas');
        if (!canvas || !this.state.matrix) return;

        QRRenderer.renderWithTransparency(canvas, this.state.matrix, this.state.version, 0.4);
    },

    // Render main canvas with full styling (step 3)
    renderMainCanvas() {
        const canvas = document.getElementById('mainCanvas');
        if (!canvas || !this.state.matrix) return;

        QRRenderer.render(canvas, this.state.matrix, this.state.version);
    },

    // Setup style controls (step 3)
    setupStyleControls() {
        // Module shape
        document.querySelectorAll('.shape-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                QRRenderer.state.moduleShape = btn.dataset.shape;
                this.renderMainCanvas();
            });
        });

        // Finder shape
        document.getElementById('finderShape').addEventListener('change', (e) => {
            QRRenderer.state.finderShape = e.target.value;
            this.renderMainCanvas();
        });

        // Module size
        const moduleSize = document.getElementById('moduleSize');
        const moduleSizeValue = document.getElementById('moduleSizeValue');
        moduleSize.addEventListener('input', (e) => {
            QRRenderer.state.moduleSize = parseInt(e.target.value);
            moduleSizeValue.textContent = e.target.value;
            this.renderMainCanvas();
        });

        // Quiet zone
        const quietZone = document.getElementById('quietZone');
        const quietZoneValue = document.getElementById('quietZoneValue');
        quietZone.addEventListener('input', (e) => {
            QRRenderer.state.quietZone = parseInt(e.target.value);
            quietZoneValue.textContent = e.target.value;
            this.renderMainCanvas();
        });
    },

    // Setup export buttons
    setupExportButtons() {
        document.querySelectorAll('.export-buttons .btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const size = parseInt(btn.dataset.size);
                const canvas = document.getElementById('mainCanvas');
                if (this.state.matrix) {
                    QRRenderer.exportPNG(canvas, this.state.matrix, this.state.version, size);
                }
            });
        });
    },

    // Generate QR with a specific mask pattern
    generateQRWithMask(maskPattern) {
        try {
            const content = this.state.qrContent;
            if (!content) return null;

            const version = this.state.version;
            const eccLevel = this.state.eccLevel;
            const mode = this.detectMode(content);

            // Generate bitstream
            const bitstreamData = generateBitstream(content, mode, version, eccLevel, capacityTable);

            // Split into blocks and calculate ECC
            let blocks = splitIntoBlocks(bitstreamData.dataBytes, version, eccLevel, blockSizeTable);
            blocks = calculateEccForBlocks(blocks);

            // Interleave
            const interleaved = interleaveBlocks(blocks);

            // Create matrix
            const size = getQrSize(version);
            const matrix = createMatrix(size);

            // Place patterns and data
            placeFunctionPatterns(matrix, version);
            placeDataBits(matrix, interleaved);
            applyMask(matrix, maskPattern, version);
            placeFormatInfo(matrix, eccLevel, maskPattern, version);
            placeVersionInfo(matrix, version);

            return matrix;
        } catch (e) {
            console.error('QR generation error:', e);
            return null;
        }
    },

    // Count how many modules match the logo's dark/light pattern
    countLogoMatches(matrix) {
        if (!matrix || !QRRenderer.state.logoImg || !QRRenderer.state.logoImageData) {
            return { matches: 0, total: 0 };
        }

        const size = matrix.length;
        const quietZone = QRRenderer.state.quietZone;
        const totalSize = size + (quietZone * 2);
        const canvasSize = 450; // Match logo canvas size
        const moduleSize = canvasSize / totalSize;
        const offset = quietZone * moduleSize;
        const qrAreaSize = size * moduleSize;

        let matches = 0;
        let total = 0;

        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                // Sample logo at module center
                const moduleCenterX = (col * moduleSize) + moduleSize / 2;
                const moduleCenterY = (row * moduleSize) + moduleSize / 2;

                const sampledRgba = QRRenderer.sampleLogo(moduleCenterX, moduleCenterY, qrAreaSize);

                // Skip if outside logo or transparent
                if (!sampledRgba || sampledRgba[3] < 128) continue;

                total++;

                // Calculate logo luminance
                const luminance = 0.299 * sampledRgba[0] + 0.587 * sampledRgba[1] + 0.114 * sampledRgba[2];
                const logoWantsDark = luminance < 128;
                const moduleIsDark = matrix[row][col];

                if (logoWantsDark === moduleIsDark) {
                    matches++;
                }
            }
        }

        return { matches, total };
    },

    // ========== PADDING MODULE MAPPING ==========

    // Identify which bytes in the bitstream are padding bytes
    identifyPaddingBytes() {
        const bitstreamData = this.state.bitstreamData;
        if (!bitstreamData) return null;

        // Calculate total message bits (everything before padding)
        const messageBits = bitstreamData.modeIndicator.length +
                           bitstreamData.charCount.length +
                           bitstreamData.messageData.length +
                           bitstreamData.terminator.length +
                           bitstreamData.bytePadding.length;

        const messageBytes = Math.ceil(messageBits / 8);
        const paddingByteCount = bitstreamData.padBytes.length;

        return {
            startByteIndex: messageBytes,
            endByteIndex: messageBytes + paddingByteCount,
            paddingByteIndices: Array.from(
                {length: paddingByteCount},
                (_, i) => messageBytes + i
            )
        };
    },

    // Track padding bytes through block split and interleaving
    trackPaddingThroughInterleaving(paddingByteIndices, blocks) {
        const paddingInBlocks = [];

        let originalDataBytesOffset = 0;

        blocks.forEach((block, blockIdx) => {
            block.data.forEach((byte, localByteIdx) => {
                const originalIndex = originalDataBytesOffset + localByteIdx;

                if (paddingByteIndices.includes(originalIndex)) {
                    const paddingByteIndex = paddingByteIndices.indexOf(originalIndex);

                    paddingInBlocks.push({
                        blockIndex: blockIdx,
                        localByteIndex: localByteIdx,
                        originalDataIndex: originalIndex,
                        paddingByteIndex: paddingByteIndex,
                        value: byte
                    });
                }
            });

            originalDataBytesOffset += block.data.length;
        });

        // Simulate interleaving to find position in interleaved array
        const paddingInInterleaved = [];
        const maxDataLen = Math.max(...blocks.map(b => b.data.length));

        let interleavedIndex = 0;
        for (let i = 0; i < maxDataLen; i++) {
            blocks.forEach((block, blockIdx) => {
                if (i < block.data.length) {
                    const isPadding = paddingInBlocks.find(
                        p => p.blockIndex === blockIdx && p.localByteIndex === i
                    );
                    if (isPadding) {
                        paddingInInterleaved.push({
                            ...isPadding,
                            interleavedIndex
                        });
                    }
                    interleavedIndex++;
                }
            });
        }

        return paddingInInterleaved;
    },

    // Map an interleaved byte index to its module positions in the matrix
    mapInterleavedToModules(interleavedIndex, size, version) {
        const modulePositions = [];
        const startBitIndex = interleavedIndex * 8;

        // Simulate the zigzag placement algorithm
        let bitIndex = 0;
        let direction = -1; // -1 = up, 1 = down
        let col = size - 1;

        while (col >= 1 && modulePositions.length < 8) {
            for (let count = 0; count < size && modulePositions.length < 8; count++) {
                let row = direction === -1 ? size - 1 - count : count;

                for (let c = 0; c < 2 && modulePositions.length < 8; c++) {
                    const currentCol = col - c;

                    // Check if this is a function module (skip if it is)
                    if (!isFunctionModule(row, currentCol, size, version)) {
                        if (bitIndex >= startBitIndex && bitIndex < startBitIndex + 8) {
                            modulePositions.push({
                                row,
                                col: currentCol,
                                bitOffset: bitIndex - startBitIndex
                            });
                        }
                        bitIndex++;
                    }
                }
            }

            col -= 2;
            if (col === 6) col--; // Skip timing column
            direction *= -1;
        }

        return modulePositions;
    },

    // Build complete mapping: padding byte index → module positions
    buildPaddingModuleMap() {
        const bitstreamData = this.state.bitstreamData;
        const blocks = this.state.blocks;
        const version = this.state.version;

        if (!bitstreamData || !blocks || !version) return;

        const size = 21 + (version - 1) * 4;
        const paddingInfo = this.identifyPaddingBytes();
        if (!paddingInfo || paddingInfo.paddingByteIndices.length === 0) {
            this.state.paddingModuleMap = null;
            this.state.editableCells = new Set();
            return;
        }

        const paddingInterleaved = this.trackPaddingThroughInterleaving(
            paddingInfo.paddingByteIndices,
            blocks
        );

        const paddingModuleMap = new Map();

        paddingInterleaved.forEach((padInfo) => {
            const modules = this.mapInterleavedToModules(
                padInfo.interleavedIndex,
                size,
                version
            );
            paddingModuleMap.set(padInfo.paddingByteIndex, modules);
        });

        this.state.paddingModuleMap = paddingModuleMap;

        // Build editable cells set
        this.state.editableCells = new Set();
        paddingModuleMap.forEach((modules) => {
            modules.forEach(m => {
                this.state.editableCells.add(`${m.row},${m.col}`);
            });
        });

        // Store original padding bytes
        this.state.originalPaddingBytes = [...bitstreamData.padBytes];
    },

    // ========== LOGO BLEND TO PADDING ==========

    // Convert padding edits (displayed/masked values) to unmasked byte values
    convertPaddingEditsToBytes(edits, maskPattern) {
        const newPaddingBytes = [...this.state.originalPaddingBytes];
        const paddingModuleMap = this.state.paddingModuleMap;

        paddingModuleMap.forEach((modules, padByteIdx) => {
            // Check if this byte has any edited modules
            const hasEdits = modules.some(module => {
                const cellKey = `${module.row},${module.col}`;
                return edits.has(cellKey);
            });

            if (!hasEdits) {
                return; // Keep original value
            }

            const bits = new Array(8).fill(0);

            modules.forEach((module) => {
                const cellKey = `${module.row},${module.col}`;

                let bitValue;
                if (edits.has(cellKey)) {
                    // This is the masked (displayed) value we want
                    const maskedValue = edits.get(cellKey);
                    const shouldFlip = shouldFlipModule(module.row, module.col, maskPattern);
                    // Unmask to get the raw bit value
                    bitValue = shouldFlip ? !maskedValue : maskedValue;
                } else {
                    // Use original bit value
                    const originalByte = this.state.originalPaddingBytes[padByteIdx];
                    const bitInByte = (originalByte >> (7 - module.bitOffset)) & 1;
                    bitValue = bitInByte === 1;
                }

                bits[module.bitOffset] = bitValue ? 1 : 0;
            });

            // Convert bits to byte
            let byteValue = 0;
            for (let i = 0; i < 8; i++) {
                byteValue = (byteValue << 1) | bits[i];
            }
            newPaddingBytes[padByteIdx] = byteValue;
        });

        return newPaddingBytes;
    },

    // Sample logo at position and determine desired dark/light for padding modules
    getDesiredPaddingEdits(moduleSize, canvasSize, matrixSize, maskPattern) {
        const edits = new Map();
        const editableCells = this.state.editableCells;

        editableCells.forEach(cellKey => {
            const [row, col] = cellKey.split(',').map(Number);
            const canvasX = (col + 0.5) * moduleSize;
            const canvasY = (row + 0.5) * moduleSize;

            const sampledRgba = QRRenderer.sampleLogo(canvasX, canvasY, canvasSize);

            if (!sampledRgba || sampledRgba[3] < 128) {
                // Outside logo or transparent - keep current masked value
                return;
            }

            // Match logo luminance
            const sampledLuminance = 0.299 * sampledRgba[0] + 0.587 * sampledRgba[1] + 0.114 * sampledRgba[2];
            const wantsDark = sampledLuminance < 128; // true = dark module

            edits.set(cellKey, wantsDark);
        });

        return edits;
    },

    // Simulate applying a mask with padding modifications to count matches
    simulateMaskWithLogoBlend(maskPattern, desiredColors, moduleSize, canvasSize) {
        const version = this.state.version;
        const size = 21 + (version - 1) * 4;

        // Save original dataBytes
        const originalDataBytes = [...this.state.bitstreamData.dataBytes];

        // Step 1: Get padding edits for this mask pattern
        const testPaddingEdits = new Map();
        const editableCells = this.state.editableCells;

        // Generate matrix with this mask to see current values
        let testMatrix = this.generateQRWithMask(maskPattern);

        editableCells.forEach(cellKey => {
            const [row, col] = cellKey.split(',').map(Number);
            const canvasX = (col + 0.5) * moduleSize;
            const canvasY = (row + 0.5) * moduleSize;

            const sampledRgba = QRRenderer.sampleLogo(canvasX, canvasY, canvasSize);

            let moduleValue;
            if (!sampledRgba || sampledRgba[3] < 128) {
                // Outside logo or transparent - keep current masked value
                moduleValue = Boolean(testMatrix[row][col]);
            } else {
                // Match logo luminance
                const sampledLuminance = 0.299 * sampledRgba[0] + 0.587 * sampledRgba[1] + 0.114 * sampledRgba[2];
                moduleValue = sampledLuminance < 128; // true = dark
            }

            testPaddingEdits.set(cellKey, moduleValue);
        });

        // Step 2: Convert padding edits to unmasked bytes
        const newPaddingBytes = this.convertPaddingEditsToBytes(testPaddingEdits, maskPattern);

        // Step 3: Update dataBytes with new padding
        const paddingInfo = this.identifyPaddingBytes();
        const messageBytes = paddingInfo.startByteIndex;

        const testDataBytes = [...originalDataBytes];
        newPaddingBytes.forEach((byte, idx) => {
            testDataBytes[messageBytes + idx] = byte;
        });

        // Step 4: Recalculate ECC with new padding
        const testBlocks = splitIntoBlocks(testDataBytes, version, this.state.eccLevel, blockSizeTable);
        calculateEccForBlocks(testBlocks);

        // Step 5: Regenerate matrix with new data+ECC
        const newInterleaved = interleaveBlocks(testBlocks);
        testMatrix = createMatrix(size);
        placeFunctionPatterns(testMatrix, version);
        placeDataBits(testMatrix, newInterleaved);
        applyMask(testMatrix, maskPattern, version);
        placeFormatInfo(testMatrix, this.state.eccLevel, maskPattern, version);
        placeVersionInfo(testMatrix, version);

        // Step 6: Count how many modules match the logo
        let matches = 0;
        desiredColors.forEach((wantsDark, cellKey) => {
            const [row, col] = cellKey.split(',').map(Number);
            const moduleValue = Boolean(testMatrix[row][col]);
            if (moduleValue === wantsDark) {
                matches++;
            }
        });

        return {
            matches: matches,
            paddingBytes: newPaddingBytes,
            paddingEdits: testPaddingEdits
        };
    },

    // Get desired colors for ALL modules based on logo (not just padding)
    getDesiredLogoColors(moduleSize, canvasSize, matrixSize) {
        const desiredValues = new Map();

        for (let row = 0; row < matrixSize; row++) {
            for (let col = 0; col < matrixSize; col++) {
                const canvasX = (col + 0.5) * moduleSize;
                const canvasY = (row + 0.5) * moduleSize;

                const sampledRgba = QRRenderer.sampleLogo(canvasX, canvasY, canvasSize);

                if (!sampledRgba) continue;

                const alpha = sampledRgba[3];
                if (alpha < 128) continue;

                // Determine if the logo wants this to be dark or light
                const sampledLuminance = 0.299 * sampledRgba[0] + 0.587 * sampledRgba[1] + 0.114 * sampledRgba[2];
                const wantsDark = sampledLuminance < 128;

                desiredValues.set(`${row},${col}`, wantsDark);
            }
        }

        return desiredValues;
    },

    // Apply logo blend to padding - modifies actual padding bytes
    applyLogoBlendToPadding() {
        if (!QRRenderer.state.logoImg || !QRRenderer.state.logoImageData) {
            return { success: false, message: 'Please upload a logo first.' };
        }

        if (!this.state.paddingModuleMap || this.state.editableCells.size === 0) {
            return { success: false, message: 'No padding modules available to modify.' };
        }

        const size = this.state.matrix.length;
        const quietZone = QRRenderer.state.quietZone;
        const totalSize = size + (quietZone * 2);
        const canvasSize = 450; // Match logo canvas size
        const moduleSize = canvasSize / totalSize;
        const qrAreaSize = size * moduleSize;

        // Get desired colors for ALL modules based on logo
        const desiredColors = this.getDesiredLogoColors(moduleSize, qrAreaSize, size);

        if (desiredColors.size === 0) {
            return { success: false, message: 'No modules inside logo area to optimize.' };
        }

        // Test all 8 mask patterns
        const scores = [];
        let bestResult = null;

        for (let maskPattern = 0; maskPattern < 8; maskPattern++) {
            const result = this.simulateMaskWithLogoBlend(maskPattern, desiredColors, moduleSize, qrAreaSize);

            const score = {
                mask: maskPattern,
                matches: result.matches,
                total: desiredColors.size,
                percentage: Math.round((result.matches / desiredColors.size) * 100),
                paddingBytes: result.paddingBytes,
                paddingEdits: result.paddingEdits
            };

            scores.push(score);

            if (!bestResult || result.matches > bestResult.matches) {
                bestResult = score;
            }
        }

        const selectedMask = bestResult.mask;

        // Apply the best mask and padding modifications
        const paddingInfo = this.identifyPaddingBytes();
        const messageBytes = paddingInfo.startByteIndex;

        // Update dataBytes with new padding
        bestResult.paddingBytes.forEach((byte, idx) => {
            this.state.bitstreamData.dataBytes[messageBytes + idx] = byte;
        });
        this.state.bitstreamData.padBytes = [...bestResult.paddingBytes];

        // Recalculate ECC
        const blocks = splitIntoBlocks(this.state.bitstreamData.dataBytes, this.state.version, this.state.eccLevel, blockSizeTable);
        calculateEccForBlocks(blocks);
        this.state.blocks = blocks;

        // Regenerate matrix with new data+ECC and best mask
        const interleaved = interleaveBlocks(blocks);
        const newMatrix = createMatrix(size);
        placeFunctionPatterns(newMatrix, this.state.version);
        placeDataBits(newMatrix, interleaved);
        applyMask(newMatrix, selectedMask, this.state.version);
        placeFormatInfo(newMatrix, this.state.eccLevel, selectedMask, this.state.version);
        placeVersionInfo(newMatrix, this.state.version);

        this.state.matrix = newMatrix;
        this.state.maskPattern = selectedMask;

        // Update original padding bytes for future modifications
        this.state.originalPaddingBytes = [...bestResult.paddingBytes];

        return {
            success: true,
            bestMask: selectedMask,
            matches: bestResult.matches,
            total: desiredColors.size,
            percentage: bestResult.percentage,
            scores: scores
        };
    },

    // Optimize mask pattern for best logo match (including padding modification)
    optimizeMaskForLogo() {
        if (!QRRenderer.state.logoImg) {
            return;
        }

        const resultEl = document.getElementById('optimizeResult');
        resultEl.textContent = 'Testing mask patterns and optimizing padding...';
        resultEl.style.display = 'block';

        // Small delay to allow UI to update
        setTimeout(() => {
            const result = this.applyLogoBlendToPadding();

            if (!result.success) {
                resultEl.textContent = result.message;
                resultEl.style.color = '#6b7280';
                return;
            }

            // Show result
            resultEl.innerHTML = `<strong>Optimized!</strong> Using mask ${result.bestMask} - ${result.matches}/${result.total} modules match logo (${result.percentage}%)`;
            resultEl.style.color = '#10b981';

            // Re-render
            this.renderLogoCanvas();
        }, 50);
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
