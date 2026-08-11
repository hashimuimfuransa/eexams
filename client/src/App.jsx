import React, { useState, useEffect, useRef } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useThemeMode } from './context/ThemeContext';
import Nav from './components/Nav';
import SEO from './components/SEO';
import api from './services/api';

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
function Reveal({ children, delay = 0, style = {}, animation = 'fadeInUp' }) {
  const ref = useRef(null);
  const inView = useInView(ref);
  
  const animations = {
    fadeInUp: {
      opacity: inView ? 1 : 0,
      transform: inView ? 'translateY(0)' : 'translateY(28px)',
    },
    fadeInDown: {
      opacity: inView ? 1 : 0,
      transform: inView ? 'translateY(0)' : 'translateY(-28px)',
    },
    fadeInLeft: {
      opacity: inView ? 1 : 0,
      transform: inView ? 'translateX(0)' : 'translateX(-28px)',
    },
    fadeInRight: {
      opacity: inView ? 1 : 0,
      transform: inView ? 'translateX(0)' : 'translateX(28px)',
    },
    fadeInScale: {
      opacity: inView ? 1 : 0,
      transform: inView ? 'scale(1)' : 'scale(0.9)',
    },
  };
  
  return (
    <div ref={ref} style={{
      ...animations[animation] || animations.fadeInUp,
      transition: `opacity 0.65s cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms, transform 0.65s cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms`,
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

  // Brand palette only — navy #0D406C, emerald #0CBD73, slate text.
  const heading = isDark ? '#E8F8F1' : '#0F172A';
  const body = isDark ? '#9DC4D9' : '#64748B';
  const hairline = isDark ? 'rgba(157,196,217,0.14)' : '#E2E8F0';
  const panel = isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF';

  // Hand-placed crosshairs on the grid — small, deliberate, brand green.
  const marks = [
    { top: '24%', left: '3%' }, { bottom: '20%', left: '7%' },
    { top: '13%', right: '6%' }, { bottom: '14%', right: '3%' },
  ];

  return (
    <section id="home" className="hero-section" style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      position: 'relative', isolation: 'isolate', overflow: 'hidden',
      background: isDark ? '#030712' : '#FFFFFF',
      paddingTop: 'clamp(80px, 15vw, 100px)',
      paddingBottom: 'clamp(48px, 10vw, 80px)',
    }}>
      {/* ── Layer 1: two restrained brand washes ────────────────────────────── */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: -3, pointerEvents: 'none' }}>
        <div className="hero-wash hero-wash-navy" style={{
          background: isDark
            ? 'radial-gradient(circle at 50% 50%, rgba(13,64,108,0.55), rgba(13,64,108,0) 70%)'
            : 'radial-gradient(circle at 50% 50%, rgba(13,64,108,0.10), rgba(13,64,108,0) 70%)',
        }} />
        <div className="hero-wash hero-wash-green" style={{
          background: isDark
            ? 'radial-gradient(circle at 50% 50%, rgba(12,189,115,0.16), rgba(12,189,115,0) 70%)'
            : 'radial-gradient(circle at 50% 50%, rgba(12,189,115,0.10), rgba(12,189,115,0) 70%)',
        }} />
      </div>

      {/* ── Layer 2: measured grid ──────────────────────────────────────────── */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, zIndex: -2, pointerEvents: 'none',
        backgroundImage: `linear-gradient(to right, ${isDark ? 'rgba(157,196,217,0.06)' : 'rgba(15,23,42,0.045)'} 1px, transparent 1px), linear-gradient(to bottom, ${isDark ? 'rgba(157,196,217,0.06)' : 'rgba(15,23,42,0.045)'} 1px, transparent 1px)`,
        backgroundSize: '56px 56px',
        maskImage: 'radial-gradient(ellipse 85% 62% at 50% 40%, #000 30%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 85% 62% at 50% 40%, #000 30%, transparent 100%)',
      }} />

      {/* ── Layer 3: crosshair marks + noise + section seam ─────────────────── */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: -2, pointerEvents: 'none' }}>
        {marks.map((pos, i) => (
          <span key={i} className="hero-mark" style={pos}>
            <span style={{ position: 'absolute', top: '50%', left: 0, width: '100%', height: 1, background: 'rgba(12,189,115,0.45)' }} />
            <span style={{ position: 'absolute', left: '50%', top: 0, height: '100%', width: 1, background: 'rgba(12,189,115,0.45)' }} />
          </span>
        ))}
      </div>
      <div aria-hidden="true" className="hero-noise" />
      <div aria-hidden="true" style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, zIndex: -1, pointerEvents: 'none',
        background: `linear-gradient(to right, transparent, ${isDark ? 'rgba(157,196,217,0.16)' : '#E2E8F0'} 20%, ${isDark ? 'rgba(157,196,217,0.16)' : '#E2E8F0'} 80%, transparent)`,
      }} />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px', position: 'relative', zIndex: 1, width: '100%' }}>
        <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 'clamp(40px, 7vw, 72px)', alignItems: 'center' }}>
          {/* Left */}
          <div>
            <div className="hero-rise" style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '6px 14px 6px 12px', borderRadius: 100,
              background: panel,
              border: `1px solid ${hairline}`,
              boxShadow: isDark ? 'none' : '0 1px 2px rgba(15,23,42,0.04)',
              marginBottom: 'clamp(18px, 4vw, 28px)',
            }}>
              <span className="hero-pulse" style={{ position: 'relative', display: 'inline-flex', width: 7, height: 7 }}>
                <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#0CBD73' }} />
              </span>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(11px, 2vw, 13px)', fontWeight: 600, color: heading, letterSpacing: '0.01em' }}>
                Trusted across Rwanda and beyond
              </span>
            </div>

            <h1 className="hero-rise hero-rise-1" style={{
              fontFamily: "'DM Sans', sans-serif", fontWeight: 800,
              fontSize: 'clamp(2.15rem, 6vw, 4rem)', lineHeight: 1.06,
              letterSpacing: '-0.03em', marginBottom: 'clamp(16px, 4vw, 24px)',
              color: heading,
            }}>
              Online exams,<br />
              <span style={{ color: '#0CBD73' }}>marked in minutes.</span>
            </h1>

            <p className="hero-rise hero-rise-2" style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(15px, 3vw, 18px)', lineHeight: 1.65,
              color: body,
              marginBottom: 'clamp(24px, 5vw, 36px)', maxWidth: 520,
            }}>
              For institutions, schools, organisations and individual students in Rwanda and beyond.
              Create a secure exam, let AI handle the marking, and share results the same day.
            </p>

            <div className="hero-buttons hero-rise hero-rise-3" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 'clamp(28px, 6vw, 40px)' }}>
              {isAuthenticated ? (
                <>
                  <RouterLink to="/dashboard" className="hero-cta" style={{
                    padding: 'clamp(13px, 2.5vw, 15px) clamp(22px, 5vw, 28px)', borderRadius: 10, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 'clamp(14px, 3vw, 16px)',
                    background: '#0D406C', color: 'white', textDecoration: 'none',
                    boxShadow: '0 8px 20px -10px rgba(13,64,108,0.7)',
                    display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
                  }}>
                    Go to dashboard
                    <svg className="hero-cta-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </RouterLink>
                  <RouterLink to="/marketplace" className="hero-ghost" style={{
                    padding: 'clamp(13px, 2.5vw, 15px) clamp(22px, 5vw, 28px)', borderRadius: 10, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 'clamp(14px, 3vw, 16px)',
                    border: `1.5px solid ${hairline}`,
                    color: isDark ? '#9DC4D9' : '#0F172A',
                    background: panel,
                    textDecoration: 'none', whiteSpace: 'nowrap',
                  }}>
                    Browse exams
                  </RouterLink>
                </>
              ) : (
                <>
                  <RouterLink to="/marketplace" className="hero-cta" style={{
                    padding: 'clamp(13px, 2.5vw, 15px) clamp(22px, 5vw, 28px)', borderRadius: 10, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 'clamp(14px, 3vw, 16px)',
                    background: '#0D406C', color: 'white', textDecoration: 'none',
                    boxShadow: '0 8px 20px -10px rgba(13,64,108,0.7)',
                    display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
                  }}>
                    Browse exams
                    <svg className="hero-cta-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </RouterLink>
                  <RouterLink to="/login" className="hero-ghost" style={{
                    padding: 'clamp(13px, 2.5vw, 15px) clamp(22px, 5vw, 28px)', borderRadius: 10, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 'clamp(14px, 3vw, 16px)',
                    border: `1.5px solid ${hairline}`,
                    color: isDark ? '#9DC4D9' : '#0F172A',
                    background: panel,
                    textDecoration: 'none', whiteSpace: 'nowrap',
                  }}>
                    Log in
                  </RouterLink>
                </>
              )}
            </div>

            {/* Trust markers */}
            <div className="hero-rise hero-rise-4" style={{ display: 'flex', alignItems: 'center', gap: 'clamp(12px, 3vw, 22px)', flexWrap: 'wrap', marginBottom: 'clamp(24px, 5vw, 34px)' }}>
              {[
                { label: 'Free to start', icon: <polyline points="20 6 9 17 4 12" /> },
                { label: 'Secure exam mode', icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /> },
                { label: 'Works on any device', icon: <><rect x="7" y="2" width="10" height="20" rx="2" /><line x1="11" y1="18" x2="13" y2="18" /></> },
              ].map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0CBD73" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{t.icon}</svg>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(12px, 2.4vw, 13.5px)', fontWeight: 500, color: body }}>{t.label}</span>
                </div>
              ))}
            </div>

            {/* Stats row */}
            <div className="hero-stats hero-rise hero-rise-5" style={{
              display: 'flex', flexWrap: 'wrap',
              borderTop: `1px solid ${hairline}`, paddingTop: 'clamp(18px, 4vw, 24px)',
              gap: 0,
            }}>
              {[
                { value: `${count.toLocaleString()}+`, label: 'Exams marked' },
                { value: '140+', label: 'Institutions served' },
                { value: '99.8%', label: 'Platform uptime' },
              ].map((s, i) => (
                <div key={i} style={{
                  paddingRight: 'clamp(18px, 4vw, 32px)',
                  paddingLeft: i === 0 ? 0 : 'clamp(18px, 4vw, 32px)',
                  borderLeft: i === 0 ? 'none' : `1px solid ${hairline}`,
                }}>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: 'clamp(20px, 4vw, 28px)', letterSpacing: '-0.025em', color: heading, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(11px, 2vw, 13px)', color: body, marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: dashboard mockup */}
          <div className="hero-mockup" style={{ position: 'relative' }}>
            {/* Soft brand glow behind the mockup */}
            <div aria-hidden="true" style={{
              position: 'absolute', inset: '-10% -6%', zIndex: 0, pointerEvents: 'none',
              background: isDark
                ? 'radial-gradient(ellipse at 50% 45%, rgba(12,189,115,0.14), rgba(13,64,108,0.20) 45%, transparent 72%)'
                : 'radial-gradient(ellipse at 50% 45%, rgba(12,189,115,0.10), rgba(13,64,108,0.08) 45%, transparent 72%)',
              filter: 'blur(30px)',
            }} />

            <div className="hero-float" style={{ position: 'relative', zIndex: 1 }}>
              <DashboardMockup isDark={isDark} />

              {/* Marking throughput */}
              <div className="hero-chip hero-chip-a" style={{
                position: 'absolute', bottom: -38, left: -54,
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 12,
                background: isDark ? '#082A45' : '#FFFFFF',
                border: `1px solid ${isDark ? 'rgba(157,196,217,0.14)' : '#E2E8F0'}`,
                boxShadow: isDark ? '0 14px 30px -14px rgba(0,0,0,0.9)' : '0 14px 30px -14px rgba(15,23,42,0.35)',
              }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(12,189,115,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0CBD73" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, fontWeight: 700, color: heading, whiteSpace: 'nowrap' }}>128 scripts marked</div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10.5, color: body, whiteSpace: 'nowrap' }}>in under 3 seconds</div>
                </div>
              </div>

              {/* Term-on-term movement */}
              <div className="hero-chip hero-chip-b" style={{
                position: 'absolute', bottom: '34%', right: -50,
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 12,
                background: isDark ? '#082A45' : '#FFFFFF',
                border: `1px solid ${isDark ? 'rgba(157,196,217,0.14)' : '#E2E8F0'}`,
                boxShadow: isDark ? '0 14px 30px -14px rgba(0,0,0,0.9)' : '0 14px 30px -14px rgba(15,23,42,0.35)',
              }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(13,64,108,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0D406C" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 7-7" /><polyline points="14 8 20 8 20 14" /></svg>
                </div>
                <div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, fontWeight: 700, color: heading, whiteSpace: 'nowrap' }}>Pass rate up 12%</div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10.5, color: body, whiteSpace: 'nowrap' }}>compared with last term</div>
                </div>
              </div>

              {/* What's happening right now */}
              <div className="hero-chip hero-chip-c" style={{
                position: 'absolute', top: -18, right: 20,
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 14px', borderRadius: 100,
                background: isDark ? '#082A45' : '#FFFFFF',
                border: `1px solid ${isDark ? 'rgba(157,196,217,0.14)' : '#E2E8F0'}`,
                boxShadow: isDark ? '0 10px 22px -12px rgba(0,0,0,0.85)' : '0 10px 22px -12px rgba(15,23,42,0.3)',
              }}>
                <span className="hero-pulse" style={{ position: 'relative', display: 'inline-flex', width: 7, height: 7 }}>
                  <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#0CBD73' }} />
                </span>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11.5, fontWeight: 600, color: heading }}>Exam in progress</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── Hero background elements ──────────────────────────────────────── */
        .hero-wash { position: absolute; border-radius: 50%; filter: blur(70px); will-change: transform; }
        .hero-wash-navy  { width: min(760px, 80vw); height: min(760px, 80vw); top: -240px; right: -200px; animation: heroDriftA 32s ease-in-out infinite; }
        .hero-wash-green { width: min(560px, 65vw); height: min(560px, 65vw); bottom: -260px; left: -140px; animation: heroDriftB 38s ease-in-out infinite; }

        .hero-mark { position: absolute; width: 11px; height: 11px; display: block; }

        .hero-noise {
          position: absolute; inset: 0; z-index: -1; pointer-events: none; opacity: 0.028;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");
        }

        @keyframes heroDriftA {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50%      { transform: translate3d(-50px, 40px, 0); }
        }
        @keyframes heroDriftB {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50%      { transform: translate3d(45px, -40px, 0); }
        }

        /* ── Hero entrance ─────────────────────────────────────────────────── */
        .hero-rise { animation: heroRise 0.85s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .hero-rise-1 { animation-delay: 0.08s; }
        .hero-rise-2 { animation-delay: 0.16s; }
        .hero-rise-3 { animation-delay: 0.24s; }
        .hero-rise-4 { animation-delay: 0.32s; }
        .hero-rise-5 { animation-delay: 0.4s; }
        @keyframes heroRise {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Live pulse dot ────────────────────────────────────────────────── */
        .hero-pulse::after {
          content: ''; position: absolute; inset: 0; border-radius: 50%;
          background: #0CBD73; animation: heroPing 2.2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        @keyframes heroPing {
          0%        { transform: scale(1); opacity: 0.65; }
          70%, 100% { transform: scale(2.6); opacity: 0; }
        }

        /* ── Hero CTAs ─────────────────────────────────────────────────────── */
        .hero-cta { transition: background 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease; }
        .hero-cta:hover { background: #082545 !important; transform: translateY(-1px); box-shadow: 0 14px 28px -12px rgba(13,64,108,0.8) !important; }
        .hero-cta-arrow { transition: transform 0.2s ease; }
        .hero-cta:hover .hero-cta-arrow { transform: translateX(3px); }

        .hero-ghost { transition: transform 0.18s ease, border-color 0.18s ease, color 0.18s ease; }
        .hero-ghost:hover { transform: translateY(-1px); border-color: #0CBD73 !important; color: #0CBD73 !important; }

        /* ── Hero mockup ───────────────────────────────────────────────────── */
        .hero-float { animation: heroFloat 10s ease-in-out infinite; }
        @keyframes heroFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-12px); }
        }
        .hero-chip { animation: heroChipFloat 7s ease-in-out infinite; will-change: transform; }
        .hero-chip-b { animation-duration: 8s; animation-delay: 0.9s; }
        .hero-chip-c { animation-duration: 9s; animation-delay: 0.45s; }
        @keyframes heroChipFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-8px); }
        }

        @media (max-width: 1024px) {
          .hero-chip { display: none !important; }
        }

        @media (max-width: 900px) {
          .hero-mark { display: none !important; }
        }

        @media (max-width: 640px) {
          .hero-stats { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; }
          .hero-stats > div { padding-left: 12px !important; padding-right: 8px !important; }
          .hero-stats > div:first-child { padding-left: 0 !important; }
        }

        @media (prefers-reduced-motion: reduce) {
          .hero-wash, .hero-chip, .hero-float, .hero-pulse::after { animation: none !important; }
          .hero-rise { animation: none !important; opacity: 1 !important; transform: none !important; }
        }

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
          .hero-section { min-height: auto !important; padding-top: 96px !important; padding-bottom: 40px !important; }
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
          .hero-section { min-height: auto !important; padding-top: 88px !important; padding-bottom: 32px !important; }
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
          .hero-section { min-height: auto !important; padding-top: 80px !important; padding-bottom: 28px !important; }
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
      boxShadow: isDark
        ? '0 2px 4px rgba(0,0,0,0.4), 0 12px 24px -8px rgba(0,0,0,0.55), 0 40px 80px -20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)'
        : '0 2px 4px rgba(13,64,108,0.05), 0 12px 24px -8px rgba(13,64,108,0.12), 0 44px 80px -24px rgba(13,64,108,0.28), inset 0 1px 0 rgba(255,255,255,0.9)',
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
      <div style={{ display: 'flex', height: 404 }}>
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
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchMarketplaceExams();
  }, []);

  const fetchMarketplaceExams = async () => {
    try {
      const response = await api.get('/marketplace/exams');
      // Surface free exams first in the homepage teaser
      const sorted = [...response.data].sort((a, b) =>
        (a.accessType === 'subscription' ? 1 : 0) - (b.accessType === 'subscription' ? 1 : 0)
      );
      setExams(sorted.slice(0, 6)); // Show only first 6 exams
    } catch (err) {
      console.error('Error fetching marketplace exams:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExamClick = (examId) => {
    // Check if user is authenticated as a student
    const isStudent = isAuthenticated && user?.role === 'student';
    
    if (!isStudent) {
      // Redirect to student registration with the exam as redirect target
      const redirectUrl = `/marketplace/exams/${examId}/request`;
      navigate(`/student-register?redirect=${encodeURIComponent(redirectUrl)}`);
      return;
    }

    // If authenticated as student, redirect to exam request page
    navigate(`/marketplace/exams/${examId}/request`);
  };

  const calculateTotalQuestions = (exam) => {
    return exam.totalQuestions || exam.sections?.reduce((sum, section) => sum + (section.questionCount || section.questions?.length || 0), 0) || 0;
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
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100, background: isDark ? 'rgba(12,189,115,0.1)' : 'rgba(12,189,115,0.08)', border: `1px solid ${isDark ? 'rgba(12,189,115,0.2)' : 'rgba(12,189,115,0.15)'}`, marginBottom: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#0CBD73', fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.02em', textTransform: 'uppercase' }}>Marketplace</span>
            </div>
            <h2 style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', letterSpacing: '-0.01em', color: text, marginBottom: 16 }}>
              Browse public online exams
            </h2>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 16, color: isDark ? '#94A3B8' : '#64748B', maxWidth: 560, margin: '0 auto', lineHeight: 1.6 }}>
              Exams shared by teachers and institutions across Rwanda, open to any student. Request access and start today.
            </p>
          </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, marginBottom: 40 }}>
          {exams.map((exam, i) => (
              <div key={exam._id || i} style={{
                padding: 24, borderRadius: 12,
                background: cardBg,
                border: `1px solid ${border}`,
                transition: 'all 0.15s ease',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                boxSizing: 'border-box',
              }}
                onClick={() => handleExamClick(exam._id)}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                  e.currentTarget.style.borderColor = '#0D406C';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = border;
                }}
              >
                {/* Header with badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 100, background: '#0CBD73', color: 'white', fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.02em' }}>
                    Public Exam
                  </div>
                  {exam.targetAudience && (
                    <div style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 8, background: isDark ? 'rgba(13,71,161,0.2)' : 'rgba(13,71,161,0.1)', color: '#0D406C', fontFamily: 'DM Sans, sans-serif' }}>
                      {exam.targetAudience}
                    </div>
                  )}
                </div>
                
                {/* Title */}
                <h3 style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 18, color: text, marginBottom: 12, lineHeight: 1.3, minHeight: 47, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {exam.title}
                </h3>

                {/* Description */}
                <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, lineHeight: 1.6, color: isDark ? '#94A3B8' : '#64748B', marginBottom: 20, minHeight: 45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {exam.publicDescription || exam.description}
                </p>
                
                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20, padding: '16px', borderRadius: 8, background: isDark ? 'rgba(30,41,59,0.3)' : 'rgba(241,245,249,0.6)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 600, color: '#0D406C', lineHeight: 1, marginBottom: 4 }}>
                      {calculateTotalQuestions(exam)}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 500, color: isDark ? '#94A3B8' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                      Questions
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 600, color: '#0CBD73', lineHeight: 1, marginBottom: 4 }}>
                      {exam.timeLimit}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 500, color: isDark ? '#94A3B8' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                      Minutes
                    </div>
                  </div>
                </div>

                {/* Access type indicator */}
                {exam.accessType === 'subscription' ? (
                  <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 16px', borderRadius: 10, background: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)', border: `1px solid ${isDark ? 'rgba(99,102,241,0.35)' : 'rgba(99,102,241,0.2)'}` }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#6366F1' }}>
                    🔒 Subscription Required
                  </span>
                </div>
                ) : (
                  <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 16px', borderRadius: 10, background: isDark ? 'rgba(12,189,115,0.1)' : 'rgba(12,189,115,0.08)', border: `1px solid ${isDark ? 'rgba(12,189,115,0.3)' : 'rgba(12,189,115,0.2)'}` }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#0CBD73' }}>
                    Free
                  </span>
                </div>
                )}
              </div>
          ))}
        </div>

          <div style={{ textAlign: 'center' }}>
            <RouterLink to="/marketplace" style={{
              padding: '12px 28px', borderRadius: 8, fontFamily: 'DM Sans, sans-serif', fontWeight: 500, fontSize: 15,
              background: '#0D406C',
              color: 'white', textDecoration: 'none',
              boxShadow: '0 1px 3px rgba(13, 64, 108, 0.15)',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              transition: 'all 0.15s ease',
            }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#082545';
                e.currentTarget.style.boxShadow = '0 2px 6px rgba(13, 64, 108, 0.25)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#0D406C';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(13, 64, 108, 0.15)';
              }}
            >
              View All Exams
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transition: 'transform 0.3s ease' }}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </RouterLink>
          </div>
      </div>
    </section>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────
