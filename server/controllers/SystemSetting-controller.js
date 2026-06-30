const { SystemConfig, Category, Banner } = require('../models/SystemSetting');
const ifsc = require('ifsc');

// In-memory cache for SystemConfig
let cachedSystemConfig = null;
let lastCacheTime = 0;
const CACHE_TTL = 30 * 1000; // 30 seconds cache TTL

const getCachedConfig = async () => {
  const now = Date.now();
  if (!cachedSystemConfig || (now - lastCacheTime > CACHE_TTL)) {
    let config = await SystemConfig.findOne();
    if (!config) {
      config = new SystemConfig({ companyName: 'Default Company' });
      await config.save();
    }
    cachedSystemConfig = config;
    lastCacheTime = now;
  }
  return cachedSystemConfig;
};

const clearSystemConfigCache = () => {
  cachedSystemConfig = null;
  lastCacheTime = 0;
};

// 1. Get System Setting
const getSystemSetting = async (req, res) => {
  try {
    const config = await getCachedConfig();
    res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system setting',
      error: error.message
    });
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
          console.error(`Error parsing ${field}:`, error);
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

    // Handle authorizedSignature upload
    if (req.files && req.files.authorizedSignature && req.files.authorizedSignature[0]) {
      updateData.authorizedSignature = req.files.authorizedSignature[0].path; // Cloudinary URL
    }

    // Handle companyStamp upload
    if (req.files && req.files.companyStamp && req.files.companyStamp[0]) {
      updateData.companyStamp = req.files.companyStamp[0].path; // Cloudinary URL
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

// 3. Create Category (Admin)
const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category with this name already exists'
      });
    }

    const categoryData = { name, description };

    // Handle icon upload
    if (req.files && req.files.icon && req.files.icon[0]) {
      categoryData.icon = req.files.icon[0].path; // Cloudinary URL
    }

    const category = new Category(categoryData);
    await category.save();
    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create category',
      error: error.message
    });
  }
};

// 4. Get All Categories Admin (Admin)
const getAllCategoriesAdmin = async (req, res) => {
  try {
    const categories = await Category.find();
    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
};

// 5. Get Active Categories (Public)
const getActiveCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true });
    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active categories',
      error: error.message
    });
  }
};

// 6. Update Category (Admin)
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    category.name = name || category.name;
    category.description = description || category.description;
    if (isActive !== undefined) category.isActive = isActive;

    // Handle icon upload
    if (req.files && req.files.icon && req.files.icon[0]) {
      category.icon = req.files.icon[0].path; // Cloudinary URL
    }

    await category.save();
    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: category
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update category',
      error: error.message
    });
  }
};

// 7. Delete Category (Admin) - Permanent Delete
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findByIdAndDelete(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete category',
      error: error.message
    });
  }
};

// 8. Toggle Category Status (Admin) - Activate/Inactivate
const toggleCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    category.isActive = !category.isActive;
    await category.save();
    res.status(200).json({
      success: true,
      message: `Category ${category.isActive ? 'activated' : 'deactivated'} successfully`,
      data: category
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to toggle category status',
      error: error.message
    });
  }
};

// 9. Get Banners (Public)
const getBanners = async (req, res) => {
  try {
    const banners = await Banner.find();
    res.status(200).json({
      success: true,
      data: banners
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banners',
      error: error.message
    });
  }
};

// 10. Create Banner (Admin)
const createBanner = async (req, res) => {
  try {
    const { title, subtitle, startDate, endDate, noExpiry } = req.body;

    let finalStartDate = startDate ? new Date(startDate) : new Date();
    let finalEndDate = (noExpiry === 'true' || noExpiry === true) ? null : (endDate ? new Date(endDate) : null);

    const bannerData = { title, subtitle, startDate: finalStartDate, endDate: finalEndDate };

    // Handle image upload
    if (req.files && req.files.image && req.files.image[0]) {
      bannerData.image = req.files.image[0].path; // Cloudinary URL
    }

    const banner = new Banner(bannerData);
    await banner.save();
    res.status(201).json({
      success: true,
      message: 'Banner created successfully',
      data: banner
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create banner',
      error: error.message
    });
  }
};

// 11. Get All Banners Admin (Admin)
const getAllBannersAdmin = async (req, res) => {
  try {
    const banners = await Banner.find();
    res.status(200).json({
      success: true,
      data: banners
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banners',
      error: error.message
    });
  }
};

// 12. Update Banner (Admin)
const updateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const { image, title, subtitle, startDate, endDate, noExpiry } = req.body;

    let finalStartDate = startDate ? new Date(startDate) : new Date();
    let finalEndDate = (noExpiry === 'true' || noExpiry === true) ? null : (endDate ? new Date(endDate) : null);

    const updateData = { title, subtitle, startDate: finalStartDate, endDate: finalEndDate };

    // Handle image upload
    if (req.files && req.files.image && req.files.image[0]) {
      updateData.image = req.files.image[0].path; // Cloudinary URL
    } else if (image) {
      updateData.image = image;
    }

    const banner = await Banner.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }
    res.status(200).json({
      success: true,
      message: 'Banner updated successfully',
      data: banner
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update banner',
      error: error.message
    });
  }
};

