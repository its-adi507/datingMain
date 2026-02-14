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
        // Heart loader structure
        loaderOverlay.innerHTML = `
            <div class="heart-loader-container">
                <div class="heart-stream"></div>
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
function showLoader(message = 'processing...') {
    initLoader();
    loaderText.textContent = message;
    loaderOverlay.classList.add('show');

    // Generate stream of hearts
    const streamContainer = loaderOverlay.querySelector('.heart-stream');
    streamContainer.innerHTML = ''; // Clear previous
    const heartTypes = ['❤️', '💖', '💗', '💓', '💞', '❣️'];

    // Create 30 random hearts
    for (let i = 0; i < 30; i++) {
        const heart = document.createElement('div');
        heart.className = 'loader-heart';
        heart.innerHTML = heartTypes[Math.floor(Math.random() * heartTypes.length)];
        heart.style.left = Math.random() * 100 + '%';
        // Randomize delays for continuous stream feel
        heart.style.animationDelay = Math.random() * 2 + 's';
        heart.style.animationDuration = (Math.random() * 1.5 + 1.5) + 's';
        heart.style.fontSize = (Math.random() * 20 + 20) + 'px';
        streamContainer.appendChild(heart);
    }
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
