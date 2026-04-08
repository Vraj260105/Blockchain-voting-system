import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Vote, Shield, Users, Zap, ArrowRight, CheckCircle2, Lock, BarChart2 } from 'lucide-react';
import { motion } from 'framer-motion';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
  }),
};

const features = [
  {
    icon: <Shield size={22} style={{ color: '#22C55E' }} />,
    title: 'Immutable Records',
    desc: 'Once cast, votes are permanently recorded on the Polygon blockchain and cannot be altered or deleted.',
    accent: '#22C55E',
  },
  {
    icon: <Users size={22} style={{ color: '#38BDF8' }} />,
    title: 'Complete Transparency',
    desc: 'All voting data is publicly verifiable on-chain while maintaining voter wallet privacy.',
    accent: '#38BDF8',
  },
  {
    icon: <Zap size={22} style={{ color: '#F59E0B' }} />,
    title: 'Instant Results',
    desc: 'Real-time vote tallying via smart contracts — no central authority required.',
    accent: '#F59E0B',
  },
];

const steps = [
  { step: 1, title: 'Create Your Account', desc: 'Register with email + OTP verification for secure access.' },
  { step: 2, title: 'Connect Your Wallet', desc: 'Link your MetaMask wallet to interact with the blockchain.' },
  { step: 3, title: 'Register as Voter', desc: 'Call registerSelf() on-chain to gain voting eligibility.' },
  { step: 4, title: 'Cast Your Vote', desc: 'Vote through the smart contract — one immutable vote per address.' },
];

