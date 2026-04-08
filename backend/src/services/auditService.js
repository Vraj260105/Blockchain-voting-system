const AuditLog = require('../models/AuditLog');
let ActivityLog;
// Lazy-load ActivityLog to avoid circular dependency issues at startup
function getActivityLog() {
  if (!ActivityLog) ActivityLog = require('../models/ActivityLog');
  return ActivityLog;
}

/**
 * Fire-and-forget write to ActivityLog (rich schema).
 * Failures are swallowed so they don't affect the primary AuditLog write.
 */
async function dualWrite(action, userId, resource, resourceId, status, severity, message, details = {}, extra = {}) {
  try {
    const AL = getActivityLog();
    await AL.create({
      userId: userId || null,
      action,
      resource: resource || null,
      resourceId: resourceId ? String(resourceId) : null,
      status: status || 'SUCCESS',
      severity: severity || 'LOW',
      message: message || null,
      details,
      ipAddress: extra.ipAddress || null,
      userAgent: extra.userAgent || null,
      walletAddress: extra.walletAddress || null,
      transactionHash: extra.transactionHash || null,
      sessionId: extra.sessionId || null,
    });
  } catch (_) {
    // Non-blocking — ActivityLog write failure must not crash the request
  }
}

class AuditService {
  /**
   * Extract IP address from request
   */
  static getIpAddress(req) {
    return req.ip || 
           req.headers['x-forwarded-for']?.split(',')[0] || 
           req.headers['x-real-ip'] || 
           req.connection?.remoteAddress || 
           null;
  }

  /**
   * Extract user agent from request
   */
  static getUserAgent(req) {
    return req.headers['user-agent'] || null;
  }

  /**
   * Get user ID from request (if authenticated)
   */
  static getUserId(req) {
    return req.user?.id || req.userId || null;
  }

  /**
   * Log authentication events
   */
  static async logAuth(action, userId, req, additionalData = {}) {
    return await AuditLog.log({
      userId,
      action,
      entityType: 'user',
      entityId: userId,
      newValues: additionalData,
      ipAddress: this.getIpAddress(req),
      userAgent: this.getUserAgent(req)
    });
  }

  /**
   * Log user registration
   */
  static async logRegistration(userId, userData, req) {
    return await AuditLog.log({
      userId,
      action: 'USER_REGISTER',
      entityType: 'user',
      entityId: userId,
      newValues: {
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role
      },
      ipAddress: this.getIpAddress(req),
      userAgent: this.getUserAgent(req)
    });
  }

  /**
   * Log login attempts
   */
  static async logLogin(userId, success, req, errorMessage = null) {
    return await AuditLog.log({
      userId,
      action: success ? 'USER_LOGIN_SUCCESS' : 'USER_LOGIN_FAILED',
      entityType: 'user',
      entityId: userId,
      newValues: {
        success,
        errorMessage,
        timestamp: new Date()
      },
      ipAddress: this.getIpAddress(req),
      userAgent: this.getUserAgent(req)
    });
  }

  /**
   * Log logout
   */
  static async logLogout(userId, req) {
    return await AuditLog.log({
      userId,
      action: 'USER_LOGOUT',
      entityType: 'user',
      entityId: userId,
      ipAddress: this.getIpAddress(req),
      userAgent: this.getUserAgent(req)
    });
  }

  /**
   * Log OTP verification
   */
  static async logOTPVerification(userId, type, success, req) {
    return await AuditLog.log({
      userId,
      action: success ? 'OTP_VERIFY_SUCCESS' : 'OTP_VERIFY_FAILED',
      entityType: 'otp',
      entityId: userId,
      newValues: {
        type,
        success,
        timestamp: new Date()
      },
      ipAddress: this.getIpAddress(req),
      userAgent: this.getUserAgent(req)
    });
  }

  /**
   * Log profile updates
   */
  static async logProfileUpdate(userId, oldData, newData, req) {
    const changes = {};
    for (const key in newData) {
      if (oldData[key] !== newData[key]) {
        changes[key] = { old: oldData[key], new: newData[key] };
      }
    }

    return await AuditLog.log({
      userId,
      action: 'PROFILE_UPDATE',
      entityType: 'user',
      entityId: userId,
      oldValues: oldData,
      newValues: newData,
      ipAddress: this.getIpAddress(req),
      userAgent: this.getUserAgent(req)
    });
  }

  /**
   * Log password changes
   */
  static async logPasswordChange(userId, req) {
    return await AuditLog.log({
      userId,
      action: 'PASSWORD_CHANGE',
      entityType: 'user',
      entityId: userId,
      newValues: { timestamp: new Date() },
      ipAddress: this.getIpAddress(req),
      userAgent: this.getUserAgent(req)
    });
  }

  /**
   * Log wallet operations
   */
  static async logWalletOperation(action, userId, walletAddress, req, additionalData = {}) {
    return await AuditLog.log({
      userId,
      action,
      entityType: 'wallet',
      entityId: userId,
      newValues: {
        walletAddress,
        ...additionalData
      },
      ipAddress: this.getIpAddress(req),
      userAgent: this.getUserAgent(req)
    });
  }

