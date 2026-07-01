const mongoose = require('mongoose');
const Service = require('../models/Service-model');
const Admin = require('../models/Admin-model');
const Provider = require('../models/Provider-model');
const excelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const cloudinary = require('../services/cloudinary');
const { Category } = require('../models/SystemSetting');
const cache = require('../utils/cache');

const parseArrayInput = (value, fallback = []) => {
    if (value === undefined || value === null || value === '') return fallback;
    if (Array.isArray(value)) return value.flatMap(item => parseArrayInput(item, [])).filter(Boolean);
    if (typeof value === 'string') {
        try {
            return parseArrayInput(JSON.parse(value), fallback);
        } catch (e) {
            return value.split(',').map(item => item.trim()).filter(Boolean);
        }
    }
    return [String(value)];
};

/**
 * ADMIN CONTROLLERS
 */

// Create a new service (Admin only)
const createService = async (req, res, next) => {
    try {
        const {
            title,
            category,
            description,
            basePrice,
            duration,
            specialNotes,
            serviceIncludes,
            serviceExcludes,
            serviceGuarantees,
            materialsUsed,
            serviceType,
            warranty,
            tags,
            faqs,
            shortDescription,
            isFeatured,
            prerequisites,
            discountPrice
        } = req.body;

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
                global.logger.error('Error uploading default image: ' + uploadError.message, uploadError);
            }
        }

        const resolvedServiceIncludes = parseArrayInput(serviceIncludes, parseArrayInput(specialNotes, []));

        const service = await Service.createService(req.adminID, {
            title,
            category: categoryId,
            description,
            basePrice,
            duration,
            specialNotes: parseArrayInput(specialNotes, resolvedServiceIncludes),
            serviceIncludes: resolvedServiceIncludes,
            serviceExcludes: parseArrayInput(serviceExcludes, []),
            serviceGuarantees: parseArrayInput(serviceGuarantees, []),
            materialsUsed: parseArrayInput(materialsUsed, []),
            images: imageUrls,
            serviceType,
            warranty: warranty ? (typeof warranty === 'string' ? JSON.parse(warranty) : warranty) : undefined,
            tags: parseArrayInput(tags, []),
            faqs: faqs ? (typeof faqs === 'string' ? JSON.parse(faqs) : faqs) : [],
            shortDescription,
            isFeatured: isFeatured === true || isFeatured === 'true',
            prerequisites: parseArrayInput(prerequisites, []),
            discountPrice: (discountPrice !== undefined && discountPrice !== null && discountPrice !== '') ? Number(discountPrice) : undefined
        });

        // Populate the category field
        const populatedService = await service.populate('category');

        cache.delByPrefix('services_');
        cache.delByPrefix('service_');

        res.status(201).json({
            success: true,
            message: 'Service created successfully',
            data: populatedService
        });
    } catch (error) {
        global.logger.error(`[ServicesController.createService] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
        next(error);
    }
};

// Update service details (Admin only)
const updateService = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (updates.existingImages !== undefined || (req.files && req.files.length > 0)) {
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
        }
        delete updates.existingImages;

        // Handle array fields
        ['specialNotes', 'serviceIncludes', 'serviceExcludes', 'serviceGuarantees', 'materialsUsed', 'tags', 'prerequisites'].forEach(field => {
            if (updates[field] !== undefined) {
                updates[field] = parseArrayInput(updates[field], []);
            }
        });

        if (updates.serviceIncludes !== undefined && updates.specialNotes === undefined) {
            updates.specialNotes = updates.serviceIncludes;
        }

        if (updates.specialNotes !== undefined && updates.serviceIncludes === undefined) {
            updates.serviceIncludes = updates.specialNotes;
        }

        if (updates.warranty && typeof updates.warranty === 'string') {
            updates.warranty = JSON.parse(updates.warranty);
        }

        if (updates.faqs && typeof updates.faqs === 'string') {
            updates.faqs = JSON.parse(updates.faqs);
        }

        if (updates.isFeatured !== undefined) {
            updates.isFeatured = updates.isFeatured === true || updates.isFeatured === 'true';
        }

        if (updates.discountPrice !== undefined && updates.discountPrice !== '') {
            updates.discountPrice = Number(updates.discountPrice);
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
            service[key] = updates[key];
        });

        await service.save();

        // Populate the category field
        const populatedService = await service.populate('category');

        cache.delByPrefix('services_');
        cache.delByPrefix('service_');

        res.json({
            success: true,
            message: 'Service updated successfully',
            data: populatedService
        });
    } catch (error) {
        global.logger.error(`[ServicesController.updateService] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
        next(error);
    }
};

