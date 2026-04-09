const { sequelize, testConnection } = require('../config/database');
const User = require('./User');
const OTP = require('./OTP');
const AuditLog = require('./AuditLog');
const UserSession = require('./UserSession');
const ActivityLog = require('./ActivityLog');
const ElectionRegistration = require('./ElectionRegistration');
const ElectionMetadata = require('./ElectionMetadata');
const VoteNotification = require('./VoteNotification');
const ElectionResult = require('./ElectionResult');

// Import Sequelize operators for use in models
const { Op } = require('sequelize');

// Make Sequelize operators available in models
sequelize.Op = Op;

// ── Associations ────────────────────────────────────────────────────────────
// UserSession ↔ User
UserSession.belongsTo && UserSession.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany && User.hasMany(UserSession, { foreignKey: 'userId', as: 'sessions' });

// ActivityLog ↔ User
ActivityLog.belongsTo && ActivityLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// ElectionRegistration ↔ User
ElectionRegistration.belongsTo && ElectionRegistration.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany && User.hasMany(ElectionRegistration, { foreignKey: 'userId', as: 'electionRegistrations' });

// ElectionMetadata ↔ User (creator)
ElectionMetadata.belongsTo && ElectionMetadata.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

// VoteNotification ↔ User
VoteNotification.belongsTo && VoteNotification.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany && User.hasMany(VoteNotification, { foreignKey: 'userId', as: 'notifications' });

// Sync database (everywhere so production databases are initialized)
const syncDatabase = async () => {
  try {
    // force: false ensures we strictly CREATE tables without dropping them.
    await sequelize.sync({ force: false });
    console.log('✅ Database synchronized successfully.');
  } catch (error) {
    console.error('❌ Database synchronization failed:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  testConnection,
  User,
  OTP,
  AuditLog,
  UserSession,
  ActivityLog,
  ElectionRegistration,
  ElectionMetadata,
  VoteNotification,
  ElectionResult,
  syncDatabase
};
