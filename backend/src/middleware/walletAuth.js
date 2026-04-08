const { User } = require('../models');

/**
 * Middleware to verify that the user's current wallet matches their registered wallet
 * This ensures that only the registered wallet can perform transactions
 */
const requireWalletAuth = async (req, res, next) => {
  try {
    // Check if user is authenticated first
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Get wallet address from request body
    const { walletAddress } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is required for this operation'
      });
    }

    // Get user's registered wallet from database
    const user = await User.findByPk(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.walletAddress) {
      return res.status(403).json({
        success: false,
        message: 'Please register a wallet address in your profile before performing transactions',
        code: 'WALLET_NOT_REGISTERED'
      });
    }

    // Check if the provided wallet matches the registered wallet
    const registeredWallet = user.walletAddress.toLowerCase();
    const providedWallet = walletAddress.toLowerCase();

    if (registeredWallet !== providedWallet) {
      return res.status(403).json({
        success: false,
        message: 'The connected wallet does not match your registered wallet address. Please connect the correct wallet or update your profile.',
        code: 'WALLET_MISMATCH',
        registeredWalletPreview: `${registeredWallet.slice(0, 6)}...${registeredWallet.slice(-4)}`
      });
    }

    // Add verified wallet info to request for downstream use
    req.verifiedWallet = {
      address: walletAddress.toLowerCase(),
      userId: req.user.userId,
      isVerified: true
    };

    next();
  } catch (error) {
    console.error('Wallet authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error verifying wallet authentication'
    });
  }
};

/**
 * Optional wallet auth - checks wallet if provided but doesn't require it
 */
const optionalWalletAuth = async (req, res, next) => {
  try {
    const { walletAddress } = req.body;
    
    // If no wallet address provided, skip verification
    if (!walletAddress) {
      req.verifiedWallet = null;
      return next();
    }

    // If wallet address provided and user is authenticated, verify it
    if (req.user && req.user.userId) {
      const user = await User.findByPk(req.user.userId);
      
      if (user && user.walletAddress) {
        const isMatching = user.walletAddress.toLowerCase() === walletAddress.toLowerCase();
        req.verifiedWallet = {
          address: walletAddress.toLowerCase(),
          userId: req.user.userId,
          isVerified: isMatching,
          registeredWallet: user.walletAddress
        };
      } else {
        req.verifiedWallet = {
          address: walletAddress.toLowerCase(),
          userId: req.user.userId,
          isVerified: false,
          needsRegistration: true
        };
      }
    } else {
      req.verifiedWallet = {
        address: walletAddress.toLowerCase(),
        userId: null,
        isVerified: false
      };
    }

    next();
  } catch (error) {
    console.error('Optional wallet authentication error:', error);
    req.verifiedWallet = null;
    next();
  }
};

/**
 * Middleware to check if user has a registered wallet
 */
const requireRegisteredWallet = async (req, res, next) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const user = await User.findByPk(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (!user.walletAddress) {
      return res.status(403).json({
        success: false,
        message: 'Please register a wallet address in your profile before accessing this feature',
        code: 'WALLET_NOT_REGISTERED'
      });
    }

    // Basic validation of wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(user.walletAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Registered wallet address is invalid. Please update your wallet address in your profile',
        code: 'INVALID_REGISTERED_WALLET'
      });
    }

    req.userWalletAddress = user.walletAddress;
    next();
  } catch (error) {
    console.error('Registered wallet check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking wallet registration'
    });
  }
};


module.exports = {
  requireWalletAuth,
  optionalWalletAuth,
  requireRegisteredWallet
};
