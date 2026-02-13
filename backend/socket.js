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

        socket.on('send-message', async (data) => {
            const { chatId, message, recipientId } = data;

            // Save message to Firestore
            const { db } = require('./firebase');
            const messageRef = await db.collection('messages').add({
                chatId,
                senderId: socket.userId,
                recipientId,
                message,
                timestamp: Date.now(),
                read: false
            });

            // Payload
            const msgData = {
                id: messageRef.id,
                chatId,
                senderId: socket.userId,
                message,
                timestamp: Date.now()
            };

            // Emit to recipient's private room
            io.to(`user:${recipientId}`).emit('new-message', msgData);

            // Emit confirmation to sender (in case of multiple tabs, though we enforce single session now, good for consistency)
            socket.emit('new-message', msgData);

            // Notification (can be same as new-message or distinct)
            io.to(`user:${recipientId}`).emit('notification', {
                type: 'new-message',
                from: socket.userId,
                chatId
            });
        });

        socket.on('typing', (data) => {
            const { chatId, recipientId } = data;
            io.to(`user:${recipientId}`).emit('user-typing', {
                userId: socket.userId,
                chatId
            });
        });

        socket.on('stop-typing', (data) => {
            const { chatId, recipientId } = data;
            io.to(`user:${recipientId}`).emit('user-stop-typing', {
                userId: socket.userId,
                chatId
            });
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.userId}`);
            updatePresence(socket.userId, false);
        });
    });

    return io;
}

module.exports = {
    initializeSocket,
    pubClient,
    subClient
};