  /**
   * Log blockchain vote
   */
  static async logVote(userId, candidateId, transactionHash, req) {
    return await AuditLog.log({
      userId,
      action: 'VOTE_CAST',
      entityType: 'vote',
      entityId: userId,
      newValues: {
        candidateId,
        transactionHash,
        timestamp: new Date()
      },
      ipAddress: this.getIpAddress(req),
      userAgent: this.getUserAgent(req)
    });
  }

  /**
   * Log candidate addition
   */
  static async logCandidateAdd(userId, candidateName, candidateId, req) {
    return await AuditLog.log({
      userId,
      action: 'CANDIDATE_ADD',
      entityType: 'candidate',
      entityId: candidateId,
      newValues: {
        candidateName,
        addedBy: userId,
        timestamp: new Date()
      },
      ipAddress: this.getIpAddress(req),
      userAgent: this.getUserAgent(req)
    });
  }

  /**
   * Log election state changes
   */
  static async logElectionStateChange(userId, action, electionId, req, additionalData = {}) {
    return await AuditLog.log({
      userId,
      action,
      entityType: 'election',
      entityId: electionId,
      newValues: {
        ...additionalData,
        timestamp: new Date()
      },
      ipAddress: this.getIpAddress(req),
      userAgent: this.getUserAgent(req)
    });
  }

  /**
   * Log voter registration on blockchain
   */
  static async logVoterRegistration(userId, walletAddress, transactionHash, req) {
    return await AuditLog.log({
      userId,
      action: 'VOTER_REGISTER_BLOCKCHAIN',
      entityType: 'voter',
      entityId: userId,
      newValues: {
        walletAddress,
        transactionHash,
        timestamp: new Date()
      },
      ipAddress: this.getIpAddress(req),
      userAgent: this.getUserAgent(req)
    });
  }

  /**
   * Log API access
   */
  static async logAPIAccess(req, statusCode, errorMessage = null) {
    const userId = this.getUserId(req);
    return await AuditLog.log({
      userId,
      action: 'API_ACCESS',
      entityType: 'api',
      entityId: null,
      newValues: {
        method: req.method,
        path: req.path,
        statusCode,
        errorMessage,
        query: req.query,
        timestamp: new Date()
      },
      ipAddress: this.getIpAddress(req),
      userAgent: this.getUserAgent(req)
    });
  }

  /**
   * Log admin actions
   */
  static async logAdminAction(action, adminId, targetEntityType, targetEntityId, req, details = {}) {
    return await AuditLog.log({
      userId: adminId,
      action,
      entityType: targetEntityType,
      entityId: targetEntityId,
      newValues: details,
      ipAddress: this.getIpAddress(req),
      userAgent: this.getUserAgent(req)
    });
  }

  /**
   * Log errors
   */
  static async logError(userId, action, error, req = null) {
    return await AuditLog.log({
      userId,
      action: `ERROR_${action}`,
      entityType: 'error',
      entityId: null,
      newValues: {
        errorMessage: error.message,
        errorStack: error.stack,
        timestamp: new Date()
      },
      ipAddress: req ? this.getIpAddress(req) : null,
      userAgent: req ? this.getUserAgent(req) : null
    });
  }

  /**
   * Get audit logs with filters
   */
  static async getLogs(filters = {}, limit = 50, offset = 0) {
    const where = {};
    
    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    
    if (filters.startDate && filters.endDate) {
      where.createdAt = {
        [require('sequelize').Op.between]: [filters.startDate, filters.endDate]
      };
    }

    return await AuditLog.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });
  }

  /**
   * Get audit log statistics
   */
  static async getStatistics(startDate = null, endDate = null) {
    const where = {};
    if (startDate && endDate) {
      where.createdAt = {
        [require('sequelize').Op.between]: [startDate, endDate]
      };
    }

    const { sequelize } = require('../config/database');
    
    const [totalLogs, actionCounts, entityTypeCounts] = await Promise.all([
      AuditLog.count({ where }),
      AuditLog.findAll({
        where,
        attributes: [
          'action',
          [sequelize.fn('COUNT', sequelize.col('action')), 'count']
        ],
        group: ['action'],
        order: [[sequelize.fn('COUNT', sequelize.col('action')), 'DESC']],
        limit: 20,
        raw: true
      }),
      AuditLog.findAll({
        where,
        attributes: [
          'entityType',
          [sequelize.fn('COUNT', sequelize.col('entityType')), 'count']
        ],
        group: ['entityType'],
        order: [[sequelize.fn('COUNT', sequelize.col('entityType')), 'DESC']],
        raw: true
      })
    ]);

    return {
      totalLogs,
      topActions: actionCounts.map(item => ({
        action: item.action,
        count: parseInt(item.count)
      })),
      entityTypeBreakdown: entityTypeCounts.map(item => ({
        entityType: item.entityType,
        count: parseInt(item.count)
      }))
    };
  }
}

module.exports = AuditService;