function HowItWorks({ mode }) {
  const isDark = mode === 'dark';
  const bg = isDark ? '#111827' : '#FFFFFF';
  const text = isDark ? '#94A3B8' : '#0F172A';

  const steps = [
    { num: '01', title: 'Create your exam', desc: 'Upload a document or build questions from scratch. Support for MCQ, essays, math, code, and file submissions.' },
    { num: '02', title: 'Assign to students', desc: 'Send to individuals or groups. Set windows, time limits, and shuffle questions per student.' },
    { num: '03', title: 'Students take it', desc: 'Students log in from any device. A secure browser environment prevents tab switching and copying.' },
    { num: '04', title: 'AI grades instantly', desc: 'MCQs are auto-scored. Open-ended answers are graded by AI and ready for teacher review in seconds.' },
    { num: '05', title: 'Review results', desc: 'Detailed score breakdowns, class analytics, and exportable reports available immediately.' },
  ];

  return (
    <section id="how-it-works" style={{ padding: 'clamp(60px, 12vw, 100px) 0', background: bg }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100, background: isDark ? 'rgba(12,189,115,0.1)' : 'rgba(12,189,115,0.08)', border: `1px solid ${isDark ? 'rgba(12,189,115,0.2)' : 'rgba(12,189,115,0.15)'}`, marginBottom: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#0CBD73', fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.02em', textTransform: 'uppercase' }}>How it works</span>
            </div>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', letterSpacing: '-0.01em', color: text }}>
              How online exams work on eexams
            </h2>
          </div>

        <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
          {steps.map((s, i) => (
              <div style={{ position: 'relative', padding: '24px', borderRadius: 12, border: '1px solid #E2E8F0', background: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF' }}>
                {/* Number bubble */}
                <div style={{ width: 48, height: 48, borderRadius: 8, background: '#0D406C', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, color: 'white', fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 18 }}>
                  {s.num}
                </div>
                <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 16, color: text, marginBottom: 8 }}>{s.title}</h3>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, lineHeight: 1.6, color: isDark ? '#94A3B8' : '#64748B' }}>{s.desc}</p>
              </div>
          ))}
        </div>

          <div style={{ textAlign: 'center', marginTop: 48 }}>
            <RouterLink to="/register" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 28px', borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 15,
              background: '#0D406C', color: 'white', textDecoration: 'none',
              boxShadow: '0 1px 3px rgba(13, 64, 108, 0.15)',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#082545';
                e.currentTarget.style.boxShadow = '0 2px 6px rgba(13, 64, 108, 0.25)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#0D406C';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(13, 64, 108, 0.15)';
              }}
            >
              Try it free — no credit card
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </RouterLink>
          </div>
      </div>
    </section>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────
