const { Banner } = require('../models/SystemSetting-model');
const cache = require('../utils/cache');

// Get Banners (Public)
const getBanners = async (req, res, next) => {
  try {
    let banners = cache.get('banners');
    if (!banners) {
      banners = await Banner.find();
      cache.set('banners', banners, 300);
    }
    res.status(200).json({
      success: true,
      data: banners
    });
  } catch (error) {
    global.logger.error(`[BannerController.getBanners] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

// Create Banner (Admin)
const createBanner = async (req, res, next) => {
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
    cache.del('banners');
    res.status(201).json({
      success: true,
      message: 'Banner created successfully',
      data: banner
    });
  } catch (error) {
    global.logger.error(`[BannerController.createBanner] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

// Get All Banners Admin (Admin)
const getAllBannersAdmin = async (req, res, next) => {
  try {
    const banners = await Banner.find();
    res.status(200).json({
      success: true,
      data: banners
    });
  } catch (error) {
    global.logger.error(`[BannerController.getAllBannersAdmin] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

// Update Banner (Admin)
const updateBanner = async (req, res, next) => {
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
    cache.del('banners');
    res.status(200).json({
      success: true,
      message: 'Banner updated successfully',
      data: banner
    });
  } catch (error) {
    global.logger.error(`[BannerController.updateBanner] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

// Delete Banner (Admin)
const deleteBanner = async (req, res, next) => {
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
    cache.del('banners');
  } catch (error) {
    global.logger.error(`[BannerController.deleteBanner] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

module.exports = {
  getBanners,
  createBanner,
  getAllBannersAdmin,
  updateBanner,
  deleteBanner
};

