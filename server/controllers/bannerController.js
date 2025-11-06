const mongoose = require('mongoose');
const Banner = require('../models/Banner-model');
const cloudinary = require('../services/cloudinary');

/**
 * ADMIN CONTROLLERS
 */

// Create a new banner (Admin only)
const createBanner = async (req, res) => {
    try {
        const { title, startDate, endDate, isActive } = req.body;

        let imageUrl;
        if (req.file) {
            imageUrl = req.file.path;
        } else {
            return res.status(400).json({
                success: false,
                message: 'Banner image is required'
            });
        }

        const banner = await Banner.create({
            title,
            imageUrl,
            startDate: new Date(startDate),
            endDate: endDate ? new Date(endDate) : undefined,
            isActive: isActive !== undefined ? isActive : true
        });

        res.status(201).json({
            success: true,
            message: 'Banner created successfully',
            data: banner
        });
    } catch (error) {
        console.error('Error creating banner:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create banner'
        });
    }
};

// Update banner details (Admin only)
const updateBanner = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const banner = await Banner.findById(id);
        if (!banner) {
            return res.status(404).json({
                success: false,
                message: 'Banner not found'
            });
        }

        // Handle image upload if new file provided
        if (req.file) {
            updates.imageUrl = req.file.path;

            // Optionally delete old image from Cloudinary
            if (banner.imageUrl) {
                const publicId = banner.imageUrl.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(`banners/${publicId}`);
            }
        }

        // Convert date strings to Date objects
        if (updates.startDate) updates.startDate = new Date(updates.startDate);
        if (updates.endDate) updates.endDate = new Date(updates.endDate);

        Object.keys(updates).forEach(key => {
            if (key in banner) {
                banner[key] = updates[key];
            }
        });

        await banner.save();

        res.json({
            success: true,
            message: 'Banner updated successfully',
            data: banner
        });
    } catch (error) {
        console.error('Error updating banner:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update banner'
        });
    }
};

// Delete banner (Admin only - soft delete by setting isActive to false)
const deleteBanner = async (req, res) => {
    try {
        const { id } = req.params;

        const banner = await Banner.findById(id);
        if (!banner) {
            return res.status(404).json({
                success: false,
                message: 'Banner not found'
            });
        }

        banner.isActive = false;
        await banner.save();

        res.json({
            success: true,
            message: 'Banner deactivated successfully'
        });
    } catch (error) {
        console.error('Error deleting banner:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete banner'
        });
    }
};

// Permanently delete banner (Admin only - hard delete)
const deleteBannerPermanently = async (req, res) => {
    try {
        const { id } = req.params;

        const banner = await Banner.findById(id);
        if (!banner) {
            return res.status(404).json({
                success: false,
                message: 'Banner not found'
            });
        }

        // Delete image from Cloudinary if exists
        if (banner.imageUrl) {
            const publicId = banner.imageUrl.split('/').pop().split('.')[0];
            await cloudinary.uploader.destroy(`banners/${publicId}`);
        }

        // Permanently delete from database
        await Banner.findByIdAndDelete(id);

        res.json({
            success: true,
            message: 'Banner permanently deleted successfully'
        });
    } catch (error) {
        console.error('Error permanently deleting banner:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to permanently delete banner'
        });
    }
};

// Get all banners (Admin view)
const getAllBanners = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        const banners = await Banner.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Banner.countDocuments();

        res.json({
            success: true,
            count: banners.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            data: banners
        });
    } catch (error) {
        console.error('Error fetching banners:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch banners'
        });
    }
};

// Get banner by ID (Admin view)
const getBannerById = async (req, res) => {
    try {
        const { id } = req.params;

        const banner = await Banner.findById(id);

        if (!banner) {
            return res.status(404).json({
                success: false,
                message: 'Banner not found'
            });
        }

        res.json({
            success: true,
            data: banner
        });
    } catch (error) {
        console.error('Error fetching banner:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch banner'
        });
    }
};

/**
 * PUBLIC CONTROLLERS
 */

// Get active banners (public)
const getActiveBanners = async (req, res) => {
    try {
        const banners = await Banner.findActiveBanners();

        res.json({
            success: true,
            count: banners.length,
            data: banners
        });
    } catch (error) {
        console.error('Error fetching active banners:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch banners'
        });
    }
};

module.exports = {
    // Admin controllers
    createBanner,
    updateBanner,
    deleteBanner,
    deleteBannerPermanently,
    getAllBanners,
    getBannerById,

    // Public controllers
    getActiveBanners
};
