const AuditService = require('../services/auditService');

/**
 * Middleware to log all API requests
 * Add this to your Express app to automatically log all HTTP requests
 */
const auditMiddleware = async (req, res, next) => {
  const startTime = Date.now();

  // Capture the original res.json to log after response
  const originalJson = res.json.bind(res);
  
  res.json = function(data) {
    const duration = Date.now() - startTime;
    
    // Log API access asynchronously (don't wait for it)
    setImmediate(async () => {
      try {
        await AuditService.logAPIAccess(req, res.statusCode, data.error || null);
      } catch (error) {
        console.error('Failed to log API access:', error);
      }
    });
    
    return originalJson(data);
  };

  next();
};

/**
 * Middleware to log authentication events
 */
const auditAuthMiddleware = (action) => {
  return async (req, res, next) => {
    // Store the action for later use in the route handler
    req.auditAction = action;
    next();
  };
};

module.exports = {
  auditMiddleware,
  auditAuthMiddleware
};
