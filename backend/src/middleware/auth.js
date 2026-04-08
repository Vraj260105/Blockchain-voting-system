const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Middleware to authenticate JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user still exists and is active
    const user = await User.findOne({
      where: {
        id: decoded.userId,
        isActive: true
      }
    });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token - user not found'
      });
    }
    
    // Add user info to request
    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified
    };
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }
    
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

// Middleware to check if user is verified
const requireVerified = (req, res, next) => {
  if (!req.user?.isVerified) {
    return res.status(403).json({
      success: false,
      message: 'Email verification required'
    });
  }
  next();
};

// Middleware to check user role
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user?.role || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }
    next();
  };
};

// Middleware to check if user is admin
const requireAdmin = requireRole(['super_admin', 'election_admin']);

// Middleware to check if user is super admin
const requireSuperAdmin = requireRole(['super_admin']);

module.exports = {
  authenticateToken,
  requireVerified,
  requireRole,
  requireAdmin,
  requireSuperAdmin
};