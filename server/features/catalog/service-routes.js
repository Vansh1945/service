const express = require('express');
const router = express.Router();
const serviceController = require('./service-controller');
const adminAuthMiddleware = require('../../shared/middlewares/admin-middleware');
const { providerAuthMiddleware, providerTestPassedMiddleware } = require('../../shared/middlewares/provider-middleware');
const { uploadServiceImage, uploadServicesFile, handleUploadErrors } = require('../../shared/middlewares/upload');
const { validateBody } = require('../../shared/validation/common-validation');
const {
    createServiceSchema,
    updateServiceSchema,
    updateBasePriceSchema
} = require('./service-validation');

/**
 * ADMIN ROUTES
 */
router.post('/admin/services',
    adminAuthMiddleware,
    uploadServiceImage.array('image', 3),
    handleUploadErrors,
    validateBody(createServiceSchema),
    serviceController.createService
);

router.put('/admin/service/:id',
    adminAuthMiddleware,
    uploadServiceImage.array('image', 3),
    handleUploadErrors,
    validateBody(updateServiceSchema),
    serviceController.updateService
);

router.patch('/admin/services/disable-discounts',
    adminAuthMiddleware,
    serviceController.disableDiscounts
);

router.patch('/admin/services/:id/price',
    adminAuthMiddleware,
    validateBody(updateBasePriceSchema),
    serviceController.updateBasePrice
);


router.delete('/admin/services/:id',
    adminAuthMiddleware,
    serviceController.deleteService
);

router.get('/admin/services',
    adminAuthMiddleware,
    serviceController.getAllServices
);

router.get('/admin/services/:id',
    adminAuthMiddleware,
    serviceController.getServiceById
);

router.post('/admin/bulk-import', 
    adminAuthMiddleware,
    uploadServicesFile.single('servicesFile'), 
    handleUploadErrors,
    serviceController.bulkImportServices
);

router.get('/admin/services-export',
    adminAuthMiddleware,
    serviceController.exportServicesToExcel
);

router.get('/admin/services-template',
    adminAuthMiddleware,
    serviceController.downloadServiceTemplate
);

/**
 * PROVIDER ROUTES
 */
router.get('/provider/services',
    providerAuthMiddleware,
    providerTestPassedMiddleware,
    serviceController.getServicesForProvider
);

router.get('/provider/services/:id',
    providerAuthMiddleware,
    providerTestPassedMiddleware,
    serviceController.getServiceDetailsForProvider
);

/**
 * PUBLIC ROUTES
 */
router.get('/services', serviceController.getActiveServices);
router.get('/services/:id', serviceController.getPublicServiceById);
router.get('/services/category/:category', serviceController.getServicesByCategory);

module.exports = router;