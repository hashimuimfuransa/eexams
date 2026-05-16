import React, { useState, useEffect, useRef } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useThemeMode } from './context/ThemeContext';
import Nav from './components/Nav';

// ─── Design tokens ────────────────────────────────────────────────────────────
const tokens = {
  // Brand palette
  primary: '#0D406C',        // Deep Navy Blue
  primaryLight: '#1A5A8C',
  primaryDark: '#082545',
  accent: '#0CBD73',         // Emerald Green
  accentLight: '#5AD5A2',    // Seafoam Green
  accentDark: '#067A4C',
  accentGlow: 'rgba(12,189,115,0.18)',
  mint: '#9DF6D6',           // Mint Green
  aqua: '#A2F8EC',           // Light Aqua / Turquoise
  success: '#0CBD73',
  warning: '#F59E0B',
  danger: '#EF4444',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  surface: '#FFFFFF',
  surfaceAlt: '#F5FBF8',
  surfaceBorder: '#D7E5DD',
  dark: {
    bg: '#031526',
    surface: '#082A45',
    surfaceAlt: '#0D406C',
    border: '#1A5A8C',
    textPrimary: '#E8F8F1',
    textSecondary: '#9DC4D9',
  },
};

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useScrollY() {
  const [y, setY] = useState(0);
  useEffect(() => {
    const handler = () => setY(window.scrollY);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);
  return y;
}

function useInView(ref, threshold = 0.15) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ref, threshold]);
  return inView;
}

