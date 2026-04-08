require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
  const mnemonic = process.env.MNEMONIC;
  const rpcUrl = process.env.POLYGON_RPC_URL || 'https://rpc-amoy.polygon.technology';
  
  if (!mnemonic) {
    console.error(' No MNEMONIC found in .env');
    process.exit(1);
  }

  // Set up provider and wallet
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = ethers.Wallet.fromPhrase(mnemonic).connect(provider);
  
  console.log(' Connected to Polygon Amoy');
  console.log(' Connected as owner:', wallet.address);
  
  // Read compiled contract JSON
  const contractPath = path.join(__dirname, 'build', 'contracts', 'VotingSystem.json');
  if (!fs.existsSync(contractPath)) {
    console.error(` Contract JSON not found at ${contractPath}. Cannot recover funds without ABI and deployed address.`);
    process.exit(1);
  }
  
  const contractJson = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  
  // Get old deployed address
  const networkId = '80002'; // Amoy
  const networkData = contractJson.networks?.[networkId];
  if (!networkData || !networkData.address) {
    console.error(` No deployed contract address found for network ID ${networkId} in JSON.`);
    process.exit(1);
  }

  const contractAddress = networkData.address;
  console.log(' Found deployed contract at:', contractAddress);

  const contractBalance = await provider.getBalance(contractAddress);
  console.log(` Contract Balance: ${ethers.formatEther(contractBalance)} POL`);

  if (contractBalance === 0n) {
    console.log(' Contract balance is 0. Nothing to recover.');
    return;
  }

  const contract = new ethers.Contract(contractAddress, contractJson.abi, wallet);

  console.log(' Initiating withdrawal to owner wallet...');
  try {
    const tx = await contract.withdrawFunds();
    console.log(' Waiting for transaction confirmation...');
    await tx.wait();
    
    console.log(' Successfully recovered funds!');
    console.log(` Transaction Hash: ${tx.hash}`);

    const newOwnerBalance = await provider.getBalance(wallet.address);
    console.log(` New Owner Balance: ${ethers.formatEther(newOwnerBalance)} POL`);

  } catch (error) {
    console.error(' Failed to withdraw funds. Make sure the connected wallet is the contract owner.');
    console.error(error.message || error);
  }
}

main().catch(err => {
  console.error(" Recovery failed:", err);
  process.exit(1);
});
