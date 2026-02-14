const { realtimeDb } = require('./firebase');
const redis = require('./redis');

/**
 * Update user presence using simple Redis strings
 * @param {string} userId - The user's ID
 * @param {boolean} isOnline - Whether the user is online or offline
 */
async function updatePresence(userId, isOnline) {
    if (!userId) {
        console.error('❌ Cannot update presence: No userId provided');
        return;
    }

    try {
        if (isOnline) {
            // Set user as online with timestamp
            await redis.set(`presence:${userId}`, 'online');
        } else {
            // Set user as offline and store lastSeen
            const lastSeen = Date.now().toString();
            await redis.set(`presence:${userId}`, 'offline');
            await redis.set(`presence:lastSeen:${userId}`, lastSeen);
        }

        // console.log(`✅ Presence updated for ${userId}: ${isOnline ? 'Online' : 'Offline'}`);
    } catch (error) {
        console.error(`❌ Failed to update presence for ${userId}:`, error);
    }
}

/**
 * Check if a user is online
 * @param {string} userId - User ID
 * @returns {boolean} True if online
 */
async function isUserOnline(userId) {
    try {
        const status = await redis.get(`presence:${userId}`);
        return status === 'online';
    } catch (error) {
        console.error(`❌ Failed to check presence for ${userId}:`, error);
        return false;
    }
}

/**
 * Get user's last seen timestamp
 * @param {string} userId - User ID
 * @returns {number|null} Timestamp or null
 */
async function getLastSeen(userId) {
    try {
        const lastSeen = await redis.get(`presence:lastSeen:${userId}`);
        return lastSeen ? parseInt(lastSeen) : null;
    } catch (error) {
        console.error(`❌ Failed to get lastSeen for ${userId}:`, error);
        return null;
    }
}

/**
 * Batch check presence for multiple users
 * @param {Array<string>} userIds - Array of user IDs
 * @returns {Object} Map of userId -> isOnline
 */
async function batchCheckPresence(userIds) {
    try {
        const results = {};

        for (const userId of userIds) {
            const status = await redis.get(`presence:${userId}`);
            results[userId] = status === 'online';
        }

        return results;
    } catch (error) {
        console.error(`❌ Failed to batch check presence:`, error);
        return {};
    }
}

module.exports = {
    updatePresence,
    isUserOnline,
    getLastSeen,
    batchCheckPresence
};
