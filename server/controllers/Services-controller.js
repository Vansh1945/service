const mongoose = require('mongoose');
const Service = require('../models/Service-model');
const Admin = require('../models/Admin-model');
const Provider = require('../models/Provider-model');
const excelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

/**
 * ADMIN CONTROLLERS
 */

// Create a new service (Admin only)
const createService = async (req, res) => {
    try {
        const { title, category, description, basePrice, duration } = req.body;
        const image = req.file ? req.file.filename : 'default-service.jpg';

        const service = await Service.createService(req.adminID, {
            title,
            category,
            description,
            basePrice,
            duration,
            image
        });

        res.status(201).json({
            success: true,
            message: 'Service created successfully',
            data: service
        });
    } catch (error) {
        console.error('Error creating service:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create service'
        });
    }
};

// Update service details (Admin only)
const updateService = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (req.file) {
            updates.image = req.file.filename;
        }

        // Find and update service
        const service = await Service.findById(id);
        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }

        // Check if admin is the creator
        if (!service.createdBy.equals(req.adminID)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this service'
            });
        }

        // Update fields
        Object.keys(updates).forEach(key => {
            service[key] = updates[key];
        });

        await service.save();

        res.json({
            success: true,
            message: 'Service updated successfully',
            data: service
        });
    } catch (error) {
        console.error('Error updating service:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update service'
        });
    }
};

// Update base price (Admin only)
const updateBasePrice = async (req, res) => {
    try {
        const { id } = req.params;
        const { basePrice } = req.body;

        const service = await Service.updateBasePrice(req.adminID, id, basePrice);

        res.json({
            success: true,
            message: 'Base price updated successfully',
            data: service
        });
    } catch (error) {
        console.error('Error updating base price:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update base price'
        });
    }
};

// Delete service (Admin only - soft delete)
const deleteService = async (req, res) => {
    try {
        const { id } = req.params;

        const service = await Service.findById(id);
        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }

        // Check if admin is the creator
        if (!service.createdBy.equals(req.adminID)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this service'
            });
        }

        service.isActive = false;
        await service.save();

        res.json({
            success: true,
            message: 'Service deactivated successfully'
        });
    } catch (error) {
        console.error('Error deleting service:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete service'
        });
    }
};

// Get all services (Admin view)
const getAllServices = async (req, res) => {
    try {
        const services = await Service.find({ createdBy: req.adminID })
            .sort({ createdAt: -1 })
            .populate('createdBy', 'name email');

        res.json({
            success: true,
            count: services.length,
            data: services
        });
    } catch (error) {
        console.error('Error fetching services:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch services'
        });
    }
};

// Get service by ID (Admin view)
const getServiceById = async (req, res) => {
    try {
        const { id } = req.params;

        const service = await Service.findById(id)
            .populate('createdBy', 'name email');

        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }

        // Check if admin is the creator
        if (!service.createdBy._id.equals(req.adminID)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this service'
            });
        }

        res.json({
            success: true,
            data: service
        });
    } catch (error) {
        console.error('Error fetching service:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch service'
        });
    }
};

/**
 * PROVIDER CONTROLLERS
 */

// Get services for provider
const getServicesForProvider = async (req, res) => {
    try {
        const services = await Service.findForProvider();

        res.json({
            success: true,
            count: services.length,
            data: services
        });
    } catch (error) {
        console.error('Error fetching services for provider:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch services'
        });
    }
};

// Get service details for provider
const getServiceDetailsForProvider = async (req, res) => {
    try {
        const { id } = req.params;

        const service = await Service.findById(id)
            .select('title category description image basePrice duration durationFormatted');

        if (!service || !service.isActive) {
            return res.status(404).json({
                success: false,
                message: 'Service not found or inactive'
            });
        }

        res.json({
            success: true,
            data: service
        });
    } catch (error) {
        console.error('Error fetching service details:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch service details'
        });
    }
};

/**
 * PUBLIC CONTROLLERS
 */

// Get all active services (public)
const getActiveServices = async (req, res) => {
    try {
        const services = await Service.find({ isActive: true })
            .select('title category description image basePrice duration durationFormatted')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: services.length,
            data: services
        });
    } catch (error) {
        console.error('Error fetching active services:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch services'
        });
    }
};

// Get service by ID (public)
const getPublicServiceById = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate ID format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid service ID format'
            });
        }

        const service = await Service.findById(id)
            .select('title category description image basePrice duration durationFormatted isActive');

        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'No service found with that ID'
            });
        }

        if (!service.isActive) {
            return res.status(404).json({
                success: false,
                message: 'Service exists but is not active'
            });
        }

        res.json({
            success: true,
            data: service
        });
    } catch (error) {
        console.error('Error fetching service:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch service'
        });
    }
};

// Get services by category (public)
const getServicesByCategory = async (req, res) => {
    try {
        const { category } = req.params;

        const services = await Service.findActiveByCategory(category)
            .select('title category description image basePrice duration durationFormatted');

        res.json({
            success: true,
            count: services.length,
            data: services
        });
    } catch (error) {
        console.error('Error fetching services by category:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch services'
        });
    }
};

// Bulk import services from Excel (Admin only)
const bulkImportServices = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const workbook = new excelJS.Workbook();
        const filePath = path.join(__dirname, '../uploads', req.file.filename);

        // Load the Excel file
        await workbook.xlsx.readFile(filePath);
        const worksheet = workbook.getWorksheet(1); // Get first sheet

        const services = [];
        const errors = [];
        let successCount = 0;

        // Process each row
        worksheet.eachRow({ includeEmpty: false }, async (row, rowNumber) => {
            // Skip header row
            if (rowNumber === 1) return;

            try {
                const serviceData = {
                    title: row.getCell(1).value,
                    category: row.getCell(2).value,
                    description: row.getCell(3).value,
                    basePrice: row.getCell(4).value,
                    duration: row.getCell(5).value,
                    createdBy: req.adminID,
                    isActive: true
                };

                // Validate required fields
                if (!serviceData.title || !serviceData.category || !serviceData.basePrice) {
                    throw new Error('Missing required fields');
                }

                // Create service
                const service = await Service.create(serviceData);
                services.push(service);
                successCount++;
            } catch (error) {
                errors.push({
                    row: rowNumber,
                    error: error.message
                });
            }
        });

        // Delete the uploaded file after processing
        fs.unlinkSync(filePath);

        return res.json({
            success: true,
            message: 'Bulk import completed',
            importedCount: successCount,
            errorCount: errors.length,
            errors,
            services
        });

    } catch (error) {
        console.error('Error in bulk import:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to process bulk import'
        });
    }
};

module.exports = {
    // Admin controllers
    createService,
    updateService,
    updateBasePrice,
    deleteService,
    getAllServices,
    getServiceById,
    bulkImportServices,

    // Provider controllers
    getServicesForProvider,
    getServiceDetailsForProvider,

    // Public controllers
    getActiveServices,
    getPublicServiceById,
    getServicesByCategory
};