const Index = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div style={{ minHeight: '100vh', background: '#0F172A' }}>

      {/* ── HERO ── */}
      <section style={{ maxWidth: 860, margin: '0 auto', padding: '80px 20px 60px', textAlign: 'center' }}>
        {/* Badge */}
        <motion.div
          custom={0} variants={fadeUp} initial="hidden" animate="show"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 28 }}
        >
          <span
            style={{
              background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 100, padding: '5px 14px',
              color: '#22C55E', fontSize: 13, fontWeight: 600, letterSpacing: '0.02em',
            }}
          >
            🔗 Built on Polygon Amoy Testnet
          </span>
        </motion.div>

        {/* Heading */}
        <motion.h1
          custom={1} variants={fadeUp} initial="hidden" animate="show"
          style={{
            color: '#E5E7EB', fontSize: 'clamp(36px, 6vw, 64px)',
            fontWeight: 800, lineHeight: 1.1, margin: '0 0 20px',
            letterSpacing: '-0.03em',
          }}
        >
          Voting You Can{' '}
          <span style={{ color: '#22C55E' }}>Trust</span>
          <br />on the Blockchain
        </motion.h1>

        {/* Sub */}
        <motion.p
          custom={2} variants={fadeUp} initial="hidden" animate="show"
          style={{
            color: '#9CA3AF', fontSize: 18, lineHeight: 1.7,
            maxWidth: 540, margin: '0 auto 40px',
          }}
        >
          Transparent, immutable, and decentralized voting powered by smart contracts.
          Every vote is on-chain, incorruptible, and publicly verifiable.
        </motion.p>

        {/* CTA */}
        <motion.div
          custom={3} variants={fadeUp} initial="hidden" animate="show"
          style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}
        >
          {isAuthenticated ? (
            <>
              <motion.div whileTap={{ scale: 0.97 }}>
                <Link
                  to="/elections"
                  className="btn-emerald"
                  style={{ textDecoration: 'none', fontSize: 15, padding: '10px 24px' }}
                >
                  Go to Voting
                  <ArrowRight size={18} />
                </Link>
              </motion.div>
              <motion.div whileTap={{ scale: 0.97 }}>
                <Link
                  to="/public-results"
                  className="btn-outline-sky"
                  style={{ textDecoration: 'none', fontSize: 15, padding: '10px 24px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                >
                  <BarChart2 size={16} /> View Results
                </Link>
              </motion.div>
            </>
          ) : (
            <>
              <motion.div whileTap={{ scale: 0.97 }}>
                <Link
                  to="/register"
                  className="btn-emerald"
                  style={{ textDecoration: 'none', fontSize: 15, padding: '10px 24px' }}
                >
                  Get Started
                  <ArrowRight size={18} />
                </Link>
              </motion.div>
              <motion.div whileTap={{ scale: 0.97 }}>
                <Link
                  to="/public-results"
                  className="btn-outline-sky"
                  style={{ textDecoration: 'none', fontSize: 15, padding: '10px 24px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <BarChart2 size={16} /> View Results
                </Link>
              </motion.div>
              <motion.div whileTap={{ scale: 0.97 }}>
                <Link
                  to="/login"
                  style={{ textDecoration: 'none', color: '#9CA3AF', fontSize: 15, padding: '10px 24px', border: '1px solid #374151', borderRadius: 12, display: 'inline-flex', alignItems: 'center' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#E5E7EB'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; }}
                >
                  Sign In
                </Link>
              </motion.div>
            </>
          )}
        </motion.div>

        {/* Trust line */}
        <motion.div
          custom={4} variants={fadeUp} initial="hidden" animate="show"
          style={{ marginTop: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}
        >
          {['Cryptographically Secured', 'Open Source Contract', 'Zero Trust Architecture'].map((label) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6B7280', fontSize: 13 }}>
              <Lock size={12} style={{ color: '#374151' }} />
              {label}
            </div>
          ))}
        </motion.div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ maxWidth: 1000, margin: '0 auto', padding: '20px 20px 80px' }}>
        <motion.h2
          custom={0} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
          style={{ color: '#E5E7EB', fontSize: 30, fontWeight: 700, textAlign: 'center', marginBottom: 40 }}
        >
          Why Blockchain Voting?
        </motion.h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              custom={i} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
              whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(0,0,0,0.4)' }}
              transition={{ duration: 0.15 }}
              style={{
                background: '#1F2937', border: '1px solid #374151',
                borderRadius: 14, padding: '24px',
                borderTop: `3px solid ${f.accent}`,
              }}
            >
              <div
                style={{
                  width: 44, height: 44, borderRadius: 10, marginBottom: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `${f.accent}18`,
                }}
              >
                {f.icon}
              </div>
              <h3 style={{ color: '#E5E7EB', fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ color: '#9CA3AF', fontSize: 14, lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ maxWidth: 700, margin: '0 auto', padding: '0 20px 80px' }}>
        <motion.h2
          custom={0} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
          style={{ color: '#E5E7EB', fontSize: 30, fontWeight: 700, textAlign: 'center', marginBottom: 40 }}
        >
          How It Works
        </motion.h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {steps.map((item, i) => (
            <motion.div
              key={item.step}
              custom={i} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
              style={{
                background: '#1F2937', border: '1px solid #374151', borderRadius: 14,
                padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: 16,
              }}
            >
              <div
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#0F172A', fontWeight: 800, fontSize: 15, flexShrink: 0,
                }}
              >
                {item.step}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ color: '#E5E7EB', fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>{item.title}</h3>
                <p style={{ color: '#9CA3AF', fontSize: 14, margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
              </div>
              <CheckCircle2 size={20} style={{ color: '#374151', flexShrink: 0, marginTop: 2 }} />
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      {!isAuthenticated && (
        <section style={{ maxWidth: 660, margin: '0 auto', padding: '0 20px 80px' }}>
          <motion.div
            custom={0} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
            style={{
              background: '#1F2937', border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 18, padding: '48px 40px', textAlign: 'center',
            }}
          >
            <Vote size={40} style={{ color: '#22C55E', margin: '0 auto 16px' }} />
            <h2 style={{ color: '#E5E7EB', fontSize: 28, fontWeight: 700, margin: '0 0 12px' }}>
              Ready to Vote?
            </h2>
            <p style={{ color: '#9CA3AF', fontSize: 15, margin: '0 0 28px', lineHeight: 1.6 }}>
              Create an account, connect MetaMask, and cast your first tamper-proof vote.
            </p>
            <motion.div whileTap={{ scale: 0.97 }}>
              <Link
                to="/register"
                className="btn-emerald"
                style={{ textDecoration: 'none', fontSize: 15, padding: '11px 28px' }}
              >
                Create Free Account
                <ArrowRight size={18} />
              </Link>
            </motion.div>
          </motion.div>
        </section>
      )}

      {/* Footer */}
      <div style={{ textAlign: 'center', paddingBottom: 40 }}>
        <p style={{ color: '#374151', fontSize: 12, letterSpacing: '0.05em' }}>
          BLOCK-VOTE · POWERED BY POLYGON · OPEN SOURCE
        </p>
      </div>
    </div>
  );
};

export default Index;
