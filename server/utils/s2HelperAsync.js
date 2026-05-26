/* BACKUP COMMENT: Created asynchronous Promise-based wrapper API around s2Worker.js thread pool. */
const { Worker } = require('worker_threads');
const path = require('path');

function runS2Worker(action, ...args) {
  return new Promise((resolve, reject) => {
    // Stringify BigInt elements for safe transfer to worker threads
    const formattedArgs = args.map(arg => typeof arg === 'bigint' ? arg.toString() : arg);

    const worker = new Worker(path.join(__dirname, 's2Worker.js'), {
      workerData: { action, args: formattedArgs }
    });

    worker.on('message', (msg) => {
      if (msg.success) {
        resolve(msg.result);
      } else {
        reject(new Error(msg.error));
      }
    });

    worker.on('error', reject);

    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`S2 Worker Thread stopped with exit code ${code}`));
      }
    });
  });
}

module.exports = {
  latLngToS2CellIdAsync: (lat, lng, level) => runS2Worker('latLngToS2CellId', lat, lng, level),
  getNeighborsAsync: (cellId) => runS2Worker('getNeighbors', cellId),
  getLevelAsync: (cellId) => runS2Worker('getLevel', cellId)
};
