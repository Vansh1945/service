const { redis, isRedisAvailable } = require('../config/redis');

const getCachedData = async (key) => {
    try {
        if (!isRedisAvailable()) return null;
        const cachedData = await redis.get(key);
        return cachedData ? JSON.parse(cachedData) : null;
    } catch (error) {
        console.error(`[Redis] Error getting key ${key}:`, error);
        return null;
    }
};

const setCachedData = async (key, data, ttl = 60) => {
    try {
        if (!isRedisAvailable()) return;
        await redis.setex(key, ttl, JSON.stringify(data));
    } catch (error) {
        console.error(`[Redis] Error setting key ${key}:`, error);
    }
};

const invalidateCache = async (pattern) => {
    try {
        if (!isRedisAvailable()) return;
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
            await redis.del(keys);
            console.log(`[Redis] Invalidated ${keys.length} keys for pattern ${pattern}`);
        }
    } catch (error) {
        console.error(`[Redis] Error invalidating pattern ${pattern}:`, error);
    }
};

module.exports = {
    getCachedData,
    setCachedData,
    invalidateCache
};
