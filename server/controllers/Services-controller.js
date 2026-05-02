const mongoose = require('mongoose');
const Service = require('../models/Service-model');
const Admin = require('../models/Admin-model');
const Provider = require('../models/Provider-model');
const excelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const cloudinary = require('../services/cloudinary');
const { Category } = require('../models/SystemSetting');

/**
 * ADMIN CONTROLLERS
 */

// Create a new service (Admin only)
const createService = async (req, res) => {
    try {
        const { title, category, description, basePrice, duration, specialNotes, materialsUsed } = req.body;

        // Handle category conversion from string to ObjectId
        let categoryId = category;
        if (typeof category === 'string') {
            // First try to find by _id, then by name
            let categoryDoc = await Category.findById(category).catch(() => null);
            if (!categoryDoc) {
                categoryDoc = await Category.findOne({ name: new RegExp('^' + category + '$', 'i') });
            }
            if (!categoryDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid category'
                });
            }
            categoryId = categoryDoc._id;
        }

        let imageUrls;
        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map(file => cloudinary.uploader.upload(file.path));
            const uploadResults = await Promise.all(uploadPromises);
            imageUrls = uploadResults.map(result => result.secure_url);

            // Optional: delete local files after upload
            req.files.forEach(file => fs.unlinkSync(file.path));
        } else {
            // Upload default image to Cloudinary if no image is provided
            try {
                const defaultImagePath = path.resolve(__dirname, '..', 'assets', 'Service.png');
                const uploadResult = await cloudinary.uploader.upload(defaultImagePath, {
                    folder: 'serviceImage' // Optional: organize in a folder
                });
                imageUrls = [uploadResult.secure_url];
            } catch (uploadError) {
                console.error('Error uploading default image:', uploadError);
            }
        }

        const service = await Service.createService(req.adminID, {
            title,
            category: categoryId,
            description,
            basePrice,
            duration,
            specialNotes: specialNotes ? JSON.parse(specialNotes) : [],
            materialsUsed: materialsUsed ? JSON.parse(materialsUsed) : [],
            images: imageUrls
        });

        // Populate the category field
        const populatedService = await service.populate('category');

        res.status(201).json({
            success: true,
            message: 'Service created successfully',
            data: populatedService
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

        let finalImages = [];
        if (updates.existingImages) {
            try {
                finalImages = JSON.parse(updates.existingImages);
            } catch (e) {
                finalImages = Array.isArray(updates.existingImages) ? updates.existingImages : [updates.existingImages];
            }
        }

        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map(file => cloudinary.uploader.upload(file.path));
            const uploadResults = await Promise.all(uploadPromises);
            const newImageUrls = uploadResults.map(result => result.secure_url);
            finalImages = [...finalImages, ...newImageUrls];
        }

        updates.images = finalImages;
        delete updates.existingImages;

        // Handle array fields
        if (updates.specialNotes && typeof updates.specialNotes === 'string') {
            updates.specialNotes = JSON.parse(updates.specialNotes);
        }

        if (updates.materialsUsed && typeof updates.materialsUsed === 'string') {
            updates.materialsUsed = JSON.parse(updates.materialsUsed);
        }

        // Handle category conversion from string to ObjectId
        if (updates.category && typeof updates.category === 'string') {
            // First try to find by _id, then by name
            let categoryDoc = await Category.findById(updates.category).catch(() => null);
            if (!categoryDoc) {
                categoryDoc = await Category.findOne({ name: new RegExp('^' + updates.category + '$', 'i') });
            }
            if (!categoryDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid category'
                });
            }
            updates.category = categoryDoc._id;
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
            if (key in service) {
                service[key] = updates[key];
            }
        });

        await service.save();

        // Populate the category field
        const populatedService = await service.populate('category');

        res.json({
            success: true,
            message: 'Service updated successfully',
            data: populatedService
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
        const { page = 1, limit = 10, search, category } = req.query;
        const skip = (page - 1) * limit;

        let query = { createdBy: req.adminID };

        if (search) {
            query.$text = { $search: search };
        }

        if (category) {
            query.category = category;
        }

        const services = await Service.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('createdBy', 'name email')
            .populate('category', 'name')
            .lean();

        const total = await Service.countDocuments(query);

        res.json({
            success: true,
            count: services.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
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
            .populate('createdBy', 'name email')
            .populate('feedback.customer', 'name email')
            .lean();

        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }

        // Check if admin is the creator
        if (service.createdBy._id.toString() !== req.adminID.toString()) {
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
        const { page = 1, limit = 10, search, category } = req.query;
        const skip = (page - 1) * limit;

        let query = { isActive: true };

        if (search) {
            query.$text = { $search: search };
        }

        if (category) {
            query.category = category;
        }

        const services = await Service.find(query)
            .select('title category description images basePrice duration feedback averageRating')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const total = await Service.countDocuments(query);

        res.json({
            success: true,
            count: services.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
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
            .select('title category description images basePrice duration durationFormatted feedback averageRating')
            .populate('feedback.customer', 'name')
            .lean();

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
        const { page = 1, limit = 10, search, category } = req.query;
        const skip = (page - 1) * limit;

        let query = { isActive: true };

        if (search) {
            query.$text = { $search: search };
        }

        if (category) {
            query.category = category;
        }

        // First get the services without virtuals to avoid issues
        const services = await Service.find(query)
            .select('title category description images basePrice duration feedback averageRating ratingCount')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('category', 'name') // Populate the category field
            .lean(); // Convert to plain JavaScript objects

        // Manually calculate durationFormatted and ensure averageRating is correct
        const enhancedServices = services.map(service => {
            // Calculate duration formatted
            const hours = Math.floor(service.duration);
            const minutes = Math.round((service.duration - hours) * 60);
            const durationFormatted = `${hours > 0 ? `${hours} hr` : ''} ${minutes > 0 ? `${minutes} min` : ''}`.trim();

            // Calculate average rating if not already calculated
            let averageRating = service.averageRating;
            if ((!averageRating || averageRating === 0) && service.feedback && service.feedback.length > 0) {
                const sum = service.feedback.reduce((acc, curr) => acc + curr.rating, 0);
                averageRating = parseFloat((sum / service.feedback.length).toFixed(1));
            }

            return {
                ...service,
                durationFormatted,
                averageRating,
                ratingCount: service.feedback ? service.feedback.length : 0
            };
        });

        const total = await Service.countDocuments(query);

        res.json({
            success: true,
            count: enhancedServices.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            data: enhancedServices
        });
    } catch (error) {
        console.error('Error fetching active services:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch services',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

        // First get the service with basic info
        const service = await Service.findById(id)
            .select('title category description images basePrice duration isActive averageRating ratingCount specialNotes materialsUsed')
            .populate('category', 'name')
            .lean();

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

        // Get feedback from the Feedback collection for better data structure
        const Feedback = require('../models/Feedback-model');
        const feedbacks = await Feedback.find({
            'serviceFeedback.service': id
        })
            .populate('customer', 'name profilePicUrl')
            .select('serviceFeedback customer createdAt updatedAt')
            .sort({ createdAt: -1 })
            .lean();

        // Transform feedback data to match expected structure
        const transformedFeedback = feedbacks.map(feedback => ({
            _id: feedback._id,
            rating: feedback.serviceFeedback.rating,
            comment: feedback.serviceFeedback.isApproved ? (feedback.serviceFeedback.comment || '') : '',
            isApproved: feedback.serviceFeedback.isApproved || false,
            customer: feedback.customer,
            createdAt: feedback.createdAt,
            updatedAt: feedback.updatedAt || feedback.createdAt,
            isEdited: feedback.serviceFeedback.isEdited || false
        }));

        // Calculate average rating and count from actual feedback
        let averageRating = 0;
        let ratingCount = transformedFeedback.length;

        if (ratingCount > 0) {
            const sum = transformedFeedback.reduce((acc, curr) => acc + curr.rating, 0);
            averageRating = parseFloat((sum / ratingCount).toFixed(1));
        }

        // Calculate durationFormatted
        const hours = Math.floor(service.duration);
        const minutes = Math.round((service.duration - hours) * 60);
        const durationFormatted = `${hours > 0 ? `${hours} hr` : ''} ${minutes > 0 ? `${minutes} min` : ''}`.trim();

        // Update service with calculated values if they differ
        if (service.averageRating !== averageRating || service.ratingCount !== ratingCount) {
            await Service.findByIdAndUpdate(id, {
                averageRating,
                ratingCount
            });
        }

        // Prepare final response
        const responseData = {
            ...service,
            durationFormatted,
            averageRating,
            ratingCount,
            feedback: transformedFeedback
        };

        res.json({
            success: true,
            data: responseData
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
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        const services = await Service.findActiveByCategory(category)
            .select('title category description images basePrice duration durationFormatted averageRating')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const total = await Service.countDocuments({ category, isActive: true });

        res.json({
            success: true,
            count: services.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
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
        const filePath = req.file.path;

        await workbook.xlsx.readFile(filePath);
        const worksheet = workbook.getWorksheet(1);

        const importedServices = [];
        const errors = [];
        let successCount = 0;

        // Get all categories for matching
        const allCategories = await Category.find({ isActive: true });

        // Iterate through rows (start from row 2 to skip headers)
        for (let i = 2; i <= worksheet.rowCount; i++) {
            const row = worksheet.getRow(i);
            if (!row.getCell(1).value) continue; // Skip empty rows

            try {
                const title = row.getCell(1).value?.toString().trim();
                const categoryName = row.getCell(2).value?.toString().trim();
                const description = row.getCell(3).value?.toString().trim();
                const basePrice = parseFloat(row.getCell(4).value);
                const duration = parseFloat(row.getCell(5).value);
                const specialNotes = row.getCell(6).value?.toString().split(',').map(s => s.trim()).filter(Boolean) || [];
                const materialsUsed = row.getCell(7).value?.toString().split(',').map(s => s.trim()).filter(Boolean) || [];

                // Basic validation
                if (!title || !categoryName || isNaN(basePrice) || isNaN(duration)) {
                    throw new Error(`Missing or invalid required fields (Title, Category, Price, Duration)`);
                }

                // Match category
                const categoryDoc = allCategories.find(c => 
                    c.name.toLowerCase() === categoryName.toLowerCase() || 
                    c._id.toString() === categoryName
                );

                if (!categoryDoc) {
                    throw new Error(`Category "${categoryName}" not found in system`);
                }

                const serviceData = {
                    title,
                    category: categoryDoc._id,
                    description: description || 'No description provided',
                    basePrice,
                    duration,
                    specialNotes,
                    materialsUsed,
                    createdBy: req.adminID,
                    isActive: true
                };

                const service = new Service(serviceData);
                await service.save();
                importedServices.push(service);
                successCount++;
            } catch (err) {
                errors.push({
                    row: i,
                    title: row.getCell(1).value || 'Unknown',
                    message: err.message
                });
            }
        }

        // Clean up file
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        return res.json({
            success: true,
            message: `Import completed: ${successCount} success, ${errors.length} failed`,
            importedCount: successCount,
            errorCount: errors.length,
            errors,
            data: importedServices
        });

    } catch (error) {
        console.error('Bulk import error:', error);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to process bulk import'
        });
    }
};

// Download Service Import Template
const downloadServiceTemplate = async (req, res) => {
    try {
        const workbook = new excelJS.Workbook();
        const worksheet = workbook.addWorksheet('Service Template');

        // Headers
        worksheet.columns = [
            { header: 'Service Title*', key: 'title', width: 30 },
            { header: 'Category Name*', key: 'category', width: 20 },
            { header: 'Description*', key: 'description', width: 50 },
            { header: 'Base Price (INR)*', key: 'basePrice', width: 15 },
            { header: 'Duration (Hours)*', key: 'duration', width: 15 },
            { header: 'Special Notes (Comma Separated)', key: 'specialNotes', width: 30 },
            { header: 'Materials Used (Comma Separated)', key: 'materialsUsed', width: 30 }
        ];

        // Add some instructions/sample
        const categories = await Category.find({ isActive: true }).select('name');
        const categoryNames = categories.map(c => c.name).join(', ');

        worksheet.addRow({
            title: 'Example Service',
            category: categories[0]?.name || 'Electrical',
            description: 'Provide a detailed description of the service here.',
            basePrice: 500,
            duration: 1.5,
            specialNotes: 'Note 1, Note 2',
            materialsUsed: 'Wire, Tape'
        });

        // Add instructions row at the end or as a comment
        const infoSheet = workbook.addWorksheet('Instructions');
        infoSheet.columns = [
            { header: 'Instruction', key: 'inst', width: 80 }
        ];
        infoSheet.addRow({ inst: '1. Fields marked with * are required.' });
        infoSheet.addRow({ inst: `2. Category Name must be one of the following: ${categoryNames}` });
        infoSheet.addRow({ inst: '3. Duration should be in decimal hours (e.g., 1.5 for 1 hour 30 mins).' });
        infoSheet.addRow({ inst: '4. Base Price should be a number without currency symbols.' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=service_import_template.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error generating template:', error);
        res.status(500).json({ success: false, message: 'Failed to generate template' });
    }
};

// Export services to Excel (Admin only) - Including Images
const exportServicesToExcel = async (req, res) => {
    try {
        const services = await Service.find({ createdBy: req.adminID })
            .sort({ createdAt: -1 })
            .lean();

        const workbook = new excelJS.Workbook();
        const worksheet = workbook.addWorksheet('Services');

        // Add headers
        worksheet.columns = [
            { header: 'Title', key: 'title', width: 30 },
            { header: 'Category', key: 'category', width: 20 },
            { header: 'Description', key: 'description', width: 50 },
            { header: 'Images', key: 'images', width: 50 },
            { header: 'Base Price', key: 'basePrice', width: 15 },
            { header: 'Duration (hours)', key: 'duration', width: 15 },
            { header: 'Special Notes', key: 'specialNotes', width: 30 },
            { header: 'Materials Used', key: 'materialsUsed', width: 30 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Average Rating', key: 'averageRating', width: 15 },
            { header: 'Rating Count', key: 'ratingCount', width: 15 },
            { header: 'Created At', key: 'createdAt', width: 20 },
            { header: 'Updated At', key: 'updatedAt', width: 20 }
        ];

        // Add data rows
        services.forEach(service => {
            worksheet.addRow({
                title: service.title,
                category: service.category,
                description: service.description,
                images: service.images.join(', '), // Multiple images as comma-separated
                basePrice: service.basePrice,
                duration: service.duration,
                specialNotes: service.specialNotes ? service.specialNotes.join(', ') : '',
                materialsUsed: service.materialsUsed ? service.materialsUsed.join(', ') : '',
                status: service.isActive ? 'Active' : 'Inactive',
                averageRating: service.averageRating,
                ratingCount: service.ratingCount,
                createdAt: service.createdAt.toISOString().split('T')[0],
                updatedAt: service.updatedAt ? service.updatedAt.toISOString().split('T')[0] : ''
            });
        });

        // Set response headers
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            'attachment; filename=services.xlsx'
        );

        // Send the Excel file
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Error exporting services:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export services'
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
    exportServicesToExcel,
    downloadServiceTemplate,

    // Provider controllers
    getServicesForProvider,
    getServiceDetailsForProvider,

    // Public controllers
    getActiveServices,
    getPublicServiceById,
    getServicesByCategory
};