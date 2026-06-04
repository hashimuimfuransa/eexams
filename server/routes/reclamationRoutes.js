const express = require('express');
const router = express.Router();
const {
  createReclamation,
  getReclamations,
  getReclamationById,
  respondToReclamation,
  getMyReclamations
} = require('../controllers/reclamationController');
const auth = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// Student routes
router.post('/', createReclamation);
router.get('/my-reclamations', getMyReclamations);

// Admin/Teacher/SuperAdmin routes
router.get('/', getReclamations);
router.get('/:id', getReclamationById);
router.put('/:id/respond', respondToReclamation);

module.exports = router;