// 13. Delete Banner (Admin)
const deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const banner = await Banner.findByIdAndDelete(id);
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }
    res.status(200).json({
      success: true,
      message: 'Banner deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete banner',
      error: error.message
    });
  }
};

// 14. Get branding settings for a specific role
const getBrandingSettings = async (req, res) => {
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
        console.error('Failed to count installed PWA users:', countError);
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
    res.status(500).json({
      success: false,
      message: 'Failed to fetch branding settings',
      error: error.message
    });
  }
};

// 15. Update branding settings for a specific role (Admin only - Draft Mode)
const updateBrandingSettings = async (req, res) => {
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
    res.status(500).json({
      success: false,
      message: 'Failed to update branding settings',
      error: error.message
    });
  }
};

// 15.5 Publish branding settings and send FCM update (Admin only)
const publishBrandingUpdate = async (req, res) => {
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
        console.error('Failed to send FCM branding update notifications:', fcmError);
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
      console.error('Failed to count installed PWA users on publish:', countError);
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
    res.status(500).json({
      success: false,
      message: 'Failed to publish branding settings update',
      error: error.message
    });
  }
};

// 16. Upload branding visual asset for a specific role (Admin only)
const uploadBrandingAsset = async (req, res) => {
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
    res.status(500).json({
      success: false,
      message: 'Failed to upload branding asset',
      error: error.message
    });
  }
};

// 17. Dynamically generate PWA manifest based on role branding in DB
const getBrandingManifest = async (req, res) => {
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
    res.status(500).json({
      success: false,
      message: 'Failed to generate manifest',
      error: error.message
    });
  }
};


const Handlebars = require('handlebars');
const { sendMail, DEFAULT_EMAIL_TEMPLATES } = require('../utils/sendmail');

const MOCK_TEMPLATE_VARIABLES = {
  otp: "654321",
  name: "John Doe",
  providerName: "PROV-87629",
  customerName: "Jane Smith",
  reason: "Incomplete KYC documents provided.",
  remark: "Your verification request has been successfully reviewed.",
  withdrawAmount: "2500",
  bookingId: "BKG-991823",
  status: "Completed",
  email: "johndoe@example.com",
  expiry: "5",
  date: "2026-05-27",
  adminName: "Super Admin"
};

// getEmailTemplates()
const getEmailTemplates = async (req, res) => {
  try {
    let config = await SystemConfig.findOne();
    if (!config) {
      config = new SystemConfig({ companyName: 'Raj Electrical Service' });
    }

    // Initialize templates in DB if not already initialized
    let modified = false;
    if (!config.emailTemplates || Object.keys(config.emailTemplates).length === 0) {
      config.emailTemplates = DEFAULT_EMAIL_TEMPLATES;
      modified = true;
    } else {
      // Ensure all 9 templates exist
      for (const key of Object.keys(DEFAULT_EMAIL_TEMPLATES)) {
        if (!config.emailTemplates[key]) {
          config.emailTemplates[key] = DEFAULT_EMAIL_TEMPLATES[key];
          modified = true;
        }
      }
    }

    if (modified) {
      config.markModified('emailTemplates');
      await config.save();
    }

    res.status(200).json({
      success: true,
      data: config.emailTemplates
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch email templates',
      error: error.message
    });
  }
};

// updateEmailTemplate()
const updateEmailTemplate = async (req, res) => {
  try {
    const { type } = req.params;
    const { subject, body, isActive } = req.body;

    const allowedTypes = [
      'forgotPasswordOtp', 'providerRegistrationOtp', 'providerApproval',
      'providerRejection', 'contactReply', 'withdrawApproved',
      'withdrawRejected', 'complaintResponse',
      'adminBookingCancelledCustomer', 'adminBookingCancelledProvider'
    ];

    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid template type'
      });
    }

    let config = await SystemConfig.findOne();
    if (!config) {
      config = new SystemConfig({ companyName: 'Raj Electrical Service' });
    }

    if (!config.emailTemplates) {
      config.emailTemplates = {};
    }

    if (!config.emailTemplates[type]) {
      config.emailTemplates[type] = DEFAULT_EMAIL_TEMPLATES[type] || { subject: '', body: '', allowedVariables: [] };
    }

    if (subject !== undefined) config.emailTemplates[type].subject = subject;
    if (body !== undefined) config.emailTemplates[type].body = body;
    if (isActive !== undefined) config.emailTemplates[type].isActive = isActive;
    config.emailTemplates[type].updatedAt = new Date();

    // Audit tracking
    config.metadata = {
      updatedBy: req.admin?.name || req.adminID || 'Admin',
      updatedAt: new Date()
    };

    config.markModified('emailTemplates');
    config.markModified('metadata');
    await config.save();

    res.status(200).json({
      success: true,
      message: 'Email template updated successfully',
      data: config.emailTemplates[type]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update email template',
      error: error.message
    });
  }
};

