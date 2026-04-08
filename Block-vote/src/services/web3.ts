import Web3 from 'web3';
import { 
  Election,
  Candidate, 
  VoterInfo, 
  ContractData, 
  WalletAuthStatus 
} from '@/types/auth.types';
import apiService from './api';

/* ── Web3 / MetaMask error normaliser ───────────────────────────── */
export function normalizeWeb3Error(error: any): string {
  const msg: string = (error?.message || error?.toString() || '').toLowerCase();
  const data: string = (error?.data?.message || '').toLowerCase();
  const combined = `${msg} ${data}`;

  // User rejected the transaction in MetaMask
  if (error?.code === 4001 || combined.includes('user denied') || combined.includes('user rejected'))
    return 'Transaction cancelled — you rejected it in MetaMask.';

  // Already voted
  if (combined.includes('already voted'))
    return 'You have already voted in this election.';

  // Not registered
  if (combined.includes('not registered') || combined.includes('voter is not registered'))
    return 'You are not registered for this election. Register first.';

  // Election not active
  if (combined.includes('not active') || combined.includes('election is not active'))
    return 'This election is not currently active.';

  // Insufficient funds
  if (combined.includes('insufficient funds') || combined.includes('doesn\'t have enough funds'))
    return 'Insufficient POL balance to cover gas fees. Get testnet POL from a faucet.';

  // Gas estimation failed (smart contract revert)
  if (combined.includes('gas required exceeds') || combined.includes('execution reverted'))
    return 'Transaction reverted by the smart contract — the action is not allowed.';

  // Nonce too low (stuck tx)
  if (combined.includes('nonce too low'))
    return 'Transaction nonce conflict. Try resetting your MetaMask account (Settings → Advanced → Clear activity).';

  // Internal JSON-RPC error
  if (combined.includes('internal json-rpc error'))
    return 'Blockchain RPC error — the network may be congested. Try again in a moment.';

  // Network / timeout
  if (combined.includes('network') && (combined.includes('error') || combined.includes('timeout')))
    return 'Network error — check your internet and MetaMask connection.';

  // Fallback: try to extract the useful part of MetaMask errors
  const revertMatch = msg.match(/reason string '([^']+)'/);
  if (revertMatch) return revertMatch[1];

  const vmMatch = msg.match(/vm exception[^:]*: revert (.+)/);
  if (vmMatch) return vmMatch[1];

  // Clean up very long messages
  const clean = error?.message || 'Transaction failed';
  return clean.length > 120 ? clean.slice(0, 120) + '…' : clean;
}

// Polygon Amoy RPC endpoints (fallback order)
const AMOY_RPC_ENDPOINTS = [
  'https://rpc-amoy.polygon.technology',
  'https://polygon-amoy.drpc.org',
  'https://rpc.ankr.com/polygon_amoy',
];

class Web3Service {
  private web3: Web3 | null = null;
  private contract: any = null;
  private account: string = '';
  private contractData: ContractData | null = null;
  private currentRpcIndex: number = 0;

