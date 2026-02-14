const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const { db, realtimeDb } = require('./firebase');
const admin = require('firebase-admin');
const redis = require('./redis');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const { log } = console;

/**
 * Helper to batched fetch profiles from Redis/Firestore
 * Ensures centralized caching logic for all profile access
 */
async function getProfiles(userIds) {
    if (!userIds || userIds.length === 0) return [];

    // 1. Try to fetch all profiles from Redis
    const profileKeys = userIds.map(id => `User/${id}/profileData`);
    let cachedProfiles = [];
    try {
        cachedProfiles = await redis.mget(profileKeys);
    } catch (error) {
        log(`❌ Error batch fetching profiles from Redis: ${error.message}`);
        cachedProfiles = new Array(userIds.length).fill(null);
    }

    const profiles = [];
    const missingIds = [];
    const missingIndices = [];

    // 2. Identify missing profiles
    cachedProfiles.forEach((profile, index) => {
        if (profile) {
            profiles[index] = profile;
        } else {
            missingIds.push(userIds[index]);
            missingIndices.push(index);
        }
    });

    // 3. Fetch missing profiles from Firestore
    if (missingIds.length > 0) {
        log(`☁️ Cache Miss: Fetching ${missingIds.length} profiles from Firestore`);
        const batchPromises = [];
        // Firestore 'in' query limit is 10, but we can do parallel requests
        // Actually limit is 30 for 'in' queries usually, or 10 depending on SDK version? 
        // Admin SDK usually supports 30. Let's stick to safe batching.
        for (let i = 0; i < missingIds.length; i += 30) {
            const batchIds = missingIds.slice(i, i + 30);
            if (batchIds.length > 0) {
                batchPromises.push(
                    db.collection('users')
                        .where(admin.firestore.FieldPath.documentId(), 'in', batchIds)
                        .get()
                );
            }
        }

        const snapshots = await Promise.all(batchPromises);

        // Map snapshot results back to their indices
        snapshots.forEach(snap => {
            snap.forEach(doc => {
                const data = doc.data();
                const profile = { id: doc.id, ...data };

                // Find where this ID fits in the original requested array
                // We need to fill all occurrences if duplicate IDs exist (though unlikely here)
                userIds.forEach((id, idx) => {
                    if (id === doc.id) {
                        profiles[idx] = profile;
                    }
                });

                // Update Redis cache asynchronously
                redis.set(`User/${doc.id}/profileData`, profile, 7 * 24 * 60 * 60); // 7 days TTL
            });
        });
    }

    // Filter out nulls for deleted users and return only essential fields
    return profiles
        .filter(p => p)
        .map(p => ({
            id: p.id,
            name: p.name || '',
            age: p.age || '',
            bio: p.bio || '',
            image: p.profilePicture || p.image || `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/2764.svg`
        }));
}

/**
 * Helper to fetch friends list (used by both API and SSR)
 */
async function getFriendsList(userId, start, end, limit = 20) {
    // Fetch user's matches directly fetch matches from firestore
    const matchIds = await db.collection('users').doc(userId).get().then(doc => doc.data().matches || []);
    const total = matchIds.length;

    if (total === 0) {
        return { friends: [], total: 0, nextCursor: null };
    }

    // Use centralized helper to get profile data
    const validFriends = await getProfiles(matchIds);

    // 4. Fetch presence (Redis optimized) - Fixed key format
    // 4. Fetch presence & unread counts
    const { getChatMetadata } = require('./chat-metadata');
    const { canonicalizationID } = require('./functions');

    const friendsPromises = validFriends.map(async (friend) => {
        try {
            // Parallel fetch: Presence + Unread Count
            const chatId = canonicalizationID(userId, friend.id);

            const [status, lastSeen, meta] = await Promise.all([
                redis.get(`presence:${friend.id}`),
                redis.get(`presence:lastSeen:${friend.id}`),
                getChatMetadata(chatId, userId)
            ]);

            return {
                id: friend.id,
                name: friend.name,
                image: friend.image || ``,
                online: status === 'online',
                lastSeen: lastSeen ? parseInt(lastSeen) : null,
                unreadCount: meta.unreadCount || 0
            };
        } catch (error) {
            log(`❌ Error fetching details for ${friend.id}: ${error.message}`);
            return {
                id: friend.id,
                name: friend.name,
                image: friend.image || ``,
                online: false,
                lastSeen: null,
                unreadCount: 0
            };
        }
    });

    const friends = await Promise.all(friendsPromises);

    // 5. Return (filtering handled by validFriends mostly)

    // Calculate next cursor
    const nextCursor = (start + friends.length) < total ? (start + friends.length) : null;

    log(`🌸 Fetched ${friends.length} friends for ${userId} (Total matches: ${total})`);
    return { friends, total, nextCursor };
}