// previewEmailTemplate()
const previewEmailTemplate = async (req, res) => {
  try {
    const { subject, body, type } = req.body;

    if (!body || !subject) {
      return res.status(400).json({
        success: false,
        message: 'Subject and Body are required for preview'
      });
    }

    const config = await SystemConfig.findOne();
    const runtimeVars = {
      companyName: config?.companyName || "Raj Electrical Service",
      ...MOCK_TEMPLATE_VARIABLES
    };

    const compiledBody = Handlebars.compile(body);
    const compiledSubject = Handlebars.compile(subject);

    const renderedHtml = compiledBody(runtimeVars);
    const renderedSubject = compiledSubject(runtimeVars);

    res.status(200).json({
      success: true,
      data: {
        subject: renderedSubject,
        html: renderedHtml
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to preview email template',
      error: error.message
    });
  }
};

// testSendEmailTemplate()
const testSendEmailTemplate = async (req, res) => {
  try {
    const { type, testEmail, subject, body } = req.body;

    if (!testEmail || !type) {
      return res.status(400).json({
        success: false,
        message: 'Template type and recipient test email are required'
      });
    }

    const config = await SystemConfig.findOne();
    const runtimeVars = {
      companyName: config?.companyName || "Raj Electrical Service",
      ...MOCK_TEMPLATE_VARIABLES
    };

    let finalSubject = subject;
    let finalHtml = body;

    // If subject and body are not passed, we fetch them from dynamic template
    if (!finalSubject || !finalHtml) {
      let template = config?.emailTemplates?.[type] || DEFAULT_EMAIL_TEMPLATES[type];
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }
      finalSubject = template.subject;
      finalHtml = template.body;
    }

    const compiledBody = Handlebars.compile(finalHtml);
    const compiledSubject = Handlebars.compile(finalSubject);

    const renderedHtml = compiledBody(runtimeVars);
    const renderedSubject = compiledSubject(runtimeVars);

    const emailResponse = await sendMail({
      to: testEmail,
      subject: renderedSubject,
      html: renderedHtml
    });

    res.status(200).json({
      success: true,
      message: `Test email sent successfully to ${testEmail}`,
      data: emailResponse
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to send test email',
      error: error.message
    });
  }
};

// restoreDefaultTemplate()
const restoreDefaultTemplate = async (req, res) => {
  try {
    const { type } = req.body;

    if (!type || !DEFAULT_EMAIL_TEMPLATES[type]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid template type'
      });
    }

    let config = await SystemConfig.findOne();
    if (!config) {
      config = new SystemConfig({ companyName: 'Raj Electrical Service' });
    }

    if (!config.emailTemplates) {
      config.emailTemplates = {};
    }

    config.emailTemplates[type] = DEFAULT_EMAIL_TEMPLATES[type];
    config.emailTemplates[type].updatedAt = new Date();

    // Audit tracking
    config.metadata = {
      updatedBy: req.admin?.name || req.adminID || 'Admin',
      updatedAt: new Date()
    };

    config.markModified('emailTemplates');
    config.markModified('metadata');
    await config.save();

    res.status(200).json({
      success: true,
      message: 'Template restored to default successfully',
      data: config.emailTemplates[type]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to restore default template',
      error: error.message
    });
  }
};


// getBrandingLogoRedirect()
const getBrandingLogoRedirect = async (req, res) => {
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
    res.status(500).send(error.message);
  }
};

// getBrandingFaviconRedirect()
const getBrandingFaviconRedirect = async (req, res) => {
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
    res.status(500).send(error.message);
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

    // 1. Try local server dataset first
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
      console.warn("Error reading local server dataset:", err.message);
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
        console.warn("Local ifsc package lookup failed:", localError.message);
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
  createCategory,
  getAllCategoriesAdmin,
  getActiveCategories,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
  getBanners,
  createBanner,
  getAllBannersAdmin,
  updateBanner,
  deleteBanner,
  getBrandingSettings,
  updateBrandingSettings,
  publishBrandingUpdate,
  uploadBrandingAsset,
  getBrandingManifest,
  getEmailTemplates,
  updateEmailTemplates: getEmailTemplates, // Preserve compatibility if any
  updateEmailTemplate,
  previewEmailTemplate,
  testSendEmailTemplate,
  restoreDefaultTemplate,
  getBrandingLogoRedirect,
  getBrandingFaviconRedirect,
  validateIfsc
};
