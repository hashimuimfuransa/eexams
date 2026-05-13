const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

// Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// @desc    Register new user (organization or individual teacher)
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, organization, phone, subscriptionPlan, accountType } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Determine account type (organization or individual)
    const isOrganization = accountType === 'organization';

    // Validate organization name for organization accounts
    if (isOrganization && (!organization || organization.trim() === '')) {
      return res.status(400).json({ message: 'Organization/school name is required' });
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
      // Individual teachers get the selected plan (or free by default)
      subscriptionStatus = 'active';
      // Different expiration based on plan type
      if (finalSubscriptionPlan === 'free') {
        subscriptionExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year for free plan
      } else {
        subscriptionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days for paid plans (renewal cycle)
      }
    }

    // Create user
    const userData = {
      email,
      password,
      firstName,
      lastName,
      phone,
      userType: isOrganization ? 'organization' : 'individual',
      role: isOrganization ? 'admin' : 'teacher',
      subscriptionPlan: finalSubscriptionPlan,
      subscriptionStatus,
      subscriptionExpiresAt
    };

    // Add organization only for organization accounts
    if (isOrganization) {
      userData.organization = organization.trim();
    }

    const user = await User.create(userData);

    if (user) {
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
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation is now handled by middleware for faster processing
    // Optimize database query - select only necessary fields for faster retrieval
    const user = await User.findOne({ email }).select('+password +isBlocked +lastLogin').lean(false);

    // Fast fail for non-existent users
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Fast fail for blocked users
    if (user.isBlocked) {
      return res.status(403).json({ message: 'Your account has been blocked. Please contact an administrator.' });
    }

    // Optimize password comparison - this is the main bottleneck
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token immediately after successful authentication
    const token = generateToken(user._id);

    // Prepare response data
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
    if (user.userType === 'organization') {
      responseData.organization = user.organization;
    }

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

    // Update subscription plan if provided
    if (subscriptionPlan) {
      user.subscriptionPlan = subscriptionPlan;

      // Set subscription status based on plan
      if (subscriptionPlan === 'free') {
        user.subscriptionStatus = 'active';
        user.subscriptionExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year for free
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
    // If the auth middleware passes, the token is valid
    // and req.user is set
    const user = await User.findById(req.user._id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      userType: user.userType,
      isVerified: true,
      subscriptionPlan: user.subscriptionPlan,
      subscriptionStatus: user.subscriptionStatus,
      organization: user.organization
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
    const { credential, accountType, subscriptionPlan, organization, phone } = req.body;

    if (!credential) {
      return res.status(400).json({ message: 'Google credential is required' });
    }

    // Verify Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

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
      if (!user.googleId) {
        user.googleId = googleId;
        user.isGoogleUser = true;
        if (picture) user.googleProfilePicture = picture;
        await user.save();
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
      // Individual teachers get free plan by default
      finalSubscriptionPlan = subscriptionPlan || 'free';
      subscriptionStatus = 'active';
      subscriptionExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    }

    // Create new user
    const userData = {
      email,
      googleId,
      firstName: firstName || email.split('@')[0],
      lastName: lastName || '',
      phone: phone || '',
      googleProfilePicture: picture || null,
      isGoogleUser: true,
      userType: isOrganization ? 'organization' : 'individual',
      role: isOrganization ? 'admin' : 'teacher',
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

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  verifyToken,
  googleAuth
};
