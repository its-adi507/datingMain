const cloudinary = require('cloudinary').v2;

// Configuration
cloudinary.config({
    cloud_name: 'dwgewdv1f',
    api_key: '388623257227266',
    api_secret: 'aBDOZ5yCDRCrHs6x34g2p0xoIyM'
});

/**
 * Modular Storage Interface
 * Change the implementation inside these functions to switch providers
 */
const storage = {
    /**
     * Upload a file to storage
     * @param {string} filePath - Local path or URL to upload
     * @param {object} options - Provider specific options (e.g. { public_id: 'userid' })
     * @returns {Promise<object>} - Result object
     */
    async upload(filePath, options = {}) {
        try {
            // Map generic options to Cloudinary specific if needed
            const cloudOptions = {
                ...options
            };

            const result = await cloudinary.uploader.upload(filePath, cloudOptions);
            return result;
        } catch (error) {
            console.error('❌ Storage Upload Error:', error);
            throw error;
        }
    },

    /**
     * Delete a file from storage
     * @param {string} publicId - The unique identifier of the file
     * @returns {Promise<object>} - Result object
     */
    async delete(publicId) {
        try {
            const result = await cloudinary.uploader.destroy(publicId);
            return result;
        } catch (error) {
            console.error('❌ Storage Delete Error:', error);
            throw error;
        }
    },

    /**
     * Get an optimized URL for the file
     * @param {string} publicId - The unique identifier of the file
     * @param {object} options - { width, height, crop, etc. }
     * @returns {string} - The URL
     */
    getUrl(publicId, options = {}) {
        try {
            // Default optimizations
            const defaultOptions = {
                fetch_format: 'auto',
                quality: 'auto',
                ...options
            };

            return cloudinary.url(publicId, defaultOptions);
        } catch (error) {
            console.error('❌ Storage URL generation error:', error);
            return '';
        }
    }
};

module.exports = storage;
