require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { sequelize, testConnection, syncDatabase, OTP, VoteNotification, User } = require('./models');
const walletService = require('./services/walletService');
const emailService = require('./services/emailService');
const { auditMiddleware } = require('./middleware/auditMiddleware');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
];

if (process.env.CLIENT_URL) {
  allowedOrigins.push(process.env.CLIENT_URL);
}

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Audit logging middleware (log all API requests)
app.use(auditMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/wallet', require('./routes/walletRoutes'));
app.use('/api/audit-logs', require('./routes/auditLogs'));

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('❌ Global error handler:', error);
  
  // Sequelize validation errors
  if (error.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.errors.map(err => ({
        field: err.path,
        message: err.message
      }))
    });
  }
  
  // Sequelize unique constraint errors
  if (error.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      message: 'Resource already exists',
      errors: error.errors.map(err => ({
        field: err.path,
        message: `${err.path} must be unique`
      }))
    });
  }
  
  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
  
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
    });
  }
  
  // Default error
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`👋 ${signal} received, shutting down gracefully`);
  try {
    await sequelize.close();
    console.log('✅ Database connection closed.');
  } catch (err) {
    console.error('❌ Error closing database connection:', err);
  }
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();
    
    // Sync database models
    await syncDatabase();
    
    // Initialize wallet service
    await walletService.initialize();
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📧 Email service: ${process.env.EMAIL_SERVICE || 'test'}`);
    });

    // ✅ Schedule OTP cleanup every hour
    const OTP_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
    setInterval(async () => {
      try {
        const deleted = await OTP.cleanupExpired();
        console.log(`🧹 OTP cleanup: removed ${deleted} expired OTP(s).`);
      } catch (err) {
        console.error('❌ OTP cleanup failed:', err.message);
      }
    }, OTP_CLEANUP_INTERVAL_MS);
    console.log(`🕐 OTP cleanup scheduled every ${OTP_CLEANUP_INTERVAL_MS / 60000} minutes.`);

    // ✅ Item 10: Schedule Notification Dispatcher every 5 minutes
    const NOTIFICATION_INTERVAL_MS = 5 * 60 * 1000;
    setInterval(async () => {
      try {
        const pending = await VoteNotification.getPending(20);
        if (pending.length === 0) return;
        
        console.log(`📧 Dispatching ${pending.length} pending notifications...`);
        for (const notification of pending) {
          if (notification.channel === 'EMAIL') {
            const user = await User.findByPk(notification.userId);
            if (!user) {
              await notification.markFailed('User not found');
              continue;
            }
            const result = await emailService.sendNotification(
              user.email,
              notification.subject || 'Voting System Notification',
              notification.body || 'You have a new notification.'
            );
            
            if (result.success) {
              await notification.markSent();
            } else {
              await notification.markFailed(result.error);
            }
          } else {
            // IN_APP notifications are just marked sent when generated
            await notification.markSent();
          }
        }
      } catch (err) {
        console.error('❌ Notification dispatcher failed:', err.message);
      }
    }, NOTIFICATION_INTERVAL_MS);
    console.log(`🕐 Notification dispatcher scheduled every ${NOTIFICATION_INTERVAL_MS / 60000} minutes.`);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();