// ─── Reveal wrapper ───────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, style = {} }) {
  const ref = useRef(null);
  const inView = useInView(ref);
  return (
    <div ref={ref} style={{
      opacity: inView ? 1 : 0,
      transform: inView ? 'translateY(0)' : 'translateY(28px)',
      transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero({ mode, isAuthenticated, user }) {
  const isDark = mode === 'dark';
  const [count, setCount] = useState(0);

  useEffect(() => {
    let frame;
    const target = 2847;
    const duration = 2000;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    const timeout = setTimeout(() => { frame = requestAnimationFrame(tick); }, 400);
    return () => { clearTimeout(timeout); cancelAnimationFrame(frame); };
  }, []);

  return (
    <section id="home" style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      position: 'relative', overflow: 'hidden',
      background: isDark
        ? `radial-gradient(ellipse 80% 60% at 50% -10%, rgba(12,189,115,0.06) 0%, transparent 70%), #030712`
        : `radial-gradient(ellipse 80% 60% at 50% -10%, rgba(12,189,115,0.1) 0%, transparent 70%), #FAFBFF`,
      paddingTop: 'clamp(80px, 15vw, 100px)',
    }}>
      {/* Grid pattern */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: isDark
          ? 'linear-gradient(rgba(30,41,59,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(30,41,59,0.4) 1px, transparent 1px)'
          : 'linear-gradient(rgba(226,232,240,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(226,232,240,0.7) 1px, transparent 1px)',
        backgroundSize: 'clamp(40px, 10vw, 60px) clamp(40px, 10vw, 60px)',
        maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)',
      }} />

      {/* Floating orbs */}
      <div style={{ position: 'absolute', top: '15%', left: '8%', width: 'clamp(150px, 30vw, 280px)', height: 'clamp(150px, 30vw, 280px)', borderRadius: '50%', background: 'radial-gradient(circle, rgba(12,189,115,0.14) 0%, transparent 70%)', animation: 'float1 8s ease-in-out infinite', zIndex: 0 }} />
      <div style={{ position: 'absolute', bottom: '20%', right: '6%', width: 'clamp(100px, 25vw, 200px)', height: 'clamp(100px, 25vw, 200px)', borderRadius: '50%', background: 'radial-gradient(circle, rgba(157,246,214,0.16) 0%, transparent 70%)', animation: 'float2 10s ease-in-out infinite', zIndex: 0 }} />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px', position: 'relative', zIndex: 1, width: '100%' }}>
        <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(40px, 8vw, 80px)', alignItems: 'center' }}>
          {/* Left */}
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 14px', borderRadius: 100,
              background: isDark ? 'rgba(12,189,115,0.15)' : 'rgba(12,189,115,0.08)',
              border: `1px solid ${isDark ? 'rgba(12,189,115,0.3)' : 'rgba(12,189,115,0.2)'}`,
              marginBottom: 'clamp(16px, 4vw, 28px)', animation: 'fadeInUp 0.6s ease forwards',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0CBD73', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(11px, 2vw, 13px)', fontWeight: 600, color: '#0CBD73', letterSpacing: '0.02em' }}>
                Rwanda's leading exam platform
              </span>
            </div>

            <h1 style={{
              fontFamily: "'DM Sans', sans-serif", fontWeight: 800,
              fontSize: 'clamp(2rem, 6vw, 4rem)', lineHeight: 1.08,
              letterSpacing: '-0.03em', marginBottom: 'clamp(16px, 4vw, 24px)',
              color: isDark ? '#94A3B8' : '#0F172A',
              animation: 'fadeInUp 0.6s 0.1s ease both',
            }}>
              Exams that run<br />
              <span style={{
                background: 'linear-gradient(135deg, #0D406C 0%, #5AD5A2 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>smarter, not harder</span>
            </h1>

            <p style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(14px, 3vw, 18px)', lineHeight: 1.7,
              color: isDark ? '#94A3B8' : '#64748B',
              marginBottom: 'clamp(24px, 6vw, 40px)', maxWidth: 500,
              animation: 'fadeInUp 0.6s 0.2s ease both',
            }}>
              AI-powered grading, real-time analytics, and secure online exams — built for Rwanda's schools and universities.
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', animation: 'fadeInUp 0.6s 0.3s ease both', marginBottom: 'clamp(32px, 8vw, 52px)' }} className="hero-buttons">
              {isAuthenticated ? (
                <>
                  <RouterLink to="/dashboard" style={{
                    padding: 'clamp(12px, 2.5vw, 14px) clamp(20px, 5vw, 28px)', borderRadius: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 'clamp(14px, 3vw, 16px)',
                    background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)',
                    color: 'white', textDecoration: 'none',
                    boxShadow: '0 8px 24px rgba(12,189,115,0.35)',
                    display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
                  }}>
                    Go to Dashboard
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </RouterLink>
                  <RouterLink to="/marketplace" style={{
                    padding: 'clamp(12px, 2.5vw, 14px) clamp(20px, 5vw, 28px)', borderRadius: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 'clamp(14px, 3vw, 16px)',
                    border: `1.5px solid ${isDark ? '#1E293B' : '#E2E8F0'}`,
                    color: isDark ? '#94A3B8' : '#64748B',
                    background: isDark ? tokens.dark.surfaceAlt : 'transparent',
                    textDecoration: 'none', whiteSpace: 'nowrap',
                  }}>
                    Browse Marketplace
                  </RouterLink>
                </>
              ) : (
                <>
                  <RouterLink to="/marketplace" style={{
                    padding: 'clamp(12px, 2.5vw, 14px) clamp(20px, 5vw, 28px)', borderRadius: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 'clamp(14px, 3vw, 16px)',
                    background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)',
                    color: 'white', textDecoration: 'none',
                    boxShadow: '0 8px 24px rgba(12,189,115,0.35)',
                    display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
                  }}>
                    Browse Marketplace
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 3h18v18H3zM9 9h6M9 12h6M9 15h6"/></svg>
                  </RouterLink>
                  <RouterLink to="/register" style={{
                    padding: 'clamp(12px, 2.5vw, 14px) clamp(20px, 5vw, 28px)', borderRadius: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 'clamp(14px, 3vw, 16px)',
                    background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)',
                    color: 'white', textDecoration: 'none',
                    boxShadow: '0 8px 24px rgba(12,189,115,0.35)',
                    display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
                  }}>
                    Start for free
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </RouterLink>
                </>
              )}
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 'clamp(16px, 5vw, 32px)', animation: 'fadeInUp 0.6s 0.4s ease both', flexWrap: 'wrap' }}>
              {[
                { value: `${count.toLocaleString()}+`, label: 'Exams graded' },
                { value: '140+', label: 'Institutions' },
                { value: '99.8%', label: 'Uptime' },
              ].map((s, i) => (
                <div key={i}>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: 'clamp(20px, 4vw, 26px)', letterSpacing: '-0.02em', color: isDark ? '#94A3B8' : '#0F172A' }}>{s.value}</div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(11px, 2vw, 13px)', color: isDark ? '#94A3B8' : '#64748B', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: dashboard mockup */}
          <div className="hero-mockup" style={{ position: 'relative', animation: 'fadeInUp 0.7s 0.2s ease both' }}>
            <DashboardMockup isDark={isDark} />
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap');
        @keyframes fadeInUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes float1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(12px,-20px)} }
        @keyframes float2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-12px,16px)} }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(1.3)} }
        @keyframes slideIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .mobile-menu-btn { display: none !important; }
        .desktop-nav-links { display: flex !important; }
        .desktop-auth { display: inline-block !important; }
        
        @media (max-width: 1024px) {
          .desktop-nav-links { gap: 2px !important; }
          .desktop-nav-links button { padding: 6px 10px !important; font-size: 13px !important; }
          .desktop-connector { display: flex !important; }
        }
        
        @media (max-width: 900px) {
          .mobile-menu-btn { display: flex !important; }
          .desktop-nav-links { display: none !important; }
          .desktop-auth { display: none !important; }
          .hero-grid { grid-template-columns: 1fr !important; }
          .hero-mockup { display: none !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .cta-inner { flex-direction: column !important; text-align: center !important; }
          .contact-grid { grid-template-columns: 1fr !important; }
          .footer-grid { grid-template-columns: 1fr !important; }
        }
        
        @media (max-width: 640px) {
          body { font-size: 14px; }
          .mobile-menu-btn { display: flex !important; }
          .desktop-nav-links { display: none !important; }
          .desktop-auth { display: none !important; }
          .hero-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
          .hero-mockup { display: none !important; }
          .hero-buttons { gap: 10px !important; }
          .features-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
          .steps-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
          .cta-inner { flex-direction: column !important; text-align: center !important; gap: 20px !important; }
          .contact-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
          .footer-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
        }
        
        @media (max-width: 480px) {
          .mobile-menu-btn { display: flex !important; }
          .desktop-nav-links { display: none !important; }
          .desktop-auth { display: none !important; }
          .hero-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
          .hero-mockup { display: none !important; }
          .hero-buttons { gap: 8px !important; flex-direction: column !important; }
          .hero-buttons a, .hero-buttons button { width: 100% !important; justify-content: center !important; }
          .features-grid { grid-template-columns: 1fr !important; gap: 12px !important; }
          .steps-grid { grid-template-columns: 1fr !important; gap: 12px !important; }
          .cta-inner { flex-direction: column !important; text-align: center !important; gap: 16px !important; }
          .contact-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
          .footer-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
        }
      `}</style>
    </section>
  );
}

// ─── Dashboard mockup ─────────────────────────────────────────────────────────
function DashboardMockup({ isDark }) {
  const bg = isDark ? '#0D1526' : '#FFFFFF';
  const border = isDark ? '#1E293B' : '#E2E8F0';
  const text = isDark ? '#94A3B8' : '#0F172A';
  const muted = isDark ? '#475569' : '#94A3B8';
  const cardBg = isDark ? '#111827' : '#F8FAFC';

  const bars = [62, 85, 45, 90, 73, 58, 95];

  return (
    <div style={{
      borderRadius: 20, overflow: 'hidden',
      border: `1px solid ${border}`,
      boxShadow: isDark ? '0 32px 64px rgba(0,0,0,0.5)' : '0 32px 64px rgba(15,23,42,0.15)',
      background: bg, fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* Window bar */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        {['#FF5F57', '#FFBD2E', '#0CBD73'].map((c, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
        <div style={{ flex: 1, margin: '0 12px', height: 24, borderRadius: 6, background: isDark ? '#1E293B' : '#F1F5F9', display: 'flex', alignItems: 'center', paddingLeft: 10, gap: 6 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="2"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/></svg>
          <span style={{ fontSize: 10, color: muted }}>eexams.rw/dashboard</span>
        </div>
      </div>

      {/* Sidebar + content */}
      <div style={{ display: 'flex', height: 340 }}>
        {/* Sidebar */}
        <div style={{ width: 56, background: isDark ? '#0D1526' : '#0F172A', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16, gap: 20, flexShrink: 0 }}>
          {[
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
            <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
            <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>,
            <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
          ].map((path, i) => (
            <div key={i} style={{ width: 36, height: 36, borderRadius: 10, background: i === 0 ? '#0CBD73' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={i === 0 ? 'white' : 'rgba(255,255,255,0.35)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{path}</svg>
            </div>
          ))}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, padding: 16, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: text }}>Overview</span>
            <span style={{ fontSize: 11, color: muted, marginLeft: 8 }}>May 2026</span>
          </div>

          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
            {[
              { label: 'Total exams', value: '284', color: '#0CBD73', icon: '📋' },
              { label: 'Pass rate', value: '91%', color: '#0CBD73', icon: '✓' },
              { label: 'Avg score', value: '78.4', color: '#F59E0B', icon: '⭑' },
            ].map((s, i) => (
              <div key={i} style={{ padding: '10px 12px', borderRadius: 10, background: cardBg, border: `1px solid ${border}` }}>
                <div style={{ fontSize: 9, color: muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          <div style={{ padding: '10px 12px', borderRadius: 10, background: cardBg, border: `1px solid ${border}`, marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: muted, marginBottom: 8 }}>Score distribution this week</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 60 }}>
              {bars.map((h, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <div style={{ width: '100%', height: `${h * 0.6}px`, borderRadius: 4, background: `linear-gradient(180deg, rgba(12,189,115,0.13), rgba(12,189,115,0.2))`, opacity: 0.7 + i * 0.04 }} />
                  <span style={{ fontSize: 8, color: muted }}>W{i + 1}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent exams */}
          <div style={{ padding: '8px 12px', borderRadius: 10, background: cardBg, border: `1px solid ${border}` }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: muted, marginBottom: 8 }}>Recent exams</div>
            {[
              { name: 'Biology P2', date: 'May 12', score: 88, status: 'graded' },
              { name: 'Math P1', date: 'May 11', score: 72, status: 'graded' },
              { name: 'English', date: 'May 10', score: null, status: 'pending' },
            ].map((exam, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: i < 2 ? 6 : 0, marginBottom: i < 2 ? 6 : 0, borderBottom: i < 2 ? `1px solid ${border}` : 'none' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: text }}>{exam.name}</div>
                  <div style={{ fontSize: 9, color: muted }}>{exam.date}</div>
                </div>
                <div style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                  background: exam.status === 'graded' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                  color: exam.status === 'graded' ? '#0CBD73' : '#F59E0B',
                }}>
                  {exam.score ? `${exam.score}%` : 'Pending'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Marketplace Showcase ─────────────────────────────────────────────────────
function MarketplaceShowcase({ mode }) {
  const isDark = mode === 'dark';
  const bg = isDark ? '#030712' : '#FFFFFF';
  const cardBg = isDark ? '#111827' : '#FFFFFF';
  const border = isDark ? '#1E293B' : '#E2E8F0';
  const text = isDark ? '#94A3B8' : '#0F172A';
  
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMarketplaceExams();
  }, []);

  const fetchMarketplaceExams = async () => {
    try {
      const response = await fetch('/api/marketplace/exams');
      const data = await response.json();
      setExams(data.slice(0, 6)); // Show only first 6 exams
    } catch (err) {
      console.error('Error fetching marketplace exams:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalQuestions = (sections) => {
    return sections?.reduce((sum, section) => sum + (section.questions?.length || 0), 0) || 0;
  };

  if (loading) {
    return null;
  }

  if (exams.length === 0) {
    return null;
  }

  return (
    <section style={{ padding: 'clamp(60px, 12vw, 100px) 0', background: bg }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100, background: isDark ? 'rgba(12,189,115,0.15)' : 'rgba(12,189,115,0.08)', border: `1px solid ${isDark ? 'rgba(12,189,115,0.3)' : 'rgba(12,189,115,0.2)'}`, marginBottom: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#0CBD73', fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Marketplace</span>
            </div>
            <h2 style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 'clamp(2rem, 4vw, 3rem)', letterSpacing: '-0.03em', color: text, marginBottom: 16 }}>
              Browse Public Exams
            </h2>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 18, color: isDark ? '#94A3B8' : '#64748B', maxWidth: 560, margin: '0 auto', lineHeight: 1.7 }}>
              Discover exams shared by teachers across Rwanda. Request access and start learning today.
            </p>
          </div>
        </Reveal>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 28, marginBottom: 48 }}>
          {exams.map((exam, i) => (
            <Reveal key={exam._id} delay={i * 80}>
              <div style={{
                padding: 28, borderRadius: 24,
                background: cardBg,
                border: `1px solid ${border}`,
                transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                cursor: 'pointer',
              }}
                onClick={() => window.location.href = `/marketplace/exams/${exam._id}/request`}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-6px)';
                  e.currentTarget.style.boxShadow = isDark ? '0 24px 48px rgba(0,0,0,0.4)' : '0 24px 48px rgba(15,23,42,0.12)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Header with badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 100, background: 'linear-gradient(135deg, #0CBD73 0%, #5AD5A2 100%)', color: 'white', fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.04em' }}>
                    Public Exam
                  </div>
                  {exam.targetAudience && (
                    <div style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 8, background: isDark ? 'rgba(13,71,161,0.2)' : 'rgba(13,71,161,0.1)', color: '#0D406C', fontFamily: 'DM Sans, sans-serif' }}>
                      {exam.targetAudience}
                    </div>
                  )}
                </div>
                
                {/* Title */}
                <h3 style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 20, color: text, marginBottom: 12, lineHeight: 1.3 }}>
                  {exam.title}
                </h3>
                
                {/* Description */}
                <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, lineHeight: 1.6, color: isDark ? '#94A3B8' : '#64748B', marginBottom: 20, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {exam.publicDescription || exam.description}
                </p>
                
                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20, padding: '16px', borderRadius: 12, background: isDark ? 'rgba(30,41,59,0.5)' : 'rgba(241,245,249,0.8)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#0D406C', lineHeight: 1, marginBottom: 4 }}>
                      {calculateTotalQuestions(exam.sections)}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#94A3B8' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Questions
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#0CBD73', lineHeight: 1, marginBottom: 4 }}>
                      {exam.timeLimit}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#94A3B8' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Minutes
                    </div>
                  </div>
                </div>

                {/* Price if applicable */}
                {exam.publicPrice > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 10, background: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.08)', border: `1px solid ${isDark ? 'rgba(245,158,11,0.3)' : 'rgba(245,158,11,0.2)'}` }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#94A3B8' : '#64748B' }}>Price</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#F59E0B' }}>
                    RWF {exam.publicPrice.toLocaleString()}
                  </span>
                </div>
                )}
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div style={{ textAlign: 'center' }}>
            <RouterLink to="/marketplace" style={{
              padding: '14px 32px', borderRadius: 12, fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 16,
              background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)',
              color: 'white', textDecoration: 'none',
              boxShadow: '0 8px 24px rgba(12,189,115,0.35)',
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              View All Exams
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </RouterLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Features ────────────────────────────────────────────────────────────────
function Features({ mode }) {
  const isDark = mode === 'dark';
  const bg = isDark ? '#030712' : '#F5FBF8';
  const cardBg = isDark ? '#111827' : '#FFFFFF';
  const border = isDark ? '#1E293B' : '#E2E8F0';
  const text = isDark ? '#94A3B8' : '#0F172A';

  const features = [
    {
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44l-1.4-8a2.5 2.5 0 0 1 2.46-2.56H12"/><path d="M14.5 22A2.5 2.5 0 0 0 12 19.5v-15a2.5 2.5 0 0 1 4.96.44l1.4 8a2.5 2.5 0 0 1-2.46 2.56H12"/></svg>,
      title: 'AI-powered grading',
      desc: 'Grade open-ended responses in seconds with state-of-the-art NLP that understands Kinyarwanda and English.',
      color: '#0CBD73',
      tag: 'Core',
    },
    {
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/></svg>,
      title: 'Timed, live exams',
      desc: 'Auto-submit on expiry, countdown timers, and real-time browser lockdown for academic integrity.',
      color: '#0D406C',
      tag: 'Security',
    },
    {
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>,
      title: 'Deep analytics',
      desc: 'Visual dashboards, per-question stats, class-wide trends, and exportable PDF/Excel reports.',
      color: '#5AD5A2',
      tag: 'Insights',
    },
    {
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
      title: 'Enterprise security',
      desc: 'End-to-end encryption, randomized question ordering, and AI proctoring to detect suspicious activity.',
      color: '#F59E0B',
      tag: 'Security',
    },
    {
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
      title: 'Student management',
      desc: 'Bulk import, group assignments, role management, and individual student progress tracking.',
      color: '#0D406C',
      tag: 'Admin',
    },
    {
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>,
      title: 'Works on any device',
      desc: 'Fully responsive — desktop, tablet, or smartphone. No app installation required, ever.',
      color: '#5AD5A2',
      tag: 'Platform',
    },
  ];

  return (
    <section id="features" style={{ padding: 'clamp(60px, 12vw, 100px) 0', background: bg }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100, background: isDark ? 'rgba(12,189,115,0.15)' : 'rgba(12,189,115,0.08)', border: `1px solid ${isDark ? 'rgba(12,189,115,0.3)' : 'rgba(12,189,115,0.2)'}`, marginBottom: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#0CBD73', fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.06em', textTransform: 'uppercase' }}>Features</span>
            </div>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: 'clamp(2rem, 4vw, 3rem)', letterSpacing: '-0.03em', color: text, marginBottom: 16 }}>
              Everything exams need.<br />
              <span style={{ background: 'linear-gradient(135deg, #0D406C 0%, #5AD5A2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Nothing they don't.</span>
            </h2>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, color: isDark ? '#94A3B8' : '#64748B', maxWidth: 560, margin: '0 auto', lineHeight: 1.7 }}>
              Built specifically for Rwanda's institutions — from National Exams to university finals.
            </p>
          </div>
        </Reveal>

        <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {features.map((f, i) => (
            <Reveal key={i} delay={i * 80}>
              <div style={{
                padding: 28, borderRadius: 20,
                background: cardBg,
                border: `1px solid ${border}`,
                transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                cursor: 'default',
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = isDark ? '0 20px 40px rgba(0,0,0,0.3)' : '0 20px 40px rgba(15,23,42,0.1)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Icon */}
                <div style={{ width: 48, height: 48, borderRadius: 14, background: `${f.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: f.color, marginBottom: 18 }}>
                  {f.icon}
                </div>
                {/* Tag */}
                <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100, background: `${f.color}15`, color: f.color, fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.04em', marginBottom: 10 }}>
                  {f.tag}
                </div>
                <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 18, color: text, marginBottom: 10 }}>
                  {f.title}
                </h3>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, lineHeight: 1.65, color: isDark ? '#94A3B8' : '#64748B' }}>
                  {f.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────
function HowItWorks({ mode }) {
  const isDark = mode === 'dark';
  const bg = isDark ? '#111827' : '#F0F4FF';
  const cardBg = isDark ? '#111827' : '#FFFFFF';
  const border = isDark ? '#1E293B' : '#E2E8F0';
  const text = isDark ? '#94A3B8' : '#0F172A';

  const steps = [
    { num: '01', title: 'Create your exam', desc: 'Upload a document or build questions from scratch. Support for MCQ, essays, math, code, and file submissions.', color: '#0CBD73' },
    { num: '02', title: 'Assign to students', desc: 'Send to individuals or groups. Set windows, time limits, and shuffle questions per student.', color: '#0D406C' },
    { num: '03', title: 'Students take it', desc: 'Students log in from any device. A secure browser environment prevents tab switching and copying.', color: '#0D406C' },
    { num: '04', title: 'AI grades instantly', desc: 'MCQs are auto-scored. Open-ended answers are graded by AI and ready for teacher review in seconds.', color: '#5AD5A2' },
    { num: '05', title: 'Review results', desc: 'Detailed score breakdowns, class analytics, and exportable reports available immediately.', color: '#F59E0B' },
  ];

  return (
    <section id="how-it-works" style={{ padding: 'clamp(60px, 12vw, 100px) 0', background: bg }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100, background: isDark ? 'rgba(12,189,115,0.15)' : 'rgba(12,189,115,0.08)', border: `1px solid ${isDark ? 'rgba(12,189,115,0.3)' : 'rgba(12,189,115,0.2)'}`, marginBottom: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#0CBD73', fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.06em', textTransform: 'uppercase' }}>How it works</span>
            </div>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: 'clamp(2rem, 4vw, 3rem)', letterSpacing: '-0.03em', color: text }}>
              From zero to graded in minutes
            </h2>
          </div>
        </Reveal>

        <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'clamp(16px, 4vw, 20px)', position: 'relative' }}>
          {/* Connector line */}
          <div style={{ position: 'absolute', top: 36, left: '10%', right: '10%', height: 2, background: `linear-gradient(90deg, #0D406C, #0CBD73, #5AD5A2)`, opacity: 0.25, zIndex: 0, display: 'none' }} className="desktop-connector" />

          {steps.map((s, i) => (
            <Reveal key={i} delay={i * 100}>
              <div style={{ position: 'relative', zIndex: 1 }}>
                {/* Number bubble */}
                <div style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${s.color}22, ${s.color}33)`, border: `2px solid ${s.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, color: s.color, fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>
                  {s.num}
                </div>
                <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 16, color: text, marginBottom: 8 }}>{s.title}</h3>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, lineHeight: 1.6, color: isDark ? '#94A3B8' : '#64748B' }}>{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={300}>
          <div style={{ textAlign: 'center', marginTop: 64 }}>
            <RouterLink to="/register" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '16px 32px', borderRadius: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 17,
              background: 'white', color: '#0CBD73', textDecoration: 'none',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              whiteSpace: 'nowrap',
            }}>
              Try it free — no credit card
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </RouterLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────
function FAQ({ mode }) {
  const isDark = mode === 'dark';
  const bg = isDark ? '#111827' : '#F5FBF8';
  const cardBg = isDark ? '#111827' : '#FFFFFF';
  const border = isDark ? '#1E293B' : '#E2E8F0';
  const text = isDark ? '#94A3B8' : '#0F172A';
  const [open, setOpen] = useState(null);

  const faqs = [
    { q: 'How does the AI grading work?', a: 'eexams uses fine-tuned large language models to evaluate open-ended responses against marking rubrics. It considers content accuracy, relevance, and language quality — working in both English and Kinyarwanda.' },
    { q: 'Is it secure enough for high-stakes national exams?', a: 'Yes. We implement browser lockdown, randomized question ordering, AI proctoring to flag suspicious behavior, encrypted connections, and full audit logs. eexams meets international standards for high-stakes examinations.' },
    { q: 'Can I import questions from existing documents?', a: 'Absolutely. Upload Word, PDF, or Excel files and eexams automatically parses and imports your questions. We support MCQ, essay, true/false, matching, and coded questions.' },
    { q: 'What devices do students need?', a: 'Any modern browser on a desktop, laptop, tablet, or smartphone. No app installation needed. eexams works offline with automatic sync when connectivity is restored.' },
    { q: 'How do I integrate with my current LMS?', a: 'eexams provides REST API and LTI 1.3 integrations for Canvas, Moodle, Blackboard, Google Classroom, and custom platforms. Our team assists with setup at no extra cost on Pro and Enterprise plans.' },
    { q: 'What analytics are available to teachers?', a: 'Per-student score breakdowns, question-level difficulty analysis, grade distribution curves, class-wide trends over time, and exportable reports in PDF, Excel, and CSV.' },
  ];

  return (
    <section id="faq" style={{ padding: 'clamp(60px, 12vw, 100px) 0', background: bg }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100, background: isDark ? 'rgba(12,189,115,0.15)' : 'rgba(12,189,115,0.08)', border: `1px solid ${isDark ? 'rgba(12,189,115,0.3)' : 'rgba(12,189,115,0.2)'}`, marginBottom: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#0CBD73', fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.06em', textTransform: 'uppercase' }}>FAQ</span>
            </div>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: 'clamp(2rem, 4vw, 2.8rem)', letterSpacing: '-0.03em', color: text }}>
              Common questions
            </h2>
          </div>
        </Reveal>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {faqs.map((faq, i) => (
            <Reveal key={i} delay={i * 60}>
              <div style={{
                borderRadius: 16, border: `1px solid ${open === i ? 'rgba(12,189,115,0.27)' : border}`,
                background: cardBg, overflow: 'hidden',
                transition: 'border-color 0.2s',
              }}>
                <button onClick={() => setOpen(open === i ? null : i)} style={{
                  width: '100%', padding: '20px 24px', background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, textAlign: 'left',
                }}>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 16, color: text }}>
                    {faq.q}
                  </span>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: open === i ? '#0CBD73' : isDark ? '#111827' : '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: open === i ? '#0CBD73' : isDark ? '#94A3B8' : '#64748B', transition: 'all 0.2s', transform: open === i ? 'rotate(45deg)' : 'none' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                  </div>
                </button>
                {open === i && (
                  <div style={{ padding: '0 24px 20px', animation: 'fadeInUp 0.2s ease' }}>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, lineHeight: 1.7, color: isDark ? '#94A3B8' : '#64748B' }}>
                      {faq.a}
                    </p>
                  </div>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA Banner ──────────────────────────────────────────────────────────────
function CTABanner({ mode }) {
  const isDark = mode === 'dark';
  return (
    <section style={{ padding: '0 16px clamp(60px, 12vw, 100px)' }}>
      <Reveal>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          borderRadius: 28, padding: 'clamp(32px, 8vw, 72px) clamp(24px, 8vw, 64px)',
          background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 55%, #5AD5A2 100%)',
          position: 'relative', overflow: 'hidden',
          boxShadow: '0 32px 64px rgba(13,64,108,0.3)',
        }}>
          {/* Background decoration */}
          <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
          <div style={{ position: 'absolute', bottom: -60, left: -20, width: 280, height: 280, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

          <div className="cta-inner" style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40 }}>
            <div style={{ maxWidth: 600 }}>
              <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', letterSpacing: '-0.03em', color: 'white', marginBottom: 16 }}>
                Ready to modernise your exams?
              </h2>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
                Join 140+ Rwandan institutions. Free 14-day trial. No credit card, no setup fee.
              </p>
              <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                {['14-day free trial', 'Full access', 'Cancel anytime'].map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }}>
              <RouterLink to="/register" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '16px 32px', borderRadius: 14, fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 17,
                background: 'white', color: '#0CBD73', textDecoration: 'none',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                whiteSpace: 'nowrap',
              }}>
                Start free trial
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </RouterLink>
              <button onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })} style={{
                padding: '14px 32px', borderRadius: 14, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 16,
                background: 'rgba(255,255,255,0.1)', color: 'white',
                border: '1.5px solid rgba(255,255,255,0.25)', cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
                Book a demo
              </button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

// ─── Contact ─────────────────────────────────────────────────────────────────
function Contact({ mode }) {
  const isDark = mode === 'dark';
  const bg = isDark ? '#111827' : '#F0F4FF';
  const cardBg = isDark ? '#111827' : '#FFFFFF';
  const border = isDark ? '#1E293B' : '#E2E8F0';
  const text = isDark ? '#94A3B8' : '#0F172A';
  const inputBg = isDark ? '#111827' : '#F8FAFC';
  const [sent, setSent] = useState(false);

  const inputStyle = {
    width: '100%', padding: '12px 16px', borderRadius: 10,
    border: `1.5px solid ${border}`, background: inputBg,
    fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: text,
    outline: 'none', transition: 'border-color 0.2s',
  };

  return (
    <section id="contact" style={{ padding: 'clamp(60px, 12vw, 100px) 0', background: bg }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100, background: isDark ? 'rgba(12,189,115,0.15)' : 'rgba(12,189,115,0.08)', border: `1px solid ${isDark ? 'rgba(12,189,115,0.3)' : 'rgba(12,189,115,0.2)'}`, marginBottom: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#0CBD73', fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.06em', textTransform: 'uppercase' }}>Contact</span>
            </div>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: 'clamp(2rem, 4vw, 3rem)', letterSpacing: '-0.03em', color: text }}>
              Talk to our team
            </h2>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, color: isDark ? '#94A3B8' : '#64748B', marginTop: 12 }}>
              We respond within 1 business day. Mon–Fri, 8am–6pm (EAT).
            </p>
          </div>
        </Reveal>

        <div className="contact-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'start' }}>
          {/* Form */}
          <Reveal>
            <div style={{ padding: 40, borderRadius: 24, background: cardBg, border: `1px solid ${border}`, boxShadow: isDark ? '0 20px 40px rgba(0,0,0,0.3)' : '0 20px 40px rgba(15,23,42,0.06)' }}>
              {sent ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(12,189,115,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#0CBD73' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 22, color: text, marginBottom: 10 }}>Message sent!</h3>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: isDark ? '#94A3B8' : '#64748B' }}>We'll get back to you within 1 business day.</p>
                </div>
              ) : (
                <>
                  <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 22, color: text, marginBottom: 8 }}>Send a message</h3>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: isDark ? '#94A3B8' : '#64748B', marginBottom: 28 }}>
                    Have a question, need a demo, or want pricing info? We're here.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                      <input style={inputStyle} placeholder="Your name"
                        onFocus={e => e.target.style.borderColor = '#0CBD73'}
                        onBlur={e => e.target.style.borderColor = border}
                      />
                      <input style={inputStyle} placeholder="Email address"
                        onFocus={e => e.target.style.borderColor = '#0CBD73'}
                        onBlur={e => e.target.style.borderColor = border}
                      />
                    </div>
                    <input style={inputStyle} placeholder="Subject"
                      onFocus={e => e.target.style.borderColor = '#0CBD73'}
                      onBlur={e => e.target.style.borderColor = border}
                    />
                    <textarea style={{ ...inputStyle, height: 140, resize: 'vertical' }} placeholder="Your message..."
                      onFocus={e => e.target.style.borderColor = '#0CBD73'}
                      onBlur={e => e.target.style.borderColor = border}
                    />
                    <button onClick={() => setSent(true)} style={{
                      width: '100%', padding: '14px', borderRadius: 12,
                      background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)',
                      color: 'white', border: 'none', cursor: 'pointer',
                      fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 16,
                      boxShadow: '0 8px 24px rgba(12,189,115,0.35)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}>
                      Send message
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </button>
                  </div>
                </>
              )}
            </div>
          </Reveal>

          {/* Info */}
          <Reveal delay={100}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {[
                { icon: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.93 12 19.79 19.79 0 0 1 1.93 3.26 2 2 0 0 1 3.9 1.07h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 15.91z"/>, label: 'Phone', value: '+250 788 123 456', color: '#0CBD73' },
                { icon: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>, label: 'Email', value: 'info@eexams.rw', color: '#0D406C' },
                { icon: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>, label: 'Office', value: 'Kigali Heights, KG 7 Ave, Kigali', color: '#5AD5A2' },
              ].map((item, i) => (
                <div key={i} style={{ padding: 24, borderRadius: 16, background: cardBg, border: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: `${item.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color, flexShrink: 0 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{item.icon}</svg>
                  </div>
                  <div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: isDark ? '#94A3B8' : '#64748B', marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 16, color: text }}>{item.value}</div>
                  </div>
                </div>
              ))}

              {/* Social */}
              <div style={{ padding: 24, borderRadius: 16, background: cardBg, border: `1px solid ${border}` }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: isDark ? '#94A3B8' : '#64748B', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Follow us</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[
                    { name: 'Facebook', color: '#1877F2', path: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/> },
                    { name: 'Twitter/X', color: '#000', path: <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/> },
                    { name: 'LinkedIn', color: '#0A66C2', path: <><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></> },
                    { name: 'Instagram', color: '#E4405F', path: <><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></> },
                  ].map((s, i) => (
                    <button key={i} title={s.name} style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${border}`, background: isDark ? '#111827' : '#F8FAFC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDark ? '#94A3B8' : '#64748B', transition: 'all 0.2s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = s.color; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = s.color; }}
                      onMouseLeave={e => { e.currentTarget.style.background = isDark ? '#111827' : '#F8FAFC'; e.currentTarget.style.color = isDark ? '#94A3B8' : '#64748B'; e.currentTarget.style.borderColor = border; }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{s.path}</svg>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────
function Footer({ mode }) {
  const isDark = mode === 'dark';
  const bg = isDark ? '#030712' : '#0F172A';
  const border = 'rgba(255,255,255,0.08)';
  const muted = 'rgba(255,255,255,0.45)';
  const secondary = 'rgba(255,255,255,0.7)';

  const cols = [
    { title: 'Product', links: ['Features', 'How it works', 'Pricing', 'Security', 'API'] },
    { title: 'Company', links: ['About', 'Blog', 'Careers', 'Partners', 'Contact'] },
    { title: 'Resources', links: ['Documentation', 'Guides', 'Webinars', 'Support', 'Status'] },
    { title: 'Legal', links: ['Privacy', 'Terms', 'Cookies', 'Accessibility'] },
  ];

  return (
    <footer style={{ background: bg, padding: 'clamp(40px, 8vw, 80px) 16px clamp(24px, 4vw, 40px)', color: 'white' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div className="footer-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'clamp(24px, 6vw, 48px)', marginBottom: 'clamp(32px, 8vw, 64px)' }}>
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
              <img src="/logo.png" alt="eexams" style={{ width: 70, height: 70, borderRadius: 12, objectFit: 'cover', backgroundColor: isDark ? 'rgba(255,255,255,0.95)' : 'transparent', padding: isDark ? '4px' : '0', boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.1)' }} />
            </div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: secondary, lineHeight: 1.7, maxWidth: 280, marginBottom: 28 }}>
              Modern online exam platform for Rwanda's schools and universities. AI-powered grading, real-time analytics.
            </p>
            <div style={{ padding: '16px 20px', borderRadius: 14, border: `1px solid ${border}`, background: 'rgba(255,255,255,0.04)' }}>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: muted, marginBottom: 10 }}>Stay in the loop</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input placeholder="your@email.com" style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: `1px solid ${border}`, background: 'rgba(255,255,255,0.05)', color: 'white', fontFamily: "'DM Sans', sans-serif", fontSize: 14, outline: 'none' }} />
                <button style={{ padding: '10px 14px', borderRadius: 10, background: '#0CBD73', border: 'none', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
              </div>
            </div>
          </div>

          {/* Links */}
          {cols.map((col, i) => (
            <div key={i}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 13, color: 'rgba(255,255,255,0.9)', marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{col.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {col.links.map((l, j) => (
                  <a key={j} href="#" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: muted, textDecoration: 'none', transition: 'color 0.2s' }}
                    onMouseEnter={e => e.target.style.color = 'white'}
                    onMouseLeave={e => e.target.style.color = muted}
                  >{l}</a>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: `1px solid ${border}`, paddingTop: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: muted }}>
            © {new Date().getFullYear()} eexams. All rights reserved.
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            {['🇷🇼 Made in Rwanda', 'Privacy', 'Terms'].map((t, i) => (
              <span key={i} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: muted, padding: '4px 12px', borderRadius: 100, border: `1px solid ${border}` }}>{t}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
function App() {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const scrollY = useScrollY();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <Nav
        scrolled={scrollY > 40}
        mode={mode}
        toggleMode={toggleMode}
        isAuthenticated={isAuthenticated}
        user={user}
        handleLogout={handleLogout}
        currentRoute="/"
      />
      <main>
        <Hero mode={mode} isAuthenticated={isAuthenticated} user={user} />
        <MarketplaceShowcase mode={mode} />
        <Features mode={mode} />
        <HowItWorks mode={mode} />
        <CTABanner mode={mode} />
        <FAQ mode={mode} />
        <Contact mode={mode} />
      </main>
      <Footer mode={mode} />
    </div>
  );
}

export default App;