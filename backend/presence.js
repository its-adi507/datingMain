const { realtimeDb } = require('./firebase');
const redis = require('./redis');
/**
 * Update user presence in Realtime Database
 * @param {string} userId - The user's ID
 * @param {boolean} isOnline - Whether the user is online or offline
 */
async function updatePresence(userId, isOnline) {
    if (!userId) {
        console.error('❌ Cannot update presence: No userId provided');
        return;
    }

    try {
        const updateData = {
            status: isOnline ? 'Online' : 'Offline',
            lastSeen: Date.now()
        };
        redis.set(`presence/${userId}`, updateData, 60 * 60 * 24 * 7);
        realtimeDb.ref(`userStatus/${userId}`).set(updateData);
        // console.log(`✅ Presence updated for ${userId}: ${updateData.status}`);
    } catch (error) {
        console.error(`❌ Failed to update presence for ${userId}:`, error);
    }
}

module.exports = { updatePresence };