// Single source of truth: rendered on the page AND emitted as FAQPage JSON-LD.
// Google requires the two to match, so never add a schema entry that isn't visible here.
const faqs = [
  { q: 'Who can use eexams?', a: 'Institutions, schools and universities, training organisations, and individual students looking for online exams. Institutions run their own exams and cohorts. Individual students can browse the public exam marketplace and take exams on their own, in Rwanda and beyond.' },
  { q: 'How does the AI grading work?', a: 'eexams uses fine-tuned large language models to evaluate open-ended responses against marking rubrics. It considers content accuracy, relevance, and language quality, working in both English and Kinyarwanda.' },
  { q: 'How quickly do results come back?', a: 'Multiple-choice answers are scored the moment a student submits. Open-ended answers are marked by AI within seconds and queued for teacher review, so a full class is usually marked and ready to share the same day.' },
  { q: 'Is it secure enough for high-stakes national exams?', a: 'Yes. We implement browser lockdown, randomized question ordering, AI proctoring to flag suspicious behavior, encrypted connections, and full audit logs. eexams meets international standards for high-stakes examinations.' },
  { q: 'Can I import questions from existing documents?', a: 'Yes. Upload Word, PDF, or Excel files and eexams automatically parses and imports your questions. We support MCQ, essay, true/false, matching, and coded questions.' },
  { q: 'What devices do students need?', a: 'Any modern browser on a desktop, laptop, tablet, or smartphone. No app installation needed. eexams works offline with automatic sync when connectivity is restored.' },
  { q: 'How do I integrate with my current LMS?', a: 'eexams provides REST API and LTI 1.3 integrations for Canvas, Moodle, Blackboard, Google Classroom, and custom platforms. Our team assists with setup at no extra cost on Pro and Enterprise plans.' },
  { q: 'What analytics are available to teachers?', a: 'Per-student score breakdowns, question-level difficulty analysis, grade distribution curves, class-wide trends over time, and exportable reports in PDF, Excel, and CSV.' },
];

const faqStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
};

function FAQ({ mode }) {
  const isDark = mode === 'dark';
  const bg = isDark ? '#111827' : '#FFFFFF';
  const cardBg = isDark ? '#111827' : '#FFFFFF';
  const border = isDark ? '#1E293B' : '#E2E8F0';
  const text = isDark ? '#94A3B8' : '#0F172A';
  const [open, setOpen] = useState(null);

  return (
    <section id="faq" style={{ padding: 'clamp(60px, 12vw, 100px) 0', background: bg }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100, background: isDark ? 'rgba(12,189,115,0.1)' : 'rgba(12,189,115,0.08)', border: `1px solid ${isDark ? 'rgba(12,189,115,0.2)' : 'rgba(12,189,115,0.15)'}`, marginBottom: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#0CBD73', fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.02em', textTransform: 'uppercase' }}>FAQ</span>
            </div>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', letterSpacing: '-0.01em', color: text }}>
              Frequently asked questions
            </h2>
          </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {faqs.map((faq, i) => (
              <div style={{
                borderRadius: 8, border: `1px solid ${open === i ? '#0CBD73' : border}`,
                background: cardBg, overflow: 'hidden',
                transition: 'all 0.15s ease',
              }}>
                <button onClick={() => setOpen(open === i ? null : i)} style={{
                  width: '100%', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 15, color: text }}>
                    {faq.q}
                  </span>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: open === i ? '#0CBD73' : isDark ? '#111827' : '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: open === i ? '#0CBD73' : isDark ? '#94A3B8' : '#64748B', transition: 'all 0.15s ease', transform: open === i ? 'rotate(45deg)' : 'none' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                  </div>
                </button>
                {open === i && (
                  <div style={{ padding: '0 20px 16px' }}>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, lineHeight: 1.6, color: isDark ? '#94A3B8' : '#64748B' }}>
                      {faq.a}
                    </p>
                  </div>
                )}
              </div>
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
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          borderRadius: 12, padding: 'clamp(32px, 8vw, 56px) clamp(24px, 8vw, 48px)',
          background: '#0D406C',
          boxShadow: '0 4px 12px rgba(13,64,108,0.15)',
        }}>

          <div className="cta-inner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40 }}>
            <div style={{ maxWidth: 600 }}>
              <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 'clamp(1.5rem, 3.5vw, 2.2rem)', letterSpacing: '-0.01em', color: 'white', marginBottom: 12 }}>
                Ready to move your exams online?
              </h2>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                Join 140+ institutions in Rwanda and beyond. Free 14-day trial. No credit card, no setup fee.
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
                padding: '12px 28px', borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 15,
                background: 'white', color: '#0D406C', textDecoration: 'none',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                }}
              >
                Start free trial
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </RouterLink>
              <button onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })} style={{
                padding: '12px 28px', borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 15,
                background: 'rgba(255,255,255,0.1)', color: 'white',
                border: '1.5px solid rgba(255,255,255,0.25)', cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
                }}
              >
                Book a demo
              </button>
            </div>
          </div>
        </div>
    </section>
  );
}

