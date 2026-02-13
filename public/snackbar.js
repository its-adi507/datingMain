/**
 * Custom Snackbar Notification System
 */

let snackbarContainer = null;
let currentSnackbar = null;

/**
 * Initialize snackbar container
 */
function initSnackbar() {
    if (!snackbarContainer) {
        snackbarContainer = document.createElement('div');
        snackbarContainer.id = 'snackbar-container';
        document.body.appendChild(snackbarContainer);
    }
}

/**
 * Show snackbar notification
 * @param {string} message - Message to display
 * @param {string} type - Type of notification (success, error, warning, info)
 * @param {number} duration - Duration in milliseconds (default: 3000)
 */
function showSnackbar(message, type = 'info', duration = 3000) {
    initSnackbar();

    // Remove current snackbar if exists
    if (currentSnackbar) {
        currentSnackbar.remove();
    }

    // Create snackbar element
    const snackbar = document.createElement('div');
    snackbar.className = `snackbar ${type}`;

    // Icon based on type
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    snackbar.innerHTML = `
        <span class="snackbar-icon">${icons[type] || icons.info}</span>
        <span class="snackbar-message">${message}</span>
        <button class="snackbar-close" onclick="this.parentElement.remove()">×</button>
    `;

    snackbarContainer.appendChild(snackbar);
    currentSnackbar = snackbar;

    // Trigger animation
    setTimeout(() => {
        snackbar.classList.add('show');
    }, 10);

    // Auto-hide after duration
    if (duration > 0) {
        setTimeout(() => {
            snackbar.classList.remove('show');
            setTimeout(() => {
                snackbar.remove();
                if (currentSnackbar === snackbar) {
                    currentSnackbar = null;
                }
            }, 400);
        }, duration);
    }
}

/**
 * Helper functions for different types
 */
function showSuccess(message, duration = 3000) {
    showSnackbar(message, 'success', duration);
}

function showError(message, duration = 4000) {
    showSnackbar(message, 'error', duration);
}

function showWarning(message, duration = 3500) {
    showSnackbar(message, 'warning', duration);
}

function showInfo(message, duration = 3000) {
    showSnackbar(message, 'info', duration);
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { showSnackbar, showSuccess, showError, showWarning, showInfo };
}