/**
 * GET /api/friends
 * Fetch all matched profiles for the user
 */
router.get('/api/friends', async (req, res) => {
    try {
        const userId = req.user.userId;
        const start = parseInt(req.query.start) || 0;
        const end = req.query.end ? parseInt(req.query.end) : null;
        const limit = parseInt(req.query.limit) || 20;

        const { friends, total, nextCursor } = await getFriendsList(userId, start, end, limit);
        res.json({ success: true, friends, total, nextCursor });
    } catch (error) {
        log(`❌ Fetch matches error: ${error.stack}`);
        res.status(500).json({ success: false, error: 'Failed to fetch profiles' });
    }
});

/**
 * GET /matches
 * Fetch paginated matching profiles (Hydrated from ID cache)
 */
router.get('/matches', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const currentUserId = req.user.userId;
        const cacheKey = `SwipeFeedIDs/${currentUserId}`; // Cache IDs, not profiles

        // 1. Try to get paginated IDs from Redis Cache first
        let cachedIDs = await redis.get(cacheKey);
        let candidateIDs = [];

        if (cachedIDs) {
            log(`🎯 Serving swipe feed IDs from Redis for user ${currentUserId}`);
            candidateIDs = cachedIDs;
        } else {
            // 2. Cache Miss: Fetch candidate IDs from Firestore with filtering
            log(`🎴 Cache miss: Fetching fresh swipe feed IDs for user ${currentUserId}`);

            // Fetch current user's interaction lists to filter results
            const currentUserDbData = (await db.collection('users').doc(currentUserId).get()).data();
            const currentUserData = await redis.get(`User/${currentUserId}/profileData`) || currentUserDbData;

            // Combine all IDs to exclude
            const excludeIds = new Set([
                currentUserId,
                ...(currentUserData.liked || []),
                ...(currentUserData.rejected || []),
                ...(currentUserData.matches || []),
                ...(currentUserData.blocked || [])
            ]);

            // Fetch a larger batch of IDs to populate the cache
            // We only need IDs initially
            const fetchSize = Math.max(limit * 5, 50);

            // Note: Firestore doesn't support "NOT IN" efficient queries for large arrays.
            // We fetch a batch and filter in memory.
            // Ideally we'd use a more sophisticated query strategy (e.g. by geo or timestamp)
            const snapshot = await db.collection('users').limit(fetchSize).get(); // Use select('id') if possible? Firestore returns whole doc.

            snapshot.forEach(doc => {
                if (!excludeIds.has(doc.id)) {
                    candidateIDs.push(doc.id);
                }
            });

            log(`✅ Fetched ${candidateIDs.length} candidate IDs`);
        }

        // 3. Slice the batch for this response
        const toHydrate = candidateIDs.slice(0, limit);
        const remaining = candidateIDs.slice(limit);

        // 4. Update ID cache
        if (remaining.length > 0) {
            redis.set(cacheKey, remaining, 1800); // 30 min TTL
        } else {
            redis.del(cacheKey);
        }

        // 5. Hydrate profiles from the central cache
        const profiles = await getProfiles(toHydrate);

        log(`🚀 Returning ${profiles.length} hydrated profiles, cached ${remaining.length} IDs`);
        res.json({ success: true, profiles });
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
            const targetData = await redis.get(`User/${targetId}/profileData`) || (await targetUserRef.get()).data();

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

        batch.commit();

        // Invalidate Redis caches
        const swipeFeedKey = `SwipeFeedIDs/${currentUserId}`;
        redis.del(swipeFeedKey);
        redis.del(`User/${currentUserId}/profileData`);
        // Also invalidate friend list cache since a new match might have occurred
        if (isMatch) {
            redis.del(`FriendList/${currentUserId}`);
            redis.del(`FriendList/${targetId}`);
            redis.del(`User/${targetId}/profileData`); // Fix: Invalidate target user's profile cache too
        }

        log(`🎯 Interaction: ${currentUserId} ${action}ed ${targetId} ${isMatch ? '(MATCH!)' : ''}`);

        // If it's a match, we'll return the target user's basic info for the UI
        let matchedUser = null;
        if (isMatch) {
            const targetData = await redis.get(`User/${targetId}/profileData`) || (await targetUserRef.get()).data();
            matchedUser = {
                id: targetId,
                name: targetData.name,
                image: targetData.profilePicture || ``
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

            userData = { id: userId, ...userDoc.data() };
            // Store in Redis with 60s TTL
            redis.set(cacheKey, userData, 600);
            log(`✅ User data loaded from Firestore and cached: ${userData.name}`);
        }

        // Read active section from cookie (provided by frontend)
        const activeSection = req.cookies.activeSection || 'swipe-container';
        log(`📂 Active view on reload: ${activeSection}`);

        // Conditional Match fetching
        let initialMatches = null;
        if (activeSection === 'left-sidebar') {
            log('🎯 Fetching initial matches for matches view');
            const data = await getFriendsList(userId);
            console.log('-------------------', data);
            initialMatches = data;
        }

        // Read index.html
        const indexPath = path.join(__dirname, '..', 'public', 'index.html');
        let html = fs.readFileSync(indexPath, 'utf8');

        // Prepare injected data object
        // Minimal data for general layout
        const injectedData = {
            id: decoded.userId,
            name: userData.name || '',
            profilePicture: userData.profilePicture || `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/2764.svg`,
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
                    redis.del(`FriendList/${friendId}`);
                    redis.del(`User/${friendId}/profileData`);
                }

                batch.commit();
                log(`🤝 Reciprocal reset complete for ${currentUserId} and ${matchIds.length} friends`);
            } else {
                userRef.update({ matches: [], matchesCounter: 0 });
            }

            // Invalidate current user's friend list cache
            redis.del(`FriendList/${currentUserId}`);
        } else {
            // Original reset for other types
            const resetData = {};
            resetData[type] = [];

            // Defensive: ensure counters are reset if applicable
            if (type === 'liked' || type === 'superliked') {
                // If we reset our own likes/superlikes, reset the sent counter
                resetData['likesSentCounter'] = 0;
            }

            userRef.update(resetData);
        }

        // Invalidate Redis caches for the current user
        redis.del(`User/${currentUserId}/profileData`);
        redis.del(`SwipeFeedIDs/${currentUserId}`); // Also clear swipe deck cache

        log(`♻️ User ${currentUserId} reset their ${type} list`);
        res.json({ success: true, message: `Successfully reset ${type}` });
    } catch (error) {
        log(`❌ Reset swipes error: ${error.stack}`);
        res.status(500).json({ success: false, error: 'Failed to reset swipes' });
    }
});

