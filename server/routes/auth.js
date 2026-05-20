const express = require('express');
const router = express.Router();
const { register, login, getProfile, updateProfile, changePassword, verifyToken, googleAuth, forgotPassword, resetPassword, verifyResetToken } = require('../controllers/authController');
const auth = require('../middleware/auth');
const { validateLogin, validateRegister } = require('../middleware/validation');

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', validateRegister, register);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', validateLogin, login);

// @route   POST /api/auth/google
// @desc    Google OAuth login/register
// @access  Public
router.post('/google', googleAuth);

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', forgotPassword);

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', resetPassword);

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

module.exports = router;
