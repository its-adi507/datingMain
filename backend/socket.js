const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const { updatePresence } = require('./presence');

// Create Redis clients for Socket.IO adapter (pub/sub)
const pubClient = createClient({
    username: 'default',
    password: '59VhpbZEQ8Tgavl8yX4ReLCZt0yI8o9T',
    socket: {
        host: 'redis-13438.c330.asia-south1-1.gce.cloud.redislabs.com',
        port: 13438
    }
});

const subClient = pubClient.duplicate();

// Error handling
pubClient.on('error', (err) => console.error('Redis Pub Client Error:', err));
subClient.on('error', (err) => console.error('Redis Sub Client Error:', err));

// Connect both clients
Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    console.log('✅ Socket.IO Redis adapter clients connected');
});


let ioInstance;

/**
 * Initialize Socket.IO with Redis adapter
 * @param {http.Server} httpServer - HTTP server instance
 * @returns {Server} Socket.IO server instance
 */
function initializeSocket(httpServer) {
    const io = new Server(httpServer, {
        cors: {
            origin: process.env.CORS_ORIGIN || '*',
            methods: ['GET', 'POST']
        }
    });

    ioInstance = io;

    // Attach Redis adapter for horizontal scaling
    io.adapter(createAdapter(pubClient, subClient));

    // Middleware for authentication
    io.use(async (socket, next) => {
        let token = socket.handshake.auth.token;

        // If no token in auth object, try to parse from cookies
        if (!token && socket.request.headers.cookie) {
            const cookies = {};
            socket.request.headers.cookie.split(';').forEach((cookie) => {
                const parts = cookie.split('=');
                cookies[parts.shift().trim()] = decodeURI(parts.join('='));
            });
            token = cookies['accessToken'];
        }

        if (!token) {
            return next(new Error('Authentication required'));
        }

        // Verify JWT token directly (stateless)
        const { verifyToken } = require('./jwt');
        const decoded = verifyToken(token);

        if (!decoded) {
            return next(new Error('Invalid or expired token'));
        }

        // Attach user info to socket
        socket.userId = decoded.userId;
        socket.mobile = decoded.mobile;

        next();
    });


    // Connection handler
    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.userId}`);

        // Single Session Enforcement: Disconnect other sockets for this user
        const userRoom = `user:${socket.userId}`;
        io.in(userRoom).fetchSockets().then(sockets => {
            sockets.forEach(s => {
                if (s.id !== socket.id) {
                    s.emit('force_disconnect', 'New login detected');
                    s.disconnect(true);
                    console.log(`Force disconnected duplicate socket for user ${socket.userId}`);
                }
            });
        });

        // Join user's personal room
        socket.join(userRoom);

        // Update user presence
        updatePresence(socket.userId, true);
        notifyFriendsOfPresence(socket.userId, 'online');

        // Track active chat rooms per socket
        socket.activeChatRooms = new Set();

        /**
         * Join a chat room with a friend
         */
        socket.on('join_chat', async (data) => {
            try {
                const { friendId } = data;
                const { canonicalizationID } = require('./functions');

                // Generate canonical chat room ID
                const chatRoomId = canonicalizationID(socket.userId, friendId);

                // Join the chat room
                socket.join(chatRoomId);
                socket.activeChatRooms.add(chatRoomId);

                console.log(`User ${socket.userId} joined chat room: ${chatRoomId}`);

                // Acknowledge join
                socket.emit('chat_joined', { chatRoomId, friendId });
            } catch (error) {
                console.error('Join chat error:', error);
                socket.emit('chat_error', { error: 'Failed to join chat' });
            }
        });

        /**
         * Leave a chat room
         */
        socket.on('leave_chat', (data) => {
            try {
                const { friendId } = data;
                const { canonicalizationID } = require('./functions');

                const chatRoomId = canonicalizationID(socket.userId, friendId);

                socket.leave(chatRoomId);
                socket.activeChatRooms.delete(chatRoomId);

                console.log(`User ${socket.userId} left chat room: ${chatRoomId}`);
            } catch (error) {
                console.error('Leave chat error:', error);
            }
        });

        /**
         * Send a message in a chat
         */
        socket.on('send_message', async (data) => {
            try {
                const { friendId, message } = data;
                const { canonicalizationID } = require('./functions');
                const { db } = require('./firebase');
                const redis = require('./redis');
                const { updateChatMetadata } = require('./chat-metadata');

                // Generate canonical chat room ID
                const chatRoomId = canonicalizationID(socket.userId, friendId);
                const streamKey = `chat:stream:${chatRoomId}`;

                const timestamp = Date.now();

                // 1. Add to Redis Stream (INSTANT)
                const messageId = await redis.xadd(streamKey, {
                    sentBy: socket.userId,
                    message: message,
                    seen: false,
                    timestamp: timestamp
                });

                // 2. Update metadata (for unread counts)
                await updateChatMetadata(chatRoomId, friendId, socket.userId);

                // Prepare message payload
                const messageData = {
                    id: messageId,
                    chatRoomId: chatRoomId,
                    sentBy: socket.userId,
                    message: message,
                    seen: false,
                    timestamp: timestamp,
                    tempId: data.tempId // Pass through for optimistic UI matching
                };

                // 3. Emit to all users in the chat room (from stream)
                io.to(chatRoomId).emit('new_message', messageData);

                // 4. Persistence & Notifications (ASYNC)
                setImmediate(async () => {
                    try {
                        // Persist to Firestore
                        await db.collection('chats').doc(chatRoomId).collection('messages').doc(messageId).set({
                            sentBy: socket.userId,
                            message: message,
                            seen: false,
                            timestamp: timestamp
                        });

                        // 5. Unread Notification (Red Dot)
                        // Emit to recipient's personal room
                        io.to(`user:${friendId}`).emit('message_notification', {
                            senderId: socket.userId,
                            message: message.substring(0, 30) + (message.length > 30 ? '...' : ''),
                            timestamp: timestamp
                        });

                    } catch (err) {
                        console.error(`❌ Async processing error: ${err.message}`);
                    }
                });

                console.log(`Message sent in room ${chatRoomId} by ${socket.userId}`);
            } catch (error) {
                console.error('Send message error:', error);
                socket.emit('message_error', { error: 'Failed to send message' });
            }
        });

        /**
         * Mark messages as seen
         */
        socket.on('messages_seen', async (data) => {
            try {
                const { friendId } = data;
                const { canonicalizationID } = require('./functions');
                const { markAsRead } = require('./chat-metadata');

                const chatRoomId = canonicalizationID(socket.userId, friendId);

                // 1. Reset unread count in Redis
                await markAsRead(chatRoomId, socket.userId);

                // 2. Notify the sender that I have seen their messages
                io.to(`user:${friendId}`).emit('messages_seen', {
                    seenBy: socket.userId,
                    chatRoomId: chatRoomId
                });

            } catch (error) {
                console.error('Messages seen error:', error);
            }
        });

        socket.on('typing', (data) => {
            const { chatId, recipientId } = data;
            io.to(`user:${recipientId}`).emit('user-typing', {
                userId: socket.userId,
                chatId
            });
        });

        socket.on('stop_typing', (data) => {
            const { friendId } = data;
            const { canonicalizationID } = require('./functions');
            const chatRoomId = canonicalizationID(socket.userId, friendId);
            socket.to(chatRoomId).emit('user_stopped_typing', { userId: socket.userId });
        });

        // Heartbeat to keep presence alive
        socket.on('heartbeat', () => {
            updatePresence(socket.userId, true);
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.userId}`);
            updatePresence(socket.userId, false);
            notifyFriendsOfPresence(socket.userId, 'offline');
        });
    });

    return io;
}

