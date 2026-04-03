const { v4: uuidv4 } = require('uuid');

const generateProviderId = () => {
  return "PROV-" + uuidv4().slice(0, 8).toUpperCase();
};

const generateBookingId = () => {
  const year = new Date().getFullYear();
  const shortId = uuidv4().replace(/-/g, "").substring(0, 8).toUpperCase();
  return `BK-${year}-${shortId}`;
};

module.exports = generateProviderId;
module.exports.generateBookingId = generateBookingId;
