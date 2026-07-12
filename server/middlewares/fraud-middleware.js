const crypto = require('crypto');
const FraudLog = require('../models/FraudLog-model');
const User = require('../models/User-model');
const Provider = require('../models/Provider-model');

/**
 * Extract the real public client IP behind proxies, Render, Vercel, Cloudflare, etc.
 */
function getClientIp(req) {
  let ip = req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    req.headers['x-forwarded-for'] ||
    req.ip ||
    (req.socket ? req.socket.remoteAddress : '');

  // x-forwarded-for can be a list of IPs: "client, proxy1, proxy2"
  if (ip && ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }

  // Clean IPv6-mapped IPv4 addresses
  if (ip && ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  return ip || '0.0.0.0';
}

/**
 * Check if IP is localhost or a private network address
 */
function isPrivateIp(ip) {
  if (!ip) return true;
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return true;

  const ipv4Parts = ip.split('.');
  if (ipv4Parts.length === 4) {
    const p1 = parseInt(ipv4Parts[0], 10);
    const p2 = parseInt(ipv4Parts[1], 10);
    if (p1 === 10) return true; // 10.x.x.x
    if (p1 === 192 && p2 === 168) return true; // 192.168.x.x
    if (p1 === 172 && p2 >= 16 && p2 <= 31) return true; // 172.16.x.x - 172.31.x.x
  }

  if (ip.startsWith('fe80:') || ip.startsWith('fc00:') || ip.startsWith('fd00:')) return true;

  return false;
}

/**
 * Generate secure device fingerprint via SHA-256
 */
function generateDeviceFingerprint(details) {
  const components = [
    details.userAgent || '',
    details.screenResolution || '',
    details.timezone || '',
    details.language || '',
    details.platform || '',
    details.hardwareConcurrency || '',
    details.deviceMemory || ''
  ].join('|');

  return crypto.createHash('sha256').update(components).digest('hex');
}

/**
 * Calculate dynamic IP reputation score and flag suspicious IPs
 */
async function calculateIpReputation(ip) {
  if (isPrivateIp(ip)) {
    return { score: 100, isFlagged: false, reason: 'Private IP' };
  }

  let score = 100;
  let reasons = [];
  const now = new Date();

  // 1. Linked accounts count (User + Provider)
  const [customerAccounts, providerAccounts] = await Promise.all([
    User.countDocuments({ 'metadata.ip': ip }),
    Provider.countDocuments({ 'metadata.ip': ip })
  ]);
  const totalAccounts = customerAccounts + providerAccounts;

  if (totalAccounts > 3) {
    const deduction = Math.min((totalAccounts - 3) * 10, 40);
    score -= deduction;
    reasons.push(`${totalAccounts} linked accounts`);
  }

  // Detect provider & customer accounts on same public IP (suspicious proxy abuse)
  if (customerAccounts > 0 && providerAccounts > 0) {
    score -= 30;
    reasons.push('Co-existence of customer and provider roles');
  }

  // 2. Failed logins in last 15 minutes
  const failedLogins = await FraudLog.countDocuments({
    ip,
    actionType: 'failed_login',
    createdAt: { $gte: new Date(now - 15 * 60 * 1000) }
  });
  if (failedLogins > 0) {
    const deduction = Math.min(failedLogins * 15, 50);
    score -= deduction;
    reasons.push(`${failedLogins} failed logins in last 15m`);
  }

  // 3. Cancellations in last 24 hours
  const cancellations = await FraudLog.countDocuments({
    ip,
    actionType: 'cancellation',
    createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) }
  });
  if (cancellations > 0) {
    const deduction = Math.min(cancellations * 20, 50);
    score -= deduction;
    reasons.push(`${cancellations} cancellations in last 24h`);
  }

  score = Math.max(0, score);
  const isFlagged = score < 50;

  return {
    score,
    isFlagged,
    reason: reasons.join(', ') || 'Clean IP history'
  };
}

/**
 * Middleware to parse request metadata: IP, Device details, and Fingerprint
 */
const parseFraudHeaders = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    const screenResolution = req.headers['x-device-screenresolution'] || '';
    const timezone = req.headers['x-device-timezone'] || '';
    const language = req.headers['x-device-language'] || '';
    const platform = req.headers['x-device-platform'] || '';
    const hardwareConcurrency = req.headers['x-device-hardwareconcurrency'] || '';
    const deviceMemory = req.headers['x-device-devicememory'] || '';

    const deviceDetails = {
      userAgent,
      screenResolution,
      timezone,
      language,
      platform,
      hardwareConcurrency: hardwareConcurrency ? parseInt(hardwareConcurrency, 10) : 0,
      deviceMemory: deviceMemory ? parseInt(deviceMemory, 10) : 0
    };

    req.clientIp = ip;
    req.deviceDetails = deviceDetails;
    req.deviceFingerprint = generateDeviceFingerprint(deviceDetails);

    next();
  } catch (error) {
    console.error('parseFraudHeaders Middleware Error:', error);
    next(); // Don't block requests due to logging errors
  }
};

/**
 * Middleware to throttle rapid failed login attempts (max 5 within 15 minutes)
 */
