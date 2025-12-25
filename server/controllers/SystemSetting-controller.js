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
    const { companyName, tagline, promoMessage } = req.body;
    let config = await SystemConfig.findOne();
    if (!config) {
      config = new SystemConfig();
    }
    config.companyName = companyName || config.companyName;
    config.tagline = tagline || config.tagline;
    config.promoMessage = promoMessage || config.promoMessage;

    // Handle logo upload
    if (req.files && req.files.logo && req.files.logo[0]) {
      config.logo = req.files.logo[0].path; // Cloudinary URL
    }

    // Handle favicon upload
    if (req.files && req.files.favicon && req.files.favicon[0]) {
      config.favicon = req.files.favicon[0].path; // Cloudinary URL
    }

    await config.save();
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
    const { title, subtitle, startDate, endDate } = req.body;

    const bannerData = { title, subtitle, startDate, endDate };

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
    const { image, title, subtitle, startDate, endDate } = req.body;
    const banner = await Banner.findByIdAndUpdate(
      id,
      { image, title, subtitle, startDate, endDate },
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
  deleteBanner
};
