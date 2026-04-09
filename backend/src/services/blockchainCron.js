const Web3 = require('web3');
const { sequelize } = require('../config/database');
const ElectionResult = require('../models/ElectionResult');
const contractData = require('../config/contract.json');

class BlockchainCronService {
  constructor() {
    this.web3 = null;
    this.contract = null;
    this.account = null;
    this.intervalId = null;
    this.isRunning = false;
  }

  initialize() {
    try {
      const RPC_URL = process.env.BLOCKCHAIN_NETWORK_URL || 'https://rpc-amoy.polygon.technology';
      const PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;

      if (!PRIVATE_KEY) {
        console.log('⚠️ Blockchain Automation Disabled: ADMIN_PRIVATE_KEY is missing in .env');
        return false;
      }

      this.web3 = new Web3(RPC_URL);

      // Add account to web3 wallet
      this.account = this.web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`);
      this.web3.eth.accounts.wallet.add(this.account);
      this.web3.eth.defaultAccount = this.account.address;

      // Initialize contract
      this.contract = new this.web3.eth.Contract(contractData.abi, contractData.address);

      console.log(`✅ Blockchain Automator Ready. Address: ${this.account.address}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Blockchain Automator:', error.message);
      return false;
    }
  }

  async runTriggerCheck() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      // Step 1: Get the exact total number of elections from the smart contract
      // We query the blockchain directly so we don't miss ones recently created but not synced to DB
      const countStr = await this.contract.methods.electionCount().call();
      const totalElections = parseInt(countStr);

      if (totalElections === 0) {
        return; // nothing to do
      }

      // Step 2: Iterate and check contract directly
      for (let id = 0; id < totalElections; id++) {
        // Use the smart contract's convenience helper
        const scheduleData = await this.contract.methods.getElectionScheduleStatus(id).call();
        
        // shouldOpen and shouldClose are computed purely from block.timestamp inside the contract
        if (scheduleData.shouldOpen || scheduleData.shouldClose) {
          const action = scheduleData.shouldOpen ? 'OPEN' : 'CLOSE';
          console.log(`⚡ Automator: Triggering ${action} for Election #${id}...`);
          
          try {
            // Fetch current network gas price and ensure a minimum floor of 35 gwei for Amoy
            let currentGasPrice = await this.web3.eth.getGasPrice();
            const minGasPrice = process.env.DEFAULT_GAS_PRICE || '35000000000';
            if (BigInt(currentGasPrice) < BigInt(minGasPrice)) {
              currentGasPrice = minGasPrice;
            }

            await this.contract.methods.triggerElectionStatus(id).send({
              from: this.account.address,
              gas: process.env.DEFAULT_GAS_LIMIT || 1000000,
              gasPrice: currentGasPrice
            });
            console.log(`✅ Automator: Election #${id} triggered successfully.`);
          } catch (txError) {
            console.error(`❌ Automator: Transaction failed for Election #${id}:`, txError.message);
          }
        }
      }
    } catch (error) {
      console.error('❌ Automator error in trigger loop:', error.message);
    } finally {
      this.isRunning = false;
    }
  }

  start() {
    if (this.initialize()) {
      // Run every 15 seconds
      this.intervalId = setInterval(() => this.runTriggerCheck(), 15000);
      
      // Run eagerly on startup
      setTimeout(() => this.runTriggerCheck(), 5000);
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

module.exports = new BlockchainCronService();
