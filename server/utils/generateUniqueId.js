const { v4: uuidv4 } = require('uuid');

const generateProviderId = () => {
  return "PROV-" + uuidv4().slice(0, 8).toUpperCase();
};

const generateBookingId = () => {
  const year = new Date().getFullYear();
  const shortId = uuidv4().replace(/-/g, "").substring(0, 8).toUpperCase();
  return `BK-${year}-${shortId}`;
};


const generateComplaintId = () => {
  const year = new Date().getFullYear();
  const shortId = uuidv4().replace(/-/g, "").substring(0, 8).toUpperCase();
  return `CMP-${year}-${shortId}`;
};

const generateReferralCode = (role) => {
  const prefix = role === 'provider' ? 'PRO' : 'CUS';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${result}`;
};

module.exports = generateProviderId;
module.exports.generateBookingId = generateBookingId;
module.exports.generateComplaintId = generateComplaintId;
module.exports.generateReferralCode = generateReferralCode;
