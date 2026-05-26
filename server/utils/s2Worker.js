/* BACKUP COMMENT: Created worker thread entry point to offload synchronous S2 math calculations from main Event Loop. */
const { parentPort, workerData } = require('worker_threads');
const s2Helper = require('./s2Helper');

try {
  const { action, args } = workerData;
  let result;

  if (action === 'latLngToS2CellId') {
    result = s2Helper.latLngToS2CellId(Number(args[0]), Number(args[1]), Number(args[2]));
  } else if (action === 'getNeighbors') {
    result = s2Helper.getNeighbors(args[0]);
  } else if (action === 'getLevel') {
    result = s2Helper.getLevel(BigInt(args[0]));
  } else {
    throw new Error(`Unknown action: ${action}`);
  }

  parentPort.postMessage({ success: true, result });
} catch (error) {
  parentPort.postMessage({ success: false, error: error.message });
}
