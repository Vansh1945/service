/* BACKUP COMMENT: Created asynchronous Promise-based wrapper API around s2Worker.js thread pool. */
// PRODUCTION FIX
const Piscina = require('piscina');
const path = require('path');
const os = require('os');

// Initialize a fixed thread pool for S2 calculations
const piscina = new Piscina({
  filename: path.resolve(__dirname, 's2Worker.js'),
  minThreads: 2,
  maxThreads: os.cpus().length || 4
});

const runS2Worker = async (action, ...args) => {
  // Stringify BigInt elements for safe transfer to worker threads
  const formattedArgs = args.map(arg => typeof arg === 'bigint' ? arg.toString() : arg);
  return await piscina.run({ action, args: formattedArgs });
};

module.exports = {
  latLngToS2CellIdAsync: (lat, lng, level) => runS2Worker('latLngToS2CellId', lat, lng, level),
  getNeighborsAsync: (cellId) => runS2Worker('getNeighbors', cellId),
  getLevelAsync: (cellId) => runS2Worker('getLevel', cellId)
};
