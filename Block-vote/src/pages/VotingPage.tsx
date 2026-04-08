import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Vote,
  Crown,
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus,
  Play,
  Square,
  Loader2,
  Copy,
  RefreshCw,
  Trophy,
  Lock,
  Wallet,
  ArrowLeft,
  Building2,
  Edit3,
  X,
} from 'lucide-react';
import web3Service, { normalizeWeb3Error } from '@/services/web3';
import { Election, Candidate, VoterInfo, WalletAuthStatus } from '@/types/auth.types';
import { useWalletValidation } from '@/hooks/useWalletValidation';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

/* ── clipboard helper for tx hashes ─────────────────── */
function copyTx(hash: string) {
  navigator.clipboard.writeText(hash);
  toast('Copied!', { description: hash.slice(0, 18) + '…', duration: 1500 });
}

/* ── animation variants ──────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.4, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
  }),
};

const slideInRight = {
  hidden: { opacity: 0, x: 40 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, x: 40, transition: { duration: 0.2 } },
};

/* ── Progress Bar component ──────────────────────────── */
function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="progress-track mt-2">
      <motion.div
        className="h-full rounded-full"
        style={{ background: '#22C55E' }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      />
    </div>
  );
}

/* (custom ToastItem removed — using Sonner instead) */

/* ── Skeleton card ───────────────────────────────────── */
function SkeletonCard() {
  return (
    <div
      style={{
        background: '#1F2937',
        border: '1px solid #374151',
        borderRadius: 14,
        padding: 24,
      }}
    >
      <div style={{ background: '#374151', borderRadius: 8, height: 20, width: '60%', marginBottom: 12 }} className="animate-pulse" />
      <div style={{ background: '#374151', borderRadius: 8, height: 14, width: '40%', marginBottom: 20 }} className="animate-pulse" />
      <div style={{ background: '#374151', borderRadius: 8, height: 8, width: '100%' }} className="animate-pulse" />
    </div>
  );
}

