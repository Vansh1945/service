const jwt = require('jsonwebtoken');
const { userAuthMiddleware } = require('./User-middleware');
const { providerAuthMiddleware } = require('./Provider-middleware');
const adminAuthMiddleware = require('./Admin-middleware');

/**
 * Unified shared authentication middleware that checks the JWT role
 * and delegates to the appropriate specialized authentication middleware.
 */
const sharedAuthMiddleware = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authorization token required' });
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
        message: 'Access token expired. Please login again.'
      });
    }
    return res.status(401).json({ success: false, message: 'Invalid or unauthorized token.' });
  }
};

module.exports = {
  sharedAuthMiddleware
};
