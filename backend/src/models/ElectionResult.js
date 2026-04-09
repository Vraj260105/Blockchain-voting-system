const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * ElectionResult — Persistent DB snapshot of each election's final state.
 *
 * Populated/updated by:
 *   - POST /api/election-results/sync   (admin-triggered manual sync)
 *   - Automatically each time an election is closed via the blockchain
 *
 * Stores both the election metadata AND a full JSONB snapshot of every
 * candidate + their vote count so results survive contract migrations.
 */
const ElectionResult = sequelize.define('election_results', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },

  // ── Blockchain identifiers ────────────────────────────────────────────────
  electionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'On-chain election index (from smart contract)',
  },

  // ── Election metadata ─────────────────────────────────────────────────────
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  organizationName: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },

  // ── Timing (unix seconds from blockchain) ─────────────────────────────────
  scheduledStart: {
    type: DataTypes.BIGINT,
    allowNull: true,
    defaultValue: 0,
  },
  scheduledEnd: {
    type: DataTypes.BIGINT,
    allowNull: true,
    defaultValue: 0,
  },
  startTime: {
    type: DataTypes.BIGINT,
    allowNull: true,
    defaultValue: 0,
    comment: 'Actual open timestamp (unix)',
  },
  endTime: {
    type: DataTypes.BIGINT,
    allowNull: true,
    defaultValue: 0,
    comment: 'Actual close timestamp (unix)',
  },

  // ── Status ────────────────────────────────────────────────────────────────
  status: {
    type: DataTypes.ENUM('active', 'closed', 'scheduled', 'upcoming'),
    allowNull: false,
    defaultValue: 'upcoming',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },

  // ── Vote totals ───────────────────────────────────────────────────────────
  totalVotes: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  candidateCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },

  // ── Full candidate snapshot (JSONB) ───────────────────────────────────────
  // Array of: { id, name, description, votes, percentage }
  candidates: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    comment: 'Full candidate list with vote counts at time of snapshot',
  },

  // ── Winner ────────────────────────────────────────────────────────────────
  // null while election is active / no votes yet
  winner: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: null,
    comment: 'Winning candidate object { id, name, votes, percentage }',
  },

  // ── Sync tracking ─────────────────────────────────────────────────────────
  lastSyncedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'When this record was last updated from the blockchain',
  },
  syncedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'userId who triggered the sync (null = automatic)',
  },
}, {
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  indexes: [
    { unique: true, fields: ['electionId'] },    // one row per on-chain election
    { fields: ['status'] },
    { fields: ['lastSyncedAt'] },
  ],
});

// ── Class helpers ─────────────────────────────────────────────────────────────

/**
 * Derive the winner from a candidate array.
 * Returns null if no votes have been cast.
 */
ElectionResult.computeWinner = function (candidates, totalVotes) {
  if (!candidates || candidates.length === 0 || totalVotes === 0) return null;
  const top = [...candidates].sort((a, b) => b.votes - a.votes)[0];
  return {
    id: top.id,
    name: top.name,
    votes: top.votes,
    percentage: totalVotes > 0 ? ((top.votes / totalVotes) * 100).toFixed(2) : '0.00',
  };
};

/**
 * Derive status string from blockchain election fields.
 */
ElectionResult.deriveStatus = function (election) {
  if (election.isActive) return 'active';
  const now = Math.floor(Date.now() / 1000);
  if (election.scheduledStart > 0 && now < election.scheduledStart) return 'scheduled';
  if (election.endTime > 0) return 'closed';
  return 'upcoming';
};

/**
 * Upsert (insert or update) a result from a blockchain election object.
 * @param {object} election  - blockchain Election struct
 * @param {object[]} candidates - array of { id, name, description, votes }
 * @param {number|null} syncedBy - userId who triggered the sync
 */
ElectionResult.upsertFromBlockchain = async function (election, candidates, syncedBy = null) {
  const totalVotes = election.totalVotes || candidates.reduce((s, c) => s + (c.votes || 0), 0);
  const status = this.deriveStatus(election);

  const candidateSnapshot = candidates.map(c => ({
    id: c.id,
    name: c.name,
    description: c.description || '',
    votes: c.votes || 0,
    percentage: totalVotes > 0 ? ((( c.votes || 0) / totalVotes) * 100).toFixed(2) : '0.00',
  }));

  const winner = status === 'closed' || !election.isActive
    ? this.computeWinner(candidateSnapshot, totalVotes)
    : null;

  const [record, created] = await this.findOrCreate({
    where: { electionId: election.id },
    defaults: {
      electionId: election.id,
      name: election.name,
      description: election.description || '',
      organizationName: election.organizationName || '',
      scheduledStart: election.scheduledStart || 0,
      scheduledEnd: election.scheduledEnd || 0,
      startTime: election.startTime || 0,
      endTime: election.endTime || 0,
      status,
      isActive: election.isActive,
      totalVotes,
      candidateCount: candidates.length,
      candidates: candidateSnapshot,
      winner,
      lastSyncedAt: new Date(),
      syncedBy,
    },
  });

  if (!created) {
    await record.update({
      name: election.name,
      description: election.description || '',
      organizationName: election.organizationName || '',
      scheduledStart: election.scheduledStart || 0,
      scheduledEnd: election.scheduledEnd || 0,
      startTime: election.startTime || 0,
      endTime: election.endTime || 0,
      status,
      isActive: election.isActive,
      totalVotes,
      candidateCount: candidates.length,
      candidates: candidateSnapshot,
      winner,
      lastSyncedAt: new Date(),
      syncedBy,
    });
  }

  return { record, created };
};

module.exports = ElectionResult;
