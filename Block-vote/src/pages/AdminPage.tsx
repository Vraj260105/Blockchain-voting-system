import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, ArrowLeft, Loader2, Vote, Edit2, ChevronUp, ChevronDown,
  Zap, Wallet, Plus, X, Clock, AlertTriangle, RefreshCw, Building2, Users,
} from 'lucide-react';
import web3Service, { normalizeWeb3Error } from '@/services/web3';
import { Election } from '@/types/auth.types';
import { toast } from 'sonner';

function dtToUnix(val: string) { return val ? Math.floor(new Date(val).getTime() / 1000) : 0; }
function unixToDt(ts: number) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function getStatus(e: Election): 'active' | 'upcoming' | 'scheduled' | 'closed' {
  if (e.isActive) return 'active';
  const now = Math.floor(Date.now() / 1000);
  if (e.scheduledStart > 0 && now < e.scheduledStart) return 'scheduled';
  if (e.endTime > 0) return 'closed';
  return 'upcoming';
}

const STATUS_COLOR: Record<string, string> = {
  active: '#22C55E', scheduled: '#FBBF24', upcoming: '#9CA3AF', closed: '#6B7280',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 14px', background: '#0F172A',
  border: '1px solid #374151', borderRadius: 10, color: '#E5E7EB',
  fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};

