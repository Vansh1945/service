const { SystemConfig } = require('../models/SystemSetting');
const ifsc = require('ifsc');
const cache = require('../utils/cache');

const getCachedConfig = async () => {
  let config = cache.get('system_config');
  if (!config) {
    config = await SystemConfig.findOne();
    if (!config) {
      config = new SystemConfig({ companyName: 'Default Company' });
      await config.save();
    }
    cache.set('system_config', config, 30); // 30 seconds cache TTL
  }
  return config;
};

const clearSystemConfigCache = () => {
  cache.del('system_config');
};

// 1. Get System Setting
const getSystemSetting = async (req, res, next) => {
  try {
    const config = await getCachedConfig();
    res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    global.logger.error(`[SystemSettingController.getSystemSetting] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

// 2. Update System Setting (Admin Only)
const updateSystemSetting = async (req, res) => {
  try {
    const updateData = { ...req.body };

    // Parse nested objects if they are strings (Multipart/FormData sends them as strings)
    const jsonFields = [
      'socialLinks',
      'bookingSettings',
      'walletSettings',
      'commissionSettings',
      'notificationSettings',
      'maintenanceMode',
      'featureFlags',
      'securitySettings',
      'uploadSettings',
      'surgeSplitSettings',
      'referralSettings'
    ];

    jsonFields.forEach(field => {
      if (typeof updateData[field] === 'string') {
        try {
          updateData[field] = JSON.parse(updateData[field]);
        } catch (error) {
          global.logger.error(`Error parsing ${field}: ` + error.message, error);
        }
      }
    });

    // Handle logo upload
    if (req.files && req.files.logo && req.files.logo[0]) {
      updateData.logo = req.files.logo[0].path; // Cloudinary URL
    }

    // Handle favicon upload
    if (req.files && req.files.favicon && req.files.favicon[0]) {
      updateData.favicon = req.files.favicon[0].path; // Cloudinary URL
    }

    // Handle providerBookingRingtone upload
    if (req.files && req.files.providerBookingRingtone && req.files.providerBookingRingtone[0]) {
      updateData.providerBookingRingtone = req.files.providerBookingRingtone[0].path; // Cloudinary URL
    }

    // Handle digitalSignature upload
    if (req.files && req.files.digitalSignature && req.files.digitalSignature[0]) {
      updateData.digitalSignature = req.files.digitalSignature[0].path; // Cloudinary URL
    }

    // Handle companySeal upload
    if (req.files && req.files.companySeal && req.files.companySeal[0]) {
      updateData.companySeal = req.files.companySeal[0].path; // Cloudinary URL
    }

    // Sanitize empty ObjectId strings to prevent CastError
    if (updateData.referralSettings) {
      if (updateData.referralSettings.systemReferralOwner === "") {
        updateData.referralSettings.systemReferralOwner = null;
      }
    }

    const config = await SystemConfig.findOneAndUpdate(
      {},
      { $set: updateData },
      {
        new: true,
        upsert: true,
        runValidators: true
      }
    );

    clearSystemConfigCache();

    res.status(200).json({
      success: true,
      message: 'System setting updated successfully',
      data: config
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update system setting',
      error: error.message
    });
  }
};

const validateIfsc = async (req, res) => {
  try {
    const { code } = req.params;
    if (!code) {
      return res.status(400).json({ success: false, message: 'IFSC Code is required' });
    }

    const cleanCode = code.trim().toUpperCase();
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(cleanCode)) {
      return res.status(400).json({ success: false, message: 'Invalid IFSC format. Expected format: ABCD0123456' });
    }

    let details = null;

    // 1. Try local RBI dataset first
    try {
      const localRbiDataset = require('../utils/localRbiDataset.json');
      const matched = localRbiDataset.find(item => item.IFSC === cleanCode);
      if (matched) {
        details = {
          BANK: matched.BANK,
          BRANCH: matched.BRANCH,
          DISTRICT: matched.DISTRICT,
          STATE: matched.STATE,
          CITY: matched.CITY,
          ADDRESS: matched.ADDRESS,
          MICR: matched.MICR
        };
      }
    } catch (err) {
      global.logger.warn("Error reading local server dataset: " + err.message);
    }

    // 2. Try validation via npm 'ifsc' package
    if (!details) {
      try {
        const isValid = ifsc.validate(cleanCode);
        if (isValid) {
          const fetchedDetails = await ifsc.fetchDetails(cleanCode);
          if (fetchedDetails) {
            details = {
              BANK: fetchedDetails.BANK || '',
              BRANCH: fetchedDetails.BRANCH || '',
              DISTRICT: fetchedDetails.DISTRICT || '',
              STATE: fetchedDetails.STATE || '',
              CITY: fetchedDetails.CITY || '',
              ADDRESS: fetchedDetails.ADDRESS || '',
              MICR: fetchedDetails.MICR || ''
            };
          }
        }
      } catch (localError) {
        global.logger.warn("Local ifsc package lookup failed: " + localError.message);
      }
    }

    if (!details) {
      return res.status(404).json({ success: false, message: 'IFSC Details not found' });
    }

    res.status(200).json({
      success: true,
      data: {
        ifsc: cleanCode,
        bank: details.BANK || '',
        branch: details.BRANCH || '',
        district: details.DISTRICT || '',
        state: details.STATE || '',
        city: details.CITY || '',
        address: details.ADDRESS || '',
        micr: details.MICR || ''
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to validate IFSC code. Please check code or try again.',
      error: error.message
    });
  }
};

module.exports = {
  getSystemSetting,
  updateSystemSetting,
  validateIfsc
};
