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

        await userRef.update(updateData);

        // Invalidate Redis cache
        await redis.del(`User/${userId}/profileData`);

        console.log(`📝 Profile updated for user: ${userId}`);
        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

module.exports = router;