/* ── Confirm Vote Modal ──────────────────────────────── */
function ConfirmModal({
  name,
  onConfirm,
  onCancel,
}: {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#1F2937', border: '1px solid #374151',
          borderRadius: 16, padding: 32, maxWidth: 380, width: '90%', textAlign: 'center',
        }}
      >
        <Lock size={32} style={{ color: '#F59E0B', margin: '0 auto 16px' }} />
        <h3 style={{ color: '#E5E7EB', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          Confirm Your Vote
        </h3>
        <p style={{ color: '#9CA3AF', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
          You are about to vote for <span style={{ color: '#22C55E', fontWeight: 600 }}>{name}</span>.
          <br />This action <strong>cannot be undone</strong>.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <motion.button className="btn-outline-sky" onClick={onCancel} whileTap={{ scale: 0.96 }} style={{ flex: 1 }}>
            Cancel
          </motion.button>
          <motion.button className="btn-emerald" onClick={onConfirm} whileTap={{ scale: 0.96 }} style={{ flex: 1 }}>
            Cast Vote
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ══ Main VotingPage ══════════════════════════════════ */
export default function VotingPage() {
  const { user, isAuthenticated } = useAuth();
  const { electionId: electionIdParam } = useParams<{ electionId: string }>();
  const navigate = useNavigate();
  const electionId = parseInt(electionIdParam || '0');

  const [web3Initialized, setWeb3Initialized] = useState(false);
  const [account, setAccount] = useState('');
  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [voterInfo, setVoterInfo] = useState<VoterInfo>({ isRegistered: false, hasVoted: false });
  const [isOwner, setIsOwner] = useState(false);
  const { isValid, isValidating, error: walletError, validateWallet } = useWalletValidation();

  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState('');
  const [newCandidateName, setNewCandidateName] = useState('');
  const [newCandidateDesc, setNewCandidateDesc] = useState('');
  const [confirmVote, setConfirmVote] = useState<{ id: number; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // ── init ───────────────────────────────────────────────
  useEffect(() => {
    if (isAuthenticated) initializeWeb3();
  }, [isAuthenticated]);

  useEffect(() => {
    if (web3Initialized) {
      loadContractData();
      validateWallet(false); // check without forcing logout
    }
  }, [web3Initialized, validateWallet]);

  // Adaptive polling: 10s when active, 30s otherwise. Stop when tab hidden.
  useEffect(() => {
    if (!web3Initialized) return;
    const INTERVAL = election?.isActive ? 10000 : 30000;
    const poll = setInterval(async () => {
      if (document.hidden) return;
      setIsPolling(true);
      try {
        await loadContractData(true);
        setLastUpdated(new Date());
      } finally {
        setIsPolling(false);
      }
    }, INTERVAL);
    return () => clearInterval(poll);
  }, [web3Initialized, election?.isActive]);

  const initializeWeb3 = async () => {
    setInitializing(true);
    try {
      const ok = await web3Service.initialize();
      if (ok) {
        setWeb3Initialized(true);
        setAccount(web3Service.getAccount());
        setError('');
      } else {
        setError('Failed to connect MetaMask. Install MetaMask and connect to Polygon Amoy Testnet.');
      }
    } catch (err: any) {
      setError(normalizeWeb3Error(err));
    } finally {
      setInitializing(false);
    }
  };

  const loadContractData = async (backgroundSync = false) => {
    try {
      if (!backgroundSync) setLoading(true);
      const [ownerStatus, electionData, voterData, candidatesData] = await Promise.all([
        web3Service.isOwner(),
        web3Service.getElection(electionId),
        web3Service.getVoterInfo(electionId),
        web3Service.getCandidates(electionId),
      ]);
      setIsOwner(ownerStatus);
      setElection(electionData);
      setVoterInfo(voterData);
      setCandidates(candidatesData);
      setError('');
    } catch (err: any) {
      setError(`Failed to load election data: ${normalizeWeb3Error(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // ── actions ────────────────────────────────────────────
  const registerSelf = async () => {
    try {
      setLoading(true);
      const txHash = await web3Service.registerSelf(electionId);
      toast.success('Registered + received 0.5 POL!', {
        description: `Tx: ${txHash.slice(0, 18)}…`,
        action: { label: 'Copy Tx', onClick: () => copyTx(txHash) },
      });
      const voterData = await web3Service.getVoterInfo(electionId);
      setVoterInfo(voterData);
    } catch (err: any) {
      toast.error('Registration failed', { description: normalizeWeb3Error(err) });
    } finally {
      setLoading(false);
    }
  };

  const addCandidate = async () => {
    if (!newCandidateName.trim()) {
      toast.error('Name required', { description: 'Candidate name cannot be empty.' });
      return;
    }
    try {
      setLoading(true);
      const txHash = await web3Service.addCandidate(electionId, newCandidateName, newCandidateDesc);
      toast.success('Candidate added!', {
        description: `Tx: ${txHash.slice(0, 18)}…`,
        action: { label: 'Copy Tx', onClick: () => copyTx(txHash) },
      });
      setNewCandidateName('');
      setNewCandidateDesc('');
      const candidatesData = await web3Service.getCandidates(electionId);
      setCandidates(candidatesData);
    } catch (err: any) {
      toast.error('Failed to add candidate', { description: normalizeWeb3Error(err) });
    } finally {
      setLoading(false);
    }
  };

  const openVoting = async () => {
    try {
      setLoading(true);
      await web3Service.openVoting(electionId);
      toast.success('Voting is now open!');
      await loadContractData();
    } catch (err: any) {
      toast.error('Failed to open voting', { description: normalizeWeb3Error(err) });
    } finally {
      setLoading(false);
    }
  };

  const closeVoting = async () => {
    try {
      setLoading(true);
      await web3Service.closeVoting(electionId);
      toast.success('Voting has been closed.');
      await loadContractData();
    } catch (err: any) {
      toast.error('Failed to close voting', { description: normalizeWeb3Error(err) });
    } finally {
      setLoading(false);
    }
  };

  const confirmAndCastVote = (candidate: Candidate) => {
    setConfirmVote({ id: candidate.id, name: candidate.name });
  };

  const castVote = async () => {
    if (!confirmVote) return;
    setConfirmVote(null);
    try {
      setLoading(true);
      const txHash = await web3Service.castVote(electionId, confirmVote.id);
      // 🎉 Confetti burst!
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      setTimeout(() => confetti({ particleCount: 60, spread: 120, origin: { y: 0.4, x: 0.3 } }), 250);
      setTimeout(() => confetti({ particleCount: 60, spread: 120, origin: { y: 0.4, x: 0.7 } }), 400);
      toast.success('🎉 Vote cast on blockchain!', {
        description: `Tx: ${txHash.slice(0, 18)}…`,
        action: { label: 'Copy Tx', onClick: () => copyTx(txHash) },
        duration: 6000,
      });
      const [voterData, candidatesData] = await Promise.all([
        web3Service.getVoterInfo(electionId),
        web3Service.getCandidates(electionId),
      ]);
      setVoterInfo(voterData);
      setCandidates(candidatesData);
    } catch (err: any) {
      toast.error('Voting failed', { description: normalizeWeb3Error(err) });
    } finally {
      setLoading(false);
    }
  };

  const switchNetwork = async () => {
    try {
      setLoading(true);
      const ok = await web3Service.switchToPolygonAmoy();
      if (ok) {
        toast.info('Switching to Polygon Amoy…');
        setTimeout(() => window.location.reload(), 1000);
      } else {
        toast.error('Network switch failed');
      }
    } catch (err: any) {
      toast.error('Network switch failed', { description: normalizeWeb3Error(err) });
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = () => {
    if (!account) return;
    navigator.clipboard.writeText(account);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── derived ────────────────────────────────────────────
  const totalVotes = candidates.reduce((s, c) => s + c.votes, 0);
  const winnerIdx = candidates.length
    ? candidates.reduce((best, c, i) => (c.votes > candidates[best].votes ? i : best), 0)
    : -1;

  // ── guard: not authenticated ────────────────────────────
  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          className="card-dark" style={{ padding: 40, maxWidth: 380, width: '90%', textAlign: 'center' }}
        >
          <Shield size={40} style={{ color: '#22C55E', margin: '0 auto 16px' }} />
          <h2 style={{ color: '#E5E7EB', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Authentication Required</h2>
          <p style={{ color: '#9CA3AF', marginBottom: 24, fontSize: 14 }}>Login to access the blockchain voting system.</p>
          <a href="/login" className="btn-emerald" style={{ display: 'inline-flex', textDecoration: 'none' }}>Go to Login</a>
        </motion.div>
      </div>
    );
  }

  // ── guard: web3 not connected ───────────────────────────
  if (!web3Initialized) {
    return (
      <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          className="card-dark" style={{ padding: 40, maxWidth: 440, width: '90%' }}
        >
          <Wallet size={40} style={{ color: '#38BDF8', marginBottom: 16 }} />
          <h2 style={{ color: '#E5E7EB', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Connect MetaMask</h2>
          <p style={{ color: '#9CA3AF', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
            Install MetaMask and connect to <span style={{ color: '#38BDF8', fontWeight: 600 }}>Polygon Amoy Testnet</span> (Chain ID: 80002) to continue.
          </p>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, color: '#EF4444', fontSize: 13 }}>{error}</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <motion.button className="btn-emerald" onClick={initializeWeb3} disabled={initializing} whileTap={{ scale: 0.96 }} style={{ width: '100%' }}>
              {initializing && <Loader2 size={16} className="animate-spin" />}
              Connect MetaMask
            </motion.button>
            <motion.button className="btn-outline-sky" onClick={switchNetwork} disabled={loading} whileTap={{ scale: 0.96 }} style={{ width: '100%' }}>
              Switch to Polygon Amoy
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── guard: wallet mismatch ──────────────────────────────
  if (!isValid && !isValidating) {
    return (
      <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          className="card-dark" style={{ padding: 40, maxWidth: 440, width: '90%', textAlign: 'center' }}
        >
          <AlertTriangle size={40} style={{ color: '#EF4444', margin: '0 auto 16px' }} />
          <h2 style={{ color: '#E5E7EB', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Wallet Mismatch</h2>
          <p style={{ color: '#9CA3AF', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
            {walletError || 'Please change your MetaMask wallet to the registered one.'}
          </p>
          <motion.button className="btn-emerald" onClick={() => validateWallet(false)} whileTap={{ scale: 0.96 }} style={{ width: '100%' }}>
            Check Again
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // ── main page ───────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#0F172A', paddingBottom: 60 }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px' }}>

        {/* ── HEADER ── */}
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show"
          style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 32 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <motion.button
              onClick={() => navigate('/elections')}
              whileHover={{ x: -3 }}
              whileTap={{ scale: 0.95 }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 4 }}
            >
              <ArrowLeft size={22} />
            </motion.button>
            <div style={{ width: 52, height: 52, borderRadius: 12, background: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Vote size={26} style={{ color: '#0F172A' }} />
            </div>
            <div>
              <h1 style={{ color: '#E5E7EB', fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                {election?.name || 'Loading…'}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                {election?.organizationName && (
                  <>
                    <Building2 size={12} style={{ color: '#6B7280' }} />
                    <span style={{ color: '#6B7280', fontSize: 13 }}>{election.organizationName}</span>
                  </>
                )}
                <span style={{
                  background: election?.isActive ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)',
                  color: election?.isActive ? '#22C55E' : '#9CA3AF',
                  border: `1px solid ${election?.isActive ? 'rgba(34,197,94,0.4)' : 'rgba(107,114,128,0.4)'}`,
                  borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600,
                }}>
                  {election?.isActive ? '● LIVE' : election?.endTime ? '■ CLOSED' : '○ SETUP'}
                </span>
              </div>
            </div>
          </div>

          {/* Right: wallet + refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {account && (
              <motion.div
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#1F2937', border: '1px solid #374151', borderRadius: 8, padding: '6px 12px' }}
                whileHover={{ borderColor: '#4B5563' }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E' }} />
                <span style={{ color: '#9CA3AF', fontSize: 13, fontFamily: 'monospace' }}>
                  {account.slice(0, 6)}…{account.slice(-4)}
                </span>
                <motion.button onClick={copyAddress} whileTap={{ scale: 0.9 }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#22C55E' : '#6B7280', padding: 2 }}
                >
                  {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                </motion.button>
              </motion.div>
            )}
            {/* Live polling indicator */}
            {election?.isActive && (
              <motion.div
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, padding: '5px 10px' }}
                animate={isPolling ? { opacity: [1, 0.5, 1] } : {}}
                transition={{ duration: 0.6, repeat: isPolling ? Infinity : 0 }}
              >
                <motion.div
                  style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E' }}
                  animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                />
                <span style={{ color: '#22C55E', fontSize: 11, fontWeight: 700 }}>LIVE</span>
                {lastUpdated && (
                  <span style={{ color: '#4B5563', fontSize: 10 }}>
                    {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </motion.div>
            )}
            <motion.button
              onClick={() => loadContractData()}
              whileTap={{ scale: 0.9 }}
              disabled={loading}
              style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#9CA3AF', display: 'flex', alignItems: 'center' }}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </motion.button>
          </div>
        </motion.div>

        {/* ── ERROR ── */}
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '12px 16px', marginBottom: 24, color: '#EF4444', fontSize: 13 }}
          >
            <AlertTriangle size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} /> {error}
          </motion.div>
        )}

        {/* ── ELECTION DESCRIPTION ── */}
        {election?.description && (
          <motion.div custom={0.5} variants={fadeUp} initial="hidden" animate="show"
            style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 12, padding: '14px 18px', marginBottom: 24, color: '#9CA3AF', fontSize: 14, lineHeight: 1.6 }}
          >
            {election.description}
          </motion.div>
        )}

        {/* ── ADMIN PANEL (owner only) ── */}
        {isOwner && (
          <motion.div custom={1} variants={fadeUp} initial="hidden" animate="show"
            style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 14, padding: 24, marginBottom: 24 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Crown size={18} style={{ color: '#F59E0B' }} />
              <h2 style={{ color: '#E5E7EB', fontSize: 16, fontWeight: 700, margin: 0 }}>Admin Panel</h2>
            </div>

            {/* Add Candidate */}
            {!election?.isActive && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Candidate name"
                  value={newCandidateName}
                  onChange={(e) => setNewCandidateName(e.target.value)}
                  style={{ flex: 1, minWidth: 140, padding: '8px 14px', background: '#111827', border: '1px solid #374151', borderRadius: 8, color: '#E5E7EB', fontSize: 14, outline: 'none' }}
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newCandidateDesc}
                  onChange={(e) => setNewCandidateDesc(e.target.value)}
                  style={{ flex: 1, minWidth: 140, padding: '8px 14px', background: '#111827', border: '1px solid #374151', borderRadius: 8, color: '#E5E7EB', fontSize: 14, outline: 'none' }}
                />
                <motion.button
                  className="btn-emerald"
                  onClick={addCandidate}
                  disabled={loading || !newCandidateName.trim()}
                  whileTap={{ scale: 0.96 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Plus size={16} /> Add
                </motion.button>
              </div>
            )}

            {/* Voting controls */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {!election?.isActive ? (
                <motion.button className="btn-emerald" onClick={openVoting} disabled={loading || candidates.length === 0} whileTap={{ scale: 0.96 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Play size={16} /> Open Voting
                </motion.button>
              ) : (
                <motion.button className="btn-outline-sky" onClick={closeVoting} disabled={loading} whileTap={{ scale: 0.96 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, borderColor: '#EF4444', color: '#EF4444' }}
                >
                  <Square size={16} /> Close Voting
                </motion.button>
              )}
            </div>
          </motion.div>
        )}

        {/* ── VOTER STATUS ── */}
        <motion.div custom={2} variants={fadeUp} initial="hidden" animate="show"
          style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 14, padding: 24, marginBottom: 24 }}
        >
          <h3 style={{ color: '#E5E7EB', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Your Status</h3>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {voterInfo.isRegistered ? <CheckCircle size={16} style={{ color: '#22C55E' }} /> : <XCircle size={16} style={{ color: '#6B7280' }} />}
              <span style={{ color: voterInfo.isRegistered ? '#22C55E' : '#6B7280', fontSize: 13, fontWeight: 600 }}>
                {voterInfo.isRegistered ? 'Registered' : 'Not Registered'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {voterInfo.hasVoted ? <CheckCircle size={16} style={{ color: '#38BDF8' }} /> : <XCircle size={16} style={{ color: '#6B7280' }} />}
              <span style={{ color: voterInfo.hasVoted ? '#38BDF8' : '#6B7280', fontSize: 13, fontWeight: 600 }}>
                {voterInfo.hasVoted ? 'Voted' : 'Not Voted'}
              </span>
            </div>
          </div>
          {!voterInfo.isRegistered && (
            <motion.button className="btn-emerald" onClick={registerSelf} disabled={loading} whileTap={{ scale: 0.96 }}
              style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
              Register as Voter (get 0.5 POL)
            </motion.button>
          )}
        </motion.div>

        {/* ── CANDIDATES ── */}
        <motion.div custom={3} variants={fadeUp} initial="hidden" animate="show">
          <h2 style={{ color: '#E5E7EB', fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
            Candidates ({candidates.length})
          </h2>

          {loading && candidates.length === 0 && (
            <div style={{ display: 'grid', gap: 12 }}>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          )}

          {!loading && candidates.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Vote size={36} style={{ color: '#374151', margin: '0 auto 12px' }} />
              <p style={{ color: '#6B7280', fontSize: 14 }}>No candidates added yet.</p>
            </div>
          )}

          <div style={{ display: 'grid', gap: 12 }}>
            {candidates.map((candidate, i) => {
              const pct = totalVotes > 0 ? (candidate.votes / totalVotes) * 100 : 0;
              const isWinner = winnerIdx === i && !election?.isActive && totalVotes > 0;
              return (
                <motion.div
                  key={candidate.id}
                  custom={i + 4}
                  variants={fadeUp}
                  initial="hidden"
                  animate="show"
                  style={{
                    background: isWinner ? 'rgba(34,197,94,0.06)' : '#1F2937',
                    border: `1px solid ${isWinner ? 'rgba(34,197,94,0.3)' : '#374151'}`,
                    borderRadius: 14,
                    padding: 20,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h3 style={{ color: '#E5E7EB', fontSize: 16, fontWeight: 700, margin: 0 }}>
                          {candidate.name}
                        </h3>
                        {isWinner && <Trophy size={16} style={{ color: '#F59E0B' }} />}
                      </div>
                      {candidate.description && (
                        <p style={{ color: '#6B7280', fontSize: 13, margin: '4px 0 0' }}>{candidate.description}</p>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: '#E5E7EB', fontSize: 20, fontWeight: 800 }}>{candidate.votes}</span>
                      <span style={{ color: '#6B7280', fontSize: 12, display: 'block' }}>
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <ProgressBar pct={pct} />

                  {election?.isActive && voterInfo.isRegistered && !voterInfo.hasVoted && (
                    <motion.button
                      className="btn-emerald"
                      onClick={() => confirmAndCastVote(candidate)}
                      disabled={loading}
                      whileTap={{ scale: 0.96 }}
                      style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <Vote size={14} /> Vote
                    </motion.button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* ── FOOTER ── */}
        <motion.div
          custom={candidates.length + 5}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          style={{ textAlign: 'center', marginTop: 48, color: '#4B5563', fontSize: 12 }}
        >
          Powered by Polygon Smart Contracts · Election #{electionId}
        </motion.div>
      </div>

      {/* Sonner toasts rendered globally via App.tsx */}

      {/* ── Confirm Vote Modal ── */}
      <AnimatePresence>
        {confirmVote && (
          <ConfirmModal
            name={confirmVote.name}
            onConfirm={castVote}
            onCancel={() => setConfirmVote(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}