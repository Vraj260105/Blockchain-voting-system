const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AuditLog = sequelize.define('audit_logs', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  entityType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'entityType'
  },
  entityId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'entityId'
  },
  oldValues: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'oldValues'
  },
  newValues: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'newValues'
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: true,
    field: 'ipAddress'
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'userAgent'
  }
}, {
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: false,
  indexes: [
    { fields: ['userId'] },
    { fields: ['action'] },
    { fields: ['entityType', 'entityId'] },
    { fields: ['createdAt'] }
  ]
});

// Helper method to create audit logs
AuditLog.log = async function(data) {
  try {
    return await this.create({
      userId: data.userId || null,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId || null,
      oldValues: data.oldValues || null,
      newValues: data.newValues || null,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw error to prevent audit logging from breaking the app
  }
};

module.exports = AuditLog;
