const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * ElectionRegistration — off-chain mirror of on-chain voter registrations.
 * Created whenever a voter registers for an election via the blockchain.
 * Enables fast analytics/dashboards without hitting the blockchain RPC.
 */
const ElectionRegistration = sequelize.define('election_registrations', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true, // Null if the voter has no linked app account
    references: { model: 'users', key: 'id' },
    comment: 'App user who registered (null if wallet-only voter)',
  },
  electionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'On-chain election ID',
  },
  walletAddress: {
    type: DataTypes.STRING(42),
    allowNull: false,
    comment: 'Wallet address that registered',
  },
  transactionHash: {
    type: DataTypes.STRING(66),
    allowNull: true,
    comment: 'Blockchain tx hash for the registerSelf() call',
  },
  fundingTxHash: {
    type: DataTypes.STRING(66),
    allowNull: true,
    comment: 'Blockchain tx hash for the VoterFunded event (auto-fund)',
  },
  fundingAmount: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true,
    comment: 'Amount of POL auto-funded to voter (in ETH/POL)',
  },
  registeredAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: 'When the registration was recorded',
  },
}, {
  timestamps: true,
  indexes: [
    { fields: ['electionId'] },
    { fields: ['walletAddress'] },
    { fields: ['userId'] },
    { fields: ['electionId', 'walletAddress'], unique: true }, // one registration per election per wallet
  ],
});

// ── Class methods ────────────────────────────────────────────────────────────

/** Create or ignore a registration record */
ElectionRegistration.recordRegistration = async function({
  userId, electionId, walletAddress, transactionHash, fundingTxHash, fundingAmount
}) {
  const [record, created] = await this.findOrCreate({
    where: { electionId, walletAddress },
    defaults: { userId, transactionHash, fundingTxHash, fundingAmount },
  });
  return { record, created };
};

/** Get stats for an election */
ElectionRegistration.getElectionStats = async function(electionId) {
  const total = await this.count({ where: { electionId } });
  const withAccount = await this.count({ where: { electionId, userId: { [Op.not]: null } } });
  const funded = await this.count({ where: { electionId, fundingTxHash: { [Op.not]: null } } });
  return { total, withAccount, funded };
};

/** Get all elections a wallet has registered for */
ElectionRegistration.getByWallet = async function(walletAddress) {
  return await this.findAll({ where: { walletAddress }, order: [['registeredAt', 'DESC']] });
};

module.exports = ElectionRegistration;
