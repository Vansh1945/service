const jwt = require('jsonwebtoken');
const { userAuthMiddleware } = require('./user-middleware');
const { providerAuthMiddleware } = require('./provider-middleware');
const adminAuthMiddleware = require('./admin-middleware');

/**
 * Unified shared authentication middleware that checks the JWT role
 * and delegates to the appropriate specialized authentication middleware.
 */
const sharedAuthMiddleware = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) {
    return res.status(401).json({ success: false, message: 'Your session has expired. Please sign in again.' });
  }

  try {
    const jwtToken = token.replace('Bearer ', '').trim();
    const decoded = jwt.verify(jwtToken, process.env.JWT_SECRET);

    if (decoded.role === 'admin') {
      return adminAuthMiddleware(req, res, next);
    } else if (decoded.role === 'provider') {
      return providerAuthMiddleware(req, res, next);
    } else {
      return userAuthMiddleware(req, res, next);
    }
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        tokenExpired: true,
        message: 'Your session has expired. Please sign in again.'
      });
    }
    return res.status(401).json({ success: false, message: 'Your session has expired. Please sign in again.' });
  }
};

module.exports = {
  sharedAuthMiddleware
};
