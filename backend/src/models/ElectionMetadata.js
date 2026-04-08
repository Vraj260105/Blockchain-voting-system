const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * ElectionMetadata — off-chain content layer for elections.
 * The smart contract only stores name/description/org — everything
 * richer (banner image, detailed rules, contact info) lives here.
 */
const ElectionMetadata = sequelize.define('election_metadata', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  electionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    comment: 'On-chain election ID (the mapping key)',
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    comment: 'App user (admin) who created this metadata',
  },
  bannerUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'URL to election banner/cover image',
  },
  rules: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Detailed rules and eligibility criteria (markdown supported)',
  },
  contactEmail: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: { isEmail: true },
    comment: 'Organiser contact email for this election',
  },
  registrationDeadline: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Voter registration cut-off date/time',
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Array of category tags for searching/filtering elections',
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Whether the results page is publicly accessible',
  },
  extraData: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: 'Flexible key-value store for future fields',
  },
}, {
  timestamps: true,
  indexes: [
    { fields: ['electionId'], unique: true },
    { fields: ['createdBy'] },
    { fields: ['registrationDeadline'] },
  ],
});

// ── Class methods ────────────────────────────────────────────────────────────

/** Upsert (create or update) metadata for an election */
ElectionMetadata.upsert = async function(electionId, data) {
  const [record] = await this.findOrCreate({
    where: { electionId },
    defaults: { electionId, ...data },
  });
  if (Object.keys(data).length > 0) {
    await record.update(data);
  }
  return record;
};

module.exports = ElectionMetadata;