// ─── Contact ─────────────────────────────────────────────────────────────────
function Contact({ mode }) {
  const isDark = mode === 'dark';
  const bg = isDark ? '#111827' : '#FFFFFF';
  const cardBg = isDark ? '#111827' : '#FFFFFF';
  const border = isDark ? '#1E293B' : '#E2E8F0';
  const text = isDark ? '#94A3B8' : '#0F172A';
  const inputBg = isDark ? '#111827' : '#F8FAFC';
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const inputStyle = {
    width: '100%', padding: '12px 16px', borderRadius: 8,
    border: `1.5px solid ${border}`, background: inputBg,
    fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: text,
    outline: 'none', transition: 'border-color 0.15s',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setSent(true);
        setFormData({ name: '', email: '', subject: '', message: '' });
      } else {
        setError(data.error || 'Failed to send message. Please try again.');
      }
    } catch (err) {
      setError('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <section id="contact" style={{ padding: 'clamp(60px, 12vw, 100px) 0', background: bg }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100, background: isDark ? 'rgba(12,189,115,0.1)' : 'rgba(12,189,115,0.08)', border: `1px solid ${isDark ? 'rgba(12,189,115,0.2)' : 'rgba(12,189,115,0.15)'}`, marginBottom: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#0CBD73', fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.02em', textTransform: 'uppercase' }}>Contact</span>
            </div>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', letterSpacing: '-0.01em', color: text }}>
              Talk to our team
            </h2>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, color: isDark ? '#94A3B8' : '#64748B', marginTop: 12 }}>
              We respond within 1 business day. Mon–Fri, 8am–6pm (EAT).
            </p>
          </div>

        <div className="contact-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'start' }}>
          {/* Form */}
            <div style={{ padding: 32, borderRadius: 12, background: cardBg, border: `1px solid ${border}`, boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.2)' : '0 1px 3px rgba(15,23,42,0.05)' }}>
              {sent ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(12,189,115,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#0CBD73' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 20, color: text, marginBottom: 8 }}>Message sent!</h3>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: isDark ? '#94A3B8' : '#64748B' }}>We'll get back to you within 1 business day.</p>
                </div>
              ) : (
                <>
                  <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 20, color: text, marginBottom: 8 }}>Send a message</h3>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: isDark ? '#94A3B8' : '#64748B', marginBottom: 24 }}>
                    Have a question, need a demo, or want pricing info? We're here.
                  </p>
                  {error && (
                    <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: 16, color: '#EF4444', fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>
                      {error}
                    </div>
                  )}
                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                      <input
                        style={inputStyle}
                        name="name"
                        placeholder="Your name"
                        value={formData.name}
                        onChange={handleChange}
                        onFocus={e => e.target.style.borderColor = '#0CBD73'}
                        onBlur={e => e.target.style.borderColor = border}
                        required
                      />
                      <input
                        style={inputStyle}
                        name="email"
                        type="email"
                        placeholder="Email address"
                        value={formData.email}
                        onChange={handleChange}
                        onFocus={e => e.target.style.borderColor = '#0CBD73'}
                        onBlur={e => e.target.style.borderColor = border}
                        required
                      />
                    </div>
                    <input
                      style={inputStyle}
                      name="subject"
                      placeholder="Subject"
                      value={formData.subject}
                      onChange={handleChange}
                      onFocus={e => e.target.style.borderColor = '#0CBD73'}
                      onBlur={e => e.target.style.borderColor = border}
                    />
                    <textarea
                      style={{ ...inputStyle, height: 140, resize: 'vertical' }}
                      name="message"
                      placeholder="Your message..."
                      value={formData.message}
                      onChange={handleChange}
                      onFocus={e => e.target.style.borderColor = '#0CBD73'}
                      onBlur={e => e.target.style.borderColor = border}
                      required
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      style={{
                        width: '100%', padding: '12px', borderRadius: 8,
                        background: loading ? 'rgba(13, 64, 108, 0.5)' : '#0D406C',
                        color: 'white', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                        fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 15,
                        boxShadow: '0 8px 24px rgba(12,189,115,0.35)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        opacity: loading ? 0.7 : 1,
                      }}
                    >
                      {loading ? 'Sending...' : 'Send message'}
                      {!loading && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>}
                    </button>
                  </form>
                </>
              )}
            </div>

          {/* Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {[
                { icon: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.93 12 19.79 19.79 0 0 1 1.93 3.26 2 2 0 0 1 3.9 1.07h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 15.91z"/>, label: 'Phone', value: '+250 788 535 156\n+250 793 828 834\n+250 781 671 517', color: '#0CBD73', isPhone: true },
                { icon: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>, label: 'Email', value: 'info@excellencecoachinghub.com', color: '#0D406C', isEmail: true },
              ].map((item, i) => (
                <div key={i} style={{ padding: 24, borderRadius: 16, background: cardBg, border: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 20, cursor: item.isEmail ? 'pointer' : 'default' }} onClick={item.isEmail ? () => window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${item.value}`, '_blank') : undefined}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: `${item.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color, flexShrink: 0 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{item.icon}</svg>
                  </div>
                  <div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: isDark ? '#94A3B8' : '#64748B', marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 16, color: text, whiteSpace: 'pre-line' }}>{item.value}</div>
                  </div>
                </div>
              ))}

              {/* Google Map */}
              <div style={{ padding: 24, borderRadius: 16, background: cardBg, border: `1px solid ${border}` }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: isDark ? '#94A3B8' : '#64748B', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Our Location</div>
                <div style={{ borderRadius: 12, overflow: 'hidden', height: 250 }}>
                  <iframe
                    src={`https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3987.5!2d${30.070017513493255}!3d${-1.9276507991997323}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMcKwNTcnMTIuMCJTIDMwwKDAzJzQyLjAiIkU!5e0!3m2!1sen!2srw!4v1700000000000!5m2!1sen!2srw`}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen=""
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
                <a
                  href={`https://www.google.com/maps?q=${-1.9276507991997323},${30.070017513493255}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 16,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#0CBD73',
                    textDecoration: 'none',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={e => e.target.style.color = '#0A9E5C'}
                  onMouseLeave={e => e.target.style.color = '#0CBD73'}
                >
                  Open in Google Maps
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>
              </div>

              {/* Social */}
              <div style={{ padding: 24, borderRadius: 16, background: cardBg, border: `1px solid ${border}` }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: isDark ? '#94A3B8' : '#64748B', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Follow us</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { name: 'Facebook', color: '#1877F2', username: '@ech.info', path: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>, url: 'https://facebook.com/ech.info' },
                    { name: 'TikTok', color: '#000000', username: '@ech.info', path: <><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/><path d="M20 9v5a5 5 0 0 1-9 0"/></>, url: 'https://tiktok.com/@ech.info' },
                    { name: 'Instagram', color: '#E4405F', username: '@ech.info', path: <><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></>, url: 'https://instagram.com/ech.info' },
                  ].map((s, i) => (
                    <button key={i} onClick={() => window.open(s.url, '_blank')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, border: `1px solid ${border}`, background: isDark ? '#111827' : '#F8FAFC', cursor: 'pointer', color: isDark ? '#94A3B8' : '#64748B', transition: 'all 0.2s', width: '100%', justifyContent: 'flex-start' }}
                      onMouseEnter={e => { e.currentTarget.style.background = s.color; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = s.color; }}
                      onMouseLeave={e => { e.currentTarget.style.background = isDark ? '#111827' : '#F8FAFC'; e.currentTarget.style.color = isDark ? '#94A3B8' : '#64748B'; e.currentTarget.style.borderColor = border; }}
                    >
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, flexShrink: 0 }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{s.path}</svg>
                      </div>
                      <div style={{ textAlign: 'left', flex: 1 }}>
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{s.name}</div>
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, opacity: 0.8 }}>{s.username}</div>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </button>
                  ))}
                </div>
              </div>
            </div>
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
  const muted = 'rgba(255,255,255,0.5)';
  const secondary = 'rgba(255,255,255,0.7)';
  const [email, setEmail] = React.useState('');
  const [subscribed, setSubscribed] = React.useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email) {
      // In a real implementation, this would send the email to a backend API
      console.log('Subscribing email:', email);
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 3000);
    }
  };

  const cols = [
    { title: 'Platform', links: [{ label: 'Home', to: '/' }, { label: 'Marketplace', to: '/marketplace' }] },
    { title: 'Account', links: [{ label: 'Login', to: '/login' }, { label: 'Register', to: '/register' }, { label: 'Student Register', to: '/student-register' }] },
    { title: 'Legal', links: [{ label: 'Privacy Policy', to: '/privacy' }, { label: 'Terms of Service', to: '/terms' }] },
  ];

  return (
    <footer style={{ background: bg, padding: 'clamp(40px, 8vw, 64px) 16px clamp(24px, 4vw, 32px)', color: 'white' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div className="footer-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'clamp(24px, 6vw, 40px)', marginBottom: 'clamp(32px, 8vw, 48px)' }}>
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <img src="/logo.png" alt="eexams" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', backgroundColor: isDark ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.9)', padding: '4px' }} />
            </div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: secondary, lineHeight: 1.6, maxWidth: 280, marginBottom: 24 }}>
              Modern online exam platform for Rwanda's schools and universities. AI-powered grading, real-time analytics.
            </p>
            <div style={{ padding: '14px 16px', borderRadius: 8, border: `1px solid ${border}`, background: 'rgba(255,255,255,0.04)' }}>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: muted, marginBottom: 10 }}>Stay in the loop</p>
              <form onSubmit={handleSubscribe} style={{ display: 'flex', gap: 8 }}>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: `1px solid ${border}`, background: 'rgba(255,255,255,0.05)', color: 'white', fontFamily: "'DM Sans', sans-serif", fontSize: 14, outline: 'none' }}
                />
                <button
                  type="submit"
                  style={{ padding: '10px 14px', borderRadius: 8, background: '#0CBD73', border: 'none', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => e.target.style.background = '#0A9E5C'}
                  onMouseLeave={(e) => e.target.style.background = '#0CBD73'}
                >
                  {subscribed ? '✓' : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>}
                </button>
              </form>
              {subscribed && (
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: '#0CBD73', marginTop: 8 }}>
                  Thanks for subscribing!
                </p>
              )}
            </div>
          </div>

          {/* Links */}
          {cols.map((col, i) => (
            <div key={i}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13, color: 'rgba(255,255,255,0.9)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{col.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {col.links.map((l, j) => (
                  <RouterLink key={j} to={l.to} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: muted, textDecoration: 'none', transition: 'color 0.2s' }}
                    onMouseEnter={e => e.target.style.color = 'white'}
                    onMouseLeave={e => e.target.style.color = muted}
                  >{l.label}</RouterLink>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: `1px solid ${border}`, paddingTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: muted }}>
            © {new Date().getFullYear()} eexams. All rights reserved.
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: secondary, fontWeight: 600 }}>
              Provided by Excellence Coaching Hub
            </span>
            <a href="https://excellencecoachinghub.com" target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: muted, textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => e.target.style.color = 'white'}
              onMouseLeave={e => e.target.style.color = muted}
            >
              Learn more about Excellence Coaching Hub on excellencecoachinghub.com
            </a>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
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
      <SEO
        title="Online Exams for Schools & Students in Rwanda | eexams"
        description="eexams runs secure online exams for institutions, schools, organisations and individual students in Rwanda and beyond. AI marking, results the same day."
        keywords="eexams, online exams, online exams Rwanda, online exams for schools, online exams for institutions, online exams for organisations, online exams for students, individual students, AI marking, AI grading, marked in minutes, same-day results, secure online exams, exam platform, exam management system, digital assessment, student testing, university exams, Kinyarwanda exams, English exams, national exams, secondary exams, primary exams, East Africa online exams"
        ogUrl="https://www.eexams.net/"
        canonical="https://www.eexams.net/"
        structuredData={[
          // The EducationalOrganization entity lives in index.html so it is served
          // on every route; don't duplicate it here.
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'eexams',
            url: 'https://www.eexams.net/',
            description: 'Online exams, marked in minutes. For institutions, schools, organisations and individual students in Rwanda and beyond.',
            potentialAction: {
              '@type': 'SearchAction',
              target: 'https://www.eexams.net/marketplace?q={search_term_string}',
              'query-input': 'required name=search_term_string'
            }
          },
          faqStructuredData
        ]}
      />
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