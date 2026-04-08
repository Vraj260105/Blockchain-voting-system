import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Vote, User, LogOut, LogIn, UserPlus, Mail, ChevronDown, Shield, History as HistoryIcon, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useTheme } from 'next-themes';

export const Navigation = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  const handleLogout = () => {
    logout();
    navigate('/login');
    setMenuOpen(false);
  };

  const isActive = (path: string) => location.pathname === path;

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user?.email?.[0]?.toUpperCase() || 'U';
  };

  const navLink = (to: string, label: string, icon: React.ReactNode) => (
    <Link
      to={to}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 8,
        color: isActive(to) ? '#22C55E' : '#9CA3AF',
        background: isActive(to) ? 'rgba(34,197,94,0.1)' : 'transparent',
        fontWeight: isActive(to) ? 600 : 400,
        fontSize: 14,
        textDecoration: 'none',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!isActive(to)) (e.currentTarget as HTMLElement).style.color = '#E5E7EB';
      }}
      onMouseLeave={(e) => {
        if (!isActive(to)) (e.currentTarget as HTMLElement).style.color = '#9CA3AF';
      }}
    >
      {icon}
      {label}
    </Link>
  );

  return (
    <nav
      style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(17,24,39,0.95)',
        borderBottom: '1px solid #374151',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div
        style={{
          maxWidth: 1100, margin: '0 auto',
          padding: '0 16px', height: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        {/* Left: Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <Link
            to="/"
            style={{
              display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none',
            }}
          >
            <div
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: '#22C55E',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Vote size={18} style={{ color: '#0F172A' }} />
            </div>
            <span style={{ color: '#E5E7EB', fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em' }}>
              Block-Vote
            </span>
          </Link>

          {/* Nav links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} className="hidden-mobile">
            {isAuthenticated && navLink('/elections', 'Elections', <Vote size={14} />)}
            {isAuthenticated && navLink('/history', 'History', <HistoryIcon size={14} />)}
            {isAuthenticated && navLink('/admin', 'Admin', <Shield size={14} />)}
            {navLink('/contact', 'Contact', <Mail size={14} />)}
          </div>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Theme Toggle */}
          <motion.button
            whileTap={{ scale: 0.88, rotate: 180 }}
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label="Toggle theme"
            style={{
              background: '#1F2937', border: '1px solid #374151',
              borderRadius: 8, padding: 7, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: isDark ? '#FBBF24' : '#38BDF8',
            }}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </motion.button>
          {isAuthenticated ? (
            <div style={{ position: 'relative' }}>
              <motion.button
                onClick={() => setMenuOpen((p) => !p)}
                whileTap={{ scale: 0.96 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: '#1F2937', border: '1px solid #374151',
                  borderRadius: 8, padding: '6px 12px 6px 8px',
                  cursor: 'pointer', color: '#E5E7EB',
                }}
              >
                <div
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'rgba(34,197,94,0.2)',
                    border: '2px solid rgba(34,197,94,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: '#22C55E',
                  }}
                >
                  {getInitials()}
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.firstName || user?.email?.split('@')[0] || 'User'}
                </span>
                <ChevronDown size={14} style={{ color: '#6B7280', transform: menuOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
              </motion.button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                      background: '#1F2937', border: '1px solid #374151',
                      borderRadius: 12, padding: '6px',
                      minWidth: 200, zIndex: 100,
                      boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
                    }}
                  >
                    <div style={{ padding: '8px 12px 10px', borderBottom: '1px solid #374151', marginBottom: 4 }}>
                      <p style={{ color: '#E5E7EB', fontWeight: 600, fontSize: 14, margin: '0 0 2px' }}>
                        {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'User'}
                      </p>
                      <p style={{ color: '#6B7280', fontSize: 12, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {user?.email}
                      </p>
                    </div>

                    {[
                      { icon: <User size={14} />, label: 'Profile', action: () => { navigate('/profile'); setMenuOpen(false); } },
                    ].map((item) => (
                      <button
                        key={item.label}
                        onClick={item.action}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                          padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                          background: 'none', border: 'none', color: '#9CA3AF',
                          fontSize: 14, textAlign: 'left',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background = '#374151';
                          (e.currentTarget as HTMLElement).style.color = '#E5E7EB';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = 'none';
                          (e.currentTarget as HTMLElement).style.color = '#9CA3AF';
                        }}
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    ))}

                    <div style={{ borderTop: '1px solid #374151', margin: '4px 0' }} />
                    <button
                      onClick={handleLogout}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                        padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                        background: 'none', border: 'none', color: '#EF4444',
                        fontSize: 14, textAlign: 'left',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'}
                      onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'none'}
                    >
                      <LogOut size={14} />
                      Log out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Link
                to="/login"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                  borderRadius: 8, color: '#9CA3AF', fontSize: 14, fontWeight: 500,
                  textDecoration: 'none', border: '1px solid transparent',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = '#E5E7EB';
                  (e.currentTarget as HTMLElement).style.borderColor = '#374151';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = '#9CA3AF';
                  (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                }}
              >
                <LogIn size={14} />
                Login
              </Link>
              <Link
                to="/register"
                className="btn-emerald"
                style={{ textDecoration: 'none' }}
              >
                <UserPlus size={14} />
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) { .hidden-mobile { display: none !important; } }
      `}</style>
    </nav>
  );
};