  async initialize(): Promise<boolean> {
    try {
      if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask is not installed!');
      }

      // Use provider from MetaMask directly
      this.web3 = new Web3(window.ethereum);
      
      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const accounts = await this.web3.eth.getAccounts();
      
      if (accounts.length === 0) {
        throw new Error('No accounts found. Please connect your wallet.');
      }
      
      this.account = accounts[0];
      
      // Load contract data
      await this.loadContract();
      
      // Listen for account changes
      window.ethereum.on('accountsChanged', this.handleAccountChange);
      window.ethereum.on('chainChanged', this.handleChainChange);
      
      return true;
    } catch (error) {
      console.error('Web3 initialization failed:', error);
      return false;
    }
  }

  private handleAccountChange = (accounts: string[]) => {
    if (accounts.length === 0) {
      this.account = '';
      this.contract = null;
    } else if (accounts[0] !== this.account) {
      this.account = accounts[0];
      console.log('Account changed to:', this.account);
    }
  };

  private handleChainChange = () => {
    window.location.reload();
  };

  private async loadContract(): Promise<void> {
    try {
      const contractModule = await import('../contracts/VotingSystem.json');
      const rawData = contractModule.default || contractModule;
      
      if (!rawData?.abi) {
        throw new Error('Invalid contract data: missing ABI');
      }

      // Truffle stores deployed address under networks[chainId].address
      let deployedAddress: string | undefined;
      if (rawData.networks) {
        deployedAddress =
          rawData.networks['80002']?.address ||
          Object.values(rawData.networks as Record<string, { address?: string }>)
            .map((n) => n.address)
            .find((a) => !!a);
      }
      if (!deployedAddress && (rawData as any).address) {
        deployedAddress = (rawData as any).address;
      }

      if (!deployedAddress) {
        throw new Error('Contract not deployed on this network. Please deploy VotingSystem.sol first.');
      }

      this.contractData = { address: deployedAddress, abi: rawData.abi };
      
      if (!this.web3) {
        throw new Error('Web3 not initialized');
      }
      
      this.contract = new this.web3.eth.Contract(
        this.contractData.abi,
        this.contractData.address
      );
      
    } catch (error) {
      console.error('Failed to load contract:', error);
      throw new Error('Smart contract not found. Please deploy the contract first.');
    }
  }

  // ── Wallet Authentication ──────────────────────────────────
  async checkWalletAuthentication(): Promise<WalletAuthStatus> {
    try {
      if (!this.account) {
        return { hasWallet: false, isVerified: false, message: 'Please connect MetaMask' };
      }

      const statusResponse = await apiService.getWalletStatus();
      
      if (!statusResponse.success || !statusResponse.data.hasWallet) {
        return { hasWallet: false, isVerified: false, message: 'No wallet registered in profile' };
      }

      const verifyResponse = await apiService.verifyWallet({ walletAddress: this.account });

      return {
        hasWallet: true,
        isVerified: verifyResponse.data.isMatching,
        message: verifyResponse.data.message
      };
      
    } catch (error) {
      console.error('Wallet authentication check failed:', error);
      return { hasWallet: false, isVerified: false, message: 'Failed to verify wallet authentication' };
    }
  }

  // ── Contract Owner ─────────────────────────────────────────
  async getContractOwner(): Promise<string> {
    if (!this.contract) throw new Error('Contract not loaded');
    return await this.contract.methods.owner().call();
  }

  async isOwner(): Promise<boolean> {
    try {
      const owner = await this.getContractOwner();
      return owner.toLowerCase() === this.account.toLowerCase();
    } catch {
      return false;
    }
  }

  // ── Election Management ────────────────────────────────────
  async getElectionCount(): Promise<number> {
    if (!this.contract) throw new Error('Contract not loaded');
    const count = await this.contract.methods.electionCount().call();
    return parseInt(count);
  }

  async getElection(electionId: number): Promise<Election> {
    if (!this.contract) throw new Error('Contract not loaded');
    const e = await this.contract.methods.getElection(electionId).call();
    return {
      id: electionId,
      name: e.name,
      description: e.description,
      organizationName: e.organizationName,
      scheduledStart: parseInt(e.scheduledStart),
      scheduledEnd: parseInt(e.scheduledEnd),
      startTime: parseInt(e.startTime),
      endTime: parseInt(e.endTime),
      isActive: e.isActive,
      totalVotes: parseInt(e.totalVotes),
      candidateCount: parseInt(e.candidateCount),
    };
  }

  async getAllElections(): Promise<Election[]> {
    const count = await this.getElectionCount();
    const elections: Election[] = [];
    for (let i = 0; i < count; i++) {
      try {
        const election = await this.getElection(i);
        elections.push(election);
      } catch (err) {
        console.error(`Failed to load election ${i}:`, err);
      }
    }
    return elections;
  }

  async createElection(
    name: string,
    description: string,
    organizationName: string,
    scheduledStart: number = 0,
    scheduledEnd: number = 0
  ): Promise<string> {
    if (!this.contract) throw new Error('Contract not loaded');
    const tx = await this.contract.methods
      .createElection(name, description, organizationName, scheduledStart, scheduledEnd)
      .send({
        from: this.account,
        gas: 500000,
        gasPrice: await this.web3!.eth.getGasPrice()
      });
    return tx.transactionHash;
  }

  async updateElection(
    electionId: number,
    name: string,
    description: string,
    organizationName: string,
    scheduledStart: number = 0,
    scheduledEnd: number = 0
  ): Promise<string> {
    if (!this.contract) throw new Error('Contract not loaded');
    const tx = await this.contract.methods
      .updateElection(electionId, name, description, organizationName, scheduledStart, scheduledEnd)
      .send({
        from: this.account,
        gas: 300000,
        gasPrice: await this.web3!.eth.getGasPrice()
      });
    return tx.transactionHash;
  }

  async triggerElectionStatus(electionId: number): Promise<string> {
    if (!this.contract) throw new Error('Contract not loaded');
    const tx = await this.contract.methods.triggerElectionStatus(electionId).send({
      from: this.account,
      gas: 150000,
      gasPrice: await this.web3!.eth.getGasPrice()
    });
    return tx.transactionHash;
  }

  // ── Candidate Management ───────────────────────────────────
  async addCandidate(electionId: number, name: string, description: string = ''): Promise<string> {
    if (!this.contract) throw new Error('Contract not loaded');
    try {
      const gasEstimate = await this.contract.methods.addCandidate(electionId, name, description).estimateGas({
        from: this.account
      });
      const tx = await this.contract.methods.addCandidate(electionId, name, description).send({
        from: this.account,
        gas: Math.floor(Number(gasEstimate) * 1.5),
        gasPrice: await this.web3!.eth.getGasPrice()
      });
      return tx.transactionHash;
    } catch (error: any) {
      console.error('Add candidate failed:', error);
      throw new Error(normalizeWeb3Error(error));
    }
  }

  async getCandidates(electionId: number): Promise<Candidate[]> {
    if (!this.contract) throw new Error('Contract not loaded');
    const result = await this.contract.methods.getElectionCandidates(electionId).call();
    const candidates: Candidate[] = [];
    for (let i = 0; i < result.names.length; i++) {
      candidates.push({
        id: i,
        name: result.names[i],
        description: result.descriptions[i],
        votes: parseInt(result.voteCounts[i])
      });
    }
    return candidates;
  }

  // ── Voting Lifecycle ───────────────────────────────────────
  async isVotingOpen(electionId: number): Promise<boolean> {
    if (!this.contract) throw new Error('Contract not loaded');
    const election = await this.getElection(electionId);
    return election.isActive;
  }

  async openVoting(electionId: number): Promise<string> {
    if (!this.contract) throw new Error('Contract not loaded');
    const tx = await this.contract.methods.openVoting(electionId).send({
      from: this.account,
      gas: 100000,
      gasPrice: await this.web3!.eth.getGasPrice()
    });
    return tx.transactionHash;
  }

  async closeVoting(electionId: number): Promise<string> {
    if (!this.contract) throw new Error('Contract not loaded');
    const tx = await this.contract.methods.closeVoting(electionId).send({
      from: this.account,
      gas: 100000,
      gasPrice: await this.web3!.eth.getGasPrice()
    });
    return tx.transactionHash;
  }

  // ── Voter Registration & Voting ────────────────────────────
  async getVoterInfo(electionId: number): Promise<VoterInfo> {
    if (!this.contract) throw new Error('Contract not loaded');
    const v = await this.contract.methods.getVoterInfo(electionId, this.account).call();
    return {
      isRegistered: v.isRegistered,
      hasVoted: v.hasVoted,
      votedCandidateId: v.votedCandidateId ? parseInt(v.votedCandidateId) : undefined
    };
  }

  async registerSelf(electionId: number): Promise<string> {
    if (!this.contract) throw new Error('Contract not loaded');
    const tx = await this.contract.methods.registerSelf(electionId).send({
      from: this.account,
      gas: 200000,
      gasPrice: await this.web3!.eth.getGasPrice()
    });
    return tx.transactionHash;
  }

  async castVote(electionId: number, candidateId: number): Promise<string> {
    if (!this.contract) throw new Error('Contract not loaded');
    const tx = await this.contract.methods.castVote(electionId, candidateId).send({
      from: this.account,
      gas: 200000,
      gasPrice: await this.web3!.eth.getGasPrice()
    });
    return tx.transactionHash;
  }

  async getWinner(electionId: number): Promise<{ name: string; voteCount: number; isTie: boolean }> {
    if (!this.contract) throw new Error('Contract not loaded');
    const result = await this.contract.methods.getElectionWinner(electionId).call();
    return {
      name: result.name,
      voteCount: parseInt(result.voteCount),
      isTie: result.isTie
    };
  }

  async fundContractWith(amountPol: number): Promise<string> {
    if (!this.contract || !this.web3) throw new Error('Contract not loaded');
    const wei = this.web3.utils.toWei(amountPol.toString(), 'ether');
    const tx = await this.contract.methods.fundContract().send({
      from: this.account,
      value: wei,
      gas: 60000,
      gasPrice: await this.web3.eth.getGasPrice()
    });
    return tx.transactionHash;
  }

  // ── Contract Balance ───────────────────────────────────────
  async getContractBalance(): Promise<string> {
    if (!this.contract) throw new Error('Contract not loaded');
    const balance = await this.contract.methods.getContractBalance().call();
    return this.web3!.utils.fromWei(balance, 'ether');
  }

  // ── Utility ────────────────────────────────────────────────
  getAccount(): string {
    return this.account;
  }

  getContractAddress(): string {
    return this.contractData?.address || '';
  }

  isInitialized(): boolean {
    return !!(this.web3 && this.contract && this.account);
  }

  async switchToPolygonAmoy(): Promise<boolean> {
    try {
      const amoyChainId = '0x13882'; // 80002 in hex
      
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: amoyChainId }],
      });
      
      return true;
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0x13882',
                chainName: 'Polygon Amoy Testnet',
                rpcUrls: [import.meta.env.VITE_POLYGON_RPC_URL || 'https://rpc-amoy.polygon.technology'],
                nativeCurrency: {
                  name: 'POL',
                  symbol: 'POL',
                  decimals: 18,
                },
                blockExplorerUrls: ['https://amoy.polygonscan.com/'],
              },
            ],
          });
          return true;
        } catch (addError) {
          console.error('Failed to add Polygon Amoy network:', addError);
          return false;
        }
      } else {
        console.error('Failed to switch to Polygon Amoy network:', switchError);
        return false;
      }
    }
  }

  cleanup(): void {
    if (window.ethereum) {
      window.ethereum.removeListener('accountsChanged', this.handleAccountChange);
      window.ethereum.removeListener('chainChanged', this.handleChainChange);
    }
    
    this.web3 = null;
    this.contract = null;
    this.account = '';
    this.contractData = null;
  }
}

