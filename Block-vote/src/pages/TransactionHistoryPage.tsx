import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  History, ExternalLink, Loader2, AlertTriangle, RefreshCw,
  Vote, UserCheck, Wallet, Zap, ArrowDownLeft, ArrowUpRight,
  Filter, CheckCircle, ChevronRight,
} from 'lucide-react';
import web3Service, { normalizeWeb3Error } from '@/services/web3';
import { toast } from 'sonner';

const AMOY_SCAN = 'https://amoy.polygonscan.com';
const ETHERSCAN_V2_API = 'https://api.etherscan.io/v2/api';
// Fallback key or empty — V2 strictly requires one, but we'll wire the env var
const API_KEY = import.meta.env.VITE_POLYGONSCAN_API_KEY || '';

// ── Types ──────────────────────────────────────────────────
interface TxRecord {
  hash: string;
  blockNumber: string;
  timeStamp: string;
  type: 'VOTE_CAST' | 'VOTER_REGISTER' | 'VOTER_FUNDED' | 'FUND_CONTRACT' | 'ELECTION_MANAGE' | 'OTHER';
  label: string;
  detail: string;
  value: string;        // in POL
  direction: 'out' | 'in' | 'none';
  status: 'success' | 'fail';
}

// ── Colours per type ───────────────────────────────────────
const TYPE_CONFIG: Record<TxRecord['type'], { color: string; bg: string; icon: React.ReactNode }> = {
  VOTE_CAST:      { color: '#22C55E', bg: 'rgba(34,197,94,0.12)',   icon: <Vote size={15} /> },
  VOTER_REGISTER: { color: '#38BDF8', bg: 'rgba(56,189,248,0.12)',  icon: <UserCheck size={15} /> },
  VOTER_FUNDED:   { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)', icon: <ArrowDownLeft size={15} /> },
  FUND_CONTRACT:  { color: '#A78BFA', bg: 'rgba(167,139,250,0.12)', icon: <ArrowUpRight size={15} /> },
  ELECTION_MANAGE:{ color: '#F97316', bg: 'rgba(249,115,22,0.12)',  icon: <Zap size={15} /> },
  OTHER:          { color: '#6B7280', bg: 'rgba(107,114,128,0.12)', icon: <ChevronRight size={15} /> },
};

// ── Known 4-byte selectors from ABI ───────────────────────
// Computed offline: keccak256("castVote(uint256,uint256)")[0:4] etc.
const SELECTORS: Record<string, { type: TxRecord['type']; label: string }> = {
  '0x2f7a7fd9': { type: 'VOTER_REGISTER',  label: 'Register as Voter' },
  '0x50f8b2b8': { type: 'VOTER_REGISTER',  label: 'Register as Voter' },
  // castVote(uint256,uint256)
  '0xb384abef': { type: 'VOTE_CAST',       label: 'Cast Vote' },
  // openVoting(uint256)
  '0x0a37736b': { type: 'ELECTION_MANAGE', label: 'Open Voting' },
  // closeVoting(uint256)
  '0xf55321b6': { type: 'ELECTION_MANAGE', label: 'Close Voting' },
  // createElection(string,string,string,uint256,uint256)
  '0x4c5e8c32': { type: 'ELECTION_MANAGE', label: 'Create Election' },
  '0xf9bc4ea0': { type: 'ELECTION_MANAGE', label: 'Create Election' },
  // fundContract()
  '0x941c9f79': { type: 'FUND_CONTRACT',   label: 'Fund Contract' },
  // withdrawFunds()
  '0x24600fc3': { type: 'FUND_CONTRACT',   label: 'Withdraw Funds' },
  // addCandidate
  '0x75fbc82f': { type: 'ELECTION_MANAGE', label: 'Add Candidate' },
  // triggerElectionStatus
  '0x3c3c0f07': { type: 'ELECTION_MANAGE', label: 'Trigger Status' },
};

