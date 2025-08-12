const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/Invoice-controller');
const { providerAuthMiddleware, providerTestPassedMiddleware } = require('../middlewares/Provider-middleware');
const { userAuthMiddleware } = require('../middlewares/User-middleware');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');

// Admin routes
router.get('/admin/all', adminAuthMiddleware, invoiceController.getAllInvoicesForAdmin);
router.put('/:id', adminAuthMiddleware, invoiceController.updateInvoice);

// Provider routes
router.get('/provider/all', providerAuthMiddleware, providerTestPassedMiddleware, invoiceController.getInvoicesForProvider);
router.post('/:id/products', providerAuthMiddleware, providerTestPassedMiddleware, invoiceController.addProductToInvoice);
router.put('/:id/products/:productId', providerAuthMiddleware, providerTestPassedMiddleware, invoiceController.updateProductInInvoice);
router.delete('/:id/products/:productId', providerAuthMiddleware, providerTestPassedMiddleware, invoiceController.removeProductFromInvoice);
router.get('/provider/:id', providerAuthMiddleware, providerTestPassedMiddleware, invoiceController.getProviderInvoiceById);

// Customer routes
router.get('/customer/all', userAuthMiddleware, invoiceController.getInvoicesForCustomer);
router.get('/customer/:id', userAuthMiddleware, invoiceController.getCustomerInvoice);
router.get('/customer/:id/download', userAuthMiddleware, invoiceController.downloadCustomerInvoice);

module.exports = router;