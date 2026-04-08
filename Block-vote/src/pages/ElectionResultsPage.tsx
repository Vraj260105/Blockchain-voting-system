import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Trophy, ExternalLink, Building2, Clock, Vote,
  CheckCircle, Loader2, AlertTriangle, Users, Award,
  BarChart2, PieChart as PieIcon, Lock, Activity,
} from 'lucide-react';
import { getElectionReadOnly, getCandidatesReadOnly } from '@/services/web3';
import { toast } from 'sonner';

/* ── colour palette (max 8 candidates) ──────────────────── */
const CHART_COLORS = [
  '#22C55E', '#38BDF8', '#FB923C', '#A78BFA',
  '#F472B6', '#FBBF24', '#34D399', '#F87171',
];

const AMOY_SCAN = 'https://amoy.polygonscan.com';

/* ── helpers ─────────────────────────────────────────────── */
function fmtDate(unix: number) {
  if (!unix) return '—';
  return new Date(unix * 1000).toLocaleString();
}
function pct(votes: number, total: number) {
  if (!total) return 0;
  return Math.round((votes / total) * 1000) / 10;
}
function duration(start: number, end: number) {
  if (!start || !end) return '—';
  const secs = end - start;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/* ── custom tooltip ──────────────────────────────────────── */
const ChartTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={{
      background: '#1F2937', border: '1px solid #374151',
      borderRadius: 8, padding: '8px 14px', fontSize: 13,
    }}>
      <p style={{ color: '#E5E7EB', fontWeight: 700, marginBottom: 2 }}>{d.name}</p>
      <p style={{ color: d.fill || d.color || '#22C55E' }}>
        {d.value} vote{d.value !== 1 ? 's' : ''}
      </p>
    </div>
  );
};

/* ── custom pie label ────────────────────────────────────── */
const renderPieLabel = ({ name, percent }: any) =>
  percent > 0.04 ? `${(percent * 100).toFixed(1)}%` : '';

