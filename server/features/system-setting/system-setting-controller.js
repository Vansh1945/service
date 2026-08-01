const { SystemConfig } = require('./system-setting-model');
const ifsc = require('ifsc');
const cache = require('../../shared/utils/cache');

const getCachedConfig = async () => {
  let config = cache.get('system_config');
  if (!config) {
    config = await SystemConfig.findOne().lean();
    if (!config) {
      const doc = new SystemConfig({ companyName: 'Default Company' });
      await doc.save();
      config = doc.toObject();
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
      'payoutSettings',
      'refundSettings',
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

    // Dependent Settings Validation
    if (updateData.bookingSettings) {
      const bs = updateData.bookingSettings;
      
      // Validate working hours: startTime < endTime
      if (bs.startTime && bs.endTime) {
        const parseMinutes = (tStr) => {
          if (!tStr || typeof tStr !== 'string') return null;
          const [h, m] = tStr.split(':').map(Number);
          return (isNaN(h) || isNaN(m)) ? null : h * 60 + m;
        };
        const startMin = parseMinutes(bs.startTime);
        const endMin = parseMinutes(bs.endTime);
        if (startMin !== null && endMin !== null && startMin >= endMin) {
          return res.status(400).json({
            success: false,
            message: 'Invalid business working hours: startTime must be earlier than endTime.'
          });
        }
      }

      // Validate numeric SLA & radius boundaries
      if (bs.autoAssignRadius !== undefined && (typeof bs.autoAssignRadius !== 'number' || bs.autoAssignRadius <= 0)) {
        return res.status(400).json({ success: false, message: 'Auto Assign Radius must be a positive number.' });
      }
      if (bs.cancellationWindowMinutes !== undefined && (typeof bs.cancellationWindowMinutes !== 'number' || bs.cancellationWindowMinutes < 0)) {
        return res.status(400).json({ success: false, message: 'Cancellation Window Minutes cannot be negative.' });
      }
      if (bs.providerAcceptTimeoutMinutes !== undefined && (typeof bs.providerAcceptTimeoutMinutes !== 'number' || bs.providerAcceptTimeoutMinutes <= 0)) {
        return res.status(400).json({ success: false, message: 'Provider Acceptance Timeout must be a positive number.' });
      }

      // Validate trustedProviderRules bounds if present
      if (bs.trustedProviderRules) {
        const rules = bs.trustedProviderRules;
        if (rules.minRating !== undefined && (rules.minRating < 0 || rules.minRating > 5)) {
          return res.status(400).json({ success: false, message: 'Trusted Provider Minimum Rating must be between 0 and 5.' });
        }
        if (rules.maxCancellationRate !== undefined && (rules.maxCancellationRate < 0 || rules.maxCancellationRate > 100)) {
          return res.status(400).json({ success: false, message: 'Trusted Provider Maximum Cancellation Rate must be between 0% and 100%.' });
        }
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
    if (global) {
      global.systemSettingsCache = config;
    }

    try {
      const BookingService = require('../booking/booking-service');
      if (BookingService && typeof BookingService.monitorActiveBookingsSLA === 'function') {
        BookingService.monitorActiveBookingsSLA().catch(err => console.error('[SLA Engine] Error after settings update:', err));
      }
      const { getIO } = require('../../shared/socket/socket-server');
      const io = getIO();
      if (io) {
        io.emit('system_settings_updated', { bookingSettings: config.bookingSettings, updatedAt: config.updatedAt });
      }
    } catch (e) {
      console.error('[SystemSettingController] Error broadcasting SLA settings update:', e.message);
    }

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

    // 1. Try validation via npm 'ifsc' package
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

