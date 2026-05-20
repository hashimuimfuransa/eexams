const express = require('express');
const router = express.Router();
const { sendContactEmail } = require('../utils/emailService');

/**
 * POST /api/contact
 * Submit contact form
 */
router.post('/', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, and message are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Send email using SendGrid
    const result = await sendContactEmail({
      name,
      email,
      subject: subject || 'Contact Form Submission',
      message
    });

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Contact form submitted successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to send contact email'
      });
    }
  } catch (error) {
    console.error('[Contact Route] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
