/**
 * Error Sanitizer Utility
 * Transforms internal technical exceptions (MongoDB errors, CastErrors, E11000 duplicate keys,
 * Razorpay SDK failures, internal service names, stack traces) into clean, user-safe messages,
 * while preserving full technical details in internal server logs.
 */

function sanitizeErrorMessage(err) {
  if (!err) return "We couldn't complete this request right now. Please try again.";

  const rawMessage = typeof err === 'string' ? err : (err.message || '');
  const name = err.name || '';
  const code = err.code;

  // Log full technical details for server debugging
  if (global.logger && typeof global.logger.error === 'function') {
    global.logger.error(`[Internal Exception Log] ${name} (${code || 'N/A'}): ${rawMessage}`, {
      stack: err.stack
    });
  } else {
    console.error(`[Internal Exception Log] ${name} (${code || 'N/A'}): ${rawMessage}`);
  }

  // Check if message exposes technical or security implementation details
  const isTechnicalExposure = (
    name === 'CastError' ||
    name === 'MongoError' ||
    name === 'MongoServerError' ||
    code === 11000 ||
    /mongo|mongoose|casterror|cast to objectid|e11000|duplicate key|collection:|schema|model\b/i.test(rawMessage) ||
    /razorpay|razorpay_order_id|razorpay_signature|signature mismatch|gateway response/i.test(rawMessage) ||
    /cloudinary|aws|s3|magic-byte|script tag|security alert:/i.test(rawMessage) ||
    /jwt|jsonwebtoken|jwt expired|invalid signature|jwt malformed/i.test(rawMessage) ||
    /axios|econndefused|etimedout|enotfound|err_network|status code 500|status code 404/i.test(rawMessage) ||
    /at\s+.*:\d+:\d+|\(node:|evalmachine|process\./i.test(rawMessage) ||
    /service\b.*failed|controller\b|router\b|middleware\b|returned 0/i.test(rawMessage)
  );

  // A. MongoDB / Database CastError or Invalid ObjectId
  if (name === 'CastError' || /cast to objectid|invalid objectid/i.test(rawMessage)) {
    return "We couldn't find the requested information or the ID format is invalid. Please try again.";
  }

  // B. MongoDB Duplicate Key Error (E11000)
  if (code === 11000 || /e11000|duplicate key/i.test(rawMessage)) {
    return "This action could not be completed because the information already exists.";
  }

  // C. Razorpay / Payment Gateway SDK Internals
  if (/razorpay|gateway|signature mismatch|order_id/i.test(rawMessage)) {
    return "We couldn't complete the payment right now. Please try again or choose another payment method.";
  }

  // D. Cloudinary / File Upload Security / Internal Magic-byte
  if (/cloudinary|magic-byte|security alert:|script tag/i.test(rawMessage)) {
    return "The uploaded file format or size is invalid. Please select a valid file.";
  }

  // E. JWT / Token Auth Details
  if (/jwt|jsonwebtoken|token/i.test(rawMessage) && isTechnicalExposure) {
    return "Your session has expired or is invalid. Please log in again.";
  }

  // F. Service / Provider Assignment Internal Failures
  if (/providerassignmentservice|assignment engine|service returned 0/i.test(rawMessage)) {
    return "We couldn't find an available service provider for this booking right now. Please try another time slot.";
  }

  // G. General Technical Exposure Fallback
  if (isTechnicalExposure) {
    return "We couldn't complete this request right now. Please try again or contact support if the issue persists.";
  }

  // H. Known Business State Reasons (User-Safe Explicit Messages)
  return rawMessage || "We couldn't complete this request right now. Please try again.";
}

module.exports = {
  sanitizeErrorMessage
};
