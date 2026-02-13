const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const { db, realtimeDb } = require('./firebase');
const admin = require('firebase-admin');
const redis = require('./redis');

const { log } = console;

/**
 * Helper to fetch friends list (used by both API and SSR)
 */
async function getFriendsList(userId) {
    const cacheKey = `FriendList/${userId}`;

    // Check Redis cache
    // const cachedFriends = await redis.get(cacheKey);
    // if (cachedFriends) {
    //     log(`⚡ Match Cache Hit: Loaded friend list for ${userId}`);
    //     return cachedFriends;
    // }

    // Fetch user's matches
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data() || {};
    const matchIds = userData.matches || [];

    if (matchIds.length === 0) {
        return [];
    }

    // Fetch profiles for matched users in parallel batches
    const batchPromises = [];
    for (let i = 0; i < matchIds.length; i += 10) {
        const batchIds = matchIds.slice(i, i + 10);
        batchPromises.push(
            db.collection('users')
                .where(admin.firestore.FieldPath.documentId(), 'in', batchIds)
                .get()
        );
    }

    const snapshots = await Promise.all(batchPromises);

    // Process snapshots and fetch presence
    const statusPromises = [];

    snapshots.forEach(snap => {
        snap.forEach(doc => {
            const data = doc.data();
            const friendId = doc.id;

            // Fetch presence from Realtime Database
            const statusPromise = realtimeDb.ref(`userStatus/${friendId}`).once('value')
                .then(statusSnap => {
                    const status = statusSnap.val();
                    return {
                        id: friendId,
                        name: data.name,
                        image: data.profilePicture || `https://i.pravatar.cc/400?u=${friendId}`,
                        online: status?.status === 'Online',
                        lastSeen: status?.lastSeen
                    };
                })
                .catch(err => {
                    log(`Error fetching status for ${friendId}: ${err.message}`);
                    return {
                        id: friendId,
                        name: data.name,
                        image: data.profilePicture || `https://i.pravatar.cc/400?u=${friendId}`,
                        online: false
                    };
                });

            statusPromises.push(statusPromise);
        });
    });

    const friends = await Promise.all(statusPromises);

    // Store in Redis with 5 min TTL
    // await redis.set(cacheKey, friends, 300);
    log(`🌸 Fetched ${friends.length} friends for ${userId}`);
    return friends;
}

/**
 * GET /api/friends
 * Fetch all matched profiles for the user
 */
router.get('/api/friends', async (req, res) => {
    try {
        const userId = req.user.userId;
        const friends = await getFriendsList(userId);
        res.json({ success: true, friends });
    } catch (error) {
        log(`❌ Fetch matches error: ${error.stack}`);
        res.status(500).json({ success: false, error: 'Failed to fetch profiles' });
    }
});

/**
 * GET /matches
 * Fetch paginated matching profiles
 */
router.get('/matches', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const currentUserId = req.user.userId;
        const cacheKey = `SwipeFeed/${currentUserId}`;

        // 1. Try to get from Redis Cache first
        let cachedProfiles = await redis.get(cacheKey);

        if (cachedProfiles) {
            log(`🎯 Serving swipe feed from Redis for user ${currentUserId}`);
            let profiles = JSON.parse(cachedProfiles);

            // Take the first 'limit' profiles
            const toSend = profiles.slice(0, limit);
            const remaining = profiles.slice(limit);

            // Update cache with remaining profiles
            if (remaining.length > 0) {
                await redis.set(cacheKey, JSON.stringify(remaining), 1800); // 30 min TTL
            } else {
                await redis.del(cacheKey);
            }

            return res.json({ success: true, profiles: toSend });
        }

        // 2. Cache Miss: Fetch from Firestore with filtering
        log(`🎴 Cache miss: Fetching fresh swipe feed for user ${currentUserId}`);

        // Fetch current user's interaction lists to filter results
        const currentUserDoc = await db.collection('users').doc(currentUserId).get();
        const currentUserData = currentUserDoc.data() || {};

        // Combine all IDs to exclude
        const excludeIds = new Set([
            currentUserId,
            ...(currentUserData.liked || []),
            ...(currentUserData.rejected || []),
            ...(currentUserData.matches || []),
            ...(currentUserData.blocked || [])
        ]);

        // Fetch a larger batch to populate the cache (e.g., 50 profiles)
        const fetchSize = Math.max(limit * 5, 50);
        let query = db.collection('users').limit(fetchSize);

        const snapshot = await query.get();
        const allFiltered = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            if (!excludeIds.has(doc.id)) {
                allFiltered.push({
                    id: doc.id,
                    name: data.name,
                    age: data.age,
                    bio: data.bio,
                    image: data.image || `https://i.pravatar.cc/400?u=${doc.id}`,
                    tags: data.tags || []
                });
            }
        });

        // 3. Return the requested limit and cache the rest
        const toSend = allFiltered.slice(0, limit);
        const remaining = allFiltered.slice(limit);

        if (remaining.length > 0) {
            await redis.set(cacheKey, JSON.stringify(remaining), 1800); // 30 min TTL
        }

        log(`✅ Fetched ${allFiltered.length} profiles, returning ${toSend.length}, cached ${remaining.length}`);
        res.json({ success: true, profiles: toSend });
    } catch (error) {
        log(`❌ Fetch matches error: ${error.stack}`);
        res.status(500).json({ success: false, error: 'Failed to fetch profiles' });
    }
});

