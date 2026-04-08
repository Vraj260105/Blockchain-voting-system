import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Vote, Plus, Loader2, Calendar, Building2, Users,
  ChevronRight, Wallet, Shield, AlertTriangle, X,
  Clock, Zap, Settings, BarChart2, Search,
} from 'lucide-react';
import web3Service, { normalizeWeb3Error } from '@/services/web3';
import { Election } from '@/types/auth.types';
import { toast } from 'sonner';

/* ── helpers ──────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
  }),
};

function getElectionStatus(e: Election): 'active' | 'upcoming' | 'scheduled' | 'closed' {
  if (e.isActive) return 'active';
  const now = Math.floor(Date.now() / 1000);
  if (e.scheduledStart > 0 && now < e.scheduledStart) return 'scheduled';
  if (e.endTime > 0) return 'closed';
  return 'upcoming';
}

const STATUS_CONFIG = {
  active:    { bg: 'rgba(34,197,94,0.15)',  color: '#22C55E', border: 'rgba(34,197,94,0.4)',  label: '● Live' },
  upcoming:  { bg: 'rgba(107,114,128,0.15)', color: '#9CA3AF', border: 'rgba(107,114,128,0.4)', label: '○ Setup' },
  scheduled: { bg: 'rgba(251,191,36,0.15)', color: '#FBBF24', border: 'rgba(251,191,36,0.4)', label: '◉ Scheduled' },
  closed:    { bg: 'rgba(107,114,128,0.15)', color: '#6B7280', border: 'rgba(107,114,128,0.3)', label: '■ Closed' },
};

function StatusBadge({ status }: { status: ReturnType<typeof getElectionStatus> }) {
  const c = STATUS_CONFIG[status];
  return (
    <span style={{
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600, letterSpacing: '0.03em',
    }}>{c.label}</span>
  );
}

/** Convert datetime-local string "YYYY-MM-DDTHH:mm" to unix timestamp (0 if empty) */
function dtToUnix(val: string): number {
  if (!val) return 0;
  return Math.floor(new Date(val).getTime() / 1000);
}

