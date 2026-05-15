const { Queue, Worker } = require('bullmq');
const { redisConfig, isRedisAvailable } = require('../config/redis');
const { refreshAnalytics } = require('./AnalyticsService');

let dashboardQueue, reportQueue, notificationQueue;

if (isRedisAvailable()) {
    // Create Queues
    dashboardQueue = new Queue('dashboard-analytics', { connection: redisConfig });
    reportQueue = new Queue('reports', { connection: redisConfig });
    notificationQueue = new Queue('notifications', { connection: redisConfig });

    // Worker for Dashboard Analytics
    const dashboardWorker = new Worker('dashboard-analytics', async (job) => {
        if (job.name === 'refresh') {
            await refreshAnalytics();
        }
    }, { connection: redisConfig });
} else {
    console.warn('[QueueService] Redis is not available. Background queues are disabled.');
    // Provide dummy objects to prevent crashes in other parts of the app
    const dummyQueue = { add: async () => ({ id: 'dummy' }) };
    dashboardQueue = dummyQueue;
    reportQueue = dummyQueue;
    notificationQueue = dummyQueue;
}

module.exports = {
    dashboardQueue,
    reportQueue,
    notificationQueue
};
