const { SystemConfig } = require('../models/SystemSetting-model');
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

// Get branding settings for a specific role
const getBrandingSettings = async (req, res, next) => {
  try {
    const { role } = req.params;
    if (!['customer', 'provider', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const config = await getCachedConfig();
    const brandingKey = `${role}Branding`;
    const brandingData = config[brandingKey] || {};

    const version = config.appVersions?.[role] || 1;
    const lastPublished = config.lastPublished?.[role] || config.updatedAt;
    const timezone = config.timezone || 'UTC';

    // Count installed users with at least one active FCM token (only if requested)
    let installedUsersCount = 0;
    if (req.query.includeCount === 'true') {
      try {
        const User = require('../models/User-model');
        const Provider = require('../models/Provider-model');
        const Admin = require('../models/Admin-model');

        if (role === 'customer') {
          installedUsersCount = await User.countDocuments({ role: 'customer', 'fcmDevices.0': { $exists: true } });
        } else if (role === 'provider') {
          installedUsersCount = await Provider.countDocuments({ isDeleted: { $ne: true }, 'fcmDevices.0': { $exists: true } });
        } else if (role === 'admin') {
          installedUsersCount = await Admin.countDocuments({ isActive: true, 'fcmDevices.0': { $exists: true } });
        }
      } catch (countError) {
        global.logger.error('Failed to count installed PWA users: ' + countError.message, countError);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        ...brandingData.toObject?.() || brandingData,
        appVersion: version,
        lastPublished: lastPublished,
        timezone: timezone,
        installedUsersCount: installedUsersCount
      }
    });
  } catch (error) {
    global.logger.error(`[BrandingController.getBrandingSettings] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

// Update branding settings for a specific role (Admin only - Draft Mode)
const updateBrandingSettings = async (req, res, next) => {
  try {
    const { role } = req.params;
    if (!['customer', 'provider', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    let config = await SystemConfig.findOne();
    if (!config) {
      config = new SystemConfig({ companyName: 'Raj Electrical Services' });
    }

    const brandingKey = `${role}Branding`;
    if (!config[brandingKey]) {
      config[brandingKey] = {};
    }

    const fieldsToUpdate = req.body;
    Object.assign(config[brandingKey], fieldsToUpdate);
    // Mark as modified so Mongoose tracks nested changes
    config.markModified(brandingKey);
    await config.save();

    clearSystemConfigCache();

    const version = config.appVersions?.[role] || 1;
    const lastPublished = config.lastPublished?.[role] || config.updatedAt;

    res.status(200).json({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} branding saved successfully (Draft)`,
      data: {
        ...config[brandingKey].toObject?.() || config[brandingKey],
        appVersion: version,
        lastPublished: lastPublished
      }
    });
  } catch (error) {
    global.logger.error(`[BrandingController.updateBrandingSettings] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

// Publish branding settings and send FCM update (Admin only)
const publishBrandingUpdate = async (req, res, next) => {
  try {
    const { role } = req.params;
    if (!['customer', 'provider', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    let config = await SystemConfig.findOne();
    if (!config) {
      config = new SystemConfig({ companyName: 'Raj Electrical Services' });
    }

    const {
      releaseNotes,
      forceRefresh = true,
      sendNotification = true,
      broadcastOnly = false
    } = req.body;

    const brandingKey = `${role}Branding`;

    // Step 1: Save branding changes if NOT a standalone broadcast-only trigger
    if (!broadcastOnly) {
      if (!config[brandingKey]) {
        config[brandingKey] = {};
      }

      const fieldsToUpdate = { ...req.body };
      delete fieldsToUpdate.releaseNotes;
      delete fieldsToUpdate.forceRefresh;
      delete fieldsToUpdate.sendNotification;
      delete fieldsToUpdate.broadcastOnly;

      Object.assign(config[brandingKey], fieldsToUpdate);
      config.markModified(brandingKey);
    }

    // Step 2: Increment existing appVersion inside SystemSettings
    if (!config.appVersions) {
      config.appVersions = { customer: 1, provider: 1, admin: 1 };
    }
    config.appVersions[role] = (config.appVersions[role] || 1) + 1;

    if (!config.lastPublished) {
      config.lastPublished = { customer: new Date(), provider: new Date(), admin: new Date() };
    }
    config.lastPublished[role] = new Date();

    config.markModified('appVersions');
    config.markModified('lastPublished');
    await config.save();

    clearSystemConfigCache();

    const newVersion = config.appVersions[role];

    // Step 3: Send FCM push notification to all installed app users
    let tokens = [];
    const User = require('../models/User-model');
    const Provider = require('../models/Provider-model');
    const Admin = require('../models/Admin-model');

    if (role === 'customer') {
      const users = await User.find({ role: 'customer' }, 'fcmDevices');
      users.forEach(u => {
        if (u.fcmDevices) {
          u.fcmDevices.forEach(t => { if (t.token && t.isActive !== false) tokens.push(t.token); });
        }
      });
    } else if (role === 'provider') {
      const providers = await Provider.find({ isDeleted: { $ne: true } }, 'fcmDevices');
      providers.forEach(p => {
        if (p.fcmDevices) {
          p.fcmDevices.forEach(t => { if (t.token && t.isActive !== false) tokens.push(t.token); });
        }
      });
    } else if (role === 'admin') {
      const admins = await Admin.find({ isActive: true }, 'fcmDevices');
      admins.forEach(a => {
        if (a.fcmDevices) {
          a.fcmDevices.forEach(t => { if (t.token && t.isActive !== false) tokens.push(t.token); });
        }
      });
    }

    const uniqueTokens = [...new Set(tokens.filter(t => t && t.trim()))];

    if (sendNotification && uniqueTokens.length > 0) {
      try {
        const { sendPushNotification } = require('../utils/notificationService');
        const payload = {
          title: 'App Update Available',
          body: releaseNotes || 'A new version is available. Tap to update now.',
          data: {
            type: 'app_update',
            version: String(newVersion),
            role: role,
            updateUrl: role === 'admin' ? '/admin/dashboard' : role === 'provider' ? '/provider/dashboard' : '/',
            forceRefresh: String(forceRefresh)
          }
        };
        await sendPushNotification(uniqueTokens, payload);
      } catch (fcmError) {
        global.logger.error('Failed to send FCM branding update notifications: ' + fcmError.message, fcmError);
      }
    }

    // Count installed users with at least one active FCM token
    let installedUsersCount = 0;
    try {
      if (role === 'customer') {
        installedUsersCount = await User.countDocuments({ role: 'customer', 'fcmDevices.0': { $exists: true } });
      } else if (role === 'provider') {
        installedUsersCount = await Provider.countDocuments({ isDeleted: { $ne: true }, 'fcmDevices.0': { $exists: true } });
      } else if (role === 'admin') {
        installedUsersCount = await Admin.countDocuments({ isActive: true, 'fcmDevices.0': { $exists: true } });
      }
    } catch (countError) {
      global.logger.error('Failed to count installed PWA users on publish: ' + countError.message, countError);
    }

    res.status(200).json({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} branding changes published and version incremented successfully`,
      data: {
        ...config[brandingKey]?.toObject?.() || config[brandingKey] || {},
        appVersion: newVersion,
        lastPublished: config.lastPublished[role],
        timezone: config.timezone || 'UTC',
        installedUsersCount: installedUsersCount
      }
    });
  } catch (error) {
    global.logger.error(`[BrandingController.publishBrandingUpdate] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

// Upload branding visual asset for a specific role (Admin only)
const uploadBrandingAsset = async (req, res, next) => {
  try {
    const { role } = req.params;
    if (!['customer', 'provider', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    if (!req.files && !req.file) {
      return res.status(400).json({ success: false, message: 'No asset file uploaded' });
    }

    let fileUrl = null;
    let fieldName = null;

    if (req.file) {
      fileUrl = req.file.path;
      fieldName = req.file.fieldname;
    } else if (req.files) {
      const keys = Object.keys(req.files);
      if (keys.length > 0 && req.files[keys[0]][0]) {
        fileUrl = req.files[keys[0]][0].path;
        fieldName = keys[0];
      }
    }

    if (!fileUrl) {
      return res.status(400).json({ success: false, message: 'Asset upload failed' });
    }

    // Auto-persist uploaded asset URL to the database immediately
    let config = await SystemConfig.findOne();
    if (!config) {
      config = new SystemConfig({ companyName: 'Raj Electrical Service' });
    }

    const brandingKey = `${role}Branding`;
    if (!config[brandingKey]) {
      config[brandingKey] = {};
    }
    config[brandingKey][fieldName] = fileUrl;
    config.markModified(brandingKey);
    await config.save();

    clearSystemConfigCache();

    res.status(200).json({
      success: true,
      message: 'Branding asset uploaded and auto-saved successfully',
      url: fileUrl,
      field: fieldName
    });
  } catch (error) {
    global.logger.error(`[BrandingController.uploadBrandingAsset] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

// Dynamically generate PWA manifest based on role branding in DB
const getBrandingManifest = async (req, res, next) => {
  try {
    const { role } = req.params;
    if (!['customer', 'provider', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const config = await SystemConfig.findOne();
    const branding = config ? config[`${role}Branding`] : null;

    // Detect client origin from query param or Referer header to resolve relative assets properly
    let clientOrigin = '';
    if (req.query.origin) {
      clientOrigin = req.query.origin;
    } else if (req.headers.referer) {
      try {
        const refUrl = new URL(req.headers.referer);
        clientOrigin = refUrl.origin;
      } catch (err) {
        // Fallback silently if referer parsing fails
      }
    }

    const formatIconUrl = (url) => {
      if (!url) return '';
      let formatted = url;
      if (url.startsWith('http://') || url.startsWith('https://')) {
        formatted = url;
      } else if (clientOrigin) {
        formatted = `${clientOrigin}${url.startsWith('/') ? '' : '/'}${url}`;
      }
      const version = config?.appVersions?.[role] || 1;
      return formatted.includes('?') ? `${formatted}&v=${version}` : `${formatted}?v=${version}`;
    };

    const appName = branding?.appName || (role === 'admin' ? 'Raj Electrical Admin' : role === 'provider' ? 'Raj Electrical Provider' : 'Raj Electrical Customer');
    const shortName = branding?.shortName || (role === 'admin' ? 'Admin' : role === 'provider' ? 'Provider' : 'Raj Service');
    const description = branding?.description || (role === 'admin' ? 'Raj Electrical Admin Panel' : `${shortName} App`);

    const logoUrl = branding?.logo || '/icon-192.png';
    const iconUrl = branding?.icon || logoUrl;

    const getStartUrl = () => {
      const path = role === 'admin' ? '/admin/dashboard' : role === 'provider' ? '/provider/dashboard' : '/customer/services';
      if (clientOrigin) {
        return `${clientOrigin}${path}`;
      }
      return path;
    };

    const scopeUrl = role === 'admin' ? '/admin/' : role === 'provider' ? '/provider/' : '/customer/';

    const manifest = {
      name: appName,
      short_name: shortName,
      start_url: getStartUrl(),
      scope: clientOrigin ? `${clientOrigin}${scopeUrl}` : scopeUrl,
      display: "standalone",
      orientation: "portrait",
      icons: [
        {
          src: formatIconUrl(iconUrl),
          sizes: "192x192",
          type: "image/png",
          purpose: "any"
        },
        {
          src: formatIconUrl(iconUrl),
          sizes: "512x512",
          type: "image/png",
          purpose: "any"
        },
        {
          src: formatIconUrl(iconUrl),
          sizes: "192x192",
          type: "image/png",
          purpose: "maskable"
        },
        {
          src: formatIconUrl(iconUrl),
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable"
        }
      ],
      description: description,
      id: `com.rajelectrical.${role}`
    };

    // Set JSON content type and wide CORS headers for PWA browser update compliance
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(JSON.stringify(manifest, null, 2));
  } catch (error) {
    global.logger.error(`[BrandingController.getBrandingManifest] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

// getBrandingLogoRedirect()
const getBrandingLogoRedirect = async (req, res, next) => {
  try {
    const { role = 'customer' } = req.query;
    const config = await SystemConfig.findOne();
    if (!config) {
      return res.status(404).send('Config not found');
    }
    const branding = config[`${role}Branding`] || {};
    const logoUrl = branding.logo || branding.icon || config.logo;
    if (logoUrl) {
      return res.redirect(logoUrl);
    }
    res.status(404).send('Logo not found');
  } catch (error) {
    global.logger.error(`[BrandingController.getBrandingLogoRedirect] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

// getBrandingFaviconRedirect()
const getBrandingFaviconRedirect = async (req, res, next) => {
  try {
    const { role = 'customer' } = req.query;
    const config = await SystemConfig.findOne();
    if (!config) {
      return res.status(404).send('Config not found');
    }
    const branding = config[`${role}Branding`] || {};
    const faviconUrl = branding.favicon || config.favicon || branding.icon || config.logo;
    if (faviconUrl) {
      return res.redirect(faviconUrl);
    }
    res.status(404).send('Favicon not found');
  } catch (error) {
    global.logger.error(`[BrandingController.getBrandingFaviconRedirect] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

module.exports = {
  getBrandingSettings,
  updateBrandingSettings,
  publishBrandingUpdate,
  uploadBrandingAsset,
  getBrandingManifest,
  getBrandingLogoRedirect,
  getBrandingFaviconRedirect
};

