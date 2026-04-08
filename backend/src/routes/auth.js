const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User, OTP, UserSession } = require('../models');
const emailService = require('../services/emailService');
const { authenticateToken } = require('../middleware/auth');
const AuditService = require('../services/auditService');
const router = express.Router();

// Generate JWT tokens
const generateTokens = (userId) => {
  const payload = { userId };
  const refreshExpirySeconds = 7 * 24 * 60 * 60; // 7 days
  
  const accessToken = jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  );
  
  const refreshToken = jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  const expiresAt = new Date(Date.now() + refreshExpirySeconds * 1000);
  return { accessToken, refreshToken, expiresAt };
};

/** Helper: create a UserSession row on successful login */
async function createSession(userId, refreshToken, expiresAt, req) {
  try {
    const sessionId = crypto.randomBytes(32).toString('hex');
    await UserSession.create({
      sessionId,
      userId,
      refreshToken,
      isActive: true,
      deviceInfo: {
        userAgent: req.headers['user-agent'] || null,
      },
      ipAddress: req.ip || req.headers['x-forwarded-for']?.split(',')[0] || null,
      userAgent: req.headers['user-agent'] || null,
      expiresAt,
      loginAt: new Date(),
      lastActivityAt: new Date(),
    });
    return sessionId;
  } catch (err) {
    console.error('Failed to create user session:', err.message);
    return null;
  }
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, walletAddress } = req.body;
    
    // Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, first name, and last name are required'
      });
    }
    
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }
    
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }
    
    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }
    
    // Create user (not verified yet)
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      walletAddress,
      isVerified: false
    });
    
    // Log registration
    await AuditService.logRegistration(user.id, { email, firstName, lastName, role: user.role }, req);
    
    // Generate and send OTP
    const { code } = await OTP.createOTP(email, 'registration');
    const emailResult = await emailService.sendOTP(email, code, 'registration');
    
    if (!emailResult.success) {
      console.warn('Failed to send OTP email, but user was created');
    }
    
    res.status(201).json({
      success: true,
      message: 'Registration initiated. Please check your email for verification code.',
      data: {
        maskedEmail: emailService.maskEmail(email),
        preview: emailResult.preview // Only in development
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
});

// POST /api/auth/verify-email
router.post('/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;
    
    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email and verification code are required'
      });
    }
    
    // Verify OTP
    const otpResult = await OTP.verifyOTP(email, code, 'registration');
    if (!otpResult.valid) {
      return res.status(400).json({
        success: false,
        message: otpResult.message
      });
    }
    
    // Find and verify user
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Mark user as verified
    await user.update({ isVerified: true });
    
    // Log OTP verification
    await AuditService.logOTPVerification(user.id, 'registration', true, req);
    
    // Generate tokens
    const tokens = generateTokens(user.id);
    
    res.json({
      success: true,
      message: 'Email verified successfully',
      data: {
        user: user.toPrivateJSON(),
        tokens
      }
    });
    
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Email verification failed'
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }
    
    // Find user
    const user = await User.findActiveByEmail(email);
    if (!user) {
      // ✅ Log failed login for unknown/inactive email (brute-force visibility)
      await AuditService.logLogin(null, false, req, 'User not found');
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Check password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      // Log failed login attempt
      await AuditService.logLogin(user.id, false, req, 'Invalid password');
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email address before logging in'
      });
    }
    
    // Generate and send login OTP
    const { code } = await OTP.createOTP(email, 'login');
    const emailResult = await emailService.sendOTP(email, code, 'login');
    
    if (!emailResult.success) {
      console.warn('Failed to send login OTP email');
    }
    
    res.json({
      success: true,
      message: 'Login OTP sent to your email',
      data: {
        maskedEmail: emailService.maskEmail(email),
        preview: emailResult.preview // Only in development
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

// POST /api/auth/verify-login
router.post('/verify-login', async (req, res) => {
  try {
    const { email, code } = req.body;
    
    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email and verification code are required'
      });
    }
    
    // Verify OTP
    const otpResult = await OTP.verifyOTP(email, code, 'login');
    if (!otpResult.valid) {
      return res.status(400).json({
        success: false,
        message: otpResult.message
      });
    }
    
    // Find user
    const user = await User.findActiveByEmail(email);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Update last login
    await user.update({ lastLogin: new Date() });
    
    // Log successful login
    await AuditService.logLogin(user.id, true, req);
    await AuditService.logOTPVerification(user.id, 'login', true, req);
    
    // Generate tokens
    const tokens = generateTokens(user.id);

    // Create session record for refresh token validation
    await createSession(user.id, tokens.refreshToken, tokens.expiresAt, req);
    
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toPrivateJSON(),
        tokens
      }
    });
    
  } catch (error) {
    console.error('Login verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Login verification failed'
    });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    // Check if user exists (don't reveal if user doesn't exist)
    const user = await User.findActiveByEmail(email);
    
    // Always return success to prevent email enumeration
    let otpSent = false;
    if (user) {
      // Generate and send password reset OTP
      const { code } = await OTP.createOTP(email, 'password_reset');
      const emailResult = await emailService.sendOTP(email, code, 'password_reset');
      otpSent = emailResult.success;
    }
    
    res.json({
      success: true,
      message: 'If an account with this email exists, a password reset code has been sent.',
      data: {
        maskedEmail: emailService.maskEmail(email)
      }
    });
    
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process password reset request'
    });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    
    if (!email || !code || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, code, and new password are required'
      });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }
    
    // Verify OTP
    const otpResult = await OTP.verifyOTP(email, code, 'password_reset');
    if (!otpResult.valid) {
      return res.status(400).json({
        success: false,
        message: otpResult.message
      });
    }
    
    // Find user
    const user = await User.findActiveByEmail(email);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Update password
    await user.update({ password: newPassword });
    
    // Log password change
    await AuditService.logPasswordChange(user.id, req);
    
    res.json({
      success: true,
      message: 'Password reset successful'
    });
    
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Password reset failed'
    });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    // Invalidate the session associated with this refresh token
    if (refreshToken) {
      await UserSession.update(
        { isActive: false, logoutAt: new Date(), logoutReason: 'USER_LOGOUT' },
        { where: { refreshToken, userId: req.user.userId, isActive: true } }
      );
    }

    // Log logout
    await AuditService.logLogout(req.user.userId, req);
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
    
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token is required'
      });
    }
    
    // Verify JWT signature first
    jwt.verify(refreshToken, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({
          success: false,
          message: 'Invalid or expired refresh token'
        });
      }

      // ── NEW: validate against user_sessions table ──────────────
      const session = await UserSession.findOne({
        where: { refreshToken, userId: decoded.userId, isActive: true }
      });
      if (!session) {
        return res.status(403).json({
          success: false,
          message: 'Session has been revoked or does not exist. Please log in again.'
        });
      }
      if (session.expiresAt && new Date() > session.expiresAt) {
        await session.update({ isActive: false, logoutReason: 'TOKEN_EXPIRED', logoutAt: new Date() });
        return res.status(403).json({
          success: false,
          message: 'Session expired. Please log in again.'
        });
      }
      // ────────────────────────────────────────────────────────────
      
      // Check if user still exists
      const user = await User.findByPk(decoded.userId);
      if (!user || user.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'User not found or inactive'
        });
      }
      
      // Generate new tokens and rotate refresh token in session
      const tokens = generateTokens(user.id);
      await session.update({
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        lastActivityAt: new Date(),
      });
      
      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: { tokens }
      });
    });
    
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh token'
    });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        user: user.toPrivateJSON()
      }
    });
    
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user information'
    });
  }
});

module.exports = router;