// Create and export singleton instance
const web3Service = new Web3Service();
export default web3Service;

// ── Read-only helpers (no MetaMask required) ─────────────────────────
// Used by the public /elections/:id/results page
async function buildReadOnlyContract() {
  const Web3 = (await import('web3')).default;
  const rpc = import.meta.env.VITE_POLYGON_RPC_URL || 'https://rpc-amoy.polygon.technology';
  const web3ro = new Web3(new (Web3 as any).providers.HttpProvider(rpc));
  const contractModule = await import('../contracts/VotingSystem.json');
  const raw: any = contractModule.default || contractModule;
  const address: string =
    raw.networks?.['80002']?.address ||
    Object.values((raw.networks || {}) as Record<string, { address?: string }>)
      .map((n) => n.address)
      .find(Boolean) || '';
  if (!address) throw new Error('Contract not deployed');
  return { web3ro, contract: new web3ro.eth.Contract(raw.abi, address), address };
}

export async function getElectionReadOnly(electionId: number) {
  const { contract, address } = await buildReadOnlyContract();
  const e: any = await contract.methods.getElection(electionId).call();
  return {
    contractAddress: address,
    election: {
      id: electionId,
      name: e.name,
      description: e.description,
      organizationName: e.organizationName,
      scheduledStart: parseInt(e.scheduledStart),
      scheduledEnd: parseInt(e.scheduledEnd),
      startTime: parseInt(e.startTime),
      endTime: parseInt(e.endTime),
      isActive: e.isActive,
      totalVotes: parseInt(e.totalVotes),
      candidateCount: parseInt(e.candidateCount),
    },
  };
}

export async function getCandidatesReadOnly(
  electionId: number,
  candidateCount: number
): Promise<Array<{ id: number; name: string; description: string; votes: number }>> {
  const { contract } = await buildReadOnlyContract();
  const results = [];
  for (let i = 0; i < candidateCount; i++) {
    const c: any = await contract.methods.candidates(electionId, i).call();
    results.push({
      id: i,
      name: c.name,
      description: c.description,
      votes: parseInt(c.voteCount),
    });
  }
  return results;
}