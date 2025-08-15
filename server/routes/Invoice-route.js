const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/Invoice-controller');
const { 
  providerAuthMiddleware, 
  providerTestPassedMiddleware 
} = require('../middlewares/Provider-middleware');
const { userAuthMiddleware } = require('../middlewares/User-middleware');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');

// Admin Routes
router.get('/admin/all', adminAuthMiddleware, invoiceController.getAllInvoicesForAdmin);
router.put('/admin/:id', adminAuthMiddleware, invoiceController.updateInvoice);

// Provider Routes
router.get('/provider/all', providerAuthMiddleware, providerTestPassedMiddleware, invoiceController.getInvoicesForProvider);
router.get('/provider/:id', providerAuthMiddleware, providerTestPassedMiddleware, invoiceController.getProviderInvoiceById);

// Provider - Service Invoices
router.get('/provider/service', providerAuthMiddleware, providerTestPassedMiddleware, invoiceController.getServiceInvoicesForProvider);

// Provider - Product Invoices
router.post('/provider/product', providerAuthMiddleware, providerTestPassedMiddleware, invoiceController.createProductInvoice);
router.get('/provider/product', providerAuthMiddleware, providerTestPassedMiddleware, invoiceController.getProductInvoicesForProvider);
router.put('/provider/product/:id', providerAuthMiddleware, providerTestPassedMiddleware, invoiceController.updateProductInvoice);
router.delete('/provider/product/:id', providerAuthMiddleware, providerTestPassedMiddleware, invoiceController.deleteProductInvoice);
router.post('/provider/:id/confirm-cash', providerAuthMiddleware, providerTestPassedMiddleware, invoiceController.confirmCashPayment);

// Customer Routes
router.get('/customer/all', userAuthMiddleware, invoiceController.getInvoicesForCustomer);
router.get('/customer/service', userAuthMiddleware, invoiceController.getServiceInvoicesForCustomer);
router.get('/customer/product', userAuthMiddleware, invoiceController.getProductInvoicesForCustomer);
router.get('/customer/:id', userAuthMiddleware, invoiceController.getCustomerInvoice);
router.get('/customer/:id/download', userAuthMiddleware, invoiceController.downloadCustomerInvoice);
router.post('/customer/product/:id/pay', userAuthMiddleware, invoiceController.payProductInvoiceDirectly);

module.exports = router;