/**
 * POST /api/posts - Create a new post
 * Uploads image to Cloudinary, stores in Firestore, invalidates cache
 */
router.post('/posts', upload.single('image'), async (req, res) => {
    try {
        const decoded = req.user;
        const userId = decoded.userId;

        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No image provided' });
        }

        const imageFile = req.file;
        const { caption = '' } = req.body;

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(imageFile.mimetype)) {
            return res.status(400).json({ success: false, error: 'Invalid file type. Only JPEG, PNG, and WebP allowed.' });
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024;
        if (imageFile.size > maxSize) {
            return res.status(400).json({ success: false, error: 'File too large. Max 10MB.' });
        }

        log(`📸 Uploading post for user ${userId}`);

        // Upload to Cloudinary
        const { uploadImage } = require('./cloudinary');
        const imageUrl = await uploadImage(imageFile.buffer, userId);

        // Create post document
        const postData = {
            imageUrl,
            caption: caption.trim(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            likes: 0,
            comments: 0
        };

        const postRef = await db.collection('users').doc(userId).collection('posts').add(postData);

        // Add ID to response
        const createdPost = {
            id: postRef.id,
            ...postData,
            createdAt: Date.now() // For immediate client use
        };

        // Invalidate user posts cache
        await redis.del(`user:posts:${userId}`);

        log(`✅ Post created: ${postRef.id}`);

        res.json({
            success: true,
            post: createdPost,
            message: 'Post created successfully'
        });

    } catch (error) {
        log(`❌ Create post error: ${error.stack}`);
        res.status(500).json({ success: false, error: 'Failed to create post' });
    }
});

/**
 * GET /api/posts/:userId - Get user posts (with caching)
 */
router.get('/posts/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const cacheKey = `user:posts:${userId}`;

        // Try cache first
        const cached = await redis.get(cacheKey);
        if (cached) {
            log(`✅ Posts cache hit for ${userId}`);
            return res.json({ success: true, posts: cached });
        }

        // Fetch from Firestore
        const postsSnapshot = await db.collection('users').doc(userId).collection('posts')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        const posts = postsSnapshot.docs.map(doc => {
            const data = doc.data();
            let timestamp = Date.now();

            // Safe timestamp conversion
            if (data.createdAt) {
                if (data.createdAt.toMillis) {
                    timestamp = data.createdAt.toMillis();
                } else if (data.createdAt instanceof Date) {
                    timestamp = data.createdAt.getTime();
                } else if (typeof data.createdAt === 'number') {
                    timestamp = data.createdAt;
                }
            }

            return {
                id: doc.id,
                ...data,
                createdAt: timestamp
            };
        });

        // Cache for 5 minutes
        await redis.set(cacheKey, posts, 300);

        log(`📦 Fetched ${posts.length} posts for ${userId}`);
        res.json({ success: true, posts });
    } catch (error) {
        log(`❌ Get posts error for user ${req.params.userId}: ${error.stack}`);
        res.status(500).json({ success: false, error: 'Failed to fetch posts' });
    }
});

module.exports = router;
