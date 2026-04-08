import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart2, Calendar, Users, Building2, ExternalLink, Loader2, AlertTriangle, ChevronRight } from 'lucide-react';
import { getElectionReadOnly } from '@/services/web3';
import { toast } from 'sonner';

function dtToUnix(val: string): number {
  if (!val) return 0;
  return Math.floor(new Date(val).getTime() / 1000);
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' as const }
  }),
};

export default function PublicElectionsPage() {
  const [elections, setElections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPublicElections();
  }, []);

  const loadPublicElections = async () => {
    setLoading(true);
    setError('');
    try {
      // We must fetch the count, but getElectionReadOnly doesn't have a direct count export.
      // Wait, we can dynamically build the web3 ro instance here or export getCountReadOnly.
      // Let's import the default web3Service, but it might not be initialized.
      // Actually, let's just use a try-catch loop incrementing the ID until it fails!
      const fetched = [];
      let i = 0;
      while (true) {
        try {
          const res = await getElectionReadOnly(i);
          fetched.push(res.election);
          i++;
        } catch (err) {
          break; // Reached the end of available elections
        }
      }
      setElections(fetched.reverse()); // Show newest first
    } catch (err: any) {
      setError(err.message || 'Failed to load public elections.');
      toast.error('Failed to load elections', { description: err.message || 'Blockchain connection error' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Loader2 size={40} style={{ color: '#38BDF8' }} className="animate-spin" />
      <p style={{ color: '#9CA3AF', fontSize: 15 }}>Loading Blockchain Records…</p>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0F172A', paddingBottom: 60 }}>
      {/* ── Header ────────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg,#0F172A,#111827)', borderBottom: '1px solid #1F2937', padding: '36px 0 32px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#38BDF8,#0EA5E9)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <BarChart2 size={26} style={{ color: '#0F172A' }} />
            </div>
            <div>
              <h1 style={{ color: '#E5E7EB', fontSize: 24, fontWeight: 800, margin: 0 }}>Public Results Directory</h1>
              <p style={{ color: '#6B7280', fontSize: 14, margin: '4px 0 0' }}>
                View transparent, verifiable blockchain voting records. No login required.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
        {error ? (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '16px', display: 'flex', gap: 10 }}>
            <AlertTriangle size={20} style={{ color: '#EF4444' }} />
            <span style={{ color: '#FCA5A5', fontSize: 14 }}>{error}</span>
          </div>
        ) : elections.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <BarChart2 size={48} style={{ color: '#374151', margin: '0 auto 16px' }} />
            <h3 style={{ color: '#6B7280', fontSize: 18, fontWeight: 600 }}>No Elections Found.</h3>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {elections.map((el, i) => (
              <motion.div key={el.id} custom={i} variants={fadeUp} initial="hidden" animate="show"
                style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <h3 style={{ color: '#E5E7EB', fontSize: 18, fontWeight: 700, margin: 0 }}>{el.name}</h3>
                  <span style={{
                    background: el.isActive ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)',
                    color: el.isActive ? '#22C55E' : '#9CA3AF',
                    border: `1px solid ${el.isActive ? 'rgba(34,197,94,0.3)' : 'rgba(107,114,128,0.3)'}`,
                    borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700,
                  }}>
                    {el.isActive ? '● LIVE' : '■ CLOSED'}
                  </span>
                </div>

                {el.organizationName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                    <Building2 size={13} style={{ color: '#6B7280' }} />
                    <span style={{ color: '#9CA3AF', fontSize: 13 }}>{el.organizationName}</span>
                  </div>
                )}

                <div style={{ background: '#111827', borderRadius: 10, padding: 12, marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <span style={{ color: '#6B7280', fontSize: 11, display: 'block', marginBottom: 4 }}>TOTAL VOTES</span>
                    <span style={{ color: '#E5E7EB', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Users size={13} style={{ color: '#38BDF8' }} /> {el.totalVotes}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#6B7280', fontSize: 11, display: 'block', marginBottom: 4 }}>CANDIDATES</span>
                    <span style={{ color: '#E5E7EB', fontSize: 14, fontWeight: 700 }}>{el.candidateCount}</span>
                  </div>
                </div>

                <Link
                  to={`/elections/${el.id}/results`}
                  style={{
                    marginTop: 'auto', padding: '10px 0', background: '#38BDF8', border: 'none', borderRadius: 10,
                    color: '#0F172A', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none'
                  }}
                >
                  <BarChart2 size={16} /> View Results
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
