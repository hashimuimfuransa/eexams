const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const sgMail = require('@sendgrid/mail');
const User = require('../models/User');
const emailService = require('../utils/emailService');
const cacheService = require('../utils/cacheService');
const { invalidateUserCache } = require('../middleware/auth');

// Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Initialize SendGrid with API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// @desc    Check if email exists
// @route   POST /api/auth/check-email
// @access  Public
const checkEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });
    res.json({ exists: !!user });
  } catch (error) {
    console.error('Check email error:', error);
    res.status(500).json({ message: 'Failed to check email' });
  }
};

// @desc    Check if phone exists
// @route   POST /api/auth/check-phone
// @access  Public
const checkPhone = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    const user = await User.findOne({ phone });
    res.json({ exists: !!user });
  } catch (error) {
    console.error('Check phone error:', error);
    res.status(500).json({ message: 'Failed to check phone' });
  }
};

// @desc    Register new user (organization, individual teacher, or student)
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, organization, phone, subscriptionPlan, accountType, role } = req.body;

    console.log('[Register] Request body:', { email, phone, firstName, lastName, role, accountType });

    // Validate that at least one of email or phone is provided
    if ((!email || !email.trim()) && (!phone || !phone.trim())) {
      console.log('[Register] Validation failed: Neither email nor phone provided');
      return res.status(400).json({ message: 'Either email or phone number is required' });
    }

    // Build query for existing user check - only include fields that are provided
    const orConditions = [];
    if (email && email.trim()) {
      orConditions.push({ email: email.trim() });
    }
    if (phone && phone.trim()) {
      orConditions.push({ phone: phone.trim() });
    }

    console.log('[Register] Checking for existing user with conditions:', orConditions);

    // Check if user already exists (by email or phone)
    const userExists = orConditions.length > 0 ? await User.findOne({ $or: orConditions }) : null;

    console.log('[Register] Existing user found:', userExists ? userExists._id : null);

    if (userExists) {
      if (userExists.email === email) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }
      if (userExists.phone === phone) {
        return res.status(400).json({ message: 'User with this phone number already exists' });
      }
      return res.status(400).json({ message: 'User already exists' });
    }

    // Determine account type (organization or individual)
    const isOrganization = accountType === 'organization';

    // Validate organization name for organization accounts
    if (isOrganization && (!organization || organization.trim() === '')) {
      return res.status(400).json({ message: 'Organization/school name is required' });
    }

    // Determine role: respect client-provided role for students, otherwise use account type
    let finalRole = role;
    if (!finalRole) {
      finalRole = isOrganization ? 'admin' : 'teacher';
    }

    // Set subscription details based on plan
    let subscriptionStatus = null;
    let subscriptionExpiresAt = null;
    let finalSubscriptionPlan = subscriptionPlan || 'free';

    if (isOrganization) {
      // Validate subscription plan for organizations
      if (!subscriptionPlan) {
        return res.status(400).json({ message: 'Subscription plan is required for organization accounts' });
      }

      subscriptionStatus = 'pending';

      // Free plan is auto-activated
      if (subscriptionPlan === 'free') {
        subscriptionStatus = 'active';
        subscriptionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days free trial
      }
    } else {
      // Individual accounts (teacher or student): free plan is auto-active
      if (finalSubscriptionPlan === 'free') {
        subscriptionStatus = 'active';
        // Students get 365 days, teachers get 14 days
        if (finalRole === 'student') {
          subscriptionExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 365 days for students
        } else {
          subscriptionExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days for teachers
        }
      } else {
        subscriptionStatus = 'pending'; // paid plan needs admin approval
        subscriptionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }
    }

    // Create user - only include email/phone if they are provided and not empty
    const userData = {
      password,
      firstName,
      lastName,
      userType: isOrganization ? 'organization' : 'individual',
      role: finalRole,
      subscriptionPlan: finalSubscriptionPlan,
      subscriptionStatus,
      subscriptionExpiresAt
    };

    // Only add email if provided and not empty
    if (email && email.trim()) {
      userData.email = email.trim();
    }

    // Only add phone if provided and not empty
    if (phone && phone.trim()) {
      userData.phone = phone.trim();
    }

    // Add organization only for organization accounts
    if (isOrganization) {
      userData.organization = organization.trim();
    }

    console.log('[Register] Creating user with data:', { ...userData, password: '***' });

    const user = await User.create(userData);

    console.log('[Register] User created successfully:', user._id);

    if (user) {
      // Send welcome email
      emailService.sendWelcomeEmail(user).catch(err => {
        console.error('[Auth] Failed to send welcome email:', err);
      });

      // Send pending approval email for organization accounts or paid plans
      if (isOrganization || (subscriptionPlan && subscriptionPlan !== 'free')) {
        emailService.sendPendingApprovalEmail(user, accountType).catch(err => {
          console.error('[Auth] Failed to send pending approval email:', err);
        });
      }

      // Generate token
      const token = generateToken(user._id);

      const responseData = {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        userType: user.userType,
        token,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionStatus: user.subscriptionStatus
      };

      // Include organization info for organization accounts
      if (isOrganization) {
        responseData.organization = user.organization;
      }

      res.status(201).json(responseData);
    } else {
      res.status(500).json({ message: 'Failed to create user' });
    }
  } catch (error) {
    console.error('[Register] Error during registration:', error);
    console.error('[Register] Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
      errors: error.errors
    });
    return res.status(400).json({ message: error.message || 'Registration failed' });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password, phone } = req.body;

    console.log('[Login] Attempt with:', { email, phone, hasPassword: !!password });

    // Validation is now handled by middleware for faster processing
    // Optimize database query - select only necessary fields for faster retrieval
    // Search by email or phone
    const user = await User.findOne({
      $or: [{ email }, { phone }]
    }).select('+password +isBlocked +lastLogin').lean(false);

    console.log('[Login] User found:', user ? { _id: user._id, email: user.email, phone: user.phone } : null);

    // Fast fail for non-existent users
    if (!user) {
      return res.status(401).json({ message: 'No account found with this email or phone number' });
    }

    // Verify that the provided identifier actually matches the user
    if (email && user.email !== email.toLowerCase()) {
      console.log('[Login] Email mismatch:', { provided: email, found: user.email });
      return res.status(401).json({ message: 'No account found with this email' });
    }
    if (phone && user.phone !== phone.trim()) {
      console.log('[Login] Phone mismatch:', { provided: phone, found: user.phone });
      return res.status(401).json({ message: 'No account found with this phone number' });
    }

    // Fast fail for blocked users
    if (user.isBlocked) {
      return res.status(403).json({ message: 'Your account has been blocked. Please contact an administrator.' });
    }

    // Optimize password comparison - this is the main bottleneck
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    // Generate token immediately after successful authentication
    const token = generateToken(user._id);

    // For org teachers: resolve effective plan/status from their parent admin
    let effectivePlan = user.subscriptionPlan || 'free';
    let effectiveStatus = user.subscriptionStatus || 'pending';
    let isOrgTeacher = false;
    if (user.role === 'teacher' && user.parentAdmin) {
      const admin = await User.findById(user.parentAdmin).select('subscriptionPlan subscriptionStatus').lean();
      if (admin) {
        effectivePlan = admin.subscriptionPlan || 'free';
        effectiveStatus = admin.subscriptionStatus || 'active';
        isOrgTeacher = true;
      }
    }

    // Prepare response data
    const responseData = {
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      userType: user.userType || (user.role === 'admin' ? 'organization' : 'individual'),
      token,
      subscriptionPlan: effectivePlan,
      subscriptionStatus: effectiveStatus,
      subscriptionStartDate: user.subscriptionStartDate,
      subscriptionEndDate: user.subscriptionEndDate,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      lastPaymentDate: user.lastPaymentDate,
      isOrgTeacher,
      organization: user.organization
    };

    // Send response immediately - don't wait for lastLogin update
    res.json(responseData);

    // Update last login time asynchronously (non-blocking)
    setImmediate(async () => {
      try {
        await User.findByIdAndUpdate(user._id, { lastLogin: Date.now() }, { lean: true });
      } catch (updateError) {
        console.error('Last login update error:', updateError);
        // Don't fail the login for this
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/profile
// @access  Private
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user._id);

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Invalidate user cache
    await invalidateUserCache(req.user._id);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update user profile (complete registration)
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { accountType, subscriptionPlan, organization, phone } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update account type if provided
    if (accountType) {
      user.userType = accountType;
      // Update role based on account type
      user.role = accountType === 'organization' ? 'admin' : 'teacher';
    }

    // Org teachers cannot change their own subscription plan
    if (subscriptionPlan && user.role === 'teacher' && user.parentAdmin) {
      return res.status(403).json({ message: 'Your subscription plan is managed by your organisation admin.' });
    }

    // Update subscription plan if provided
    if (subscriptionPlan) {
      user.subscriptionPlan = subscriptionPlan;

      // Set subscription status based on plan
      if (subscriptionPlan === 'free') {
        user.subscriptionStatus = 'active';
        // Students get 365 days, teachers get 14 days
        if (user.role === 'student') {
          user.subscriptionExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 365 days for students
        } else {
          user.subscriptionExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days for teachers
        }
      } else {
        // Paid plans require admin approval
        user.subscriptionStatus = 'pending';
        user.subscriptionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days trial
      }
    }

    // Update organization if provided (required for org accounts)
    if (organization !== undefined) {
      user.organization = organization;
    }

    // Update phone if provided
    if (phone !== undefined) {
      user.phone = phone;
    }

    await user.save();

    // Invalidate user cache
    await invalidateUserCache(req.user._id);

    // Return updated user data
    res.json({
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      userType: user.userType,
      subscriptionPlan: user.subscriptionPlan,
      subscriptionStatus: user.subscriptionStatus,
      organization: user.organization,
      phone: user.phone
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Verify token
// @route   GET /api/auth/verify
// @access  Private
const verifyToken = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // For org teachers, inherit plan and status from their parent admin
    let effectivePlan = user.subscriptionPlan;
    let effectiveStatus = user.subscriptionStatus;
    let isOrgTeacher = false;
    if (user.role === 'teacher' && user.parentAdmin) {
      const admin = await User.findById(user.parentAdmin).select('subscriptionPlan subscriptionStatus');
      if (admin) {
        effectivePlan = admin.subscriptionPlan;
        effectiveStatus = admin.subscriptionStatus;
        isOrgTeacher = true;
      }
    }

    res.json({
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      userType: user.userType || (user.role === 'admin' ? 'organization' : 'individual'),
      isVerified: true,
      subscriptionPlan: effectivePlan,
      subscriptionStatus: effectiveStatus,
      organization: user.organization,
      phone: user.phone,
      isOrgTeacher
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Google OAuth login/register
// @route   POST /api/auth/google
// @access  Public
const googleAuth = async (req, res) => {
  try {
    const { credential, accountType, subscriptionPlan, organization, phone, role } = req.body;

    if (!credential) {
      return res.status(400).json({ message: 'Google credential is required' });
    }

    // Check if Google Client ID is configured
    if (!process.env.GOOGLE_CLIENT_ID) {
      console.error('[GoogleAuth] GOOGLE_CLIENT_ID environment variable is not set');
      return res.status(500).json({ message: 'Google authentication is not properly configured on the server' });
    }

    // Verify Google ID token
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID
      });
    } catch (verifyError) {
      console.error('[GoogleAuth] Token verification failed:', verifyError.message);
      // Check for common error cases
      if (verifyError.message?.includes('audience')) {
        return res.status(400).json({ message: 'Invalid Google Client ID configuration. Please contact support.' });
      }
      if (verifyError.message?.includes('expired')) {
        return res.status(400).json({ message: 'Google session expired. Please try again.' });
      }
      return res.status(400).json({ message: 'Failed to verify Google account. Please try again.' });
    }

    const payload = ticket.getPayload();
    const { sub: googleId, email, given_name: firstName, family_name: lastName, picture } = payload;

    if (!email) {
      return res.status(400).json({ message: 'Email is required from Google account' });
    }

    // Check if user already exists (by email or googleId)
    let user = await User.findOne({
      $or: [{ email }, { googleId }]
    });

    if (user) {
      // Existing user - update Google info if needed
      let needsSave = false;
      if (!user.googleId) {
        user.googleId = googleId;
        user.isGoogleUser = true;
        if (picture) user.googleProfilePicture = picture;
        needsSave = true;
      }

      // Apply registration data ONLY for users who haven't completed registration yet
      // (i.e. they signed up with Google but haven't chosen account type/plan).
      // NEVER overwrite role/userType for a returning, fully-registered user.
      const isCompletingRegistration = !user.role || user.role === 'teacher' && !user.subscriptionPlan && !user.parentAdmin;
      if (accountType && isCompletingRegistration) {
        const isOrg = accountType === 'organization';
        user.userType = isOrg ? 'organization' : 'individual';
        user.role = isOrg ? 'admin' : (role || 'teacher');
        needsSave = true;
      }
      if (subscriptionPlan && isCompletingRegistration) {
        user.subscriptionPlan = subscriptionPlan;
        const isOrg = (accountType || user.userType) === 'organization';
        if (subscriptionPlan === 'free') {
          user.subscriptionStatus = 'active';
          // Students get 365 days, teachers get 14 days, orgs get 30 days
          if (user.role === 'student') {
            user.subscriptionExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 365 days for students
          } else if (isOrg) {
            user.subscriptionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days for orgs
          } else {
            user.subscriptionExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days for teachers
          }
        } else {
          user.subscriptionStatus = 'pending';
          user.subscriptionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        }
        needsSave = true;
      }
      if (organization && isCompletingRegistration && (accountType === 'organization' || user.userType === 'organization')) {
        user.organization = organization.trim();
        needsSave = true;
      }
      if (phone) {
        user.phone = phone;
        needsSave = true;
      }

      if (needsSave) await user.save();

      // Generate token
      const token = generateToken(user._id);

      const responseData = {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        userType: user.userType,
        isGoogleUser: true,
        token,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionStatus: user.subscriptionStatus
      };

      // Include organization info for organization accounts
      if (user.userType === 'organization') {
        responseData.organization = user.organization;
      }

      return res.json({ ...responseData, isNewUser: false });
    }

    // New user - create account
    const isOrganization = accountType === 'organization';

    // Validate organization name for organization accounts
    if (isOrganization && (!organization || organization.trim() === '')) {
      return res.status(400).json({ message: 'Organization/school name is required' });
    }

    // Set subscription details
    let subscriptionStatus = null;
    let subscriptionExpiresAt = null;
    let finalSubscriptionPlan = subscriptionPlan;

    if (isOrganization) {
      if (!subscriptionPlan) {
        return res.status(400).json({ message: 'Subscription plan is required for organization accounts' });
      }
      subscriptionStatus = 'pending';
      if (subscriptionPlan === 'free') {
        subscriptionStatus = 'active';
        subscriptionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }
    } else {
      // Individual accounts (teacher or student) get free plan by default
      finalSubscriptionPlan = subscriptionPlan || 'free';
      subscriptionStatus = 'active';
      // Students get 365 days, teachers get 14 days
      if (finalRole === 'student') {
        subscriptionExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 365 days for students
      } else {
        subscriptionExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days for teachers
      }
    }

    // Determine role: respect client-provided role for students, otherwise use account type
    let finalRole = role;
    if (!finalRole) {
      finalRole = isOrganization ? 'admin' : 'teacher';
    }

    // Create new user
    const userData = {
      email,
      googleId,
      firstName: firstName || email.split('@')[0],
      lastName: lastName || (email ? email.split('@')[0] : 'User'),
      phone: phone || '',
      googleProfilePicture: picture || null,
      isGoogleUser: true,
      userType: isOrganization ? 'organization' : 'individual',
      role: finalRole,
      subscriptionPlan: finalSubscriptionPlan,
      subscriptionStatus,
      subscriptionExpiresAt
    };

    // Add organization only for organization accounts
    if (isOrganization) {
      userData.organization = organization.trim();
    }

    user = await User.create(userData);

    // Generate token
    const token = generateToken(user._id);

    const responseData = {
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      userType: user.userType,
      isGoogleUser: true,
      token,
      subscriptionPlan: user.subscriptionPlan,
      subscriptionStatus: user.subscriptionStatus
    };

    // Include organization info for organization accounts
    if (isOrganization) {
      responseData.organization = user.organization;
    }

    res.status(201).json({ ...responseData, isNewUser: true });
  } catch (error) {
    console.error('Google authentication error:', error);
    res.status(500).json({ message: 'Google authentication failed', error: error.message });
  }
};

// @desc    Forgot password - send reset email
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Find user by email
    const user = await User.findOne({ email });

    // Don't reveal if user exists or not for security
    if (!user) {
      return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    }

    // Don't allow password reset for Google-only users
    if (user.isGoogleUser && !user.password) {
      return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Save hashed token and expiry to user
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour expiry
    await user.save();

    // Send email with SendGrid using emailService
    if (process.env.SENDGRID_API_KEY) {
      await emailService.sendPasswordResetEmail(user, resetToken);
      console.log(`[PasswordReset] Reset email sent to ${user.email}`);
    } else {
      console.log('[PasswordReset] SENDGRID_API_KEY not configured, email not sent');
      // For development, log the reset URL
      const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
      console.log(`[PasswordReset] Reset URL (dev): ${resetUrl}`);
    }

    res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Failed to send reset email. Please try again later.' });
  }
};

// @desc    Reset password with token
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    // Hash the token from request
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: resetTokenHash,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token. Please request a new password reset.' });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return res.status(400).json({ message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' });
    }

    // Update password and clear reset token fields
    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    // Send password reset confirmation email
    emailService.sendPasswordResetConfirmationEmail(user).catch(err => {
      console.error('[Auth] Failed to send password reset confirmation:', err);
    });

    console.log(`[PasswordReset] Password reset successful for ${user.email}`);

    res.json({ message: 'Password reset successful. You can now log in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Failed to reset password. Please try again.' });
  }
};

// @desc    Verify reset token validity
// @route   GET /api/auth/verify-reset-token
// @access  Public
const verifyResetToken = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    // Hash the token from request
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: resetTokenHash,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    res.json({ valid: true, email: user.email });
  } catch (error) {
    console.error('Verify reset token error:', error);
    res.status(500).json({ message: 'Failed to verify token' });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  verifyToken,
  googleAuth,
  forgotPassword,
  resetPassword,
  verifyResetToken,
  checkEmail,
  checkPhone
};
