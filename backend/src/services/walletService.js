const { User } = require('../models');
const Web3 = require('web3');

class WalletService {
  constructor() {
    this.web3 = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      // Connect to blockchain network for wallet verification
      const networkUrl = process.env.BLOCKCHAIN_NETWORK_URL || 'http://localhost:7545';
      this.web3 = new Web3(networkUrl);
      this.initialized = true;
      console.log('✅ Wallet service initialized');
    } catch (error) {
      console.error('❌ Wallet service initialization failed:', error);
      this.initialized = false;
    }
  }

  /**
   * Verify if a wallet address is valid Ethereum address
   */
  isValidWalletAddress(address) {
    if (!this.web3) return false;
    return this.web3.utils.isAddress(address);
  }

  /**
   * Check if user's current wallet matches the one stored in database
   */
  async verifyUserWallet(userId, currentWalletAddress) {
    try {
      if (!this.isValidWalletAddress(currentWalletAddress)) {
        return {
          isValid: false,
          isMatching: false,
          message: 'Invalid wallet address format'
        };
      }

      const user = await User.findByPk(userId);
      if (!user) {
        return {
          isValid: false,
          isMatching: false,
          message: 'User not found'
        };
      }

      if (!user.walletAddress) {
        return {
          isValid: true,
          isMatching: false,
          message: 'No wallet registered for this user',
          needsRegistration: true
        };
      }

      const isMatching = user.walletAddress.toLowerCase() === currentWalletAddress.toLowerCase();
      
      return {
        isValid: true,
        isMatching,
        message: isMatching 
          ? 'Wallet address matches registered wallet' 
          : 'Wallet address does not match registered wallet',
        registeredWallet: user.walletAddress
      };
    } catch (error) {
      console.error('Error verifying user wallet:', error);
      return {
        isValid: false,
        isMatching: false,
        message: 'Error verifying wallet'
      };
    }
  }

  /**
   * Register or update user's wallet address
   */
  async registerUserWallet(userId, walletAddress) {
    try {
      if (!this.isValidWalletAddress(walletAddress)) {
        throw new Error('Invalid wallet address format');
      }

      // Check if wallet is already registered by another user
      const existingUser = await User.findOne({
        where: { 
          walletAddress: walletAddress.toLowerCase(),
          id: { [require('sequelize').Op.ne]: userId } // Exclude current user
        }
      });

      if (existingUser) {
        throw new Error('This wallet address is already registered by another user');
      }

      // Update user's wallet address
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      user.walletAddress = walletAddress.toLowerCase();
      await user.save();

      return {
        success: true,
        message: 'Wallet address registered successfully',
        walletAddress: user.walletAddress
      };
    } catch (error) {
      console.error('Error registering user wallet:', error);
      throw error;
    }
  }

  /**
   * Get wallet status for a user
   */
  async getUserWalletStatus(userId) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      return {
        hasWallet: !!user.walletAddress,
        walletAddress: user.walletAddress,
        isWalletValid: user.walletAddress ? this.isValidWalletAddress(user.walletAddress) : false
      };
    } catch (error) {
      console.error('Error getting user wallet status:', error);
      throw error;
    }
  }

  /**
   * Check if wallet can perform transactions (additional checks can be added)
   */
  async canWalletTransact(walletAddress) {
    try {
      if (!this.initialized || !this.web3) {
        return false;
      }

      if (!this.isValidWalletAddress(walletAddress)) {
        return false;
      }

      // Check wallet balance (optional)
      try {
        const balance = await this.web3.eth.getBalance(walletAddress);
        const balanceInEth = this.web3.utils.fromWei(balance, 'ether');
        
        // Require minimum balance for gas fees
        return parseFloat(balanceInEth) > 0.001; // 0.001 ETH minimum
      } catch (error) {
        console.warn('Could not check wallet balance:', error);
        return true; // Allow transaction attempt even if balance check fails
      }
    } catch (error) {
      console.error('Error checking wallet transaction capability:', error);
      return false;
    }
  }

  /**
   * Generate wallet connection challenge (for future signature verification)
   */
  generateWalletChallenge(userId) {
    const timestamp = Date.now();
    const challenge = `Please sign this message to verify wallet ownership.\nUser ID: ${userId}\nTimestamp: ${timestamp}`;
    
    return {
      challenge,
      timestamp,
      expiresAt: timestamp + (5 * 60 * 1000) // 5 minutes expiry
    };
  }

  /**
   * Verify wallet signature (placeholder for future implementation)
   */
  async verifyWalletSignature(walletAddress, signature, message) {
    try {
      if (!this.web3) {
        throw new Error('Web3 not initialized');
      }

      const recoveredAddress = this.web3.eth.accounts.recover(message, signature);
      return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
    } catch (error) {
      console.error('Error verifying wallet signature:', error);
      return false;
    }
  }
}

// Create singleton instance
const walletService = new WalletService();

module.exports = walletService;