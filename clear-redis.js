const redis = require('./backend/redis');

async function clearOldPresenceData() {
    try {
        console.log('🧹 Clearing old bitmap presence data...');

        // Delete the massive bitmap key
        const deleted = await redis.del('presence:online');
        console.log(`✅ Deleted presence:online (${deleted} key deleted)`);

        // Also clear the old lastSeen hash if it exists
        const deletedHash = await redis.del('presence:lastSeen');
        console.log(`✅ Deleted presence:lastSeen hash (${deletedHash} key deleted)`);

        console.log('✅ Redis cleanup complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error clearing Redis:', error);
        process.exit(1);
    }
}

clearOldPresenceData();
