const fs = require('fs');
const path = require('path');

const logPath = path.join(__dirname, 'server', 'logs', 'combined.log');

if (!fs.existsSync(logPath)) {
    console.error(`Log file not found at: ${logPath}`);
    process.exit(1);
}

console.log('Reading combined.log...');
const data = fs.readFileSync(logPath, 'utf8');
const lines = data.split('\n');

const routeStats = {};
let totalMs = 0;
let totalCount = 0;
let slowRequests = [];

for (const line of lines) {
    // Expected format:
    // GET /api/service 200 45.20 ms - Role: customer - UserID: 123456789 - IP: 127.0.0.1
    const morganMatch = line.match(/(GET|POST|PUT|DELETE|PATCH)\s+([^\s?]+)(?:\?[^\s]+)?\s+(\d+)\s+(\d+\.\d+|\d+)\s+ms\s+-\s+Role:/);
    if (morganMatch) {
        const method = morganMatch[1];
        let route = morganMatch[2];
        const status = parseInt(morganMatch[3]);
        const ms = parseFloat(morganMatch[4]);

        route = route.replace(/\/[0-9a-fA-F]{24}/g, '/:id');
        route = route.replace(/\/\d+/g, '/:id');

        const key = `${method} ${route}`;
        if (!routeStats[key]) {
            routeStats[key] = { count: 0, totalMs: 0, minMs: ms, maxMs: ms, statusCodes: {} };
        }

        routeStats[key].count++;
        routeStats[key].totalMs += ms;
        routeStats[key].minMs = Math.min(routeStats[key].minMs, ms);
        routeStats[key].maxMs = Math.max(routeStats[key].maxMs, ms);
        routeStats[key].statusCodes[status] = (routeStats[key].statusCodes[status] || 0) + 1;

        totalMs += ms;
        totalCount++;

        if (ms > 1000) {
            slowRequests.push({ line: line.trim(), ms });
        }
    }
}

console.log('===================================================');
console.log('            API PERFORMANCE ANALYZER               ');
console.log('===================================================');
console.log(`Total Logged Requests Analyzed: ${totalCount}`);
if (totalCount > 0) {
    console.log(`Overall Average Response Time : ${(totalMs / totalCount).toFixed(2)} ms`);
}
console.log('---------------------------------------------------');
console.log('ROUTE-WISE STATISTICS (Sorted by count):');
console.log('---------------------------------------------------');

const sortedRoutes = Object.entries(routeStats).sort((a, b) => b[1].count - a[1].count);

for (const [route, stats] of sortedRoutes) {
    const avg = stats.totalMs / stats.count;
    console.log(`${route.padEnd(45)} | Count: ${String(stats.count).padStart(5)} | Avg: ${avg.toFixed(2).padStart(8)} ms | Min: ${stats.minMs.toFixed(1).padStart(6)} ms | Max: ${stats.maxMs.toFixed(1).padStart(7)} ms`);
}

console.log('---------------------------------------------------');
console.log('SLOWEST ROUTES BY AVERAGE RESPONSE TIME:');
console.log('---------------------------------------------------');

const slowestRoutes = Object.entries(routeStats)
    .map(([route, stats]) => ({ route, avg: stats.totalMs / stats.count, ...stats }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 15);

for (const item of slowestRoutes) {
    console.log(`${item.route.padEnd(45)} | Avg: ${item.avg.toFixed(2).padStart(8)} ms | Max: ${item.maxMs.toFixed(1).padStart(7)} ms | Count: ${item.count}`);
}

console.log('===================================================');
console.log(`Slow Requests (> 1000ms) count: ${slowRequests.length}`);
if (slowRequests.length > 0) {
    console.log('Sample slow requests:');
    slowRequests.slice(-10).forEach(req => console.log(`  - [${req.ms} ms] ${req.line}`));
}
console.log('===================================================');
