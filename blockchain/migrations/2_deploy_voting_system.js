const fs = require('fs');
const path = require('path');
const VotingSystem = artifacts.require('VotingSystem');

module.exports = async function (deployer) {
  await deployer.deploy(VotingSystem);
  const instance = await VotingSystem.deployed();

  // Write ABI + address for the frontend
  const artifactPath = path.join(__dirname, '..', 'build', 'contracts', 'VotingSystem.json');
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  
  const output = {
    address: instance.address,
    abi: artifact.abi,
  };

  // Write to Block-vote frontend (primary location)
  const blockVoteDir = path.join(__dirname, '..', '..', 'Block-vote', 'src', 'contracts');
  fs.mkdirSync(blockVoteDir, { recursive: true });
  fs.writeFileSync(path.join(blockVoteDir, 'VotingSystem.json'), JSON.stringify(output, null, 2));
  console.log('✅ Wrote Block-vote contract artifact to', path.join(blockVoteDir, 'VotingSystem.json'));

  // Also write to legacy frontend location if it exists
  const legacyDir = path.join(__dirname, '..', '..', 'frontend', 'src', 'contracts');
  if (fs.existsSync(path.join(__dirname, '..', '..', 'frontend'))) {
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(path.join(legacyDir, 'VotingSystem.json'), JSON.stringify(output, null, 2));
    console.log('✅ Wrote frontend contract artifact to', path.join(legacyDir, 'VotingSystem.json'));
  }

  console.log('\n🎉 VotingSystem deployed at:', instance.address);
  console.log('📍 Network: Polygon Mumbai Testnet');
  console.log('💾 Contract artifacts saved to both frontend locations');
};
