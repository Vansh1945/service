/* BACKUP COMMENT: Created worker thread entry point to offload synchronous S2 math calculations from main Event Loop. */
// PRODUCTION FIX
const s2Helper = require('./s2Helper');

module.exports = async ({ action, args }) => {
  if (action === 'latLngToS2CellId') {
    return s2Helper.latLngToS2CellId(Number(args[0]), Number(args[1]), Number(args[2]));
  } else if (action === 'getNeighbors') {
    return s2Helper.getNeighbors(args[0]);
  } else if (action === 'getLevel') {
    return s2Helper.getLevel(BigInt(args[0]));
  } else {
    throw new Error(`Unknown action: ${action}`);
  }
};
