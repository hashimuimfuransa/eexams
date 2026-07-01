const express = require('express');
const router = express.Router();
const {
  getLevels,
  getLevelById,
  createLevel,
  updateLevel,
  deleteLevel,
  updateLevelStatus,
  addSubLevel,
  updateSubLevel,
  deleteSubLevel
} = require('../controllers/levelController');
const auth = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/role');

// Apply auth middleware to all routes
router.use(auth);

// Public routes (for level selection)
router.get('/', getLevels);
router.get('/:id', getLevelById);

// Super Admin only routes
router.post('/', isSuperAdmin, createLevel);
router.put('/:id', isSuperAdmin, updateLevel);
router.delete('/:id', isSuperAdmin, deleteLevel);
router.patch('/:id/status', isSuperAdmin, updateLevelStatus);
router.post('/:id/sublevels', isSuperAdmin, addSubLevel);
router.put('/:id/sublevels/:subLevelId', isSuperAdmin, updateSubLevel);
router.delete('/:id/sublevels/:subLevelId', isSuperAdmin, deleteSubLevel);

module.exports = router;
