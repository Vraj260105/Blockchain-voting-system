const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const crypto = require('crypto');

const UserSession = sequelize.define('user_sessions', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sessionId: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    comment: 'Unique session identifier'
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    comment: 'User associated with this session'
  },
  refreshToken: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'JWT refresh token for this session'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Whether the session is currently active'
  },
  deviceInfo: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: 'Device information (browser, OS, etc.)'
  },
  walletAddress: {
    type: DataTypes.STRING(42),
    allowNull: true,
    comment: 'Connected wallet address for this session'
  },
  ipAddress: {
    type: DataTypes.STRING(45), // IPv6 support
    allowNull: true,
    comment: 'IP address when session was created'
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'User agent string from the browser'
  },
  location: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Approximate location based on IP (if available)'
  },
  loginAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: 'When the session was created'
  },
  lastActivityAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: 'Last activity timestamp'
  },
  logoutAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the session was ended'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: 'When the session expires'
  },
  logoutReason: {
    type: DataTypes.ENUM('USER_LOGOUT', 'TOKEN_EXPIRED', 'ADMIN_REVOKE', 'SECURITY_LOGOUT', 'INACTIVITY'),
    allowNull: true,
    comment: 'Reason for session termination'
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: 'Additional session metadata'
  }
}, {
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  indexes: [
    {
      fields: ['sessionId'],
      unique: true
    },
    {
      fields: ['userId']
    },
    {
      fields: ['isActive']
    },
    {
      fields: ['refreshToken']
    },
    {
      fields: ['walletAddress']
    },
    {
      fields: ['ipAddress']
    },
    {
      fields: ['loginAt']
    },
    {
      fields: ['lastActivityAt']
    },
    {
      fields: ['expiresAt']
    },
    {
      fields: ['userId', 'isActive']
    },
    {
      fields: ['userId', 'loginAt']
    }
  ]
});

// Instance methods
UserSession.prototype.updateActivity = async function() {
  this.lastActivityAt = new Date();
  return await this.save();
};

UserSession.prototype.logout = async function(reason = 'USER_LOGOUT') {
  this.isActive = false;
  this.logoutAt = new Date();
  this.logoutReason = reason;
  this.refreshToken = null;
  return await this.save();
};

UserSession.prototype.updateWallet = async function(walletAddress) {
  this.walletAddress = walletAddress;
  return await this.save();
};

UserSession.prototype.isExpired = function() {
  return new Date() > this.expiresAt;
};

UserSession.prototype.getRemainingTime = function() {
  const now = new Date();
  return this.expiresAt > now ? this.expiresAt - now : 0;
};

UserSession.prototype.getDeviceSummary = function() {
  const device = this.deviceInfo || {};
  return {
    browser: device.browser || 'Unknown',
    os: device.os || 'Unknown',
    device: device.device || 'Unknown'
  };
};

UserSession.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  // Don't expose sensitive data
  delete values.refreshToken;
  return values;
};

UserSession.prototype.toSecureJSON = function() {
  const values = Object.assign({}, this.get());
  delete values.refreshToken;
  delete values.metadata;
  return {
    id: values.id,
    sessionId: values.sessionId,
    isActive: values.isActive,
    deviceSummary: this.getDeviceSummary(),
    walletConnected: !!values.walletAddress,
    loginAt: values.loginAt,
    lastActivityAt: values.lastActivityAt,
    location: values.location
  };
};

// Class methods
UserSession.generateSessionId = function() {
  return crypto.randomBytes(32).toString('hex');
};

UserSession.createSession = async function(userId, deviceInfo, ipAddress, userAgent, expiresInHours = 24) {
  const sessionId = this.generateSessionId();
  const expiresAt = new Date(Date.now() + (expiresInHours * 60 * 60 * 1000));
  
  return await this.create({
    sessionId,
    userId,
    deviceInfo,
    ipAddress,
    userAgent,
    expiresAt,
    loginAt: new Date(),
    lastActivityAt: new Date()
  });
};

UserSession.findBySessionId = async function(sessionId) {
  return await this.findOne({
    where: { 
      sessionId,
      isActive: true 
    }
  });
};

UserSession.findActiveSessionsByUser = async function(userId) {
  return await this.findAll({
    where: {
      userId,
      isActive: true
    },
    order: [['lastActivityAt', 'DESC']]
  });
};

UserSession.findExpiredSessions = async function() {
  return await this.findAll({
    where: {
      isActive: true,
      expiresAt: {
        [sequelize.Op.lt]: new Date()
      }
    }
  });
};

UserSession.cleanupExpiredSessions = async function() {
  const expiredSessions = await this.findExpiredSessions();
  const cleanedCount = expiredSessions.length;
  
  for (const session of expiredSessions) {
    await session.logout('TOKEN_EXPIRED');
  }
  
  return cleanedCount;
};

UserSession.revokeAllUserSessions = async function(userId, reason = 'ADMIN_REVOKE') {
  const activeSessions = await this.findActiveSessionsByUser(userId);
  
  for (const session of activeSessions) {
    await session.logout(reason);
  }
  
  return activeSessions.length;
};

UserSession.revokeOtherUserSessions = async function(userId, currentSessionId, reason = 'SECURITY_LOGOUT') {
  const activeSessions = await this.findAll({
    where: {
      userId,
      isActive: true,
      sessionId: {
        [sequelize.Op.ne]: currentSessionId
      }
    }
  });
  
  for (const session of activeSessions) {
    await session.logout(reason);
  }
  
  return activeSessions.length;
};

UserSession.getSessionStatistics = async function(userId = null) {
  const whereClause = {};
  if (userId) {
    whereClause.userId = userId;
  }

  const [totalSessions, activeSessions, expiredSessions, todaySessions] = await Promise.all([
    this.count({ where: whereClause }),
    this.count({ where: { ...whereClause, isActive: true } }),
    this.count({ 
      where: { 
        ...whereClause, 
        isActive: false, 
        logoutReason: 'TOKEN_EXPIRED' 
      } 
    }),
    this.count({
      where: {
        ...whereClause,
        loginAt: {
          [sequelize.Op.gte]: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    })
  ]);

  return {
    totalSessions,
    activeSessions,
    expiredSessions,
    todaySessions
  };
};

UserSession.findSessionsWithWallet = async function(walletAddress) {
  return await this.findAll({
    where: {
      walletAddress: walletAddress.toLowerCase(),
      isActive: true
    },
    order: [['lastActivityAt', 'DESC']]
  });
};

UserSession.updateSessionWallet = async function(sessionId, walletAddress) {
  const session = await this.findBySessionId(sessionId);
  if (session) {
    return await session.updateWallet(walletAddress);
  }
  return null;
};

module.exports = UserSession;