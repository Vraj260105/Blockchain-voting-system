/**
 * roleGuard.js
 * Middleware to enforce role-based access control on backend routes.
 * Reads req.user.role (set by authenticateToken) and rejects requests
 * from users without the required role(s).
 *
 * Usage:
 *   router.get('/admin/users', authenticateToken, requireRole('super_admin'), handler)
 *   router.post('/elections', authenticateToken, requireRole('super_admin', 'election_admin'), handler)
 */

const { User } = require('../models');

/**
 * Lightweight role check using the JWT payload (no DB hit).
 * Use this for simple route guards where you trust the token's role claim.
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role || 'none'}`
    });
  }
  next();
};

/**
 * Strict role check — re-validates role against the database.
 * Use this for sensitive operations where you must ensure the DB role
 * hasn't changed since the JWT was issued.
 */
const requireRoleStrict = (...roles) => async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const user = await User.findByPk(req.user.userId, { attributes: ['id', 'role', 'isActive'] });
    if (!user || user.isActive !== true) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }
    if (!roles.includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}`
      });
    }
    req.dbUser = user;
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to verify role' });
  }
};

/** Shorthand guards */
const requireSuperAdmin  = requireRoleStrict('super_admin');
const requireAdmin       = requireRoleStrict('super_admin', 'election_admin');

module.exports = { requireRole, requireRoleStrict, requireSuperAdmin, requireAdmin };