/**
 * POST /swipe
 * Handle like, reject, superlike actions
 */
router.post('/swipe', async (req, res) => {
    try {
        const { targetId, action } = req.body;
        const currentUserId = req.user.userId;

        if (!targetId || !['like', 'reject', 'superlike'].includes(action)) {
            return res.status(400).json({ success: false, error: 'Invalid swipe action' });
        }

        const batch = db.batch();
        const currentUserRef = db.collection('users').doc(currentUserId);
        const targetUserRef = db.collection('users').doc(targetId);

        let isMatch = false;

        if (action === 'reject') {
            batch.update(currentUserRef, {
                rejected: admin.firestore.FieldValue.arrayUnion(targetId)
            });
        } else {
            // Action is like or superlike
            const listName = action === 'like' ? 'liked' : 'superliked';
            batch.update(currentUserRef, {
                [listName]: admin.firestore.FieldValue.arrayUnion(targetId)
            });

            // Check for reciprocal match
            const targetDoc = await targetUserRef.get();
            const targetData = targetDoc.data();

            if (targetData) {
                const reciprocalInterest = (targetData.liked && targetData.liked.includes(currentUserId)) ||
                    (targetData.superliked && targetData.superliked.includes(currentUserId));

                if (reciprocalInterest) {
                    isMatch = true;
                    // Add both to each other's matches list
                    batch.update(currentUserRef, {
                        matches: admin.firestore.FieldValue.arrayUnion(targetId),
                        matchesCounter: admin.firestore.FieldValue.increment(1)
                    });
                    batch.update(targetUserRef, {
                        matches: admin.firestore.FieldValue.arrayUnion(currentUserId),
                        matchesCounter: admin.firestore.FieldValue.increment(1)
                    });
                }

                // Increment current user's sent likes counter
                batch.update(currentUserRef, {
                    likesSentCounter: admin.firestore.FieldValue.increment(1)
                });

                // Also increment target's likes counter for visual feedback (Received Likes)
                batch.update(targetUserRef, {
                    likesCounter: admin.firestore.FieldValue.increment(1)
                });
            }
        }

        await batch.commit();

        // Invalidate Redis caches
        const swipeFeedKey = `SwipeFeed/${currentUserId}`;
        await redis.del(swipeFeedKey);
        await redis.del(`User/${currentUserId}/profileData`);
        // Also invalidate friend list cache since a new match might have occurred
        if (isMatch) {
            await redis.del(`FriendList/${currentUserId}`);
            await redis.del(`FriendList/${targetId}`);
            await redis.del(`User/${targetId}/profileData`); // Fix: Invalidate target user's profile cache too
        }

        log(`🎯 Interaction: ${currentUserId} ${action}ed ${targetId} ${isMatch ? '(MATCH!)' : ''}`);

        // If it's a match, we'll return the target user's basic info for the UI
        let matchedUser = null;
        if (isMatch) {
            const targetDoc = await targetUserRef.get();
            const targetData = targetDoc.data();
            matchedUser = {
                id: targetId,
                name: targetData.name,
                image: targetData.profilePicture || `https://i.pravatar.cc/400?u=${targetId}`
            };
        }

        res.json({
            success: true,
            isMatch,
            matchedUser
        });
    } catch (error) {
        log(`❌ Swipe error: ${error.stack}`);
        res.status(500).json({ success: false, error: 'Failed to process swipe' });
    }
});

