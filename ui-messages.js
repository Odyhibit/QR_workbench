// ui-messages.js
// On-page replacement for the browser's alert()/confirm() popups.
// Messages stack in a fixed banner at the top of the page instead of
// blocking a native dialog.

(function () {
    const AUTO_DISMISS_MS = { success: 4000, info: 5000, warning: 0, error: 0 };

    // Messages already shown this "workflow" (since page load, or since the last
    // resetMessageHistory() call - e.g. loading a new image) don't show again. This
    // keeps something like corner-dragging, which redraws and re-detects on every
    // tiny move, from repeating the same banner dozens of times in a row.
    const shownMessages = new Set();

    function getContainer() {
        let container = document.getElementById('uiMessageContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'uiMessageContainer';
            document.body.appendChild(container);
        }
        return container;
    }

    // Show a dismissible on-screen message. type: 'error' | 'warning' | 'success' | 'info'.
    // Only shows once per workflow - see shownMessages above. By default that's keyed
    // on the exact (type, text) pair, but pass `key` explicitly to mark several calls
    // as "the same notification slot" even when their wording (or type) varies run to
    // run - e.g. a status guess whose numbers change as the user fine-tunes something,
    // or a family of related info/warning variants for one situation. When `key` is
    // given it's the *entire* dedupe identity (type and text are ignored for dedupe
    // purposes), so whichever variant fires first claims the slot.
    function showMessage(text, type, key) {
        type = type || 'error';

        const dedupeKey = key || (type + ':' + text);
        if (shownMessages.has(dedupeKey)) return null;
        shownMessages.add(dedupeKey);

        const container = getContainer();

        const card = document.createElement('div');
        card.className = `ui-message ui-message-${type}`;

        const textSpan = document.createElement('span');
        textSpan.className = 'ui-message-text';
        textSpan.textContent = text;
        card.appendChild(textSpan);

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'ui-message-close';
        closeButton.setAttribute('aria-label', 'Dismiss message');
        closeButton.textContent = '×';
        closeButton.addEventListener('click', () => card.remove());
        card.appendChild(closeButton);

        container.appendChild(card);

        const dismissAfter = AUTO_DISMISS_MS[type];
        if (dismissAfter) {
            setTimeout(() => card.remove(), dismissAfter);
        }

        return card;
    }

    // Show an inline confirmation card in place of window.confirm().
    // Calls onConfirm() if the user confirms, otherwise onCancel() (optional).
    function showConfirm(text, onConfirm, onCancel) {
        const container = getContainer();

        const card = document.createElement('div');
        card.className = 'ui-message ui-message-confirm';

        const textSpan = document.createElement('span');
        textSpan.className = 'ui-message-text';
        textSpan.textContent = text;
        card.appendChild(textSpan);

        const actions = document.createElement('span');
        actions.className = 'ui-message-actions';

        const confirmButton = document.createElement('button');
        confirmButton.type = 'button';
        confirmButton.className = 'ui-message-confirm-btn';
        confirmButton.textContent = 'Confirm';
        confirmButton.addEventListener('click', () => {
            card.remove();
            if (onConfirm) onConfirm();
        });

        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.className = 'ui-message-cancel-btn';
        cancelButton.textContent = 'Cancel';
        cancelButton.addEventListener('click', () => {
            card.remove();
            if (onCancel) onCancel();
        });

        actions.appendChild(confirmButton);
        actions.appendChild(cancelButton);
        card.appendChild(actions);

        container.appendChild(card);
        return card;
    }

    // Forget which messages have already been shown, so the next occurrence of any
    // of them shows again. Call this when starting a new "workflow" - e.g. loading a
    // new image - so stale detection results from a previous image don't suppress a
    // genuinely new message. (A page refresh clears it naturally, since this Set is
    // just an in-memory variable.)
    function resetMessageHistory() {
        shownMessages.clear();
    }

    // Expose globally - loaded as a plain script (no module system) alongside the other tool scripts.
    window.showMessage = showMessage;
    window.showConfirm = showConfirm;
    window.resetMessageHistory = resetMessageHistory;
})();
