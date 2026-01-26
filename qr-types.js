// QR Code Type Formatters and Handlers
// Formats user input into proper QR code content for various types

let currentQrType = 'text';
let isUpdatingOutput = false; // Flag to prevent recursive updates

// ========== TYPE SELECTION ==========

function selectQrType(type) {
    currentQrType = type;

    // Update card selection
    document.querySelectorAll('.qr-type-card').forEach(card => {
        card.classList.remove('active');
        if (card.dataset.type === type) {
            card.classList.add('active');
        }
    });

    // Update form visibility
    document.querySelectorAll('.qr-type-form').forEach(form => {
        form.classList.remove('active');
    });
    const activeForm = document.getElementById(`form-${type}`);
    if (activeForm) {
        activeForm.classList.add('active');
    }

    // For text type, copy current messageInput value to textInput
    // and make messageInput readonly (it shows formatted output for other types)
    const messageInput = document.getElementById('messageInput');
    const textInput = document.getElementById('textInput');

    if (type === 'text') {
        // Text mode: sync from messageInput to textInput
        if (textInput && messageInput) {
            textInput.value = messageInput.value;
        }
    }

    // Update the message output
    updateQrOutput();
}

// ========== FORMAT FUNCTIONS ==========

function formatText() {
    const text = document.getElementById('textInput')?.value || '';
    return text;
}