router.get('/', async (req, res) => {
    try {
        log('📍 Root route accessed');

        // Decoded user from checkToken middleware
        const decoded = req.user;
        const userId = decoded.userId;
        const cacheKey = `User/${userId}/profileData`;

        log(`🔓 Authenticated User: ${userId}`);

        // Try to fetch from Redis first
        let userData = await redis.get(cacheKey);

        if (userData) {
            log(`⚡ Cache Hit: User data loaded from Redis for ${userData.name}`);
        } else {
            log(`☁️ Cache Miss: Fetching user data from Firestore for ${userId}`);
            // Fetch user data from Firestore
            const userDoc = await db.collection('users').doc(userId).get();

            if (!userDoc.exists) {
                log('❌ User not found - clearing and redirecting');
                res.clearCookie('accessToken');
                return res.redirect('/auth');
            }

            userData = userDoc.data();
            // Store in Redis with 60s TTL
            await redis.set(cacheKey, userData, 600);
            log(`✅ User data loaded from Firestore and cached: ${userData.name}`);
        }

        // Read active section from cookie (provided by frontend)
        const activeSection = req.cookies.activeSection || 'swipe-container';
        log(`📂 Active view on reload: ${activeSection}`);

        // Conditional Match fetching
        let initialMatches = null;
        if (activeSection === 'left-sidebar') {
            log('🎯 Fetching initial matches for matches view');
            initialMatches = await getFriendsList(userId);
        }

        // Read index.html
        const indexPath = path.join(__dirname, '..', 'public', 'index.html');
        let html = fs.readFileSync(indexPath, 'utf8');

        // Prepare injected data object
        // Minimal data for general layout
        const injectedData = {
            id: decoded.userId,
            name: userData.name || '',
            profilePicture: `api/assets/profile/${userId}.png`,
            matchesCounter: Math.max(0, userData.matchesCounter || 0),
            likesCounter: Math.max(0, userData.likesCounter || 0),
            likesSentCounter: Math.max(0, userData.likesSentCounter || 0),
            postsCounter: Math.max(0, userData.postsCounter || 0)
        };

        // Add extra details ONLY if on profile view
        if (activeSection === 'right-sidebar') {
            log('👤 Injecting full profile details');
            Object.assign(injectedData, {
                mobile: userData.mobile || '',
                bio: userData.bio || '',
                tags: userData.tags || [],
                posts: userData.posts || []
            });
        }

        // Inject data as a script tag
        const dataInjectionScript = `
    <script>
        window.userData = ${JSON.stringify(injectedData)};
        window.initialMatches = ${initialMatches ? JSON.stringify(initialMatches) : 'null'};
    </script>`;

        // Case-insensitive search for </head> or </body>
        if (/<\/head>/i.test(html)) {
            html = html.replace(/<\/head>/i, `${dataInjectionScript}\n</head>`);
        } else if (/<\/body>/i.test(html)) {
            html = html.replace(/<\/body>/i, `${dataInjectionScript}\n</body>`);
        } else {
            html = dataInjectionScript + html;
        }

        log('✅ Serving index.html with conditional injection');
        res.send(html);
    } catch (error) {
        log(`❌ Auth error: ${error.message}`);
        res.clearCookie('accessToken');
        res.redirect('/auth');
    }
});

/**
 * POST /reset-swipes
 * Reset specific interaction lists for the user
 */
router.post('/reset-swipes', async (req, res) => {
    try {
        const { type } = req.body;
        const currentUserId = req.user.userId;

        const validTypes = ['liked', 'superliked', 'rejected', 'matches'];
        if (!type || !validTypes.includes(type)) {
            return res.status(400).json({ success: false, error: 'Invalid reset type' });
        }

        const userRef = db.collection('users').doc(currentUserId);

        if (type === 'matches') {
            const userDoc = await userRef.get();
            const userData = userDoc.data() || {};
            const matchIds = userData.matches || [];

            if (matchIds.length > 0) {
                const batch = db.batch();

                // 1. Reset current user
                batch.update(userRef, {
                    matches: [],
                    matchesCounter: 0
                });

                // 2. Reciprocal removal from all matched users
                for (const friendId of matchIds) {
                    const friendRef = db.collection('users').doc(friendId);
                    batch.update(friendRef, {
                        matches: admin.firestore.FieldValue.arrayRemove(currentUserId),
                        matchesCounter: admin.firestore.FieldValue.increment(-1)
                    });
                    // Invalidate each friend's list and profile cache
                    await redis.del(`FriendList/${friendId}`);
                    await redis.del(`User/${friendId}/profileData`);
                }

                await batch.commit();
                log(`🤝 Reciprocal reset complete for ${currentUserId} and ${matchIds.length} friends`);
            } else {
                await userRef.update({ matches: [], matchesCounter: 0 });
            }

            // Invalidate current user's friend list cache
            await redis.del(`FriendList/${currentUserId}`);
        } else {
            // Original reset for other types
            const resetData = {};
            resetData[type] = [];

            // Defensive: ensure counters are reset if applicable
            if (type === 'liked' || type === 'superliked') {
                // If we reset our own likes/superlikes, reset the sent counter
                resetData['likesSentCounter'] = 0;
            }

            await userRef.update(resetData);
        }

        // Invalidate Redis caches for the current user
        await redis.del(`User/${currentUserId}/profileData`);
        await redis.del(`SwipeFeed/${currentUserId}`); // Also clear swipe deck cache

        log(`♻️ User ${currentUserId} reset their ${type} list`);
        res.json({ success: true, message: `Successfully reset ${type}` });
    } catch (error) {
        log(`❌ Reset swipes error: ${error.stack}`);
        res.status(500).json({ success: false, error: 'Failed to reset swipes' });
    }
});

module.exports = router;
