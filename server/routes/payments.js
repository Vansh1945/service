const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.post('/test-payment', paymentController.createTestOrder);
router.post('/verify-payment', paymentController.verifyTestPayment);

module.exports = router;