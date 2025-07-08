const mongoose = require('mongoose');
const Service = require('../models/Service-model');
const Admin = require('../models/Admin-model');
const Provider = require('../models/Provider-model');

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
            if (key !== 'basePrice' && key !== 'providerPrices') {
                service[key] = updates[key];
            }
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
            .populate('createdBy', 'name email')
            .populate('providerPrices.provider', 'name profilePicUrl');

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

// Set provider's price for a service
const setProviderPrice = async (req, res) => {
    try {
        const { id } = req.params;
        const { price } = req.body;

        const service = await Service.findById(id);
        if (!service || !service.isActive) {
            return res.status(404).json({
                success: false,
                message: 'Service not found or inactive'
            });
        }

        await service.setProviderPrice(req.providerID, price);

        res.json({
            success: true,
            message: 'Price updated successfully',
            data: {
                basePrice: service.basePrice,
                yourPrice: price
            }
        });
    } catch (error) {
        console.error('Error setting provider price:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to set provider price'
        });
    }
};

// Get services with provider's specific pricing
const getServicesForProvider = async (req, res) => {
    try {
        const services = await Service.findForProvider(req.providerID);

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

// Get service details with provider's price
const getServiceDetailsForProvider = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Convert IDs to ObjectId once at the beginning
        const serviceId = new mongoose.Types.ObjectId(id);
        const providerId = new mongoose.Types.ObjectId(req.providerID);

        const [service] = await Service.aggregate([
            { 
                $match: { 
                    _id: serviceId, 
                    isActive: true 
                } 
            },
            {
                $addFields: {
                    providerPrice: {
                        $let: {
                            vars: {
                                pp: {
                                    $arrayElemAt: [
                                        {
                                            $filter: {
                                                input: "$providerPrices",
                                                cond: { 
                                                    $eq: ["$$this.provider", providerId] 
                                                }
                                            }
                                        },
                                        0
                                    ]
                                }
                            },
                            in: { $ifNull: ["$$pp.adjustedPrice", "$basePrice"] }
                        }
                    }
                }
            },
            {
                $project: {
                    title: 1,
                    category: 1,
                    description: 1,
                    image: 1,
                    basePrice: 1,
                    providerPrice: 1,
                    duration: 1,
                    durationFormatted: 1,
                    providerPrices: {
                        $filter: {
                            input: "$providerPrices",
                            as: "pp",
                            cond: { $eq: ["$$pp.provider", providerId] }
                        }
                    }
                }
            }
        ]);

        if (!service) {
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
            .select('title category description image basePrice duration durationFormatted isActive')
            .populate('providerPrices.provider', 'name profilePicUrl experience');

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

        // Format provider prices with names
        const providerPrices = service.providerPrices.map(pp => ({
            provider: pp.provider,
            price: pp.adjustedPrice,
            discount: pp.adjustedPrice ? 
                ((service.basePrice - pp.adjustedPrice) / service.basePrice * 100).toFixed(1) : 
                '0'
        }));

        res.json({
            success: true,
            data: {
                ...service.toObject(),
                providerPrices
            }
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

module.exports = {
    // Admin controllers
    createService,
    updateService,
    updateBasePrice,
    deleteService,
    getAllServices,
    getServiceById,

    // Provider controllers
    setProviderPrice,
    getServicesForProvider,
    getServiceDetailsForProvider,

    // Public controllers
    getActiveServices,
    getPublicServiceById,
    getServicesByCategory
};