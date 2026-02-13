/**
 * Loading Indicator System
 */

let loaderOverlay = null;
let loaderText = null;

/**
 * Initialize loader
 */
function initLoader() {
    if (!loaderOverlay) {
        loaderOverlay = document.createElement('div');
        loaderOverlay.className = 'loader-overlay';
        loaderOverlay.innerHTML = `
            <div class="loader-container">
                <div class="loader-spinner"></div>
                <div class="loader-text">Loading...</div>
            </div>
        `;
        document.body.appendChild(loaderOverlay);
        loaderText = loaderOverlay.querySelector('.loader-text');
    }
}

/**
 * Show loader with optional custom message
 * @param {string} message - Custom loading message (default: "Loading...")
 */
function showLoader(message = 'Loading...') {
    initLoader();
    loaderText.textContent = message;
    loaderOverlay.classList.add('show');
}

/**
 * Hide loader
 */
function hideLoader() {
    if (loaderOverlay) {
        loaderOverlay.classList.remove('show');
    }
}

/**
 * Check if loader is currently showing
 * @returns {boolean}
 */
function isLoaderVisible() {
    return loaderOverlay && loaderOverlay.classList.contains('show');
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { showLoader, hideLoader, isLoaderVisible };
}
