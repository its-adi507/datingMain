const { createClient } = require('redis');

// Create Redis client
const client = createClient({
    username: 'default',
    password: '59VhpbZEQ8Tgavl8yX4ReLCZt0yI8o9T',
    socket: {
        host: 'redis-13438.c330.asia-south1-1.gce.cloud.redislabs.com',
        port: 13438
    }
});

// Error handling
client.on('error', (err) => {
    console.error('Redis Client Error:', err);
});

client.on('connect', () => {
    console.log('✅ Redis connected successfully');
});

client.on('ready', () => {
    console.log('✅ Redis client ready');
});

// Connect to Redis
(async () => {
    try {
        await client.connect();
    } catch (err) {
        console.error('Failed to connect to Redis:', err);
    }
})();

// Helper functions
const redisHelpers = {
    // Set key with optional expiry (in seconds)
    async set(key, value, expirySeconds = null) {
        try {
            if (expirySeconds) {
                await client.setEx(key, expirySeconds, JSON.stringify(value));
            } else {
                await client.set(key, JSON.stringify(value));
            }
            return true;
        } catch (err) {
            console.error('Redis SET error:', err);
            return false;
        }
    },

    // Get key
    async get(key) {
        try {
            const value = await client.get(key);
            return value ? JSON.parse(value) : null;
        } catch (err) {
            console.error('Redis GET error:', err);
            return null;
        }
    },

    // Delete key
    async del(key) {
        try {
            await client.del(key);
            return true;
        } catch (err) {
            console.error('Redis DEL error:', err);
            return false;
        }
    },

    // Check if key exists
    async exists(key) {
        try {
            const result = await client.exists(key);
            return result === 1;
        } catch (err) {
            console.error('Redis EXISTS error:', err);
            return false;
        }
    },

    // Set expiry on existing key
    async expire(key, seconds) {
        try {
            await client.expire(key, seconds);
            return true;
        } catch (err) {
            console.error('Redis EXPIRE error:', err);
            return false;
        }
    }
};

module.exports = {
    client,
    ...redisHelpers
};
