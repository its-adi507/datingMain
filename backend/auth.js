const express = require('express');
const { db, auth } = require('./firebase');
const redis = require('./redis');
const { generateToken, verifyToken } = require('./jwt');
const { updatePresence } = require('./presence');

const router = express.Router();

/**
 * Generate 6-digit OTP
 */
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Authentication middleware
 */
function authMiddleware(req, res, next) {
    const token = req.cookies.accessToken;

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = verifyToken(token);

    if (!decoded) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = decoded;
    next();
}

// ============================================
// AUTH ROUTES
// ============================================

/**
 * POST /api/auth/send-otp
 * Send OTP to mobile number
 * Checks if user exists for login flow
 */
router.post('/send-otp', async (req, res) => {
    try {
        const { mobile, isLogin } = req.body;

        if (!mobile) {
            return res.status(400).json({ error: 'Mobile number required' });
        }

        // Check if user exists
        const userSnapshot = await db.collection('users')
            .where('mobile', '==', mobile)
            .limit(1)
            .get();

        const userExists = !userSnapshot.empty;

        // If login flow and user doesn't exist, return error
        if (isLogin && !userExists) {
            return res.status(404).json({
                error: 'No account found with this number. Please register first.',
                shouldRegister: true
            });
        }

        // If register flow and user exists, return error
        if (!isLogin && userExists) {
            return res.status(400).json({
                error: 'Account already exists. Please login instead.',
                shouldLogin: true
            });
        }

        const otp = generateOTP();
        const expiryTime = 5 * 60; // 5 minutes in seconds

        // Store OTP in Redis with expiry (otp/ folder structure)
        await redis.set(`otp/${mobile}`, {
            otp,
            createdAt: Date.now()
        }, expiryTime);

        // TODO: Send OTP via Firebase Auth or SMS service
        // For now, log it to console
        console.log(`OTP for ${mobile}: ${otp}`);

        res.json({ success: true, message: 'OTP sent successfully' });
    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
});

/**
 * POST /api/auth/verify-otp
 * Verify OTP and login existing user
 */
router.post('/verify-otp', async (req, res) => {
    try {
        const { mobile, otp } = req.body;

        if (!mobile || !otp) {
            return res.status(400).json({ error: 'Mobile and OTP required' });
        }

        // Get OTP from Redis (otp/ folder structure)
        const stored = await redis.get(`otp/${mobile}`);

        if (!stored) {
            return res.status(400).json({ error: 'OTP not found or expired' });
        }

        if (stored.otp !== otp) {
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        // Delete OTP after successful verification
        await redis.del(`otp/${mobile}`);

        // Check if user exists in Firestore
        const userSnapshot = await db.collection('users')
            .where('mobile', '==', mobile)
            .limit(1)
            .get();

        if (userSnapshot.empty) {
            // New user - needs registration
            return res.json({
                success: true,
                message: 'OTP verified',
                isNewUser: true
            });
        }

        // Existing user - create JWT token
        const userId = userSnapshot.docs[0].id;
        const userData = userSnapshot.docs[0].data();

        const token = generateToken(userId, mobile);

        // Update presence
        await updatePresence(userId, true);

        // Set HTTP-only cookie
        res.cookie('accessToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            sameSite: 'strict'
        });

        return res.redirect('/');
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ error: 'Failed to verify OTP' });
    }
});

/**
 * POST /api/auth/register
 * Register new user
 */
router.post('/register', async (req, res) => {
    try {
        const { name, mobile, otp } = req.body;

        if (!name || !mobile || !otp) {
            return res.status(400).json({ error: 'Name, mobile, and OTP required' });
        }

        // Verify OTP first (otp/ folder structure)
        const stored = await redis.get(`otp/${mobile}`);

        if (!stored || stored.otp !== otp) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        // Delete OTP
        await redis.del(`otp/${mobile}`);

        // Check if user already exists
        const existingUser = await db.collection('users')
            .where('mobile', '==', mobile)
            .limit(1)
            .get();

        if (!existingUser.empty) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Create user in Firestore
        const userRef = await db.collection('users').add({
            name,
            mobile,
            createdAt: Date.now(),
            isActive: true,
            bio: '',
            tags: [],
            profilePicture: ''
        });

        // Generate JWT token
        const token = generateToken(userRef.id, mobile);

        // Update presence
        await updatePresence(userRef.id, true);

        // Set HTTP-only cookie
        res.cookie('accessToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            sameSite: 'strict'
        });

        return res.redirect('/');
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', async (req, res) => {
    try {
        const token = req.cookies.accessToken;

        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const decoded = verifyToken(token);

        if (!decoded) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Get user from Firestore
        const userDoc = await db.collection('users').doc(decoded.userId).get();

        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            success: true,
            user: {
                id: userDoc.id,
                ...userDoc.data()
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

/**
 * GET /api/auth/logout
 * Logout user with Redis blacklisting
 */
router.get('/logout', async (req, res) => {
    try {
        const token = req.cookies.accessToken;

        if (token) {
            // Update presence if token is valid
            const decoded = verifyToken(token);
            if (decoded && decoded.userId) {
                await updatePresence(decoded.userId, false);
            }

            // Blacklist the token in Redis
            // We set expiry to 7 days (matching JWT expiry) to be safe
            const expiry = 7 * 24 * 60 * 60;
            await redis.set(`blacklist:${token}`, {
                blacklistedAt: Date.now(),
                reason: 'Logout'
            }, expiry);
        }

        res.clearCookie('accessToken');
        res.redirect('/auth');
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Failed to logout' });
    }
});

// Export router and middleware
module.exports = {
    router,
    authMiddleware,
    verifyToken
};
