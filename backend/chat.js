const express = require('express');
const router = express.Router();
const { db } = require('./firebase');
const { canonicalizationID } = require('./functions');
const redis = require('./redis');
const { markAsRead } = require('./chat-metadata');

const { log } = console;

/**
 * GET /:friendId
 * Fetch chat history with a friend (Stream-first)
 */
router.get('/:friendId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const friendId = req.params.friendId;
        const limit = parseInt(req.query.limit) || 50;
        const cursor = req.query.cursor || '+'; // '+' = newest, '-' = oldest
        const direction = req.query.direction || 'older'; // 'older' or 'newer'

        // Generate canonical chat ID
        const chatId = canonicalizationID(userId, friendId);
        const streamKey = `chat:stream:${chatId}`;

        let streamMessages = [];
        let hasMore = false;

        // 1. Try to read from Redis Stream (FAST)
        if (direction === 'newer') {
            // Load newer messages (forward from cursor)
            // Exclude the cursor itself by using (cursor instead of cursor
            const exclusiveCursor = cursor === '-' ? '-' : `(${cursor}`;
            streamMessages = await redis.xrange(streamKey, exclusiveCursor, '+', limit + 1);
        } else {
            // Load older messages (reverse from cursor)
            // Exclude the cursor itself by using (cursor instead of cursor
            const exclusiveCursor = cursor === '+' ? '+' : `(${cursor}`;
            streamMessages = await redis.xrevrange(streamKey, exclusiveCursor, '-', limit + 1);
        }

        // Check if there are more messages
        if (streamMessages.length > limit) {
            hasMore = true;
            streamMessages = streamMessages.slice(0, limit);
        }

        if (streamMessages.length > 0) {
            log(`⚡ Stream Hit: Fetched ${streamMessages.length} ${direction} messages for chat ${chatId}`);
            return res.json({
                success: true,
                messages: streamMessages,
                nextCursor: streamMessages.length > 0 ? streamMessages[streamMessages.length - 1].id : null,
                hasMore,
                source: 'stream',
                chatId
            });
        }

        // 2. Fallback to Firestore
        log(`☁️ Stream Miss: Fetching from Firestore for chat ${chatId}`);
        const messagesSnapshot = await db
            .collection('chats')
            .doc(chatId)
            .collection('messages')
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get();

        const messages = [];
        messagesSnapshot.forEach(doc => {
            messages.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // 3. Cache to stream for next time
        if (messages.length > 0) {
            log(`💾 Caching ${messages.length} messages to stream ${streamKey}`);
            for (const msg of messages.reverse()) { // Reverse to maintain order
                try {
                    await redis.xadd(streamKey, {
                        sentBy: msg.sentBy,
                        message: msg.message,
                        timestamp: msg.timestamp,
                        seen: msg.seen || false
                    });
                } catch (err) {
                    log(`⚠️ Failed to cache message to stream: ${err.message}`);
                }
            }
        }

        log(`📨 Fetched ${messages.length} messages for chat ${chatId} from Firestore`);
        res.json({
            success: true,
            messages,
            nextCursor: messages.length > 0 ? messages[messages.length - 1].id : null,
            hasMore: false, // Firestore initial load doesn't support pagination yet
            source: 'firestore',
            chatId
        });
    } catch (error) {
        log(`❌ Fetch chat error: ${error.stack}`);
        res.status(500).json({ success: false, error: 'Failed to fetch chat' });
    }
});

/**
 * POST /:friendId/mark-read
 * Mark all messages from friend as read
 */
router.post('/:friendId/mark-read', async (req, res) => {
    try {
        const userId = req.user.userId;
        const friendId = req.params.friendId;

        // Generate canonical chat ID
        const chatId = canonicalizationID(userId, friendId);

        // Mark as read in metadata
        await markAsRead(chatId, userId);

        log(`✅ Marked messages as read in chat ${chatId} for user ${userId}`);
        res.json({ success: true });
    } catch (error) {
        log(`❌ Mark read error: ${error.stack}`);
        res.status(500).json({ success: false, error: 'Failed to mark messages as read' });
    }
});

/**
 * GET /unread-count
 * Get total unread message count across all chats
 */
router.get('/unread-count', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { getTotalUnreadCount } = require('./chat-metadata');

        // Get all user's matches
        const userDoc = await db.collection('users').doc(userId).get();
        const matches = userDoc.data()?.matches || [];

        // Generate chat IDs
        const chatIds = matches.map(friendId => canonicalizationID(userId, friendId));

        // Get total unread from metadata (FAST)
        const totalUnread = await getTotalUnreadCount(userId, chatIds);

        log(`📊 User ${userId} has ${totalUnread} unread messages`);
        res.json({ success: true, unreadCount: totalUnread });
    } catch (error) {
        log(`❌ Unread count error: ${error.stack}`);
        res.status(500).json({ success: false, error: 'Failed to get unread count' });
    }
});

module.exports = router;
