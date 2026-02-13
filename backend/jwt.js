const jwt = require('jsonwebtoken');

// JWT Secret (should be in environment variable in production)
const JWT_SECRET = process.env.JWT_SECRET || 'iqwniubnfbqwudbnqiwndioqnwdinqwiduhqiwudqbnwdninasdqwqgqgggqqasq';
const JWT_EXPIRY = '7d'; // 7 days

/**
 * Generate JWT token
 */
function generateToken(userId, mobile) {
    return jwt.sign(
        { userId, mobile },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
    );
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

/**
 * Middleware: Redirect to /auth if token is missing or invalid
 */
const redis = require('./redis');

/**
 * Middleware: Handles both protecting routes and redirecting logged-in users
 */
async function checkToken(req, res, next) {
    // Skip middleware for static files only
    if (req.path.includes('.')) {
        return next();
    }

    const token = req.cookies.accessToken;
    let decoded = null;

    if (token) {
        // Check if token is blacklisted in Redis
        try {
            const isBlacklisted = await redis.get(`blacklist:${token}`);
            if (isBlacklisted) {
                res.clearCookie('accessToken');
            } else {
                decoded = verifyToken(token);
            }
        } catch (e) {
            console.error('Redis blacklist check error:', e);
            decoded = verifyToken(token);
        }
    }

    const isAuthPath = req.path === '/auth' || req.path === '/auth.html';
    const isApiPath = req.path.startsWith('/api/');
    const isPublicAuthApi = req.path.startsWith('/api/auth/');

    if (decoded) {
        // Logged in user trying to access /auth -> Go to home (only for browser requests)
        if (isAuthPath && !isApiPath) {
            return res.redirect('/');
        }
        // Valid token for protected route
        req.user = decoded;
        return next();
    } else {
        // Guest user on /auth -> OK
        if (isAuthPath || isPublicAuthApi) {
            return next();
        }

        // Unauthorized API request -> 401 (but allow public auth APIs)
        if (isApiPath) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        // Guest user on protected route -> Go to /auth
        if (token) res.clearCookie('accessToken');
        return res.redirect('/auth');
    }
}

module.exports = {
    generateToken,
    verifyToken,
    checkToken,
    JWT_SECRET,
    JWT_EXPIRY
};