/**
 * Notify friends when a user's presence changes
 */
async function notifyFriendsOfPresence(userId, status) {
    try {
        // Late require to avoid circular dependency if dashboard uses socket
        const { getFriendsList } = require('./dashboard');

        // We need a request-like object for getFriendsList, but it might expect (req, res).
        // Let's check dashboard.js implementation.
        // Actually getFriendsList is likely an API handler. We need loop logic here or a helper.
        // Let's implement a direct Redis fetch here to be safe and fast.

        const redis = require('./redis');
        const friendsKey = `FriendList/${userId}`;
        const friendsData = await redis.get(friendsKey);

        let friendIds = [];
        if (friendsData) {
            const friends = JSON.parse(friendsData);
            friendIds = friends.map(f => f.id);
        } else {
            // Fallback to Firestore if not cached (expensive, but necessary)
            const { db } = require('./firebase');
            const doc = await db.collection('users').doc(userId).get();
            if (doc.exists) {
                const userData = doc.data();
                if (userData.matches) {
                    friendIds = userData.matches;
                }
            }
        }

        if (friendIds.length > 0) {
            const lastSeen = status === 'offline' ? Date.now().toString() : null;

            friendIds.forEach(friendId => {
                ioInstance.to(`user:${friendId}`).emit('presence_update', {
                    userId: userId,
                    status: status,
                    lastSeen: lastSeen
                });
            });
            // console.log(`🔔 Notified ${friendIds.length} friends of ${userId} status: ${status}`);
        }
    } catch (error) {
        console.error('Notify friends error:', error);
    }
}

module.exports = {
    initializeSocket,
    pubClient,
    subClient
};