export default function AdminPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [ready, setReady] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [elections, setElections] = useState<Election[]>([]);
  const [balance, setBalance] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sortKey, setSortKey] = useState<'id' | 'votes'>('id');

  // top-up
  const [topUpAmount, setTopUpAmount] = useState('1');
  const [topping, setTopping] = useState(false);

  // edit modal
  const [editing, setEditing] = useState<Election | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editOrg, setEditOrg] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [saving, setSaving] = useState(false);

  // open/close/trigger
  const [actionId, setActionId] = useState<number | null>(null);

  useEffect(() => { if (isAuthenticated) boot(); }, [isAuthenticated]);

  const boot = async () => {
    setLoading(true);
    try {
      const ok = await web3Service.initialize();
      if (!ok) { setError('MetaMask not connected'); return; }
      const owner = await web3Service.isOwner();
      setIsOwner(owner);
      setReady(true);
      if (owner) await refresh();
    } catch (err: any) { const msg = normalizeWeb3Error(err); setError(msg); toast.error('Initialization failed', { description: msg }); }
    finally { setLoading(false); }
  };

  const refresh = async () => {
    const [list, bal] = await Promise.all([
      web3Service.getAllElections(),
      web3Service.getContractBalance(),
    ]);
    setElections(list);
    setBalance(bal);
  };

  const handleTopUp = async () => {
    const amt = parseFloat(topUpAmount);
    if (!amt || amt <= 0) return;
    setTopping(true);
    try { await web3Service.fundContractWith(amt); await refresh(); setTopUpAmount('1'); }
    catch (err: any) { const msg = normalizeWeb3Error(err); setError(msg); toast.error('Top-up failed', { description: msg }); }
    finally { setTopping(false); }
  };

  const openEdit = (e: Election) => {
    setEditing(e);
    setEditName(e.name); setEditDesc(e.description); setEditOrg(e.organizationName);
    setEditStart(unixToDt(e.scheduledStart)); setEditEnd(unixToDt(e.scheduledEnd));
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await web3Service.updateElection(editing.id, editName, editDesc, editOrg, dtToUnix(editStart), dtToUnix(editEnd));
      setEditing(null); await refresh();
    } catch (err: any) { const msg = normalizeWeb3Error(err); setError(msg); toast.error('Failed to save changes', { description: msg }); }
    finally { setSaving(false); }
  };

  const handleOpen = async (id: number) => {
    setActionId(id);
    try { await web3Service.openVoting(id); await refresh(); }
    catch (err: any) { const msg = normalizeWeb3Error(err); setError(msg); toast.error('Failed to open voting', { description: msg }); }
    finally { setActionId(null); }
  };

  const handleClose = async (id: number) => {
    setActionId(id);
    try { await web3Service.closeVoting(id); await refresh(); }
    catch (err: any) { const msg = normalizeWeb3Error(err); setError(msg); toast.error('Failed to close voting', { description: msg }); }
    finally { setActionId(null); }
  };

  const handleTrigger = async (id: number) => {
    setActionId(id);
    try { await web3Service.triggerElectionStatus(id); await refresh(); }
    catch (err: any) { const msg = normalizeWeb3Error(err); setError(msg); toast.error('Failed to trigger schedule', { description: msg }); }
    finally { setActionId(null); }
  };

  const sorted = [...elections].sort((a, b) =>
    sortKey === 'id' ? a.id - b.id : b.totalVotes - a.totalVotes
  );

  /* Access guards */
  if (!isAuthenticated) return (
    <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#EF4444', fontSize: 16 }}>Unauthenticated</div>
    </div>
  );

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 size={32} className="animate-spin" style={{ color: '#38BDF8' }} />
    </div>
  );

  if (ready && !isOwner) return (
    <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <Shield size={40} style={{ color: '#EF4444' }} />
      <p style={{ color: '#EF4444', fontSize: 16 }}>Access denied. Owner wallet required.</p>
      <button onClick={() => navigate('/elections')} style={{ padding: '8px 20px', background: '#1F2937', border: '1px solid #374151', borderRadius: 10, color: '#9CA3AF', cursor: 'pointer', fontSize: 14 }}>Back to Elections</button>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0F172A', paddingBottom: 60 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 16px' }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 32 }}
        >
          <button onClick={() => navigate('/elections')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1F2937', border: '1px solid #374151', borderRadius: 10, padding: '8px 14px', color: '#9CA3AF', cursor: 'pointer', fontSize: 13 }}>
            <ArrowLeft size={14} /> Elections
          </button>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={22} style={{ color: '#fff' }} />
          </div>
          <div>
            <h1 style={{ color: '#E5E7EB', fontSize: 22, fontWeight: 800, margin: 0 }}>Admin Dashboard</h1>
            <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>Owner-only controls for all elections</p>
          </div>
          <motion.button onClick={refresh} whileTap={{ scale: 0.92 }} style={{ marginLeft: 'auto', background: 'none', border: '1px solid #374151', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', color: '#9CA3AF' }}>
            <RefreshCw size={15} />
          </motion.button>
        </motion.div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, color: '#EF4444', fontSize: 13 }}>
            <AlertTriangle size={14} style={{ marginRight: 6 }} /> {error}
          </div>
        )}

        {/* Stats + Top-Up Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
          {/* Contract Balance */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.05 } }}
            style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 14, padding: 20 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Wallet size={16} style={{ color: '#38BDF8' }} />
              <span style={{ color: '#9CA3AF', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Contract Balance</span>
            </div>
            <div style={{ color: '#E5E7EB', fontSize: 24, fontWeight: 800 }}>{parseFloat(balance).toFixed(4)} <span style={{ color: '#6B7280', fontSize: 14, fontWeight: 400 }}>POL</span></div>
            <p style={{ color: '#4B5563', fontSize: 12, marginTop: 4 }}>~{Math.floor(parseFloat(balance))} auto-fund{Math.floor(parseFloat(balance)) !== 1 ? 's' : ''} remaining</p>
          </motion.div>

          {/* Total Elections */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}
            style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 14, padding: 20 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Vote size={16} style={{ color: '#22C55E' }} />
              <span style={{ color: '#9CA3AF', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Elections</span>
            </div>
            <div style={{ color: '#E5E7EB', fontSize: 24, fontWeight: 800 }}>{elections.length}</div>
            <p style={{ color: '#4B5563', fontSize: 12, marginTop: 4 }}>{elections.filter(e => e.isActive).length} currently active</p>
          </motion.div>

          {/* Total Votes */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.15 } }}
            style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 14, padding: 20 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Users size={16} style={{ color: '#F59E0B' }} />
              <span style={{ color: '#9CA3AF', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Votes Cast</span>
            </div>
            <div style={{ color: '#E5E7EB', fontSize: 24, fontWeight: 800 }}>{elections.reduce((s, e) => s + e.totalVotes, 0)}</div>
            <p style={{ color: '#4B5563', fontSize: 12, marginTop: 4 }}>across all elections</p>
          </motion.div>

          {/* Top-Up Card */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }}
            style={{ background: '#1F2937', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 14, padding: 20 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Plus size={16} style={{ color: '#38BDF8' }} />
              <span style={{ color: '#38BDF8', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Top Up Contract</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="number" min="0.1" step="0.1" value={topUpAmount} onChange={e => setTopUpAmount(e.target.value)}
                style={{ ...inputStyle, flex: 1, fontSize: 13, padding: '7px 10px' }} placeholder="POL" />
              <motion.button onClick={handleTopUp} disabled={topping} whileTap={{ scale: 0.94 }}
                style={{ padding: '7px 14px', background: '#38BDF8', border: 'none', borderRadius: 8, color: '#0F172A', fontWeight: 700, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                {topping ? <Loader2 size={14} className="animate-spin" /> : 'Fund'}
              </motion.button>
            </div>
          </motion.div>
        </div>

        {/* Elections Table */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.25 } }}
          style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 14, overflow: 'hidden' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #374151' }}>
            <h2 style={{ color: '#E5E7EB', fontSize: 16, fontWeight: 700, margin: 0 }}>All Elections</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['id', 'votes'] as const).map(k => (
                <button key={k} onClick={() => setSortKey(k)}
                  style={{ padding: '5px 12px', background: sortKey === k ? '#374151' : 'transparent', border: '1px solid #374151', borderRadius: 8, color: sortKey === k ? '#E5E7EB' : '#6B7280', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                  Sort: {k === 'id' ? 'Newest' : 'Most Votes'}
                </button>
              ))}
            </div>
          </div>

          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 160px 80px 80px 120px', gap: 16, padding: '10px 20px', background: '#111827', borderBottom: '1px solid #374151' }}>
            {['ID', 'Election', 'Organization', 'Votes', 'Cands', 'Actions'].map(h => (
              <span key={h} style={{ color: '#6B7280', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
            ))}
          </div>

          {sorted.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#6B7280', fontSize: 14 }}>No elections created yet.</div>
          )}

          {sorted.map((e, i) => {
            const status = getStatus(e);
            const isActing = actionId === e.id;
            return (
              <motion.div key={e.id} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: i * 0.04 } }}
                style={{ display: 'grid', gridTemplateColumns: '40px 1fr 160px 80px 80px 120px', gap: 16, padding: '14px 20px', borderBottom: '1px solid #1F2937', alignItems: 'center' }}
              >
                <span style={{ color: '#6B7280', fontSize: 13, fontWeight: 600 }}>#{e.id}</span>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#E5E7EB', fontSize: 14, fontWeight: 600 }}>{e.name}</span>
                    <span style={{ color: STATUS_COLOR[status], fontSize: 11, fontWeight: 700 }}>● {status}</span>
                  </div>
                  {e.scheduledEnd > 0 && (
                    <div style={{ color: '#6B7280', fontSize: 11, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={10} /> Closes {new Date(e.scheduledEnd * 1000).toLocaleDateString()}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Building2 size={12} style={{ color: '#6B7280' }} />
                  <span style={{ color: '#9CA3AF', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.organizationName || '—'}</span>
                </div>

                <span style={{ color: '#F59E0B', fontSize: 14, fontWeight: 700 }}>{e.totalVotes}</span>
                <span style={{ color: '#9CA3AF', fontSize: 14 }}>{e.candidateCount}</span>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6 }}>
                  {/* Edit */}
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => openEdit(e)}
                    disabled={e.isActive} title="Edit"
                    style={{ padding: '5px 8px', background: '#111827', border: '1px solid #374151', borderRadius: 7, color: e.isActive ? '#4B5563' : '#9CA3AF', cursor: e.isActive ? 'not-allowed' : 'pointer' }}>
                    <Edit2 size={13} />
                  </motion.button>

                  {/* Open / Close */}
                  {!e.isActive && status !== 'closed' ? (
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleOpen(e.id)} disabled={isActing || e.candidateCount === 0} title="Open Voting"
                      style={{ padding: '5px 8px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 7, color: '#22C55E', cursor: (isActing || e.candidateCount === 0) ? 'not-allowed' : 'pointer' }}>
                      {isActing ? <Loader2 size={13} className="animate-spin" /> : <ChevronUp size={13} />}
                    </motion.button>
                  ) : e.isActive ? (
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleClose(e.id)} disabled={isActing} title="Close Voting"
                      style={{ padding: '5px 8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 7, color: '#EF4444', cursor: isActing ? 'not-allowed' : 'pointer' }}>
                      {isActing ? <Loader2 size={13} className="animate-spin" /> : <ChevronDown size={13} />}
                    </motion.button>
                  ) : null}

                  {/* Trigger for scheduled */}
                  {e.scheduledStart > 0 && !e.isActive && status !== 'closed' && (
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleTrigger(e.id)} disabled={isActing} title="Trigger Schedule"
                      style={{ padding: '5px 8px', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 7, color: '#FBBF24', cursor: isActing ? 'not-allowed' : 'pointer' }}>
                      {isActing ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                    </motion.button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Edit Election Modal */}
      <AnimatePresence>
        {editing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
            onClick={() => setEditing(null)}
          >
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 16, padding: 32, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ color: '#E5E7EB', fontSize: 18, fontWeight: 700, margin: 0 }}>Edit Election #{editing.id}</h2>
                <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}><X size={20} /></button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { label: 'Name', val: editName, set: setEditName },
                  { label: 'Organization', val: editOrg, set: setEditOrg },
                ].map(({ label, val, set }) => (
                  <div key={label}>
                    <label style={{ display: 'block', color: '#9CA3AF', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{label}</label>
                    <input value={val} onChange={e => set(e.target.value)} style={inputStyle} />
                  </div>
                ))}

                <div>
                  <label style={{ display: 'block', color: '#9CA3AF', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Description</label>
                  <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>

                <div style={{ background: '#111827', borderRadius: 12, padding: 14, border: '1px solid #374151' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <Clock size={13} style={{ color: '#FBBF24' }} />
                    <span style={{ color: '#E5E7EB', fontSize: 13, fontWeight: 600 }}>Scheduled Times</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', color: '#6B7280', fontSize: 11, marginBottom: 5 }}>Auto-Open</label>
                      <input type="datetime-local" value={editStart} onChange={e => setEditStart(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark', fontSize: 12 }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', color: '#6B7280', fontSize: 11, marginBottom: 5 }}>Auto-Close</label>
                      <input type="datetime-local" value={editEnd} onChange={e => setEditEnd(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark', fontSize: 12 }} />
                    </div>
                  </div>
                </div>

                <motion.button onClick={handleSaveEdit} disabled={saving || !editName.trim()} whileTap={{ scale: 0.96 }}
                  style={{ padding: '11px 0', background: saving ? '#374151' : '#7C3AED', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Edit2 size={16} />}
                  {saving ? 'Saving to blockchain…' : 'Save Changes'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
