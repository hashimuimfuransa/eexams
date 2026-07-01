const express = require('express');
const router = express.Router();
const { processPaymentCallback } = require('../controllers/subscriptionController');

// iTechPay webhook — no auth, signature verified inside the controller
router.post('/itecpay/callback', processPaymentCallback);

module.exports = router;
