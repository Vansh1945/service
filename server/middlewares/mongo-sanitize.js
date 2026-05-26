/**
 * Custom MongoDB Sanitize Middleware to protect against NoSQL Injection.
 * Compatible with Express 5+ by redefining read-only getters (like req.query) as writable properties.
 */

function sanitizeObject(obj, replaceWith = '_', allowDots = true) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = sanitizeObject(obj[i], replaceWith, allowDots);
    }
    return obj;
  }

  // Avoid sanitizing special objects (like Date, BSON classes, Buffer, etc.)
  if (obj.constructor && obj.constructor.name !== 'Object' && obj.constructor.name !== 'Array') {
    return obj;
  }

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      let newKey = key;
      let keyChanged = false;

      if (key.startsWith('$')) {
        newKey = replaceWith + key.slice(1);
        keyChanged = true;
      }

      if (!allowDots && newKey.includes('.')) {
        newKey = newKey.split('.').join(replaceWith);
        keyChanged = true;
      }

      const val = sanitizeObject(obj[key], replaceWith, allowDots);

      if (keyChanged) {
        obj[newKey] = val;
        delete obj[key];
      } else {
        obj[key] = val;
      }
    }
  }

  return obj;
}

const mongoSanitize = (options = {}) => {
  const replaceWith = options.replaceWith || '_';
  const allowDots = options.allowDots !== undefined ? options.allowDots : false;

  return (req, res, next) => {
    // Redefine req.query to be writable and sanitized, avoiding Express 5's read-only getter TypeError
    if (req.query) {
      const sanitizedQuery = sanitizeObject({ ...req.query }, replaceWith, allowDots);
      Object.defineProperty(req, 'query', {
        value: sanitizedQuery,
        writable: true,
        configurable: true,
        enumerable: true
      });
    }

    if (req.body) {
      sanitizeObject(req.body, replaceWith, allowDots);
    }

    if (req.params) {
      sanitizeObject(req.params, replaceWith, allowDots);
    }

    if (req.headers) {
      sanitizeObject(req.headers, replaceWith, allowDots);
    }

    next();
  };
};

module.exports = mongoSanitize;
