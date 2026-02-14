const express = require('express');
const router = express.Router();
const { db } = require('./firebase');
const { log } = console;
const redis = require('./redis');

/**
 * POST /api/profile
 * Update user profile (name, bio, tags)
 */
router.post('/', async (req, res) => {
    try {
        const { name, bio, tags } = req.body;
        const userId = req.user.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Update user document in Firestore
        const userRef = db.collection('users').doc(userId);

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (bio !== undefined) updateData.bio = bio;
        if (tags !== undefined) updateData.tags = tags;

        userRef.update(updateData);

        // Invalidate Redis cache
        redis.del(`User/${userId}/profileData`);

        console.log(`📝 Profile updated for user: ${userId}`);
        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

const multer = require('multer');
const fs = require('fs');
// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}
const upload = multer({ dest: 'uploads/' }); // Temp storage
const storage = require('./storage');


/**
 * POST /api/profile/upload-photo
 * Upload and update profile picture
 */
router.post('/upload-photo', upload.single('photo'), async (req, res) => {
    try {
        const userId = req.user.userId;
        const file = req.file;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        // Upload to Cloudinary (or other storage)
        // We use the userId as public_id to overwrite existing image or keep it consistent
        // Timestamp to force refresh if CDN caches it
        const result = await storage.upload(file.path, {
            public_id: `user_${userId}`,
            folder: 'user_profiles',
            overwrite: true
        });

        // Clean up temp file
        fs.unlinkSync(file.path);

        const secureUrl = result.secure_url;

        // Update user document in Firestore
        const userRef = db.collection('users').doc(userId);
        userRef.update({
            profilePicture: secureUrl
        });

        // Invalidate Redis cache
        redis.del(`User/${userId}/profileData`);

        console.log(`📸 Profile picture updated for user: ${userId}`);
        res.json({ success: true, url: secureUrl });

    } catch (error) {
        console.error('Upload photo error:', error);
        // Try to clean up temp file if it exists
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Failed to upload photo' });
    }
});

module.exports = router;
