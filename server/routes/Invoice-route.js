const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/Invoice-controller');

const {
  providerAuthMiddleware,
  providerTestPassedMiddleware
} = require('../middlewares/Provider-middleware');
const { userAuthMiddleware } = require('../middlewares/User-middleware');

// Get invoice data for frontend
router.get('/frontend/:id',
  userAuthMiddleware,
  invoiceController.getInvoiceForFrontend
);

// Get single invoice (accessible by both users and providers)
router.get('/:id', 
  userAuthMiddleware,
  invoiceController.getInvoice
);

// Get customer's invoices
router.get('/user/my-invoices',
  userAuthMiddleware,
  invoiceController.getMyInvoices
);

// Get provider's invoices (with commission details)
router.get('/provider/my-invoices',
  providerAuthMiddleware,
  providerTestPassedMiddleware,
  invoiceController.getProviderInvoices
);

// Download invoice PDF (accessible by both users and providers)
router.get('/:id/download',
  userAuthMiddleware,
  invoiceController.downloadInvoice
);

module.exports = router;