// Update base price (Admin only)
const updateBasePrice = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { basePrice } = req.body;

        const service = await Service.updateBasePrice(req.adminID, id, basePrice);

        cache.delByPrefix('services_');
        cache.delByPrefix('service_');

        res.json({
            success: true,
            message: 'Base price updated successfully',
            data: service
        });
    } catch (error) {
        global.logger.error(`[ServicesController.updateBasePrice] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
        next(error);
    }
};

// Delete service (Admin only - soft delete)
const deleteService = async (req, res, next) => {
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

        cache.delByPrefix('services_');
        cache.delByPrefix('service_');

        res.json({
            success: true,
            message: 'Service deactivated successfully'
        });
    } catch (error) {
        global.logger.error(`[ServicesController.deleteService] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
        next(error);
    }
};

// Get all services (Admin view)
const getAllServices = async (req, res, next) => {
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
        global.logger.error(`[ServicesController.getAllServices] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
        next(error);
    }
};

// Get service by ID (Admin view)
const getServiceById = async (req, res, next) => {
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
        global.logger.error(`[ServicesController.getServiceById] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
        next(error);
    }
};

/**
 * PROVIDER CONTROLLERS
 */

// Get services for provider
const getServicesForProvider = async (req, res, next) => {
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
            .select('title category description images basePrice duration feedback averageRating serviceType warranty tags faqs shortDescription isFeatured prerequisites discountPrice specialNotes serviceIncludes serviceExcludes serviceGuarantees materialsUsed')
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
        global.logger.error(`[ServicesController.getServicesForProvider] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
        next(error);
    }
};

// Get service details for provider
const getServiceDetailsForProvider = async (req, res, next) => {
    try {
        const { id } = req.params;

        const service = await Service.findById(id)
            .select('title category description images basePrice duration durationFormatted feedback averageRating serviceType warranty tags faqs shortDescription isFeatured prerequisites discountPrice specialNotes serviceIncludes serviceExcludes serviceGuarantees materialsUsed')
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
        global.logger.error(`[ServicesController.getServiceDetailsForProvider] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
        next(error);
    }
};

/**
 * PUBLIC CONTROLLERS
 */

// Get all active services (public)
const getActiveServices = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, search, category } = req.query;
        const skip = (page - 1) * limit;

        const cacheKey = `services_active_${page}_${limit}_${search || ''}_${category || ''}`;
        const cachedResult = cache.get(cacheKey);
        if (cachedResult) {
            return res.json(cachedResult);
        }

        let query = { isActive: true };

        if (search) {
            query.$text = { $search: search };
        }

        if (category) {
            query.category = category;
        }

        // First get the services without virtuals to avoid issues
        const services = await Service.find(query)
            .select('title category description images basePrice duration feedback averageRating ratingCount serviceType warranty tags faqs shortDescription isFeatured prerequisites discountPrice specialNotes serviceIncludes serviceExcludes serviceGuarantees materialsUsed')
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

        const resultResponse = {
            success: true,
            count: enhancedServices.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            data: enhancedServices
        };

        cache.set(cacheKey, resultResponse, 300);

        res.json(resultResponse);
    } catch (error) {
        global.logger.error(`[ServicesController.getActiveServices] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
        next(error);
    }
};

// Get service by ID (public)
const getPublicServiceById = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Validate ID format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid service ID format'
            });
        }

        const cacheKey = `service_${id}`;
        const cachedResult = cache.get(cacheKey);
        if (cachedResult) {
            return res.json(cachedResult);
        }

        // First get the service with basic info
        const service = await Service.findById(id)
            .select('title category description images basePrice duration isActive averageRating ratingCount specialNotes serviceIncludes serviceExcludes serviceGuarantees materialsUsed serviceType warranty tags faqs shortDescription isFeatured prerequisites discountPrice')
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

        const resultResponse = {
            success: true,
            data: responseData
        };

        cache.set(cacheKey, resultResponse, 300);

        res.json(resultResponse);
    } catch (error) {
        global.logger.error(`[ServicesController.getPublicServiceById] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
        next(error);
    }
};

