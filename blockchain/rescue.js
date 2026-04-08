require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function rescue() {
  console.log(' Starting Fund Recovery...');
  
  const RPC_URL = process.env.POLYGON_RPC_URL || 'https://rpc-amoy.polygon.technology';
  const MNEMONIC = process.env.MNEMONIC;
  if (!MNEMONIC) throw new Error('Missing MNEMONIC in .env');

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = ethers.Wallet.fromPhrase(MNEMONIC).connect(provider);

  console.log(` Rescuer Wallet: ${wallet.address}`);
  const initialBalance = await provider.getBalance(wallet.address);
  console.log(` Current Wallet Balance: ${ethers.formatEther(initialBalance)} POL`);

  // Load ABI and address dynamically to avoid checksum typos
  const abiPath = path.resolve(__dirname, 'build/contracts/VotingSystem.json');
  const compiled = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  const abi = compiled.abi;
  const OLD_CONTRACT_ADDRESS = compiled.networks['80002'].address;

  console.log(` Target Contract: ${OLD_CONTRACT_ADDRESS}`);

  const contractBalance = await provider.getBalance(OLD_CONTRACT_ADDRESS);
  console.log(` Locked Contract Balance: ${ethers.formatEther(contractBalance)} POL`);

  if (contractBalance === 0n) {
    console.log('Contract is empty. Nothing to rescue.');
    return;
  }



  const contract = new ethers.Contract(OLD_CONTRACT_ADDRESS, abi, wallet);

  console.log('⚡ Calling withdrawFunds()...');
  try {
    const tx = await contract.withdrawFunds();
    console.log(` Waiting for Transaction: ${tx.hash}`);
    
    await tx.wait();
    console.log(' Rescue Successful! Funds have been withdrawn.');
    
    const finalBalance = await provider.getBalance(wallet.address);
    console.log(` New Wallet Balance: ${ethers.formatEther(finalBalance)} POL`);
  } catch (err) {
    console.error(' Failed to rescue funds:', err.message);
  }
}

rescue().catch(console.error);
