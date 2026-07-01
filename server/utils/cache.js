const NodeCache = require('node-cache');

const cache = new NodeCache({
  stdTTL: 300, // Default TTL is 5 minutes
  checkperiod: 60
});

// Helper function to invalidate cache entries by prefix
cache.delByPrefix = (prefix) => {
  const keys = cache.keys();
  const targets = keys.filter(k => k.startsWith(prefix));
  if (targets.length > 0) {
    cache.del(targets);
  }
};

module.exports = cache;
