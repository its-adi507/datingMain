const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dwgewdv1f',
    api_key: process.env.CLOUDINARY_API_KEY || '388623257227266',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'aBDOZ5yCDRCrHs6x34g2p0xoIyM'
});

/**
 * Upload image buffer to Cloudinary
 * @param {Buffer} buffer - Image buffer
 * @param {string} userId - User ID for folder organization
 * @returns {Promise<string>} - Cloudinary URL
 */
async function uploadImage(buffer, userId) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: `dating-app/posts/${userId}`,
                resource_type: 'image',
                transformation: [
                    { width: 1080, height: 1080, crop: 'fill', gravity: 'auto' }, // Square crop
                    { quality: 'auto:good' },
                    { fetch_format: 'auto' }
                ]
            },
            (error, result) => {
                if (error) {
                    console.error('❌ Cloudinary upload error:', error);
                    reject(error);
                } else {
                    console.log('✅ Image uploaded to Cloudinary:', result.secure_url);
                    resolve(result.secure_url);
                }
            }
        );

        uploadStream.end(buffer);
    });
}

/**
 * Delete image from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 */
async function deleteImage(publicId) {
    try {
        const result = await cloudinary.uploader.destroy(publicId);
        console.log('🗑️ Image deleted from Cloudinary:', publicId);
        return result;
    } catch (error) {
        console.error('❌ Cloudinary delete error:', error);
        throw error;
    }
}

module.exports = {
    uploadImage,
    deleteImage
};
