const jwt = require('jsonwebtoken');

const Provider = require('../models/Provider-model');
const Feedback = require('../models/Feedback-model');
const Transaction = require('../models/Transaction-model ');

/**
 * Provider Authentication Middleware
 */
const providerAuthMiddleware = async (req, res, next) => {
    // Extract token from header
    const token = req.header('Authorization');

    if (!token || !token.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized. Provider token not provided or invalid format."
        });
    }

    const jwtToken = token.replace("Bearer ", "").trim();

    try {
        // Verify token
        const decoded = jwt.verify(jwtToken, process.env.JWT_SECRET);

        // Find provider in database
        const provider = await Provider.findById(decoded.id)
            .select('-password')
            .populate('feedbacks', 'rating comment')
            .populate('earningsHistory', 'amount date');

        if (!provider) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Provider not found."
            });
        }

        // Check if provider is approved
        if (!provider.approved) {
            return res.status(403).json({
                success: false,
                message: "Forbidden. Your provider account is not yet approved."
            });
        }

        // Check if provider is blocked
        if (provider.blockedTill && provider.blockedTill > new Date()) {
            return res.status(403).json({
                success: false,
                message: `Forbidden. Your account is blocked until ${provider.blockedTill}.`
            });
        }

        // Check if provider is deleted
        if (provider.isDeleted) {
            return res.status(403).json({
                success: false,
                message: "Forbidden. This provider account has been deleted."
            });
        }

        // Attach provider data to request object
        req.provider = provider;
        req.token = jwtToken;
        req.providerID = provider._id;
        req.role = 'provider';

        next();
    } catch (error) {
        console.error("Provider auth middleware error:", error);

        let message = "Unauthorized. Invalid provider token.";
        if (error.name === 'TokenExpiredError') {
            message = "Provider session expired. Please login again.";
        } else if (error.name === 'JsonWebTokenError') {
            message = "Invalid provider token. Please login again.";
        }

        res.status(401).json({
            success: false,
            message
        });
    }
};
/**
 * Middleware to check if provider passed the test
 */
const providerTestPassedMiddleware = async (req, res, next) => {
    try {
        if (!req.provider) {
            return res.status(401).json({
                success: false,
                message: 'Provider not authenticated'
            });
        }

        const provider = await Provider.findById(req.provider._id);

        if (!provider || !provider.testPassed) {
            return res.status(403).json({
                success: false,
                message: 'Complete provider test to access this feature'
            });
        }

        next();
    } catch (error) {
        console.error('[Test Middleware Error]', error);
        res.status(500).json({
            success: false,
            message: 'Server error during authorization'
        });
    }
};

module.exports = {
    providerAuthMiddleware,
    providerTestPassedMiddleware
};