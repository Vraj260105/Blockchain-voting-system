const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ActivityLog = sequelize.define('activity_logs', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true, // Some logs might not be user-specific (system events)
    references: {
      model: 'users',
      key: 'id'
    },
    comment: 'User who performed the action (null for system events)'
  },
  sessionId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Session ID for tracking user sessions'
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Type of action performed',
    validate: {
      isIn: [[
        // Authentication actions
        'AUTH_LOGIN_ATTEMPT',
        'AUTH_LOGIN_SUCCESS',
        'AUTH_LOGIN_FAILURE',
        'AUTH_LOGOUT',
        'AUTH_REGISTER',
        'AUTH_EMAIL_VERIFY',
        'AUTH_PASSWORD_RESET',
        'AUTH_TOKEN_REFRESH',
        'AUTH_OTP_SEND',
        'AUTH_OTP_VERIFY',
        
        // Legacy auth action names used by AuditService (kept for compatibility)
        'USER_REGISTER',
        'USER_LOGIN_SUCCESS',
        'USER_LOGIN_FAILED',
        'USER_LOGOUT',
        'USER_DEACTIVATE',
        'ACCOUNT_DEACTIVATED',
        'PASSWORD_CHANGE',
        'OTP_VERIFY_SUCCESS',
        'OTP_VERIFY_FAILED',
        'OTP_SEND',
        
        // Session management
        'SESSION_CREATE',
        'SESSION_INVALIDATE',
        'SESSION_EXPIRED',
        
        // Wallet actions
        'WALLET_CONNECT',
        'WALLET_DISCONNECT',
        'WALLET_REGISTER',
        'WALLET_UNREGISTER',
        'WALLET_UPDATE',
        'WALLET_VERIFY',
        'WALLET_ADDRESS_UPDATED',
        'WALLET_TRANSACTION_ATTEMPT',
        'WALLET_TRANSACTION_SUCCESS',
        'WALLET_TRANSACTION_FAILURE',
        'WALLET_SIGNATURE_VERIFIED',
        'WALLET_SIGNATURE_FAILED',
        'WALLET_CHALLENGE_ISSUED',
        
        // Blockchain actions
        'BLOCKCHAIN_VOTE_CAST',
        'BLOCKCHAIN_CANDIDATE_ADD',
        'BLOCKCHAIN_ELECTION_CREATE',
        'BLOCKCHAIN_ELECTION_OPEN',
        'BLOCKCHAIN_ELECTION_CLOSE',
        'BLOCKCHAIN_VOTER_REGISTER',
        'BLOCKCHAIN_SYNC',
        'VOTE_CAST',
        'VOTER_REGISTER_BLOCKCHAIN',
        'CANDIDATE_ADD',
        'ELECTION_CREATE',
        'ELECTION_OPEN',
        'ELECTION_CLOSE',
        
        // System actions
        'SYSTEM_STARTUP',
        'SYSTEM_SHUTDOWN',
        'SYSTEM_ERROR',
        'SYSTEM_DATABASE_SYNC',
        'SYSTEM_SERVICE_INIT',
        
        // API actions
        'API_REQUEST',
        'API_RESPONSE',
        'API_ERROR',
        'API_RATE_LIMIT',
        'API_ACCESS',
        
        // Profile actions
        'PROFILE_VIEW',
        'PROFILE_UPDATE',
        'PROFILE_PASSWORD_CHANGE',
        
        // Admin actions
        'ADMIN_USER_CREATE',
        'ADMIN_USER_UPDATE',
        'ADMIN_USER_DELETE',
        'ADMIN_USER_ROLE_CHANGE',
        'ADMIN_LOGS_VIEW',
        'ADMIN_SYSTEM_CONFIG',
        'ADMIN_VIEW_AUDIT_LOGS',
        'ADMIN_ACTION',
        
        // Notification actions
        'NOTIFICATION_SENT',
        'NOTIFICATION_FAILED'
      ]]
    }
  },
  resource: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Resource affected by the action (e.g., election, candidate, user)'
  },
  resourceId: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'ID of the affected resource'
  },
  status: {
    type: DataTypes.ENUM('SUCCESS', 'FAILURE', 'PENDING', 'ERROR'),
    defaultValue: 'SUCCESS',
    comment: 'Status of the action'
  },
  severity: {
    type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
    defaultValue: 'LOW',
    comment: 'Severity level of the event'
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Human-readable description of the action'
  },
  details: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: 'Additional details about the action in JSON format'
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: 'Technical metadata (request data, response codes, etc.)'
  },
  ipAddress: {
    type: DataTypes.STRING(45), // IPv6 support
    allowNull: true,
    comment: 'IP address of the user/system making the request'
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'User agent string from the request'
  },
  walletAddress: {
    type: DataTypes.STRING(42),
    allowNull: true,
    comment: 'Wallet address associated with the action'
  },
  transactionHash: {
    type: DataTypes.STRING(66),
    allowNull: true,
    comment: 'Blockchain transaction hash if applicable'
  },
  blockNumber: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Block number if blockchain transaction'
  },
  errorCode: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Error code for failed actions'
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Detailed error message for failed actions'
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Duration of the action in milliseconds'
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: 'When the action occurred'
  }
}, {
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['action']
    },
    {
      fields: ['status']
    },
    {
      fields: ['severity']
    },
    {
      fields: ['timestamp']
    },
    {
      fields: ['sessionId']
    },
    {
      fields: ['resource', 'resourceId']
    },
    {
      fields: ['walletAddress']
    },
    {
      fields: ['transactionHash']
    },
    {
      fields: ['ipAddress']
    },
    {
      fields: ['createdAt', 'action']
    },
    {
      fields: ['userId', 'timestamp']
    }
  ]
});

