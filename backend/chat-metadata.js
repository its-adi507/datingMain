const redis = require('./redis');
const { log } = console;

/**
 * Update chat metadata when a new message is sent
 * @param {string} chatId - Canonical chat ID
 * @param {string} recipientId - ID of the message recipient
 * @param {string} senderId - ID of the message sender
 */
async function updateChatMetadata(chatId, recipientId, senderId) {
    try {
        const metaKey = `chat:meta:${chatId}`;

        // Update last message timestamp and sender
        await redis.hset(metaKey, 'lastMessage', Date.now());
        await redis.hset(metaKey, 'lastSender', senderId);

        // Increment unread count for recipient
        const unreadCount = await redis.hincrby(metaKey, `unread:${recipientId}`, 1);

        log(`📊 Metadata updated for chat ${chatId}: unread for ${recipientId} = ${unreadCount}`);

        return unreadCount;
    } catch (error) {
        log(`❌ Error updating chat metadata: ${error.message}`);
        return 0;
    }
}

/**
 * Get chat metadata for a user
 * @param {string} chatId - Canonical chat ID
 * @param {string} userId - User ID
 * @returns {object} Metadata object
 */
async function getChatMetadata(chatId, userId) {
    try {
        const metaKey = `chat:meta:${chatId}`;
        const [lastMessage, lastSender, unreadCount] = await redis.hmget(metaKey, [
            'lastMessage',
            'lastSender',
            `unread:${userId}`
        ]);

        return {
            lastMessage: lastMessage ? parseInt(lastMessage) : null,
            lastSender,
            unreadCount: unreadCount ? parseInt(unreadCount) : 0
        };
    } catch (error) {
        log(`❌ Error fetching chat metadata: ${error.message}`);
        return {
            lastMessage: null,
            lastSender: null,
            unreadCount: 0
        };
    }
}

/**
 * Mark messages as read (reset unread count)
 * @param {string} chatId - Canonical chat ID
 * @param {string} userId - User ID
 */
async function markAsRead(chatId, userId) {
    try {
        const metaKey = `chat:meta:${chatId}`;
        await redis.hset(metaKey, `unread:${userId}`, 0);
        log(`✅ Marked chat ${chatId} as read for user ${userId}`);
    } catch (error) {
        log(`❌ Error marking as read: ${error.message}`);
    }
}

/**
 * Get total unread count for a user across all chats
 * @param {string} userId - User ID
 * @param {Array} chatIds - Array of chat IDs to check
 * @returns {number} Total unread count
 */
async function getTotalUnreadCount(userId, chatIds) {
    try {
        let total = 0;

        for (const chatId of chatIds) {
            const metaKey = `chat:meta:${chatId}`;
            const unreadCount = await redis.hget(metaKey, `unread:${userId}`);
            total += unreadCount ? parseInt(unreadCount) : 0;
        }

        return total;
    } catch (error) {
        log(`❌ Error getting total unread count: ${error.message}`);
        return 0;
    }
}

module.exports = {
    updateChatMetadata,
    getChatMetadata,
    markAsRead,
    getTotalUnreadCount
};
