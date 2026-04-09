const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcrypt');

const User = sequelize.define('users', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  firstName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  lastName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('super_admin', 'election_admin', 'voter'),
    defaultValue: 'voter'
  },
  walletAddress: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true
  },
  failedLoginAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  },
  lockedUntil: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  indexes: [
    {
      fields: ['email']
    },
    {
      fields: ['walletAddress']
    },
    {
      fields: ['role']
    }
  ]
});

// Instance methods
User.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

User.prototype.getFullName = function() {
  return `${this.firstName} ${this.lastName}`;
};

User.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  delete values.password;
  delete values.walletAddress; // Hide wallet address by default
  return values;
};

User.prototype.toPrivateJSON = function() {
  const values = Object.assign({}, this.get());
  delete values.password;
  return values; // Keep wallet address for profile/private views
};

User.prototype.toPublicJSON = function() {
  const values = Object.assign({}, this.get());
  delete values.password;
  delete values.walletAddress; // Hide wallet address in public responses
  return values;
};

User.prototype.toPrivateJSON = function() {
  const values = Object.assign({}, this.get());
  delete values.password;
  return values; // Keep wallet address for profile/private views
};

// Class methods
User.hashPassword = async function(password) {
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  return await bcrypt.hash(password, saltRounds);
};

User.findByEmail = async function(email) {
  return await this.findOne({
    where: { email: email.toLowerCase() }
  });
};

User.findActiveByEmail = async function(email) {
  return await this.findOne({
    where: { 
      email: email.toLowerCase(),
      isActive: true 
    }
  });
};

/** Increment failed login counter; lock account for 15 min after 5 failures */
User.recordFailedLogin = async function(userId) {
  const user = await this.findByPk(userId);
  if (!user) return;
  const attempts = (user.failedLoginAttempts || 0) + 1;
  const update = { failedLoginAttempts: attempts };
  if (attempts >= 5) {
    update.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // lock 15 min
  }
  await user.update(update);
};

/** Clear failed login counter and lock on successful login */
User.resetLoginAttempts = async function(userId) {
  await this.update(
    { failedLoginAttempts: 0, lockedUntil: null },
    { where: { id: userId } }
  );
};

// Hooks
User.beforeCreate(async (user) => {
  if (user.email) {
    user.email = user.email.toLowerCase();
  }
  if (user.password) {
    user.password = await User.hashPassword(user.password);
  }
});

User.beforeUpdate(async (user) => {
  if (user.changed('email')) {
    user.email = user.email.toLowerCase();
  }
  if (user.changed('password')) {
    user.password = await User.hashPassword(user.password);
  }
});

module.exports = User;