/** Convert unix timestamp to "YYYY-MM-DDTHH:mm" for datetime-local input (empty if 0) */
function unixToDt(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ── main page ──────────────────────────────── */
export default function ElectionsPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [web3Initialized, setWeb3Initialized] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [elections, setElections] = useState<Election[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [contractBalance, setContractBalance] = useState('0');
  const [triggeringId, setTriggeringId] = useState<number | null>(null);

  // create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newOrg, setNewOrg] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'scheduled' | 'closed'>('all');

  useEffect(() => { if (isAuthenticated) initWeb3(); }, [isAuthenticated]);
  useEffect(() => { if (web3Initialized) loadElections(); }, [web3Initialized]);

  const initWeb3 = async () => {
    setInitializing(true);
    try {
      const ok = await web3Service.initialize();
      if (ok) {
        setWeb3Initialized(true);
        const ownerFlag = await web3Service.isOwner();
        setIsOwner(ownerFlag);
        if (ownerFlag) {
          const bal = await web3Service.getContractBalance();
          setContractBalance(bal);
        }
      } else setError('Failed to connect MetaMask.');
    } catch (err: any) { const msg = normalizeWeb3Error(err); setError(msg); toast.error('MetaMask connection failed', { description: msg }); }
    finally { setInitializing(false); }
  };

  const loadElections = async () => {
    setLoading(true);
    try {
      const list = await web3Service.getAllElections();
      setElections(list);
      setError('');
    } catch (err: any) { const msg = normalizeWeb3Error(err); setError(msg); toast.error('Failed to load elections', { description: msg }); }
    finally { setLoading(false); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const startTs = dtToUnix(newStart);
    const endTs = dtToUnix(newEnd);
    if (endTs > 0 && endTs <= Math.floor(Date.now() / 1000)) {
      setError('End time must be in the future.'); return;
    }
    if (startTs > 0 && endTs > 0 && endTs <= startTs) {
      setError('End time must be after start time.'); return;
    }
    setCreating(true);
    try {
      await web3Service.createElection(newName, newDesc, newOrg, startTs, endTs);
      setShowCreate(false);
      setNewName(''); setNewDesc(''); setNewOrg(''); setNewStart(''); setNewEnd('');
      await loadElections();
    } catch (err: any) { const msg = normalizeWeb3Error(err); setError(msg); toast.error('Failed to create election', { description: msg }); }
    finally { setCreating(false); }
  };

  const handleTrigger = async (electionId: number) => {
    setTriggeringId(electionId);
    try {
      await web3Service.triggerElectionStatus(electionId);
      await loadElections();
    } catch (err: any) { const msg = normalizeWeb3Error(err); setError(msg); toast.error('Failed to trigger election', { description: msg }); }
    finally { setTriggeringId(null); }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 14px', background: '#111827',
    border: '1px solid #374151', borderRadius: 10, color: '#E5E7EB',
    fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  };

  // ── guard: not authenticated ────────────────
  if (!isAuthenticated) return (
    <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 16, padding: 40, maxWidth: 380, width: '90%', textAlign: 'center' }}
      >
        <Shield size={40} style={{ color: '#22C55E', margin: '0 auto 16px' }} />
        <h2 style={{ color: '#E5E7EB', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Authentication Required</h2>
        <p style={{ color: '#9CA3AF', marginBottom: 24, fontSize: 14 }}>Login to access the blockchain voting system.</p>
        <a href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', background: '#22C55E', color: '#0F172A', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>Go to Login</a>
      </motion.div>
    </div>
  );

  // ── guard: web3 not connected ───────────────
  if (!web3Initialized) return (
    <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 16, padding: 40, maxWidth: 440, width: '90%' }}
      >
        <Wallet size={40} style={{ color: '#38BDF8', marginBottom: 16 }} />
        <h2 style={{ color: '#E5E7EB', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Connect MetaMask</h2>
        <p style={{ color: '#9CA3AF', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
          Install MetaMask and connect to <span style={{ color: '#38BDF8', fontWeight: 600 }}>Polygon Amoy Testnet</span> (Chain ID: 80002).
        </p>
        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, color: '#EF4444', fontSize: 13 }}>{error}</div>}
        <motion.button onClick={initWeb3} disabled={initializing} whileTap={{ scale: 0.96 }}
          style={{ width: '100%', padding: '11px 0', background: '#22C55E', border: 'none', borderRadius: 10, color: '#0F172A', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          {initializing && <Loader2 size={16} className="animate-spin" />} Connect MetaMask
        </motion.button>
      </motion.div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0F172A', paddingBottom: 60 }}>
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '32px 16px' }}>

        {/* Header */}
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show"
          style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 32 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 12, background: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Vote size={26} style={{ color: '#0F172A' }} />
            </div>
            <div>
              <h1 style={{ color: '#E5E7EB', fontSize: 22, fontWeight: 800, margin: 0 }}>Elections</h1>
              <p style={{ color: '#6B7280', fontSize: 13, margin: '2px 0 0' }}>{elections.length} election{elections.length !== 1 ? 's' : ''} on-chain</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {isOwner && (
              <>
                <span style={{ color: '#6B7280', fontSize: 12 }}>
                  Contract: <span style={{ color: '#22C55E', fontWeight: 600 }}>{parseFloat(contractBalance).toFixed(3)} POL</span>
                </span>
                <motion.button onClick={() => navigate('/admin')} whileTap={{ scale: 0.96 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#1F2937', border: '1px solid #374151', borderRadius: 10, color: '#9CA3AF', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
                >
                  <Settings size={15} /> Admin
                </motion.button>
                <motion.button onClick={() => setShowCreate(true)} whileTap={{ scale: 0.96 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: '#22C55E', border: 'none', borderRadius: 10, color: '#0F172A', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}
                >
                  <Plus size={16} /> Create Election
                </motion.button>
              </>
            )}
          </div>
        </motion.div>

        {/* Error */}
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '12px 16px', marginBottom: 24, color: '#EF4444', fontSize: 13 }}
          >
            <AlertTriangle size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} /> {error}
          </motion.div>
        )}

        {/* ⚠️ Low balance warning — owner only */}
        {isOwner && parseFloat(contractBalance) < 1 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 12, padding: '12px 18px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
          >
            <AlertTriangle size={18} style={{ color: '#F87171', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ color: '#FECACA', fontWeight: 700, fontSize: 14 }}>Low Contract Balance — </span>
              <span style={{ color: '#FCA5A5', fontSize: 13 }}>
                Only <strong style={{ color: '#F87171' }}>{parseFloat(contractBalance).toFixed(3)} POL</strong> remaining. The contract auto-funds 0.5 POL per voter registration. Top up now to prevent registration failures.
              </span>
            </div>
            <a href="/admin" style={{ flexShrink: 0, padding: '7px 16px', background: '#EF4444', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              Top Up →
            </a>
          </motion.div>
        )}

        {/* Search + Filter */}
        {!loading && elections.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* search box */}
              <div style={{ flex: '1 1 240px', position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6B7280' }} />
                <input
                  type="text"
                  placeholder="Search elections…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px 9px 36px',
                    background: '#1F2937', border: '1px solid #374151', borderRadius: 10,
                    color: '#E5E7EB', fontSize: 13, outline: 'none',
                  }}
                />
              </div>
              {/* status filter pills */}
              <div style={{ display: 'flex', gap: 6 }}>
                {([['all','All'],['active','Live'],['scheduled','Scheduled'],['closed','Closed']] as const).map(([val, label]) => (
                  <button key={val} onClick={() => setStatusFilter(val)}
                    style={{
                      padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 600,
                      background: statusFilter === val ? '#22C55E' : '#1F2937',
                      color: statusFilter === val ? '#0F172A' : '#9CA3AF',
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Loader2 size={32} className="animate-spin" style={{ color: '#38BDF8', margin: '0 auto 16px' }} />
            <p style={{ color: '#9CA3AF', fontSize: 14 }}>Loading elections from blockchain…</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && elections.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', padding: '80px 0' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px' }}>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" />
              <path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14h.01" />
              <path d="M8 18h.01" /><path d="M12 18h.01" />
            </svg>
            <h3 style={{ color: '#6B7280', fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Elections Yet</h3>
            <p style={{ color: '#4B5563', fontSize: 14 }}>{isOwner ? 'Create your first election to get started.' : 'Check back later.'}</p>
          </motion.div>
        )}

        {/* Elections Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {elections
            .filter(el => {
              // text search
              const q = searchQuery.toLowerCase();
              if (q && !(el.name.toLowerCase().includes(q) || el.organizationName?.toLowerCase().includes(q) || el.description?.toLowerCase().includes(q))) return false;
              // status filter
              if (statusFilter !== 'all') {
                const s = getElectionStatus(el);
                if (statusFilter === 'active' && s !== 'active') return false;
                if (statusFilter === 'scheduled' && s !== 'scheduled') return false;
                if (statusFilter === 'closed' && s !== 'closed' && s !== 'upcoming') return false;
              }
              return true;
            })
            .map((election, i) => {
            const status = getElectionStatus(election);
            const canTrigger = isOwner && (status === 'scheduled') && election.scheduledStart > 0;
            return (
              <motion.div key={election.id} custom={i} variants={fadeUp} initial="hidden" animate="show"
                whileHover={{ y: -4, borderColor: '#4B5563' }}
                style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 14, padding: 24, cursor: 'pointer', transition: 'border-color 0.2s', position: 'relative' }}
                onClick={() => navigate(`/voting/${election.id}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <StatusBadge status={status} />
                  <ChevronRight size={18} style={{ color: '#6B7280' }} />
                </div>

                <h3 style={{ color: '#E5E7EB', fontSize: 18, fontWeight: 700, marginBottom: 6, lineHeight: 1.3 }}>{election.name}</h3>

                {election.organizationName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Building2 size={13} style={{ color: '#6B7280' }} />
                    <span style={{ color: '#9CA3AF', fontSize: 13 }}>{election.organizationName}</span>
                  </div>
                )}

                {election.description && (
                  <p style={{ color: '#6B7280', fontSize: 13, lineHeight: 1.5, marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {election.description}
                  </p>
                )}

                {/* Scheduled times */}
                {election.scheduledStart > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '6px 10px', background: 'rgba(251,191,36,0.08)', borderRadius: 8, border: '1px solid rgba(251,191,36,0.2)' }}>
                    <Clock size={12} style={{ color: '#FBBF24' }} />
                    <span style={{ color: '#FBBF24', fontSize: 12 }}>
                      Opens: {new Date(election.scheduledStart * 1000).toLocaleString()}
                    </span>
                  </div>
                )}
                {election.scheduledEnd > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '6px 10px', background: 'rgba(239,68,68,0.06)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.15)' }}>
                    <Clock size={12} style={{ color: '#F87171' }} />
                    <span style={{ color: '#F87171', fontSize: 12 }}>
                      Closes: {new Date(election.scheduledEnd * 1000).toLocaleString()}
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 20, borderTop: '1px solid #374151', paddingTop: 14, marginTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={13} style={{ color: '#38BDF8' }} />
                    <span style={{ color: '#9CA3AF', fontSize: 12 }}>{election.totalVotes} vote{election.totalVotes !== 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Vote size={13} style={{ color: '#22C55E' }} />
                    <span style={{ color: '#9CA3AF', fontSize: 12 }}>{election.candidateCount} candidate{election.candidateCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                {/* Trigger button for scheduled elections */}
                {canTrigger && (
                  <motion.button
                    onClick={(e) => { e.stopPropagation(); handleTrigger(election.id); }}
                    disabled={triggeringId === election.id}
                    whileTap={{ scale: 0.96 }}
                    style={{ marginTop: 12, width: '100%', padding: '8px 0', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 8, color: '#FBBF24', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    {triggeringId === election.id ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                    Trigger Status Update
                  </motion.button>
                )}

                {/* View Results button for closed elections */}
                {status === 'closed' && election.totalVotes > 0 && (
                  <Link
                    to={`/elections/${election.id}/results`}
                    onClick={(e) => e.stopPropagation()}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, padding: '8px 0', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, color: '#22C55E', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
                  >
                    <BarChart2 size={14} /> View Results
                  </Link>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Create Election Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
            onClick={() => setShowCreate(false)}
          >
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 16, padding: 32, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ color: '#E5E7EB', fontSize: 20, fontWeight: 700, margin: 0 }}>Create Election</h2>
                <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}><X size={20} /></button>
              </div>

              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Basic fields */}
                {[
                  { label: 'Election Name *', val: newName, set: setNewName, ph: 'e.g. Student Council 2026', required: true },
                  { label: 'Organization Name', val: newOrg, set: setNewOrg, ph: 'e.g. University of Technology', required: false },
                ].map(({ label, val, set, ph, required }) => (
                  <div key={label}>
                    <label style={{ display: 'block', color: '#9CA3AF', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>
                    <input type="text" value={val} onChange={e => set(e.target.value)} placeholder={ph} required={required} style={inputStyle} />
                  </div>
                ))}

                <div>
                  <label style={{ display: 'block', color: '#9CA3AF', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Description</label>
                  <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Brief description…" rows={3}
                    style={{ ...inputStyle, resize: 'vertical' }} />
                </div>

                {/* Time controls */}
                <div style={{ background: '#111827', borderRadius: 12, padding: 16, border: '1px solid #374151' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Clock size={15} style={{ color: '#FBBF24' }} />
                    <span style={{ color: '#E5E7EB', fontSize: 14, fontWeight: 600 }}>Scheduled Time Controls</span>
                    <span style={{ color: '#6B7280', fontSize: 11, marginLeft: 4 }}>(optional)</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ flex: '1 1 200px' }}>
                      <label style={{ display: 'block', color: '#9CA3AF', fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' }}>Auto-Open At</label>
                      <input type="datetime-local" value={newStart} onChange={e => setNewStart(e.target.value)}
                        style={{ ...inputStyle, colorScheme: 'dark' }} />
                    </div>
                    <div style={{ flex: '1 1 200px' }}>
                      <label style={{ display: 'block', color: '#9CA3AF', fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' }}>Auto-Close At</label>
                      <input type="datetime-local" value={newEnd} onChange={e => setNewEnd(e.target.value)}
                        style={{ ...inputStyle, colorScheme: 'dark' }} />
                    </div>
                  </div>
                  <p style={{ color: '#6B7280', fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>
                    If set, anyone can call "Trigger Status Update" once the time is reached to auto-open/close the election.
                  </p>
                </div>

                <motion.button type="submit" disabled={creating || !newName.trim()} whileTap={{ scale: 0.96 }}
                  style={{ padding: '11px 0', background: (!creating && newName.trim()) ? '#22C55E' : '#374151', border: 'none', borderRadius: 10, color: (!creating && newName.trim()) ? '#0F172A' : '#6B7280', fontWeight: 700, fontSize: 14, cursor: (!creating && newName.trim()) ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {creating ? 'Creating on blockchain…' : 'Create Election'}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
