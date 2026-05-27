const { SystemConfig, Category, Banner } = require('../models/SystemSetting');

// 1. Get System Setting
const getSystemSetting = async (req, res) => {
  try {
    let config = await SystemConfig.findOne();
    if (!config) {
      config = new SystemConfig({ companyName: 'Default Company' });
      await config.save();
    }
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
      'uploadSettings'
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

    const config = await SystemConfig.findOneAndUpdate(
      {},
      { $set: updateData },
      {
        new: true,
        upsert: true,
        runValidators: true
      }
    );

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

    const banner = await Banner.findByIdAndUpdate(
      id,
      { image, title, subtitle, startDate: finalStartDate, endDate: finalEndDate },
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

    let config = await SystemConfig.findOne();
    if (!config) {
      config = new SystemConfig({ companyName: 'SafeVolt Solutions' });
      await config.save();
    }

    const brandingKey = `${role}Branding`;
    const brandingData = config[brandingKey] || {};

    res.status(200).json({
      success: true,
      data: brandingData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch branding settings',
      error: error.message
    });
  }
};

// 15. Update branding settings for a specific role (Admin only)
const updateBrandingSettings = async (req, res) => {
  try {
    const { role } = req.params;
    if (!['customer', 'provider', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    let config = await SystemConfig.findOne();
    if (!config) {
      config = new SystemConfig({ companyName: 'SafeVolt Solutions' });
    }

    const brandingKey = `${role}Branding`;
    if (!config[brandingKey]) {
      config[brandingKey] = {};
    }

    const fieldsToUpdate = req.body;
    for (const key of Object.keys(fieldsToUpdate)) {
      config[brandingKey][key] = fieldsToUpdate[key];
    }

    // Mark as modified so Mongoose tracks nested changes
    config.markModified(brandingKey);
    await config.save();

    res.status(200).json({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} branding updated successfully`,
      data: config[brandingKey]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update branding settings',
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

    res.status(200).json({
      success: true,
      message: 'Branding asset uploaded successfully',
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

    const appName = branding?.appName || (role === 'admin' ? 'SafeVolt Admin' : role === 'provider' ? 'SafeVolt Provider' : 'SafeVolt Customer');
    const shortName = branding?.shortName || (role === 'admin' ? 'Admin' : role === 'provider' ? 'Provider' : 'SafeVolt');
    const description = branding?.description || (role === 'admin' ? 'SafeVolt Control Panel' : `${shortName} App`);
    const themeColor = branding?.themeColor || (role === 'admin' ? '#4f46e5' : role === 'provider' ? '#10b981' : '#3b82f6');
    const backgroundColor = branding?.backgroundColor || '#ffffff';
    const logoUrl = branding?.logo || '/icon-192.png';
    const iconUrl = branding?.icon || logoUrl;

    const manifest = {
      name: appName,
      short_name: shortName,
      start_url: role === 'admin' ? '/admin/dashboard' : role === 'provider' ? '/provider/dashboard' : '/',
      display: "standalone",
      background_color: backgroundColor,
      theme_color: themeColor,
      orientation: "portrait",
      icons: [
        {
          src: iconUrl,
          sizes: "192x192",
          type: "image/png",
          purpose: "any maskable"
        },
        {
          src: branding?.splashScreen || iconUrl,
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable"
        }
      ],
      description: description,
      id: `com.safevolt.${role}`
    };

    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify(manifest, null, 2));
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate manifest',
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
  uploadBrandingAsset,
  getBrandingManifest
};
