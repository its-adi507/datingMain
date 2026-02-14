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
    },

    // Get multiple keys
    async mget(keys) {
        try {
            if (!keys || keys.length === 0) return [];
            const values = await client.mGet(keys);
            return values.map(v => v ? JSON.parse(v) : null);
        } catch (err) {
            console.error('Redis MGET error:', err);
            return keys ? new Array(keys.length).fill(null) : [];
        }
    },

    /**
     * Stream Operations
     */

    // Add entry to stream
    async xadd(stream, fields) {
        try {
            const args = [];
            for (const [key, value] of Object.entries(fields)) {
                args.push(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
            }
            const messageId = await client.xAdd(stream, '*', args);
            return messageId;
        } catch (err) {
            console.error(`Redis XADD error for stream ${stream}:`, err);
            throw err;
        }
    },

    // Read messages from stream in reverse (newest first)
    async xrevrange(stream, end = '+', start = '-', count = 50) {
        try {
            const messages = await client.xRevRange(stream, end, start, { COUNT: count });
            return messages.map(msg => {
                // Debug: Log the first message to see its structure
                if (messages.indexOf(msg) === 0) {
                    console.log('🔍 DEBUG - Raw msg.message:', JSON.stringify(msg.message));
                    console.log('🔍 DEBUG - Type:', Array.isArray(msg.message) ? 'Array' : typeof msg.message);
                    console.log('🔍 DEBUG - Keys:', Object.keys(msg.message));
                }

                const parsed = redisHelpers.parseStreamMessage(msg.message);

                if (messages.indexOf(msg) === 0) {
                    console.log('🔍 DEBUG - Parsed result:', JSON.stringify(parsed));
                }

                return {
                    id: msg.id,
                    ...parsed
                };
            });
        } catch (err) {
            console.error(`Redis XREVRANGE error for stream ${stream}:`, err);
            return [];
        }
    },

    // Read messages from stream in forward order (oldest first)
    async xrange(stream, start = '-', end = '+', count = 50) {
        try {
            const messages = await client.xRange(stream, start, end, { COUNT: count });
            return messages.map(msg => {
                const parsed = redisHelpers.parseStreamMessage(msg.message);
                return {
                    id: msg.id,
                    ...parsed
                };
            });
        } catch (err) {
            console.error(`Redis XRANGE error for stream ${stream}:`, err);
            return [];
        }
    },

    // Read new messages from stream(s)
    async xread(streams, count = 10, block = 0) {
        try {
            const streamKeys = Object.keys(streams);
            const streamIds = Object.values(streams);

            const result = await client.xRead(
                streamKeys.map((key, i) => ({ key, id: streamIds[i] })),
                { COUNT: count, BLOCK: block }
            );

            if (!result) return [];

            return result.map(stream => ({
                name: stream.name,
                messages: stream.messages.map(msg => ({
                    id: msg.id,
                    ...redisHelpers.parseStreamMessage(msg.message)
                }))
            }));
        } catch (err) {
            console.error(`Redis XREAD error:`, err);
            return [];
        }
    },

    // Parse stream message fields
    parseStreamMessage(message) {
        const parsed = {};

        // Handle array format (Redis returns [key1, value1, key2, value2, ...])
        if (Array.isArray(message)) {
            for (let i = 0; i < message.length; i += 2) {
                const key = message[i];
                const value = message[i + 1];
                try {
                    parsed[key] = JSON.parse(value);
                } catch {
                    parsed[key] = value;
                }
            }
            return parsed;
        }

        // Handle object with numeric keys (e.g., {0: "key1", 1: "value1", 2: "key2", 3: "value2"})
        const keys = Object.keys(message);
        if (keys.length > 0 && keys.every(k => !isNaN(k))) {
            // Convert numeric keys to array-like access
            const values = Object.values(message);
            for (let i = 0; i < values.length; i += 2) {
                const key = values[i];
                const value = values[i + 1];
                try {
                    parsed[key] = JSON.parse(value);
                } catch {
                    parsed[key] = value;
                }
            }
            return parsed;
        }

        // Handle normal object format
        for (const [key, value] of Object.entries(message)) {
            try {
                parsed[key] = JSON.parse(value);
            } catch {
                parsed[key] = value;
            }
        }
        return parsed;
    },

    /**
     * Bitmap Operations
     */

    // Set bit value
    async setbit(key, offset, value) {
        try {
            await client.setBit(key, offset, value);
        } catch (err) {
            console.error(`Redis SETBIT error for key ${key}:`, err);
        }
    },

    // Get bit value
    async getbit(key, offset) {
        try {
            return await client.getBit(key, offset);
        } catch (err) {
            console.error(`Redis GETBIT error for key ${key}:`, err);
            return 0;
        }
    },

    /**
     * Hash Operations
     */

    // Set hash field
    async hset(key, field, value) {
        try {
            await client.hSet(key, field, typeof value === 'object' ? JSON.stringify(value) : String(value));
        } catch (err) {
            console.error(`Redis HSET error for key ${key}:`, err);
        }
    },

    // Set multiple hash fields
    async hmset(key, fields) {
        try {
            const args = [];
            for (const [field, value] of Object.entries(fields)) {
                args.push(field, typeof value === 'object' ? JSON.stringify(value) : String(value));
            }
            await client.hSet(key, args);
        } catch (err) {
            console.error(`Redis HMSET error for key ${key}:`, err);
        }
    },

    // Get hash field
    async hget(key, field) {
        try {
            const value = await client.hGet(key, field);
            if (!value) return null;
            try {
                return JSON.parse(value);
            } catch {
                return value;
            }
        } catch (err) {
            console.error(`Redis HGET error for key ${key}:`, err);
            return null;
        }
    },

    // Get multiple hash fields
    async hmget(key, fields) {
        try {
            const values = await client.hmGet(key, fields);
            return values.map(v => {
                if (!v) return null;
                try {
                    return JSON.parse(v);
                } catch {
                    return v;
                }
            });
        } catch (err) {
            console.error(`Redis HMGET error for key ${key}:`, err);
            return fields.map(() => null);
        }
    },

    // Increment hash field
    async hincrby(key, field, increment = 1) {
        try {
            return await client.hIncrBy(key, field, increment);
        } catch (err) {
            console.error(`Redis HINCRBY error for key ${key}:`, err);
            return 0;
        }
    }
};

module.exports = {
    client,
    ...redisHelpers
};