function classifyTx(tx: any, walletAddress: string, contractAddress: string): TxRecord {
  const input = (tx.input || '').toLowerCase();
  const selector = input.slice(0, 10);
  const isSend = tx.from?.toLowerCase() === walletAddress.toLowerCase();
  const isContract = tx.to?.toLowerCase() === contractAddress.toLowerCase();
  const valueWei = BigInt(tx.value || '0');
  const valuePol = Number(valueWei) / 1e18;

  const known = SELECTORS[selector];

  let type: TxRecord['type'] = 'OTHER';
  let label = 'Contract Interaction';
  let detail = '';
  let direction: TxRecord['direction'] = isSend ? 'out' : 'in';

  if (known && isContract) {
    type = known.type;
    label = known.label;
  } else if (!isContract && !isSend && valueWei > 0n) {
    // Receiving POL from contract (voter fund)
    type = 'VOTER_FUNDED';
    label = 'Received POL (Voter Fund)';
    direction = 'in';
  } else if (isContract && isSend && valueWei > 0n && (input === '0x' || selector === '0x941c9f79')) {
    type = 'FUND_CONTRACT';
    label = 'Fund Contract';
    direction = 'out';
  } else if (isContract && selector === '0x') {
    type = 'FUND_CONTRACT';
    label = 'Fund Contract (Direct)';
    direction = 'out';
  }

  return {
    hash: tx.hash,
    blockNumber: tx.blockNumber,
    timeStamp: tx.timeStamp,
    type,
    label,
    detail,
    value: valuePol > 0 ? `${valuePol.toFixed(4)} POL` : '',
    direction,
    status: tx.isError === '1' ? 'fail' : 'success',
  };
}

function fmtTime(ts: string) {
  if (!ts) return '—';
  const d = new Date(parseInt(ts) * 1000);
  return d.toLocaleString();
}

function shortHash(h: string) {
  return `${h.slice(0, 8)}…${h.slice(-6)}`;
}

// ── Filter types ───────────────────────────────────────────
const FILTER_OPTIONS: Array<{ value: TxRecord['type'] | 'ALL'; label: string }> = [
  { value: 'ALL',            label: 'All' },
  { value: 'VOTE_CAST',      label: 'Votes' },
  { value: 'VOTER_REGISTER', label: 'Registrations' },
  { value: 'VOTER_FUNDED',   label: 'Funded' },
  { value: 'FUND_CONTRACT',  label: 'Funding' },
  { value: 'ELECTION_MANAGE',label: 'Admin' },
];

