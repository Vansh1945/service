const Redis = require('ioredis');
const dotenv = require('dotenv');

dotenv.config();

const redisConfig = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    retryStrategy(times) {
        // Stop retrying after 3 attempts in development if no REDIS_HOST is set
        if (!process.env.REDIS_HOST && times > 3) {
            console.warn('[Redis] Max retries reached. Running without Redis cache.');
            return null; // Stop retrying
        }
        const delay = Math.min(times * 100, 3000);
        return delay;
    }
};

const redis = new Redis(redisConfig);
let isRedisConnected = false;

redis.on('connect', () => {
    isRedisConnected = true;
    console.log('Redis connected successfully');
});

redis.on('error', (err) => {
    isRedisConnected = false;
    // Log only once if it's a connection refusal to avoid spam
    if (err.code === 'ECONNREFUSED' && redis.status === 'reconnecting') {
        // Silent reconnecting logs
    } else {
        console.error('Redis connection error:', err.message);
    }
});

module.exports = {
    redis,
    redisConfig,
    isRedisAvailable: () => isRedisConnected && redis.status === 'ready'
};
