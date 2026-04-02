const { v4: uuidv4 } = require('uuid');

const generateProviderId = () => {
  return "PROV-" + uuidv4().slice(0, 8).toUpperCase();
};

module.exports = generateProviderId;
