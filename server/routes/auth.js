const express = require('express');
const router = express.Router();
const { register, login, getProfile, updateProfile, changePassword, verifyToken, googleAuth, forgotPassword, resetPassword, verifyResetToken, checkEmail, checkPhone, selectLevel } = require('../controllers/authController');
const auth = require('../middleware/auth');
const { validateLogin, validateRegister } = require('../middleware/validation');
const { authLimiter } = require('../middleware/rateLimiter');

// @route   POST /api/auth/check-email
// @desc    Check if email exists
// @access  Public
router.post('/check-email', checkEmail);

// @route   POST /api/auth/check-phone
// @desc    Check if phone exists
// @access  Public
router.post('/check-phone', checkPhone);

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', authLimiter, validateRegister, register);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', authLimiter, validateLogin, login);

// @route   POST /api/auth/google
// @desc    Google OAuth login/register
// @access  Public
router.post('/google', authLimiter, googleAuth);

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', authLimiter, forgotPassword);

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', authLimiter, resetPassword);

// @route   GET /api/auth/verify-reset-token
// @desc    Verify reset token validity
// @access  Public
router.get('/verify-reset-token', verifyResetToken);

// @route   GET /api/auth/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', auth, getProfile);

// @route   PUT /api/auth/profile
// @desc    Update user profile (complete registration)
// @access  Private
router.put('/profile', auth, updateProfile);

// @route   PUT /api/auth/change-password
// @desc    Change password
// @access  Private
router.put('/change-password', auth, changePassword);

// @route   GET /api/auth/verify
// @desc    Verify token
// @access  Private
router.get('/verify', auth, verifyToken);

// @route   POST /api/auth/select-level
// @desc    Select learning level (for first-time students)
// @access  Private
router.post('/select-level', auth, selectLevel);

module.exports = router;
