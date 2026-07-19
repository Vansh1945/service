const { Category } = require('../models/SystemSetting');
const cache = require('../utils/cache');

// Create Category (Admin)
const createCategory = async (req, res, next) => {
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
    cache.del('active_categories');
    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category
    });
  } catch (error) {
    global.logger.error(`[CategoryController.createCategory] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

// Get All Categories Admin (Admin)
const getAllCategoriesAdmin = async (req, res, next) => {
  try {
    const categories = await Category.find();
    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    global.logger.error(`[CategoryController.getAllCategoriesAdmin] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

// Get Active Categories (Public)
const getActiveCategories = async (req, res, next) => {
  try {
    let categories = cache.get('active_categories');
    if (!categories) {
      categories = await Category.find({ isActive: true });
      cache.set('active_categories', categories, 300);
    }
    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    global.logger.error(`[CategoryController.getActiveCategories] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

// Update Category (Admin)
const updateCategory = async (req, res, next) => {
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
    cache.del('active_categories');
    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: category
    });
  } catch (error) {
    global.logger.error(`[CategoryController.updateCategory] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

// Delete Category (Admin) - Permanent Delete
const deleteCategory = async (req, res, next) => {
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
    cache.del('active_categories');
  } catch (error) {
    global.logger.error(`[CategoryController.deleteCategory] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

// Toggle Category Status (Admin) - Activate/Inactivate
const toggleCategoryStatus = async (req, res, next) => {
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
    cache.del('active_categories');
    res.status(200).json({
      success: true,
      message: `Category ${category.isActive ? 'activated' : 'deactivated'} successfully`,
      data: category
    });
  } catch (error) {
    global.logger.error(`[CategoryController.toggleCategoryStatus] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

module.exports = {
  createCategory,
  getAllCategoriesAdmin,
  getActiveCategories,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus
};
