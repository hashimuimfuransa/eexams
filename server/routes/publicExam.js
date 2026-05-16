const express = require('express');
const router = express.Router();

// Public exam routes are now handled by /api/share for link-based sharing
// Marketplace functionality has been moved to /api/marketplace
// This file is kept for backward compatibility but routes are deprecated

// Deprecated: Use /api/marketplace/exams instead
router.get('/exams', (req, res) => {
  res.status(301).json({ 
    message: 'This endpoint has been moved to /api/marketplace/exams',
    newEndpoint: '/api/marketplace/exams'
  });
});

// Deprecated: Use /api/marketplace/exams/:id instead
router.get('/exams/:id', (req, res) => {
  res.status(301).json({ 
    message: 'This endpoint has been moved to /api/marketplace/exams/:id',
    newEndpoint: `/api/marketplace/exams/${req.params.id}`
  });
});

// Deprecated: Use /api/marketplace/exams/:id/request instead
router.post('/exams/:id/request', (req, res) => {
  res.status(301).json({ 
    message: 'This endpoint has been moved to /api/marketplace/exams/:id/request',
    newEndpoint: `/api/marketplace/exams/${req.params.id}/request`
  });
});

module.exports = router;