// Instance methods
ActivityLog.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  return values;
};

// Class methods for common logging patterns
ActivityLog.logAuth = async function(action, userId, sessionId, status, message, metadata = {}, ipAddress = null, userAgent = null) {
  return await this.create({
    userId,
    sessionId,
    action,
    resource: 'user',
    resourceId: userId?.toString(),
    status,
    severity: status === 'FAILURE' ? 'MEDIUM' : 'LOW',
    message,
    metadata,
    ipAddress,
    userAgent
  });
};

ActivityLog.logWallet = async function(action, userId, walletAddress, status, message, metadata = {}, transactionHash = null) {
  return await this.create({
    userId,
    action,
    resource: 'wallet',
    resourceId: walletAddress,
    status,
    severity: status === 'FAILURE' ? 'MEDIUM' : 'LOW',
    message,
    metadata,
    walletAddress,
    transactionHash
  });
};

ActivityLog.logBlockchain = async function(action, userId, walletAddress, transactionHash, blockNumber, status, message, metadata = {}) {
  return await this.create({
    userId,
    action,
    resource: 'blockchain',
    resourceId: transactionHash,
    status,
    severity: status === 'FAILURE' ? 'HIGH' : 'LOW',
    message,
    metadata,
    walletAddress,
    transactionHash,
    blockNumber
  });
};

ActivityLog.logSystem = async function(action, message, severity = 'LOW', metadata = {}) {
  return await this.create({
    userId: null,
    action,
    resource: 'system',
    status: 'SUCCESS',
    severity,
    message,
    metadata
  });
};

ActivityLog.logAPI = async function(action, userId, method, path, statusCode, duration, ipAddress, userAgent, metadata = {}) {
  return await this.create({
    userId,
    action,
    resource: 'api',
    resourceId: `${method} ${path}`,
    status: statusCode < 400 ? 'SUCCESS' : statusCode < 500 ? 'FAILURE' : 'ERROR',
    severity: statusCode < 400 ? 'LOW' : statusCode < 500 ? 'MEDIUM' : 'HIGH',
    message: `${method} ${path} - ${statusCode}`,
    metadata: {
      ...metadata,
      method,
      path,
      statusCode
    },
    duration,
    ipAddress,
    userAgent
  });
};

ActivityLog.logError = async function(action, userId, error, severity = 'HIGH', metadata = {}) {
  return await this.create({
    userId,
    action,
    status: 'ERROR',
    severity,
    message: error.message,
    metadata,
    errorCode: error.code,
    errorMessage: error.stack
  });
};

// Query helpers
ActivityLog.findByUser = async function(userId, limit = 50, offset = 0) {
  return await this.findAll({
    where: { userId },
    order: [['timestamp', 'DESC']],
    limit,
    offset
  });
};

ActivityLog.findByAction = async function(action, limit = 100, offset = 0) {
  return await this.findAll({
    where: { action },
    order: [['timestamp', 'DESC']],
    limit,
    offset
  });
};

ActivityLog.findBySeverity = async function(severity, limit = 100, offset = 0) {
  return await this.findAll({
    where: { severity },
    order: [['timestamp', 'DESC']],
    limit,
    offset
  });
};

ActivityLog.findByDateRange = async function(startDate, endDate, limit = 1000, offset = 0) {
  return await this.findAll({
    where: {
      timestamp: {
        [sequelize.Op.between]: [startDate, endDate]
      }
    },
    order: [['timestamp', 'DESC']],
    limit,
    offset
  });
};

ActivityLog.getStatistics = async function(startDate = null, endDate = null) {
  const whereClause = {};
  if (startDate && endDate) {
    whereClause.timestamp = {
      [sequelize.Op.between]: [startDate, endDate]
    };
  }

  const [totalLogs, statusCounts, severityCounts, actionCounts] = await Promise.all([
    this.count({ where: whereClause }),
    this.findAll({
      where: whereClause,
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']],
      group: ['status'],
      raw: true
    }),
    this.findAll({
      where: whereClause,
      attributes: ['severity', [sequelize.fn('COUNT', sequelize.col('severity')), 'count']],
      group: ['severity'],
      raw: true
    }),
    this.findAll({
      where: whereClause,
      attributes: ['action', [sequelize.fn('COUNT', sequelize.col('action')), 'count']],
      group: ['action'],
      order: [[sequelize.fn('COUNT', sequelize.col('action')), 'DESC']],
      limit: 10,
      raw: true
    })
  ]);

  return {
    totalLogs,
    statusCounts: Object.fromEntries(statusCounts.map(item => [item.status, parseInt(item.count)])),
    severityCounts: Object.fromEntries(severityCounts.map(item => [item.severity, parseInt(item.count)])),
    topActions: actionCounts.map(item => ({ action: item.action, count: parseInt(item.count) }))
  };
};

module.exports = ActivityLog;