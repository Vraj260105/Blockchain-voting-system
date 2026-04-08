const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const OTP = sequelize.define('otp_codes', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  code: {
    type: DataTypes.STRING(10),
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('registration', 'login', 'password_reset'),
    allowNull: false
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  isUsed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: false,
  indexes: [
    {
      fields: ['email', 'type']
    },
    {
      fields: ['code']
    },
    {
      fields: ['expiresAt']
    }
  ]
});

// Class methods
OTP.generateCode = function() {
  const length = parseInt(process.env.OTP_LENGTH) || 6;
  return Math.floor(Math.random() * Math.pow(10, length)).toString().padStart(length, '0');
};

OTP.createOTP = async function(email, type) {
  const code = this.generateCode();
  const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES) || 10;
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  // Invalidate any existing OTPs for this email and type
  await this.update(
    { isUsed: true },
    {
      where: {
        email: email.toLowerCase(),
        type,
        isUsed: false,
        expiresAt: {
          [sequelize.Op.gt]: new Date()
        }
      }
    }
  );

  // Create new OTP
  const otp = await this.create({
    email: email.toLowerCase(),
    code,
    type,
    expiresAt
  });

  return { code, expiresAt };
};

OTP.verifyOTP = async function(email, code, type) {
  const otp = await this.findOne({
    where: {
      email: email.toLowerCase(),
      code,
      type,
      isUsed: false,
      expiresAt: {
        [sequelize.Op.gt]: new Date()
      }
    },
    order: [['createdAt', 'DESC']]
  });

  if (!otp) {
    return { valid: false, message: 'Invalid or expired OTP' };
  }

  // Mark as used
  await otp.update({ isUsed: true });

  return { valid: true, otp };
};

OTP.cleanupExpired = async function() {
  const deleted = await this.destroy({
    where: {
      expiresAt: {
        [sequelize.Op.lt]: new Date()
      }
    }
  });
  
  console.log(`🧹 Cleaned up ${deleted} expired OTP records`);
  return deleted;
};

module.exports = OTP;