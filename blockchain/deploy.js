require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
  const mnemonic = process.env.MNEMONIC;
  const rpcUrl = process.env.POLYGON_RPC_URL || 'https://rpc-amoy.polygon.technology';
  
  if (!mnemonic) {
    console.error('No MNEMONIC found in .env');
    process.exit(1);
  }

  // Set up provider and wallet
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = ethers.Wallet.fromPhrase(mnemonic).connect(provider);
  
  console.log(' Connected to Polygon Amoy');
  console.log(' Deploying from account:', wallet.address);
  
  const balance = await provider.getBalance(wallet.address);
  console.log(' Wallet balance:', ethers.formatEther(balance), 'POL');
  
  // Read compiled contract JSON
  const contractPath = path.join(__dirname, 'build', 'contracts', 'VotingSystem.json');
  if (!fs.existsSync(contractPath)) {
    console.error(`Contract JSON not found at ${contractPath}. Run 'npx truffle compile' first.`);
    process.exit(1);
  }
  
  const contractJson = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  
  // Deploy
  console.log(' Deploying VotingSystem contract...');
  const factory = new ethers.ContractFactory(contractJson.abi, contractJson.bytecode, wallet);
  
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  
  const address = await contract.getAddress();
  console.log(' Contract deployed successfully at:', address);
  
  // Fund the contract with POL for voter auto-fund (send 2 POL)
  const fundAmount = ethers.parseEther('2');
  console.log(' Funding contract with 2 POL for voter auto-fund...');
  const fundTx = await wallet.sendTransaction({
    to: address,
    value: fundAmount
  });
  await fundTx.wait();
  console.log(' Contract funded! Tx:', fundTx.hash);
  
  // Update the JSON ABI file with the new network ID (80002 for Amoy)
  contractJson.networks = contractJson.networks || {};
  contractJson.networks['80002'] = {
    events: {},
    links: {},
    address: address,
    transactionHash: contract.deploymentTransaction()?.hash
  };
  
  fs.writeFileSync(contractPath, JSON.stringify(contractJson, null, 2));
  console.log(' Updated ABI JSON with new deployed address.');
  
  // Copy ABI to frontend
  const frontendAbiPath = path.join(__dirname, '..', 'Block-vote', 'src', 'contracts', 'VotingSystem.json');
  const frontendDir = path.dirname(frontendAbiPath);
  if (!fs.existsSync(frontendDir)) {
    fs.mkdirSync(frontendDir, { recursive: true });
  }
  fs.writeFileSync(frontendAbiPath, JSON.stringify(contractJson, null, 2));
  console.log(' Copied ABI to frontend at:', frontendAbiPath);
  
  console.log('\n Deployment complete!');
  console.log('   Contract:', address);
  console.log('   Network: Polygon Amoy (Chain ID 80002)');
  console.log('   Owner:', wallet.address);
}

main().catch(err => {
  console.error(" Deployment failed:", err);
  process.exit(1);
});
