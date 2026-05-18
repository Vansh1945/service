const jwt = require('jsonwebtoken');
const User = require('../models/User-model');

/**
 * User Authentication Middleware
 * Verifies JWT access token. On expiry, returns 401 with tokenExpired:true
 * so the client can automatically call /auth/refresh-token.
 */
const userAuthMiddleware = async (req, res, next) => {
    const token = req.header('Authorization');

    if (!token || !token.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Token not provided.' });
    }

    const jwtToken = token.replace('Bearer ', '').trim();

    if (!jwtToken || jwtToken === 'null' || jwtToken === 'undefined') {
        return res.status(401).json({ success: false, message: 'Unauthorized. Invalid token.' });
    }

    try {
        const decoded = jwt.verify(jwtToken, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id)
            .select('-password')
            .select('+couponsUsed +customDiscount');

        if (!user) {
            return res.status(401).json({ success: false, message: 'Unauthorized. User not found.' });
        }

        // Dynamic Token Invalidation/Revocation check
        const currentFingerprint = req.deviceFingerprint;
        let isSessionValid = false;

        if (user.refreshTokens && user.refreshTokens.length > 0) {
            const activeSessions = user.refreshTokens.filter(t => t.isValid && t.expiresAt > new Date());
            if (activeSessions.length > 0) {
                if (currentFingerprint) {
                    isSessionValid = activeSessions.some(t => t.deviceId === currentFingerprint);
                } else {
                    isSessionValid = true;
                }
            }
        }

        if (!isSessionValid) {
            return res.status(401).json({
                success: false,
                tokenExpired: true,
                message: 'Your session has been logged out or revoked.'
            });
        }

        if (user.role !== 'customer') {
            return res.status(403).json({ success: false, message: 'Forbidden. Customers only.' });
        }

        if (user.isSuspended) {
            return res.status(403).json({ success: false, message: `Account suspended: ${user.suspensionReason || 'Suspicious activity'}` });
        }

        req.user   = user;
        req.token  = jwtToken;
        req.userID = user._id;
        req.role   = user.role;
        next();

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            // Signal client to use refresh token
            return res.status(401).json({
                success: false,
                tokenExpired: true,
                message: 'Access token expired. Please refresh your session.'
            });
        }
        return res.status(401).json({ success: false, message: 'Unauthorized. Invalid token.' });
    }
};

const firstBookingCheckMiddleware = (req, res, next) => {
    if (req.user.firstBookingUsed) {
        return res.status(403).json({ success: false, message: 'First booking discount already used.' });
    }
    next();
};

const discountAccessMiddleware = (req, res, next) => {
    if (req.user.customDiscount <= 0) {
        return res.status(403).json({ success: false, message: 'No active discount available.' });
    }
    next();
};

module.exports = { userAuthMiddleware, firstBookingCheckMiddleware, discountAccessMiddleware };