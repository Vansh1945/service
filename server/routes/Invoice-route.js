const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/Invoice-controller');
const {
    providerAuthMiddleware,
    providerTestPassedMiddleware
} = require('../middlewares/Provider-middleware');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');
const {
    userAuthMiddleware
} = require('../middlewares/User-middleware');

// ======================
// USER ROUTES
// ======================
router.get('/customer/my-invoices',
    userAuthMiddleware,
    invoiceController.getMyInvoices);

router.get('/:id',
    userAuthMiddleware,
    invoiceController.getInvoice);

router.get('/:id/download',
    userAuthMiddleware,
    invoiceController.downloadInvoice);

// ======================
// PROVIDER ROUTES
// ======================
router.get('/provider/my-invoices',
    providerAuthMiddleware,
    providerTestPassedMiddleware,
    invoiceController.getProviderInvoices);

router.post('/',
    providerAuthMiddleware,
    providerTestPassedMiddleware,
    invoiceController.autoGenerateInvoice);

router.put('/:id',
    providerAuthMiddleware,
    providerTestPassedMiddleware,
    invoiceController.updateInvoice);

// ======================
// ADMIN ROUTES
// ======================
router.get('/',
    adminAuthMiddleware,
    invoiceController.getAllInvoices);

router.put('/admin/:id',
    adminAuthMiddleware,
    invoiceController.adminUpdateInvoice);

router.post('/admin/set-invoice-sequence',
    adminAuthMiddleware,
    invoiceController.setInvoiceSequence);

module.exports = router;