function formatUrl() {
    let url = document.getElementById('urlInput')?.value || '';
    // Add https:// if no protocol specified
    if (url && !url.match(/^https?:\/\//i)) {
        url = 'https://' + url;
    }
    return url;
}

function formatContact() {
    const firstName = document.getElementById('contactFirstName')?.value || '';
    const lastName = document.getElementById('contactLastName')?.value || '';
    const phone = document.getElementById('contactPhone')?.value || '';
    const email = document.getElementById('contactEmail')?.value || '';
    const company = document.getElementById('contactCompany')?.value || '';
    const title = document.getElementById('contactTitle')?.value || '';
    const website = document.getElementById('contactWebsite')?.value || '';
    const address = document.getElementById('contactAddress')?.value || '';

    // Build vCard 3.0 format
    let vcard = 'BEGIN:VCARD\nVERSION:3.0\n';

    if (firstName || lastName) {
        vcard += `N:${lastName};${firstName};;;\n`;
        vcard += `FN:${firstName} ${lastName}`.trim() + '\n';
    }

    if (phone) {
        // Clean phone number for TEL field
        const cleanPhone = phone.replace(/[^\d+]/g, '');
        vcard += `TEL:${cleanPhone}\n`;
    }

    if (email) {
        vcard += `EMAIL:${email}\n`;
    }

    if (company) {
        vcard += `ORG:${company}\n`;
    }

    if (title) {
        vcard += `TITLE:${title}\n`;
    }

    if (website) {
        vcard += `URL:${website}\n`;
    }

    if (address) {
        vcard += `ADR:;;${address};;;;\n`;
    }

    vcard += 'END:VCARD';
    return vcard;
}

function formatPhone() {
    const phone = document.getElementById('phoneNumber')?.value || '';
    if (!phone) return '';

    // Clean and format as tel: URI
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    return `tel:${cleanPhone}`;
}

function formatSms() {
    const phone = document.getElementById('smsPhone')?.value || '';
    const message = document.getElementById('smsMessage')?.value || '';

    if (!phone) return '';

    const cleanPhone = phone.replace(/[^\d+]/g, '');
    let sms = `sms:${cleanPhone}`;

    if (message) {
        sms += `?body=${encodeURIComponent(message)}`;
    }

    return sms;
}

function formatEmail() {
    const to = document.getElementById('emailTo')?.value || '';
    const subject = document.getElementById('emailSubject')?.value || '';
    const body = document.getElementById('emailBody')?.value || '';

    if (!to) return '';

    let mailto = `mailto:${to}`;
    const params = [];

    if (subject) {
        params.push(`subject=${encodeURIComponent(subject)}`);
    }
    if (body) {
        params.push(`body=${encodeURIComponent(body)}`);
    }

    if (params.length > 0) {
        mailto += '?' + params.join('&');
    }

    return mailto;
}

function formatWifi() {
    const ssid = document.getElementById('wifiSsid')?.value || '';
    const password = document.getElementById('wifiPassword')?.value || '';
    const encryption = document.getElementById('wifiEncryption')?.value || 'WPA';
    const hidden = document.getElementById('wifiHidden')?.checked || false;

    if (!ssid) return '';

    // Escape special characters in SSID and password
    const escapeWifi = (str) => str.replace(/[\\;,:\"]/g, '\\$&');

    let wifi = `WIFI:T:${encryption};S:${escapeWifi(ssid)};`;

    if (encryption !== 'nopass' && password) {
        wifi += `P:${escapeWifi(password)};`;
    }

    if (hidden) {
        wifi += 'H:true;';
    }

    wifi += ';';
    return wifi;
}

function formatEvent() {
    const title = document.getElementById('eventTitle')?.value || '';
    const startDate = document.getElementById('eventStartDate')?.value || '';
    const startTime = document.getElementById('eventStartTime')?.value || '';
    const endDate = document.getElementById('eventEndDate')?.value || '';
    const endTime = document.getElementById('eventEndTime')?.value || '';
    const location = document.getElementById('eventLocation')?.value || '';
    const description = document.getElementById('eventDescription')?.value || '';

    if (!title || !startDate) return '';

    // Format date/time as iCal format: YYYYMMDDTHHMMSS
    const formatDateTime = (date, time) => {
        const d = date.replace(/-/g, '');
        if (time) {
            const t = time.replace(/:/g, '') + '00';
            return d + 'T' + t;
        }
        return d;
    };

    let vevent = 'BEGIN:VEVENT\n';
    vevent += `SUMMARY:${title}\n`;
    vevent += `DTSTART:${formatDateTime(startDate, startTime)}\n`;

    if (endDate) {
        vevent += `DTEND:${formatDateTime(endDate, endTime)}\n`;
    }

    if (location) {
        vevent += `LOCATION:${location}\n`;
    }

    if (description) {
        vevent += `DESCRIPTION:${description}\n`;
    }

    vevent += 'END:VEVENT';
    return vevent;
}

function formatLocation() {
    const lat = document.getElementById('locationLat')?.value || '';
    const lng = document.getElementById('locationLng')?.value || '';
    const label = document.getElementById('locationLabel')?.value || '';

    if (!lat || !lng) return '';

    let geo = `geo:${lat},${lng}`;

    if (label) {
        geo += `?q=${encodeURIComponent(label)}`;
    }

    return geo;
}

// ========== OUTPUT UPDATE ==========

function updateQrOutput() {
    if (isUpdatingOutput) return;
    isUpdatingOutput = true;

    let output = '';

    switch (currentQrType) {
        case 'text':
            output = formatText();
            break;
        case 'url':
            output = formatUrl();
            break;
        case 'contact':
            output = formatContact();
            break;
        case 'phone':
            output = formatPhone();
            break;
        case 'sms':
            output = formatSms();
            break;
        case 'email':
            output = formatEmail();
            break;
        case 'wifi':
            output = formatWifi();
            break;
        case 'event':
            output = formatEvent();
            break;
        case 'location':
            output = formatLocation();
            break;
    }

    // Update the message input (which is used by the encoder)
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.value = output;
        // Trigger the input event to update validation and analysis
        messageInput.dispatchEvent(new Event('input'));
    }

    isUpdatingOutput = false;
}

// ========== INITIALIZATION ==========

function initQrTypeHandlers() {
    // Add input listeners to all form fields
    const formInputs = document.querySelectorAll('.qr-type-form input, .qr-type-form textarea, .qr-type-form select');
    formInputs.forEach(input => {
        input.addEventListener('input', updateQrOutput);
        input.addEventListener('change', updateQrOutput);
    });

    // Set default dates for event form
    const today = new Date().toISOString().split('T')[0];
    const eventStartDate = document.getElementById('eventStartDate');
    const eventEndDate = document.getElementById('eventEndDate');
    if (eventStartDate && !eventStartDate.value) {
        eventStartDate.value = today;
    }
    if (eventEndDate && !eventEndDate.value) {
        eventEndDate.value = today;
    }

    // Bidirectional sync: when messageInput is edited directly in text mode,
    // update the textInput form field
    const messageInput = document.getElementById('messageInput');
    const textInput = document.getElementById('textInput');
    if (messageInput && textInput) {
        messageInput.addEventListener('input', function() {
            if (currentQrType === 'text' && !isUpdatingOutput) {
                isUpdatingOutput = true;
                textInput.value = messageInput.value;
                isUpdatingOutput = false;
            }
        });
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initQrTypeHandlers);
} else {
    initQrTypeHandlers();
}