const throttleFailedLogins = async (req, res, next) => {
  try {
    const ip = req.clientIp || getClientIp(req);
    
    // 1. IP-based lockout check
    if (!isPrivateIp(ip)) {
      const failedAttempts = await FraudLog.countDocuments({
        ip,
        actionType: 'failed_login',
        createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) } // 15 mins
      });

      if (failedAttempts >= 5) {
        if (global.logger) {
          global.logger.warn(`Throttled login attempt from blocked IP: ${ip} (Failed attempts: ${failedAttempts})`);
        }
        return res.status(429).json({
          success: false,
          message: 'Too many failed login attempts. Please try again after 15 minutes.',
          error: 'TOO_MANY_FAILED_LOGINS'
        });
      }
    }

    // 2. Account-based lockout check
    if (req.body && req.body.email) {
      const email = req.body.email.trim().toLowerCase();
      const User = require('../models/User-model');
      const Provider = require('../models/Provider-model');
      const Admin = require('../models/Admin-model');

      let user = await User.findOne({ email });
      if (!user) {
        user = await Provider.findOne({ email });
      }
      if (!user) {
        user = await Admin.findOne({ email });
      }

      if (user && user.lockUntil && user.lockUntil > Date.now()) {
        if (global.logger) {
          global.logger.warn(`Throttled login attempt for locked account: ${email}`);
        }
        return res.status(429).json({
          success: false,
          message: 'Too many failed login attempts. Please try again after 15 minutes.',
          error: 'TOO_MANY_FAILED_LOGINS'
        });
      }
    }

    next();
  } catch (error) {
    console.error('throttleFailedLogins Middleware Error:', error);
    next();
  }
};

/**
 * Middleware to prevent duplicate requests (accidental double-click)
 */
const preventDuplicateSubmissions = (ttlSeconds = 5) => {
  return async (req, res, next) => {
    try {
      if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
        return next();
      }

      const cache = require('../utils/cache');
      const ip = req.clientIp || getClientIp(req);
      const userId = req.userID || req.user?._id || req.provider?._id || req.admin?._id || 'guest';
      
      const bodyHash = crypto.createHash('md5').update(JSON.stringify(req.body || {})).digest('hex');
      const key = `dup:${userId}:${ip}:${req.originalUrl || req.url}:${bodyHash}`;

      if (cache.has(key)) {
        await trackEvent({
          req,
          actionType: 'duplicate_submission',
          flagReason: `Blocked duplicate submission: ${req.originalUrl || req.url}`,
          userId: req.userID || req.user?._id || req.provider?._id || req.admin?._id,
          userModel: req.user ? 'User' : (req.provider ? 'Provider' : (req.admin ? 'Admin' : undefined)),
          role: req.role || req.user?.role || req.provider?.role || (req.admin ? 'admin' : undefined)
        });

        return res.status(409).json({
          success: false,
          message: 'Too many requests. Please wait a moment and try again.'
        });
      }

      cache.set(key, true, ttlSeconds);
      next();
    } catch (error) {
      console.error('preventDuplicateSubmissions Middleware Error:', error);
      next();
    }
  };
};

/**
 * Middleware to throttle excessive OTP requests (max 10 within 1 hour)
 */
const throttleOtpRequests = async (req, res, next) => {
  try {
    const ip = req.clientIp || getClientIp(req);
    const fingerprint = req.deviceFingerprint;
    if (isPrivateIp(ip)) {
      return next();
    }

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const otpCount = await FraudLog.countDocuments({
      $or: [
        { ip },
        { device: fingerprint }
      ],
      actionType: 'otp_request',
      createdAt: { $gte: oneHourAgo }
    });

    if (otpCount >= 10) {
      if (global.logger) {
        global.logger.warn(`Throttled OTP request from IP/Device: ${ip}/${fingerprint} (OTP requests: ${otpCount})`);
      }
      return res.status(429).json({
        success: false,
        message: 'OTP request limit exceeded. Please try again in an hour.',
        error: 'OTP_LIMIT_EXCEEDED'
      });
    }

    next();
  } catch (error) {
    console.error('throttleOtpRequests Middleware Error:', error);
    next();
  }
};

/**
 * Utility function to log a security/fraud-related event to the database
 */
const trackEvent = async ({
  req,
  actionType,
  userId,
  userModel,
  role,
  bookingId,
  notes,
  fraudScore = 0,
  riskLevel = 'LOW',
  flagReason
}) => {
  try {
    const ip = req ? (req.clientIp || getClientIp(req)) : '0.0.0.0';
    const fingerprint = req ? req.deviceFingerprint : 'N/A';
    const details = req ? req.deviceDetails : {};

    // Get dynamic IP reputation
    const rep = await calculateIpReputation(ip);

    let finalScore = Math.max(fraudScore, 100 - rep.score);
    let finalRisk = riskLevel;
    if (finalScore >= 70 || rep.isFlagged) {
      finalRisk = 'HIGH';
    } else if (finalScore >= 40) {
      finalRisk = 'MEDIUM';
    }

    const log = await FraudLog.create({
      ip,
      userId,
      userModel,
      role,
      device: fingerprint,
      deviceDetails: details,
      actionType,
      bookingId,
      fraudScore: finalScore,
      riskLevel: finalRisk,
      isFlagged: rep.isFlagged || finalScore >= 40,
      flagReason: flagReason || rep.reason,
      status: (rep.isFlagged || finalScore >= 40) ? 'pending_review' : 'safe'
    });

    if (global.logger) {
      global.logger.info(`[Fraud Event] Recorded ${actionType} event for User ID: ${userId || 'N/A'} from IP: ${ip}. Risk: ${finalRisk}. Score: ${finalScore}`);
    }

    return log;
  } catch (err) {
    console.error('trackEvent Utility Error:', err);
  }
};

module.exports = {
  parseFraudHeaders,
  throttleFailedLogins,
  throttleOtpRequests,
  trackEvent,
  calculateIpReputation,
  getClientIp,
  isPrivateIp,
  preventDuplicateSubmissions
};
