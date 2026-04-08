const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * VoteNotification — notification queue for election events.
 * Created when elections open/close so registered voters can be notified via email.
 * A background job (server.js) polls for isSent=false records and dispatches them.
 */
const VoteNotification = sequelize.define('vote_notifications', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'users', key: 'id' },
    comment: 'Recipient user',
  },
  electionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'On-chain election ID this notification is about',
  },
  type: {
    type: DataTypes.ENUM(
      'ELECTION_OPEN',      // Voting has opened
      'ELECTION_CLOSE',     // Voting has closed
      'ELECTION_RESULT',    // Results are available
      'REGISTRATION_REMINDER', // You haven't registered yet
      'VOTE_REMINDER',      // You're registered but haven't voted
      'UPCOMING_ELECTION'   // A new election is coming soon
    ),
    allowNull: false,
    comment: 'Notification event type',
  },
  channel: {
    type: DataTypes.ENUM('EMAIL', 'IN_APP'),
    defaultValue: 'EMAIL',
    comment: 'Delivery channel',
  },
  subject: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Email subject line',
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Full notification body (HTML or plain text)',
  },
  isSent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether this notification has been dispatched',
  },
  sentAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the notification was dispatched',
  },
  failureReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Error message if delivery failed',
  },
  retryCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Number of send attempts',
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: 'Extra data (election name, etc.) for template rendering',
  },
}, {
  timestamps: true,
  indexes: [
    { fields: ['userId'] },
    { fields: ['electionId'] },
    { fields: ['isSent', 'retryCount'] }, // for the background job query
    { fields: ['type'] },
    { fields: ['userId', 'electionId', 'type'] }, // prevent duplicate notifications
  ],
});

// ── Class methods ────────────────────────────────────────────────────────────

/** Create notification if not already sent for this user+election+type combo */
VoteNotification.enqueue = async function({ userId, electionId, type, channel = 'EMAIL', subject, body, metadata = {} }) {
  const existing = await this.findOne({ where: { userId, electionId, type } });
  if (existing) return { created: false, notification: existing };
  const notification = await this.create({ userId, electionId, type, channel, subject, body, metadata });
  return { created: true, notification };
};

/** Get all pending (unsent, retry < 3) notifications for dispatch */
VoteNotification.getPending = async function(limit = 50) {
  return await this.findAll({
    where: { isSent: false, retryCount: { [Op.lt]: 3 } },
    limit,
    order: [['createdAt', 'ASC']],
  });
};

/** Mark as sent */
VoteNotification.prototype.markSent = async function() {
  return await this.update({ isSent: true, sentAt: new Date() });
};

/** Mark as failed and increment retry count */
VoteNotification.prototype.markFailed = async function(reason) {
  return await this.update({
    retryCount: this.retryCount + 1,
    failureReason: reason,
  });
};

/** Get unread in-app notifications for a user */
VoteNotification.getInAppForUser = async function(userId, limit = 20) {
  return await this.findAll({
    where: { userId, channel: 'IN_APP' },
    order: [['createdAt', 'DESC']],
    limit,
  });
};

module.exports = VoteNotification;
