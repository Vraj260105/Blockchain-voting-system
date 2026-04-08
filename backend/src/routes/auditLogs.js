const express = require('express');
const AuditService = require('../services/auditService');
const { authenticateToken } = require('../middleware/auth');
const { User } = require('../models');
const router = express.Router();

/**
 * Middleware to check if user is admin
 */
const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.userId);
    if (!user || (user.role !== 'super_admin' && user.role !== 'election_admin')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }
    req.adminUser = user;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to verify admin privileges'
    });
  }
};

/**
 * GET /api/audit-logs
 * Get audit logs with filters (Admin only)
 */
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      userId,
      action,
      entityType,
      entityId,
      startDate,
      endDate,
      limit = 50,
      offset = 0
    } = req.query;

    const filters = {};
    if (userId) filters.userId = parseInt(userId);
    if (action) filters.action = action;
    if (entityType) filters.entityType = entityType;
    if (entityId) filters.entityId = parseInt(entityId);
    if (startDate && endDate) {
      filters.startDate = new Date(startDate);
      filters.endDate = new Date(endDate);
    }

    const logs = await AuditService.getLogs(
      filters,
      parseInt(limit),
      parseInt(offset)
    );

    // Log admin viewing audit logs
    await AuditService.logAdminAction(
      'ADMIN_VIEW_AUDIT_LOGS',
      req.user.userId,
      'audit_log',
      null,
      req,
      { filters, limit, offset }
    );

    res.json({
      success: true,
      data: {
        logs,
        filters,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      }
    });
  } catch (error) {
    console.error('Failed to fetch audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit logs'
    });
  }
});

/**
 * GET /api/audit-logs/statistics
 * Get audit log statistics (Admin only)
 */
router.get('/statistics', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const statistics = await AuditService.getStatistics(start, end);

    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Failed to fetch audit statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit statistics'
    });
  }
});

/**
 * GET /api/audit-logs/user/:userId
 * Get audit logs for a specific user (Admin only, or own logs for regular users)
 */
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const requestedUserId = parseInt(req.params.userId);
    const currentUser = await User.findByPk(req.user.userId);

    // Check if user has permission to view these logs
    const isAdmin = currentUser.role === 'super_admin' || currentUser.role === 'election_admin';
    const isOwnLogs = requestedUserId === req.user.userId;

    if (!isAdmin && !isOwnLogs) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own logs.'
      });
    }

    const { limit = 50, offset = 0 } = req.query;

    const logs = await AuditService.getLogs(
      { userId: requestedUserId },
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      success: true,
      data: {
        logs,
        userId: requestedUserId,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      }
    });
  } catch (error) {
    console.error('Failed to fetch user audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user audit logs'
    });
  }
});

/**
 * GET /api/audit-logs/my-activity
 * Get current user's activity logs
 */
router.get('/my-activity', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const logs = await AuditService.getLogs(
      { userId: req.user.userId },
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      }
    });
  } catch (error) {
    console.error('Failed to fetch activity logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity logs'
    });
  }
});

module.exports = router;