// Get services by category (public)
const getServicesByCategory = async (req, res, next) => {
    try {
        const { category } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        const cacheKey = `services_cat_${category}_${page}_${limit}`;
        const cachedResult = cache.get(cacheKey);
        if (cachedResult) {
            return res.json(cachedResult);
        }

        const services = await Service.findActiveByCategory(category)
            .select('title category description images basePrice duration durationFormatted averageRating')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const total = await Service.countDocuments({ category, isActive: true });

        const resultResponse = {
            success: true,
            count: services.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            data: services
        };

        cache.set(cacheKey, resultResponse, 300);

        res.json(resultResponse);
    } catch (error) {
        global.logger.error(`[ServicesController.getServicesByCategory] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
        next(error);
    }
};

// Bulk import services from Excel (Admin only)
const bulkImportServices = async (req, res, next) => {
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
        const categoryMap = new Map();
        allCategories.forEach(c => {
            categoryMap.set(c.name.toLowerCase(), c);
            categoryMap.set(c._id.toString(), c);
        });

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
                const serviceIncludes = row.getCell(6).value?.toString().split(',').flatMap(s => { const t = s.trim(); return t ? [t] : []; }) || [];
                const serviceExcludes = row.getCell(7).value?.toString().split(',').flatMap(s => { const t = s.trim(); return t ? [t] : []; }) || [];
                const serviceGuarantees = row.getCell(8).value?.toString().split(',').flatMap(s => { const t = s.trim(); return t ? [t] : []; }) || [];
                const prerequisites = row.getCell(9).value?.toString().split(',').flatMap(s => { const t = s.trim(); return t ? [t] : []; }) || [];
                const materialsUsed = row.getCell(10).value?.toString().split(',').flatMap(s => { const t = s.trim(); return t ? [t] : []; }) || [];

                // Basic validation
                if (!title || !categoryName || isNaN(basePrice) || isNaN(duration)) {
                    throw new Error(`Missing or invalid required fields (Title, Category, Price, Duration)`);
                }

                // Match category
                const categoryDoc = categoryMap.get(categoryName.toLowerCase()) || categoryMap.get(categoryName);

                if (!categoryDoc) {
                    throw new Error(`Category "${categoryName}" not found in system`);
                }

                const serviceData = {
                    title,
                    category: categoryDoc._id,
                    description: description || 'No description provided',
                    basePrice,
                    duration,
                    specialNotes: serviceIncludes,
                    serviceIncludes,
                    serviceExcludes,
                    serviceGuarantees,
                    prerequisites,
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

        cache.delByPrefix('services_');
        cache.delByPrefix('service_');

        return res.json({
            success: true,
            message: `Import completed: ${successCount} success, ${errors.length} failed`,
            importedCount: successCount,
            errorCount: errors.length,
            errors,
            data: importedServices
        });

    } catch (error) {
        global.logger.error(`[ServicesController.bulkImportServices] Route: ${req.originalUrl || req.url} - Bulk import error: ${error.message}`, error);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        next(error);
    }
};

// Download Service Import Template
const downloadServiceTemplate = async (req, res, next) => {
    try {
        const workbook = new excelJS.Workbook();
        const worksheet = workbook.addWorksheet('Service Template');

        // Headers
        worksheet.columns = [
            { header: 'Service Title*', key: 'title', width: 30 },
            { header: 'Category Name*', key: 'category', width: 25 },
            { header: 'Description*', key: 'description', width: 50 },
            { header: 'Base Price (INR)*', key: 'basePrice', width: 15 },
            { header: 'Duration (Hours)*', key: 'duration', width: 15 },
            { header: 'Service Includes (Comma Separated)', key: 'serviceIncludes', width: 35 },
            { header: 'Service Excludes (Comma Separated)', key: 'serviceExcludes', width: 35 },
            { header: 'Service Guarantees (Comma Separated)', key: 'serviceGuarantees', width: 35 },
            { header: 'Prerequisites (Comma Separated)', key: 'prerequisites', width: 35 },
            { header: 'Materials Used (Comma Separated)', key: 'materialsUsed', width: 30 }
        ];

        // Fetch active categories
        const categories = await Category.find({ isActive: true }).select('name');
        const categoryNames = categories.map(c => c.name);

        // Add a hidden sheet for categories to use as a source for data validation
        const catSheet = workbook.addWorksheet('CategoriesData', { state: 'hidden' });
        categoryNames.forEach((name, index) => {
            catSheet.getCell(index + 1, 1).value = name;
        });

        // Add sample row
        worksheet.addRow({
            title: 'Example Service',
            category: categoryNames[0] || 'Electrical',
            description: 'Provide a detailed description of the service here.',
            basePrice: 500,
            duration: 1.5,
            serviceIncludes: 'Inspection, Basic fitting',
            serviceExcludes: 'Spare parts cost, Civil work',
            serviceGuarantees: 'On-time arrival, 30-day workmanship support',
            prerequisites: 'Accessible power supply, Clear work area',
            materialsUsed: 'Wire, Tape'
        });

        // Apply Data Validation (Dropdown) for Category Name column (Column B)
        // We apply it to rows 2 to 1000
        const categoryListRange = `'CategoriesData'!$A$1:$A$${categoryNames.length || 1}`;
        for (let i = 2; i <= 1000; i++) {
            worksheet.getCell(`B${i}`).dataValidation = {
                type: 'list',
                allowBlank: false,
                formulae: [categoryListRange],
                showErrorMessage: true,
                errorStyle: 'stop',
                errorTitle: 'Invalid Category',
                error: 'Please select a category from the dropdown list.'
            };
        }

        // Add instructions sheet
        const infoSheet = workbook.addWorksheet('Instructions');
        infoSheet.columns = [
            { header: 'Instruction', key: 'inst', width: 80 }
        ];
        infoSheet.addRow({ inst: '1. Fields marked with * are required.' });
        infoSheet.addRow({ inst: `2. Category Name MUST be selected from the dropdown in Column B.` });
        infoSheet.addRow({ inst: '3. Duration should be in decimal hours (e.g., 1.5 for 1 hour 30 mins).' });
        infoSheet.addRow({ inst: '4. Base Price should be a number without currency symbols.' });
        infoSheet.addRow({ inst: '5. Service Includes, Service Excludes, Service Guarantees, Prerequisites, and Materials Used should be comma-separated.' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=service_import_template.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        global.logger.error(`[ServicesController.downloadServiceTemplate] Route: ${req.originalUrl || req.url} - Error generating template: ${error.message}`, error);
        next(error);
    }
};

// Export services to Excel (Admin only) - Including Images
const exportServicesToExcel = async (req, res, next) => {
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
            { header: 'Service Includes', key: 'serviceIncludes', width: 35 },
            { header: 'Service Excludes', key: 'serviceExcludes', width: 35 },
            { header: 'Service Guarantees', key: 'serviceGuarantees', width: 35 },
            { header: 'Prerequisites', key: 'prerequisites', width: 35 },
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
                serviceIncludes: (service.serviceIncludes || service.specialNotes || []).join(', '),
                serviceExcludes: service.serviceExcludes ? service.serviceExcludes.join(', ') : '',
                serviceGuarantees: service.serviceGuarantees ? service.serviceGuarantees.join(', ') : '',
                prerequisites: service.prerequisites ? service.prerequisites.join(', ') : '',
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
        global.logger.error(`[ServicesController.exportServicesToExcel] Route: ${req.originalUrl || req.url} - Error exporting services: ${error.message}`, error);
        next(error);
    }
};

// Bulk disable discounts (Admin only)
const disableDiscounts = async (req, res, next) => {
    try {
        const { scope, categoryId } = req.body;

        if (!scope || !['all', 'category'].includes(scope)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid scope. Must be "all" or "category"'
            });
        }

        let query = { createdBy: req.adminID };

        if (scope === 'category') {
            if (!categoryId) {
                return res.status(400).json({
                    success: false,
                    message: 'Category ID is required for category scope'
                });
            }
            query.category = categoryId;
        }

        const result = await Service.updateMany(query, { $unset: { discountPrice: "" } });

        res.json({
            success: true,
            message: `Discounts successfully deactivated for ${result.modifiedCount} services.`,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        global.logger.error(`[ServicesController.disableDiscounts] Route: ${req.originalUrl || req.url} - Error disabling discounts: ${error.message}`, error);
        next(error);
    }
};


module.exports = {
    // Admin controllers
    disableDiscounts,
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