/* ══ Main Page ════════════════════════════════════════════ */
export default function ElectionResultsPage() {
  const { electionId: electionIdParam } = useParams<{ electionId: string }>();
  const electionId = parseInt(electionIdParam || '0');

  const [election, setElection] = useState<any>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [contractAddress, setContractAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chartTab, setChartTab] = useState<'bar' | 'pie'>('bar');

  useEffect(() => {
    loadData();
  }, [electionId]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const { election: el, contractAddress: addr } = await getElectionReadOnly(electionId);
      setElection(el);
      setContractAddress(addr);
      if (el.candidateCount > 0) {
        const cands = await getCandidatesReadOnly(electionId, el.candidateCount);
        setCandidates(cands);
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to load election results';
      setError(msg);
      toast.error('Results unavailable', { description: msg });
    } finally {
      setLoading(false);
    }
  };

  /* derived */
  const totalVotes = candidates.reduce((s, c) => s + c.votes, 0);
  const sortedCands = [...candidates].sort((a, b) => b.votes - a.votes);
  const winner = sortedCands[0];
  const isTie = sortedCands.length > 1 && sortedCands[0]?.votes === sortedCands[1]?.votes && totalVotes > 0;
  const chartData = sortedCands.map((c, i) => ({ name: c.name, votes: c.votes, fill: CHART_COLORS[i % CHART_COLORS.length] }));

  /* ── loading ─────────────────────────────────────────────── */
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Loader2 size={40} style={{ color: '#22C55E' }} className="animate-spin" />
      <p style={{ color: '#9CA3AF', fontSize: 15 }}>Loading results from blockchain…</p>
    </div>
  );

  /* ── error ───────────────────────────────────────────────── */
  if (error) return (
    <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 16, padding: 40, maxWidth: 420, textAlign: 'center' }}>
        <AlertTriangle size={36} style={{ color: '#EF4444', margin: '0 auto 14px' }} />
        <h2 style={{ color: '#E5E7EB', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Results Unavailable</h2>
        <p style={{ color: '#9CA3AF', fontSize: 14, marginBottom: 20 }}>{error}</p>
        <Link to="/elections" style={{ color: '#22C55E', fontSize: 14 }}>← Browse Elections</Link>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0F172A', paddingBottom: 60 }}>

      {/* ── Hero Header ─────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1a2744 60%, #0F172A 100%)', borderBottom: '1px solid #1F2937', paddingTop: 40, paddingBottom: 40 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px' }}>

          {/* breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <Link to="/elections" style={{ color: '#6B7280', fontSize: 13, textDecoration: 'none' }}>Elections</Link>
            <span style={{ color: '#374151' }}>/</span>
            <span style={{ color: '#9CA3AF', fontSize: 13 }}>Results</span>
            <span style={{ marginLeft: 'auto' }}>
              <span style={{
                background: election?.isActive ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)',
                color: election?.isActive ? '#22C55E' : '#9CA3AF',
                border: `1px solid ${election?.isActive ? 'rgba(34,197,94,0.3)' : 'rgba(107,114,128,0.3)'}`,
                borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700,
              }}>
                {election?.isActive ? '● LIVE' : '■ CLOSED'}
              </span>
            </span>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg,#22C55E,#16A34A)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <BarChart2 size={28} style={{ color: '#0F172A' }} />
              </div>
              <div>
                <h1 style={{ color: '#E5E7EB', fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                  {election?.name}
                </h1>
                {election?.organizationName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <Building2 size={13} style={{ color: '#6B7280' }} />
                    <span style={{ color: '#6B7280', fontSize: 13 }}>{election.organizationName}</span>
                  </div>
                )}
                {election?.description && (
                  <p style={{ color: '#9CA3AF', fontSize: 14, marginTop: 8, maxWidth: 560 }}>{election.description}</p>
                )}
              </div>
            </div>
          </motion.div>

          {/* stats strip */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 28 }}
          >
            {[
              { icon: <Vote size={14} />, label: 'Total Votes', value: totalVotes.toLocaleString() },
              { icon: <Users size={14} />, label: 'Candidates', value: candidates.length },
              { icon: <Clock size={14} />, label: 'Started', value: fmtDate(election?.startTime) },
              { icon: <Clock size={14} />, label: 'Ended', value: fmtDate(election?.endTime) },
              { icon: <Activity size={14} />, label: 'Duration', value: duration(election?.startTime, election?.endTime) },
            ].map((s) => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #1F2937', borderRadius: 10, padding: '10px 16px', minWidth: 120 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6B7280', fontSize: 11, marginBottom: 4 }}>
                  {s.icon} {s.label}
                </div>
                <div style={{ color: '#E5E7EB', fontSize: 14, fontWeight: 700 }}>{s.value}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Winner Banner ──────────────────────────────────── */}
        {totalVotes > 0 && winner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
            style={{
              background: isTie
                ? 'linear-gradient(135deg,rgba(251,191,36,0.12),rgba(251,191,36,0.04))'
                : 'linear-gradient(135deg,rgba(34,197,94,0.15),rgba(34,197,94,0.04))',
              border: `1px solid ${isTie ? 'rgba(251,191,36,0.35)' : 'rgba(34,197,94,0.35)'}`,
              borderRadius: 16, padding: '24px 28px', marginBottom: 28,
              display: 'flex', alignItems: 'center', gap: 20,
            }}
          >
            <div style={{ fontSize: 44 }}>{isTie ? '🤝' : '🏆'}</div>
            <div>
              {isTie ? (
                <>
                  <p style={{ color: '#FBBF24', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', margin: 0 }}>TIE</p>
                  <h2 style={{ color: '#E5E7EB', fontSize: 22, fontWeight: 800, margin: '4px 0' }}>
                    It's a draw! Multiple candidates tied.
                  </h2>
                </>
              ) : (
                <>
                  <p style={{ color: '#22C55E', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', margin: 0 }}>WINNER</p>
                  <h2 style={{ color: '#E5E7EB', fontSize: 22, fontWeight: 800, margin: '4px 0' }}>{winner.name}</h2>
                  <p style={{ color: '#9CA3AF', fontSize: 13, margin: 0 }}>
                    {winner.votes} vote{winner.votes !== 1 ? 's' : ''} · {pct(winner.votes, totalVotes)}% of total
                  </p>
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Charts ─────────────────────────────────────────── */}
        {candidates.length > 0 && totalVotes > 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 16, padding: 28, marginBottom: 28 }}>

            {/* tab switcher */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h3 style={{ color: '#E5E7EB', fontSize: 16, fontWeight: 700, margin: 0 }}>Vote Distribution</h3>
              <div style={{ display: 'flex', background: '#111827', borderRadius: 8, padding: 3, gap: 2 }}>
                {(['bar', 'pie'] as const).map((tab) => (
                  <button key={tab} onClick={() => setChartTab(tab)}
                    style={{
                      background: chartTab === tab ? '#374151' : 'transparent',
                      border: 'none', borderRadius: 6, padding: '5px 14px', cursor: 'pointer',
                      color: chartTab === tab ? '#E5E7EB' : '#6B7280', fontSize: 12, fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                    {tab === 'bar' ? <BarChart2 size={13} /> : <PieIcon size={13} />}
                    {tab === 'bar' ? 'Bar' : 'Pie'}
                  </button>
                ))}
              </div>
            </div>

            <AnimatePresence mode="wait">
              {chartTab === 'bar' ? (
                <motion.div key="bar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                      <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                      <Bar dataKey="votes" radius={[6, 6, 0, 0]} maxBarSize={72}>
                        {chartData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </motion.div>
              ) : (
                <motion.div key="pie" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={chartData} dataKey="votes" nameKey="name"
                        cx="50%" cy="50%" outerRadius={110} innerRadius={55}
                        label={renderPieLabel} labelLine={false}
                        paddingAngle={2}
                      >
                        {chartData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                      <Legend
                        formatter={(value) => <span style={{ color: '#9CA3AF', fontSize: 12 }}>{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── Candidate Leaderboard ──────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 16, padding: 28, marginBottom: 28 }}>
          <h3 style={{ color: '#E5E7EB', fontSize: 16, fontWeight: 700, margin: '0 0 20px' }}>Candidate Results</h3>

          {sortedCands.length === 0 ? (
            <p style={{ color: '#6B7280', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>No candidates in this election.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sortedCands.map((c, i) => {
                const share = pct(c.votes, totalVotes);
                const isFirst = i === 0 && !isTie && totalVotes > 0;
                return (
                  <motion.div key={c.id}
                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}
                    style={{
                      background: isFirst ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isFirst ? 'rgba(34,197,94,0.25)' : '#374151'}`,
                      borderRadius: 12, padding: '14px 18px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      {/* rank */}
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: isFirst ? '#22C55E' : '#374151',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 800,
                        color: isFirst ? '#0F172A' : '#9CA3AF',
                      }}>
                        {isFirst ? <Trophy size={15} /> : i + 1}
                      </div>
                      {/* name + desc */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: '#E5E7EB', fontWeight: 700, fontSize: 15 }}>{c.name}</span>
                          {isFirst && <span style={{ fontSize: 10, color: '#22C55E', fontWeight: 700, border: '1px solid rgba(34,197,94,0.4)', borderRadius: 10, padding: '1px 8px' }}>WINNER</span>}
                        </div>
                        {c.description && <p style={{ color: '#6B7280', fontSize: 12, margin: '2px 0 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.description}</p>}
                        {/* progress bar */}
                        <div style={{ height: 6, background: '#374151', borderRadius: 3, overflow: 'hidden' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${share}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 * i }}
                            style={{ height: '100%', background: CHART_COLORS[i % CHART_COLORS.length], borderRadius: 3 }}
                          />
                        </div>
                      </div>
                      {/* votes */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ color: CHART_COLORS[i % CHART_COLORS.length], fontWeight: 700, fontSize: 18 }}>{c.votes}</div>
                        <div style={{ color: '#6B7280', fontSize: 11 }}>{share}%</div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* ── Blockchain Proof ───────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 16, padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <CheckCircle size={18} style={{ color: '#22C55E' }} />
            <h3 style={{ color: '#E5E7EB', fontSize: 16, fontWeight: 700, margin: 0 }}>Blockchain Proof & Transparency</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14 }}>
            {/* Contract */}
            <div style={{ background: '#111827', borderRadius: 10, padding: '14px 16px' }}>
              <p style={{ color: '#6B7280', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', margin: '0 0 6px' }}>SMART CONTRACT</p>
              <p style={{ color: '#E5E7EB', fontFamily: 'monospace', fontSize: 12, margin: '0 0 10px', wordBreak: 'break-all' }}>
                {contractAddress || '—'}
              </p>
              {contractAddress && (
                <a
                  href={`${AMOY_SCAN}/address/${contractAddress}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#22C55E', fontSize: 12, textDecoration: 'none', fontWeight: 600 }}
                >
                  View on Polygonscan <ExternalLink size={12} />
                </a>
              )}
            </div>

            {/* Votes */}
            <div style={{ background: '#111827', borderRadius: 10, padding: '14px 16px' }}>
              <p style={{ color: '#6B7280', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', margin: '0 0 6px' }}>ALL VOTES ON CHAIN</p>
              <p style={{ color: '#9CA3AF', fontSize: 12, margin: '0 0 10px' }}>
                Every vote is a signed blockchain transaction stored permanently on Polygon Amoy.
              </p>
              {contractAddress && (
                <a
                  href={`${AMOY_SCAN}/address/${contractAddress}#events`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#38BDF8', fontSize: 12, textDecoration: 'none', fontWeight: 600 }}
                >
                  View VoteCast Events <ExternalLink size={12} />
                </a>
              )}
            </div>

            {/* Network */}
            <div style={{ background: '#111827', borderRadius: 10, padding: '14px 16px' }}>
              <p style={{ color: '#6B7280', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', margin: '0 0 6px' }}>NETWORK</p>
              <p style={{ color: '#E5E7EB', fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>Polygon Amoy Testnet</p>
              <p style={{ color: '#6B7280', fontSize: 12, margin: '0 0 10px' }}>Chain ID: 80002</p>
              <span style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
                Immutable · Transparent · Verifiable
              </span>
            </div>
          </div>

          {/* public notice */}
          <div style={{ marginTop: 18, padding: '12px 16px', background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Lock size={14} style={{ color: '#38BDF8', marginTop: 1, flexShrink: 0 }} />
            <p style={{ color: '#9CA3AF', fontSize: 12, margin: 0 }}>
              This page is publicly accessible. All results are read directly from the blockchain — no login required. Anyone can independently verify these results using the contract address above.
            </p>
          </div>
        </motion.div>

        {/* ── Footer nav ────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 36 }}>
          <Link to="/elections"
            style={{ color: '#6B7280', fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
            ← Back to Elections
          </Link>
          <Link to="/login"
            style={{ color: '#22C55E', fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Award size={13} /> Participate in Voting →
          </Link>
        </div>
      </div>
    </div>
  );
}
