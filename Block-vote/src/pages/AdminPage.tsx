import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, ArrowLeft, Loader2, Vote, Edit2, ChevronUp, ChevronDown,
  Zap, Wallet, Plus, X, Clock, AlertTriangle, RefreshCw, Building2, Users,
  FileText, Search, ChevronLeft, ChevronRight, CheckCircle, XCircle, Filter,
  Activity, BarChart2, Lock,
} from 'lucide-react';
import web3Service, { normalizeWeb3Error } from '@/services/web3';
import { Election } from '@/types/auth.types';
import apiService from '@/services/api';
import { toast } from 'sonner';

// ─── helpers ────────────────────────────────────────────────────────────────
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
const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  super_admin:    { bg: 'rgba(124,58,237,0.15)', text: '#A78BFA' },
  election_admin: { bg: 'rgba(59,130,246,0.15)', text: '#60A5FA' },
  voter:          { bg: 'rgba(34,197,94,0.1)',   text: '#4ADE80' },
};
function fmt(s: string) {
  return s.replace(/_/g, ' ');
}
function timeSince(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface AdminUser {
  id: number; email: string; firstName: string; lastName: string;
  role: string; isActive: boolean; isVerified: boolean;
  walletAddress?: string | null; lastLogin?: string | null;
  failedLoginAttempts?: number; lockedUntil?: string | null;
  createdAt: string;
}
interface AuditEntry {
  id: number; userId: number | null; action: string;
  entityType: string | null; entityId: number | null;
  ipAddress: string | null; createdAt: string;
}
interface Pagination { total: number; page: number; limit: number; pages: number; }

// ─── Sub-tabs ─────────────────────────────────────────────────────────────
type Tab = 'elections' | 'users' | 'audit';

// ════════════════════════════════════════════════════════════════════════════
export default function AdminPage() {
  const { isAuthenticated, user: authUser } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('elections');

  // ── Elections state ───────────────────────────────────────────────────────
  const [ready, setReady]         = useState(false);
  const [isOwner, setIsOwner]     = useState(false);
  const [elections, setElections] = useState<Election[]>([]);
  const [balance, setBalance]     = useState('0');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [sortKey, setSortKey]     = useState<'id' | 'votes'>('id');
  const [topUpAmount, setTopUpAmount] = useState('1');
  const [topping, setTopping]     = useState(false);
  const [editing, setEditing]     = useState<Election | null>(null);
  const [editName, setEditName]   = useState('');
  const [editDesc, setEditDesc]   = useState('');
  const [editOrg, setEditOrg]     = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd]     = useState('');
  const [saving, setSaving]       = useState(false);
  const [actionId, setActionId]   = useState<number | null>(null);

  // ── Users state ───────────────────────────────────────────────────────────
  const [users, setUsers]           = useState<AdminUser[]>([]);
  const [usersPag, setUsersPag]     = useState<Pagination>({ total: 0, page: 1, limit: 10, pages: 1 });
  const [userSearch, setUserSearch] = useState('');
  const [userRole, setUserRole]     = useState('');
  const [usersLoading, setUsersLoading] = useState(false);

  // ── Audit state ───────────────────────────────────────────────────────────
  const [logs, setLogs]           = useState<AuditEntry[]>([]);
  const [logsPag, setLogsPag]     = useState<Pagination>({ total: 0, page: 1, limit: 15, pages: 1 });
  const [logAction, setLogAction] = useState('');
  const [logUser, setLogUser]     = useState('');
  const [logsLoading, setLogsLoading] = useState(false);
  const [stats, setStats]         = useState<any>(null);

  // ── isAdmin check ─────────────────────────────────────────────────────────
  const isAdmin = authUser?.role === 'super_admin' || authUser?.role === 'election_admin';

  // ─── Elections boot ───────────────────────────────────────────────────────
  useEffect(() => { if (isAuthenticated) boot(); }, [isAuthenticated]);

  const boot = async () => {
    setLoading(true);
    try {
      const ok = await web3Service.initialize();
      if (!ok) { setError('MetaMask not connected'); return; }
      const owner = await web3Service.isOwner();
      setIsOwner(owner);
      setReady(true);
      if (owner) await refreshElections();
    } catch (err: any) { const msg = normalizeWeb3Error(err); setError(msg); toast.error('Initialization failed', { description: msg }); }
    finally { setLoading(false); }
  };

  const refreshElections = async () => {
    const [list, bal] = await Promise.all([web3Service.getAllElections(), web3Service.getContractBalance()]);
    setElections(list); setBalance(bal);
  };

  // ─── Users fetch ──────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async (page = 1) => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page), limit: '10',
        ...(userSearch ? { search: userSearch } : {}),
        ...(userRole   ? { role: userRole }     : {}),
      });
      const res = await (apiService as any).api.get(`/users/admin/list?${params}`);
      setUsers(res.data.data.users);
      setUsersPag(res.data.data.pagination);
    } catch (e: any) { toast.error('Failed to load users', { description: e.message }); }
    finally { setUsersLoading(false); }
  }, [userSearch, userRole]);

  useEffect(() => { if (tab === 'users') fetchUsers(1); }, [tab, userSearch, userRole]);

  const toggleUserStatus = async (u: AdminUser) => {
    try {
      await (apiService as any).api.patch(`/users/admin/${u.id}/status`);
      toast.success(`User ${u.isActive ? 'deactivated' : 'activated'}`);
      fetchUsers(usersPag.page);
    } catch (e: any) { toast.error('Failed to update user status', { description: e.message }); }
  };

  // ─── Audit fetch ──────────────────────────────────────────────────────────
  const fetchLogs = useCallback(async (page = 1) => {
    setLogsLoading(true);
    try {
      const limit = 15;
      const offset = (page - 1) * limit;
      const params = new URLSearchParams({
        limit: String(limit), offset: String(offset),
        ...(logAction ? { action: logAction } : {}),
        ...(logUser   ? { userId: logUser }   : {}),
      });
      const res = await (apiService as any).api.get(`/audit-logs?${params}`);
      setLogs(res.data.data.logs);
      const p = res.data.data.pagination;
      setLogsPag({ total: p.total, page, limit, pages: p.pages });
    } catch (e: any) { toast.error('Failed to load audit logs', { description: e.message }); }
    finally { setLogsLoading(false); }
  }, [logAction, logUser]);

  const fetchStats = async () => {
    try {
      const res = await (apiService as any).api.get('/audit-logs/statistics');
      setStats(res.data.data);
    } catch (_) {}
  };

  useEffect(() => {
    if (tab === 'audit') { fetchLogs(1); fetchStats(); }
  }, [tab, logAction, logUser]);

  // ─── Election helpers ─────────────────────────────────────────────────────
  const handleTopUp = async () => {
    const amt = parseFloat(topUpAmount);
    if (!amt || amt <= 0) return;
    setTopping(true);
    try { await web3Service.fundContractWith(amt); await refreshElections(); setTopUpAmount('1'); }
    catch (err: any) { const msg = normalizeWeb3Error(err); setError(msg); toast.error('Top-up failed', { description: msg }); }
    finally { setTopping(false); }
  };
  const openEdit = (e: Election) => {
    setEditing(e); setEditName(e.name); setEditDesc(e.description); setEditOrg(e.organizationName);
    setEditStart(unixToDt(e.scheduledStart)); setEditEnd(unixToDt(e.scheduledEnd));
  };
  const handleSaveEdit = async () => {
    if (!editing) return; setSaving(true);
    try { await web3Service.updateElection(editing.id, editName, editDesc, editOrg, dtToUnix(editStart), dtToUnix(editEnd)); setEditing(null); await refreshElections(); }
    catch (err: any) { const msg = normalizeWeb3Error(err); setError(msg); toast.error('Failed to save changes', { description: msg }); }
    finally { setSaving(false); }
  };
  const handleOpen    = async (id: number) => { setActionId(id); try { await web3Service.openVoting(id); await refreshElections(); } catch (err: any) { toast.error('Failed', { description: normalizeWeb3Error(err) }); } finally { setActionId(null); } };
  const handleClose   = async (id: number) => { setActionId(id); try { await web3Service.closeVoting(id); await refreshElections(); } catch (err: any) { toast.error('Failed', { description: normalizeWeb3Error(err) }); } finally { setActionId(null); } };

  const sorted = [...elections].sort((a, b) => sortKey === 'id' ? a.id - b.id : b.totalVotes - a.totalVotes);

  // ─── Guards ───────────────────────────────────────────────────────────────
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

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#0F172A', paddingBottom: 60 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px' }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <button onClick={() => navigate('/elections')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1F2937', border: '1px solid #374151', borderRadius: 10, padding: '8px 14px', color: '#9CA3AF', cursor: 'pointer', fontSize: 13 }}>
            <ArrowLeft size={14} /> Elections
          </button>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#7C3AED,#3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={22} style={{ color: '#fff' }} />
          </div>
          <div>
            <h1 style={{ color: '#E5E7EB', fontSize: 22, fontWeight: 800, margin: 0 }}>Admin Dashboard</h1>
            <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>System management &amp; monitoring</p>
          </div>
          <motion.button onClick={() => { if (tab === 'elections') refreshElections(); else if (tab === 'users') fetchUsers(1); else { fetchLogs(1); fetchStats(); } }}
            whileTap={{ scale: 0.92 }}
            style={{ marginLeft: 'auto', background: 'none', border: '1px solid #374151', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', color: '#9CA3AF' }}>
            <RefreshCw size={15} />
          </motion.button>
        </motion.div>

        {/* Tab Switcher */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.05 } }}
          style={{ display: 'flex', gap: 4, background: '#111827', borderRadius: 12, padding: 4, marginBottom: 28, width: 'fit-content' }}>
          {([
            { key: 'elections', label: 'Elections', icon: Vote },
            { key: 'users',     label: 'Users',     icon: Users },
            { key: 'audit',     label: 'Audit Logs', icon: FileText },
          ] as { key: Tab; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px',
                background: tab === key ? '#1F2937' : 'transparent',
                border: tab === key ? '1px solid #374151' : '1px solid transparent',
                borderRadius: 10, color: tab === key ? '#E5E7EB' : '#6B7280',
                cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all .15s',
              }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </motion.div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, color: '#EF4444', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {/* ═══ TAB: ELECTIONS ═══════════════════════════════════════════════ */}
        {tab === 'elections' && (
          <motion.div key="elections" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {ready && !isOwner ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 80 }}>
                <Shield size={40} style={{ color: '#EF4444' }} />
                <p style={{ color: '#EF4444', fontSize: 16 }}>Access denied. Owner wallet required.</p>
                <button onClick={() => navigate('/elections')} style={{ padding: '8px 20px', background: '#1F2937', border: '1px solid #374151', borderRadius: 10, color: '#9CA3AF', cursor: 'pointer', fontSize: 14 }}>Back to Elections</button>
              </div>
            ) : (
              <>
                {/* Stats Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
                  <StatCard icon={<Wallet size={16} style={{ color: '#38BDF8' }} />} label="Contract Balance" value={`${parseFloat(balance).toFixed(4)} POL`} sub={`~${Math.floor(parseFloat(balance))} auto-funds`} accent="#38BDF8" />
                  <StatCard icon={<Vote size={16} style={{ color: '#22C55E' }} />} label="Elections" value={String(elections.length)} sub={`${elections.filter(e => e.isActive).length} currently active`} accent="#22C55E" />
                  <StatCard icon={<Users size={16} style={{ color: '#F59E0B' }} />} label="Total Votes Cast" value={String(elections.reduce((s, e) => s + e.totalVotes, 0))} sub="across all elections" accent="#F59E0B" />
                  {/* Top-Up */}
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }}
                    style={{ background: '#1F2937', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 14, padding: 20 }}>
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
                  style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 14, overflow: 'hidden' }}>
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
                  <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 160px 80px 80px 120px', gap: 16, padding: '10px 20px', background: '#111827', borderBottom: '1px solid #374151' }}>
                    {['ID', 'Election', 'Organization', 'Votes', 'Cands', 'Actions'].map(h => (
                      <span key={h} style={{ color: '#6B7280', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
                    ))}
                  </div>
                  {sorted.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#6B7280', fontSize: 14 }}>No elections created yet.</div>}
                  {sorted.map((e, i) => {
                    const status = getStatus(e); const isActing = actionId === e.id;
                    return (
                      <motion.div key={e.id} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: i * 0.04 } }}
                        style={{ display: 'grid', gridTemplateColumns: '40px 1fr 160px 80px 80px 120px', gap: 16, padding: '14px 20px', borderBottom: '1px solid #1F2937', alignItems: 'center' }}>
                        <span style={{ color: '#6B7280', fontSize: 13, fontWeight: 600 }}>#{e.id}</span>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: '#E5E7EB', fontSize: 14, fontWeight: 600 }}>{e.name}</span>
                            <span style={{ color: STATUS_COLOR[status], fontSize: 11, fontWeight: 700 }}>● {status}</span>
                          </div>
                          {e.scheduledEnd > 0 && <div style={{ color: '#6B7280', fontSize: 11, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={10} /> Closes {new Date(e.scheduledEnd * 1000).toLocaleDateString()}</div>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Building2 size={12} style={{ color: '#6B7280' }} /><span style={{ color: '#9CA3AF', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.organizationName || '—'}</span></div>
                        <span style={{ color: '#F59E0B', fontSize: 14, fontWeight: 700 }}>{e.totalVotes}</span>
                        <span style={{ color: '#9CA3AF', fontSize: 14 }}>{e.candidateCount}</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <motion.button whileTap={{ scale: 0.9 }} onClick={() => openEdit(e)} disabled={e.isActive} title="Edit"
                            style={{ padding: '5px 8px', background: '#111827', border: '1px solid #374151', borderRadius: 7, color: e.isActive ? '#4B5563' : '#9CA3AF', cursor: e.isActive ? 'not-allowed' : 'pointer' }}>
                            <Edit2 size={13} />
                          </motion.button>
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
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </>
            )}
          </motion.div>
        )}

        {/* ═══ TAB: USERS ═══════════════════════════════════════════════════ */}
        {tab === 'users' && (
          <motion.div key="users" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {!isAdmin ? (
              <AccessDenied />
            ) : (
              <>
                {/* Filters */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6B7280' }} />
                    <input placeholder="Search name or email…" value={userSearch} onChange={e => setUserSearch(e.target.value)}
                      style={{ ...inputStyle, paddingLeft: 34 }} />
                  </div>
                  <select value={userRole} onChange={e => setUserRole(e.target.value)}
                    style={{ ...inputStyle, width: 160, cursor: 'pointer', background: '#111827' }}>
                    <option value="">All Roles</option>
                    <option value="super_admin">Super Admin</option>
                    <option value="election_admin">Election Admin</option>
                    <option value="voter">Voter</option>
                  </select>
                </div>

                {/* Users Table */}
                <div style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 14, overflow: 'hidden' }}>
                  {/* Header */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 100px 90px 100px', gap: 12, padding: '10px 20px', background: '#111827', borderBottom: '1px solid #374151' }}>
                    {['Name', 'Email', 'Role', 'Joined', 'Status', 'Action'].map(h => (
                      <span key={h} style={{ color: '#6B7280', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
                    ))}
                  </div>
                  {usersLoading && <div style={{ textAlign: 'center', padding: 40 }}><Loader2 size={24} className="animate-spin" style={{ color: '#38BDF8' }} /></div>}
                  {!usersLoading && users.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#6B7280', fontSize: 14 }}>No users found.</div>}
                  {!usersLoading && users.map((u, i) => {
                    const rc = ROLE_COLORS[u.role] || ROLE_COLORS.voter;
                    const isLocked = u.lockedUntil && new Date() < new Date(u.lockedUntil);
                    return (
                      <motion.div key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: i * 0.03 } }}
                        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 100px 90px 100px', gap: 12, padding: '12px 20px', borderBottom: '1px solid #111827', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#7C3AED,#3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                            {u.firstName[0]}{u.lastName[0]}
                          </div>
                          <div>
                            <div style={{ color: '#E5E7EB', fontSize: 13, fontWeight: 600 }}>{u.firstName} {u.lastName}</div>
                            {isLocked && <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#F59E0B', fontSize: 11 }}><Lock size={9} /> Locked</div>}
                          </div>
                        </div>
                        <span style={{ color: '#9CA3AF', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</span>
                        <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 20, background: rc.bg, color: rc.text, fontSize: 11, fontWeight: 700, width: 'fit-content' }}>
                          {fmt(u.role)}
                        </span>
                        <span style={{ color: '#6B7280', fontSize: 12 }}>{new Date(u.createdAt).toLocaleDateString()}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          {u.isActive
                            ? <><CheckCircle size={13} style={{ color: '#22C55E' }} /><span style={{ color: '#22C55E', fontSize: 12 }}>Active</span></>
                            : <><XCircle size={13} style={{ color: '#EF4444' }} /><span style={{ color: '#EF4444', fontSize: 12 }}>Inactive</span></>}
                        </div>
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => toggleUserStatus(u)}
                          style={{ padding: '5px 10px', background: u.isActive ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', border: `1px solid ${u.isActive ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`, borderRadius: 8, color: u.isActive ? '#EF4444' : '#22C55E', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </motion.button>
                      </motion.div>
                    );
                  })}
                </div>
                {/* Pagination */}
                <PaginationBar pag={usersPag} onPage={p => fetchUsers(p)} />
              </>
            )}
          </motion.div>
        )}

        {/* ═══ TAB: AUDIT LOGS ══════════════════════════════════════════════ */}
        {tab === 'audit' && (
          <motion.div key="audit" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {!isAdmin ? (
              <AccessDenied />
            ) : (
              <>
                {/* Stats cards */}
                {stats && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 24 }}>
                    <StatCard icon={<Activity size={16} style={{ color: '#7C3AED' }} />} label="Total Events" value={String(stats.totalLogs)} sub="in the system" accent="#7C3AED" />
                    {stats.topActions?.slice(0, 3).map((a: any) => (
                      <StatCard key={a.action} icon={<BarChart2 size={16} style={{ color: '#38BDF8' }} />} label={fmt(a.action)} value={String(a.count)} sub="events" accent="#38BDF8" />
                    ))}
                  </div>
                )}

                {/* Filters */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
                    <Filter size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6B7280' }} />
                    <input placeholder="Filter by action (e.g. USER_LOGIN_FAILED)…" value={logAction} onChange={e => setLogAction(e.target.value)}
                      style={{ ...inputStyle, paddingLeft: 34 }} />
                  </div>
                  <div style={{ position: 'relative', width: 160 }}>
                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6B7280' }} />
                    <input placeholder="User ID…" value={logUser} onChange={e => setLogUser(e.target.value)}
                      style={{ ...inputStyle, paddingLeft: 34 }} />
                  </div>
                </div>

                {/* Logs Table */}
                <div style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 120px 120px 100px 90px', gap: 12, padding: '10px 20px', background: '#111827', borderBottom: '1px solid #374151' }}>
                    {['ID', 'Action', 'Entity', 'User ID', 'IP', 'When'].map(h => (
                      <span key={h} style={{ color: '#6B7280', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
                    ))}
                  </div>
                  {logsLoading && <div style={{ textAlign: 'center', padding: 40 }}><Loader2 size={24} className="animate-spin" style={{ color: '#38BDF8' }} /></div>}
                  {!logsLoading && logs.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#6B7280', fontSize: 14 }}>No logs found.</div>}
                  {!logsLoading && logs.map((l, i) => {
                    const isFail = l.action.includes('FAIL') || l.action.includes('ERROR');
                    return (
                      <motion.div key={l.id} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: i * 0.02 } }}
                        style={{ display: 'grid', gridTemplateColumns: '60px 1fr 120px 120px 100px 90px', gap: 12, padding: '11px 20px', borderBottom: '1px solid #111827', alignItems: 'center' }}>
                        <span style={{ color: '#4B5563', fontSize: 12, fontFamily: 'monospace' }}>#{l.id}</span>
                        <span style={{ color: isFail ? '#F87171' : '#E5E7EB', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {l.action}
                        </span>
                        <span style={{ color: '#9CA3AF', fontSize: 12 }}>{l.entityType || '—'}</span>
                        <span style={{ color: '#9CA3AF', fontSize: 12 }}>{l.userId ?? '—'}</span>
                        <span style={{ color: '#6B7280', fontSize: 11, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.ipAddress || '—'}</span>
                        <span style={{ color: '#6B7280', fontSize: 12 }}>{timeSince(l.createdAt)}</span>
                      </motion.div>
                    );
                  })}
                </div>
                <PaginationBar pag={logsPag} onPage={p => fetchLogs(p)} />
              </>
            )}
          </motion.div>
        )}
      </div>

      {/* Edit Election Modal */}
      <AnimatePresence>
        {editing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
            onClick={() => setEditing(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 16, padding: 32, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ color: '#E5E7EB', fontSize: 18, fontWeight: 700, margin: 0 }}>Edit Election #{editing.id}</h2>
                <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}><X size={20} /></button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {([{ label: 'Name', val: editName, set: setEditName }, { label: 'Organization', val: editOrg, set: setEditOrg }] as const).map(({ label, val, set }) => (
                  <div key={label}>
                    <label style={{ display: 'block', color: '#9CA3AF', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{label}</label>
                    <input value={val} onChange={e => (set as any)(e.target.value)} style={inputStyle} />
                  </div>
                ))}
                <div>
                  <label style={{ display: 'block', color: '#9CA3AF', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Description</label>
                  <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
                <div style={{ background: '#111827', borderRadius: 12, padding: 14, border: '1px solid #374151' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}><Clock size={13} style={{ color: '#FBBF24' }} /><span style={{ color: '#E5E7EB', fontSize: 13, fontWeight: 600 }}>Scheduled Times</span></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[{ label: 'Auto-Open', val: editStart, set: setEditStart }, { label: 'Auto-Close', val: editEnd, set: setEditEnd }].map(({ label, val, set }) => (
                      <div key={label}>
                        <label style={{ display: 'block', color: '#6B7280', fontSize: 11, marginBottom: 5 }}>{label}</label>
                        <input type="datetime-local" value={val} onChange={e => (set as any)(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark', fontSize: 12 }} />
                      </div>
                    ))}
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

// ─── Shared Sub-components ───────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub: string; accent: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 14, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {icon}
        <span style={{ color: '#9CA3AF', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      </div>
      <div style={{ color: '#E5E7EB', fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{value}</div>
      <p style={{ color: '#4B5563', fontSize: 12, marginTop: 6, marginBottom: 0 }}>{sub}</p>
    </motion.div>
  );
}

function AccessDenied() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 80 }}>
      <Shield size={40} style={{ color: '#EF4444' }} />
      <p style={{ color: '#EF4444', fontSize: 16 }}>Access denied. Admin role required.</p>
    </div>
  );
}

function PaginationBar({ pag, onPage }: { pag: Pagination; onPage: (p: number) => void }) {
  if (pag.pages <= 1) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0' }}>
      <span style={{ color: '#6B7280', fontSize: 13 }}>
        Showing {((pag.page - 1) * pag.limit) + 1}–{Math.min(pag.page * pag.limit, pag.total)} of {pag.total}
      </span>
      <div style={{ display: 'flex', gap: 6 }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => onPage(pag.page - 1)} disabled={pag.page <= 1}
          style={{ padding: '6px 12px', background: '#1F2937', border: '1px solid #374151', borderRadius: 8, color: pag.page <= 1 ? '#4B5563' : '#9CA3AF', cursor: pag.page <= 1 ? 'not-allowed' : 'pointer' }}>
          <ChevronLeft size={14} />
        </motion.button>
        {Array.from({ length: Math.min(pag.pages, 7) }, (_, i) => {
          const p = i + 1;
          return (
            <motion.button key={p} whileTap={{ scale: 0.9 }} onClick={() => onPage(p)}
              style={{ padding: '6px 12px', background: pag.page === p ? '#7C3AED' : '#1F2937', border: '1px solid #374151', borderRadius: 8, color: pag.page === p ? '#fff' : '#9CA3AF', cursor: 'pointer', fontWeight: pag.page === p ? 700 : 400 }}>
              {p}
            </motion.button>
          );
        })}
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => onPage(pag.page + 1)} disabled={pag.page >= pag.pages}
          style={{ padding: '6px 12px', background: '#1F2937', border: '1px solid #374151', borderRadius: 8, color: pag.page >= pag.pages ? '#4B5563' : '#9CA3AF', cursor: pag.page >= pag.pages ? 'not-allowed' : 'pointer' }}>
          <ChevronRight size={14} />
        </motion.button>
      </div>
    </div>
  );
}