// ══ Main Page ══════════════════════════════════════════════
export default function TransactionHistoryPage() {
  const [account, setAccount]     = useState('');
  const [contractAddr, setContractAddr] = useState('');
  const [txList, setTxList]       = useState<TxRecord[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [filter, setFilter]       = useState<TxRecord['type'] | 'ALL'>('ALL');
  const [connected, setConnected] = useState(false);

  const connect = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const ok = await web3Service.initialize();
      if (!ok) { setError('Could not connect MetaMask.'); return; }
      const acc = web3Service.getAccount();
      const caddr = web3Service.getContractAddress();
      setAccount(acc);
      setContractAddr(caddr);
      setConnected(true);
      await fetchHistory(acc, caddr);
    } catch (e: any) {
      const msg = normalizeWeb3Error(e); setError(msg); toast.error('MetaMask connection failed', { description: msg });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { connect(); }, []);

  const fetchHistory = async (addr: string, caddr: string) => {
    if (!addr || !caddr) return;
    setLoading(true);
    setError('');
    try {
      // 1. Outgoing txs FROM wallet TO contract
      const outUrl = `${ETHERSCAN_V2_API}?chainid=80002&module=account&action=txlist&address=${addr}&startblock=0&endblock=latest&page=1&offset=200&sort=desc&apikey=${API_KEY}`;
      const outRes = await fetch(outUrl);
      const outData = await outRes.json();

      // 2. Internal transactions TO wallet (voter fund transfers FROM contract)
      const internalUrl = `${ETHERSCAN_V2_API}?chainid=80002&module=account&action=txlistinternal&address=${addr}&startblock=0&endblock=latest&page=1&offset=200&sort=desc&apikey=${API_KEY}`;
      const internalRes = await fetch(internalUrl);
      const internalData = await internalRes.json();

      const records: TxRecord[] = [];

      // Process outgoing txs (filter to those interacting with contract)
      if (outData.status === '1' && Array.isArray(outData.result)) {
        outData.result
          .filter((tx: any) =>
            tx.to?.toLowerCase() === caddr.toLowerCase() ||
            (tx.from?.toLowerCase() === addr.toLowerCase() && tx.to?.toLowerCase() === caddr.toLowerCase())
          )
          .forEach((tx: any) => records.push(classifyTx(tx, addr, caddr)));
      }

      // Process internal transfers (POL from contract → wallet)
      if (internalData.status === '1' && Array.isArray(internalData.result)) {
        internalData.result
          .filter((tx: any) =>
            tx.from?.toLowerCase() === caddr.toLowerCase() &&
            tx.to?.toLowerCase() === addr.toLowerCase() &&
            BigInt(tx.value || '0') > 0n
          )
          .forEach((tx: any) => {
            records.push({
              hash: tx.hash,
              blockNumber: tx.blockNumber,
              timeStamp: tx.timeStamp,
              type: 'VOTER_FUNDED',
              label: 'Received POL (Voter Fund)',
              detail: '',
              value: `${(Number(BigInt(tx.value)) / 1e18).toFixed(4)} POL`,
              direction: 'in',
              status: tx.isError === '1' ? 'fail' : 'success',
            });
          });
      }

      if (outData.status === '0' && internalData.status === '0') {
        const msg = 'Polygonscan API returned no data. You may have no contract interactions yet, or the API is rate-limiting.';
        setError(msg);
        toast.warning('No transactions found', { description: msg });
      }

      // Sort by timestamp desc, deduplicate by hash+type
      const seen = new Set<string>();
      const deduped = records
        .filter(r => { const key = r.hash + r.type; if (seen.has(key)) return false; seen.add(key); return true; })
        .sort((a, b) => parseInt(b.timeStamp) - parseInt(a.timeStamp));

      setTxList(deduped);
    } catch (e: any) {
      const msg = 'Failed to fetch transaction history: ' + (e.message || 'Unknown error');
      setError(msg);
      toast.error('History fetch failed', { description: e.message || 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  const filtered = filter === 'ALL' ? txList : txList.filter(t => t.type === filter);

  // ── Not connected ──────────────────────────────────────────
  if (!connected && !loading) return (
    <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 16, padding: 40, maxWidth: 420, width: '90%', textAlign: 'center' }}>
        <Wallet size={40} style={{ color: '#38BDF8', margin: '0 auto 16px' }} />
        <h2 style={{ color: '#E5E7EB', fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>Connect MetaMask</h2>
        <p style={{ color: '#9CA3AF', fontSize: 14, marginBottom: 24 }}>Connect your wallet to view your blockchain transaction history.</p>
        {error && <div style={{ color: '#EF4444', fontSize: 13, marginBottom: 16, background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: 8 }}>{error}</div>}
        <motion.button onClick={connect} whileTap={{ scale: 0.96 }}
          style={{ width: '100%', padding: '11px 0', background: '#22C55E', border: 'none', borderRadius: 10, color: '#0F172A', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          Connect MetaMask
        </motion.button>
      </motion.div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0F172A', paddingBottom: 60 }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg,#0F172A,#111827)', borderBottom: '1px solid #1F2937', padding: '36px 0 32px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px' }}>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#38BDF8,#0EA5E9)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <History size={26} style={{ color: '#0F172A' }} />
              </div>
              <div>
                <h1 style={{ color: '#E5E7EB', fontSize: 22, fontWeight: 800, margin: 0 }}>Transaction History</h1>
                <p style={{ color: '#6B7280', fontSize: 13, margin: '4px 0 0' }}>
                  Your interactions with the voting contract on Polygon Amoy
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <a href={`${AMOY_SCAN}/address/${account}`} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#1F2937', border: '1px solid #374151', borderRadius: 10, color: '#9CA3AF', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                <ExternalLink size={13} /> Polygonscan
              </a>
              <motion.button onClick={() => fetchHistory(account, contractAddr)} disabled={loading}
                whileTap={{ scale: 0.96 }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#1F2937', border: '1px solid #374151', borderRadius: 10, color: '#9CA3AF', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                Refresh
              </motion.button>
            </div>
          </motion.div>

          {/* Wallet address */}
          {account && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
              style={{ marginTop: 20, padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid #1F2937', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Wallet size={14} style={{ color: '#38BDF8' }} />
              <span style={{ color: '#9CA3AF', fontSize: 12 }}>Wallet: </span>
              <span style={{ color: '#E5E7EB', fontFamily: 'monospace', fontSize: 12 }}>{account}</span>
              <span style={{ marginLeft: 'auto', background: 'rgba(34,197,94,0.12)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
                {txList.length} txs found
              </span>
            </motion.div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>

        {/* ── Filter tabs ──────────────────────────────────── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          <Filter size={14} style={{ color: '#6B7280', alignSelf: 'center', marginRight: 4 }} />
          {FILTER_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setFilter(opt.value as any)}
              style={{
                padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: filter === opt.value ? '#22C55E' : '#1F2937',
                color: filter === opt.value ? '#0F172A' : '#9CA3AF',
              }}>
              {opt.label}
              {opt.value !== 'ALL' && (
                <span style={{ marginLeft: 6, opacity: 0.7 }}>
                  ({txList.filter(t => t.type === opt.value).length})
                </span>
              )}
            </button>
          ))}
        </motion.div>

        {/* ── Error ────────────────────────────────────────── */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertTriangle size={16} style={{ color: '#EF4444', flexShrink: 0, marginTop: 1 }} />
            <span style={{ color: '#FCA5A5', fontSize: 13 }}>{error}</span>
          </div>
        )}

        {/* ── Loading ──────────────────────────────────────── */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Loader2 size={32} className="animate-spin" style={{ color: '#38BDF8', margin: '0 auto 12px' }} />
            <p style={{ color: '#9CA3AF', fontSize: 14 }}>Fetching transactions from Polygonscan…</p>
          </div>
        )}

        {/* ── Empty ────────────────────────────────────────── */}
        {!loading && filtered.length === 0 && !error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ textAlign: 'center', padding: '80px 0' }}>
            <History size={48} style={{ color: '#374151', margin: '0 auto 16px' }} />
            <h3 style={{ color: '#6B7280', fontSize: 17, fontWeight: 600, marginBottom: 8 }}>No Transactions Found</h3>
            <p style={{ color: '#4B5563', fontSize: 13 }}>
              {filter !== 'ALL' ? 'No transactions match this filter.' : 'You haven\'t interacted with the voting contract yet.'}
            </p>
            <Link to="/elections" style={{ color: '#22C55E', fontSize: 13, marginTop: 16, display: 'inline-block' }}>Go to Elections →</Link>
          </motion.div>
        )}

        {/* ── Transaction List ─────────────────────────────── */}
        {!loading && filtered.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((tx, i) => {
              const cfg = TYPE_CONFIG[tx.type];
              return (
                <motion.div key={tx.hash + i}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  style={{ background: '#1F2937', border: `1px solid #374151`, borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>

                  {/* Type icon */}
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: cfg.color }}>
                    {cfg.icon}
                  </div>

                  {/* Main content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ color: '#E5E7EB', fontWeight: 700, fontSize: 14 }}>{tx.label}</span>
                      {tx.status === 'fail' && (
                        <span style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '1px 8px', fontSize: 10, fontWeight: 700 }}>FAILED</span>
                      )}
                      {tx.status === 'success' && (
                        <CheckCircle size={13} style={{ color: '#22C55E' }} />
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                      <span style={{ color: '#6B7280', fontSize: 12 }}>{fmtTime(tx.timeStamp)}</span>
                      <span style={{ color: '#374151' }}>·</span>
                      <span style={{ color: '#6B7280', fontSize: 12, fontFamily: 'monospace' }}>Block #{tx.blockNumber}</span>
                      <span style={{ color: '#374151' }}>·</span>
                      <a href={`${AMOY_SCAN}/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#38BDF8', fontSize: 12, textDecoration: 'none', fontFamily: 'monospace' }}>
                        {shortHash(tx.hash)} <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>

                  {/* Value */}
                  {tx.value && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{
                        color: tx.direction === 'in' ? '#22C55E' : tx.direction === 'out' ? '#F87171' : '#9CA3AF',
                        fontWeight: 700, fontSize: 15,
                      }}>
                        {tx.direction === 'in' ? '+' : tx.direction === 'out' ? '-' : ''}{tx.value}
                      </span>
                    </div>
                  )}

                  {/* Type badge */}
                  <span style={{ padding: '4px 10px', background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}33`, borderRadius: 20, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                    {tx.type.replace('_', ' ')}
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ── Footer note ─────────────────────────────────── */}
        {!loading && (
          <div style={{ marginTop: 32, padding: '14px 18px', background: 'rgba(56,189,248,0.04)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 12 }}>
            <p style={{ color: '#6B7280', fontSize: 12, margin: 0 }}>
              Data is fetched from the <a href={`${AMOY_SCAN}/address/${contractAddr}`} target="_blank" rel="noopener noreferrer" style={{ color: '#38BDF8' }}>Polygonscan Amoy API</a>.
              Internal transfers (POL auto-funding) are shown as incoming "VOTER_FUNDED" entries.
              Only transactions involving the voting contract are displayed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
