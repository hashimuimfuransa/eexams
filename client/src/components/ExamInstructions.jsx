import React, { useState, useEffect } from 'react';

const CARD_DATA = [
  {
    key: 'time',
    iconClass: 'ti-clock',
    iconColor: '#0D406C',
    iconBg: 'rgba(13, 64, 108, 0.1)',
    iconBorder: 'rgba(13, 64, 108, 0.2)',
    title: 'Time Limit',
    sub: '⏱ Timer starts when you begin',
    dotColor: '#0D406C',
    rules: [
      <>You have <strong style={{ color: '#0D406C' }}>{60} minutes</strong> once you click Start</>,
      'Timer is always visible in the corner',
      'You get a warning at 10 minutes left',
      'When time is up, answers submit automatically',
    ],
  },
  {
    key: 'conduct',
    iconClass: 'ti-shield-check',
    iconColor: '#FFAB2E',
    iconBg: 'rgba(255, 171, 46, 0.1)',
    iconBorder: 'rgba(255, 171, 46, 0.2)',
    title: 'Exam Rules',
    sub: '⚠️ Play fair',
    dotColor: '#FFAB2E',
    rules: [
      'Stay on this page only',
      'No notes, books, or helpers allowed',
      'Do not share or copy questions',
      'Breaking rules will flag you for review',
    ],
  },
  {
    key: 'navigation',
    iconClass: 'ti-layout-list',
    iconColor: '#0CBD73',
    iconBg: 'rgba(12, 189, 115, 0.1)',
    iconBorder: 'rgba(12, 189, 115, 0.2)',
    title: 'Moving Around',
    sub: '📋 Jump between questions',
    dotColor: '#0CBD73',
    rules: [
      'Use Next and Previous buttons',
      'Bookmark questions to come back later',
      'The panel shows which are done',
      'You can change answers before submitting',
    ],
  },
  {
    key: 'technical',
    iconClass: 'ti-wifi',
    iconColor: '#A2F8EC',
    iconBg: 'rgba(162, 248, 236, 0.15)',
    iconBorder: 'rgba(162, 248, 236, 0.3)',
    title: 'Stay Connected',
    sub: '📶 Internet needed',
    dotColor: '#0D406C',
    rules: [
      'Keep your internet on the whole time',
      'Answers save every 30 seconds',
      'If disconnected, you have 60 seconds to reconnect',
      'Do not refresh or close the browser',
    ],
  },
  {
    key: 'leaving',
    iconClass: 'ti-alert-triangle',
    iconColor: '#FF5252',
    iconBg: 'rgba(255, 82, 82, 0.1)',
    iconBorder: 'rgba(255, 82, 82, 0.2)',
    title: 'Leaving Page',
    sub: '🚫 Auto-submit if you leave',
    dotColor: '#FF5252',
    rules: [
      'Minimizing the window is tracked',
      'Switching tabs 3 times will auto-submit',
      'Being away for 90 seconds will auto-submit',
      'You cannot re-enter after submitting',
    ],
  },
  {
    key: 'submitting',
    iconClass: 'ti-circle-check',
    iconColor: '#0CBD73',
    iconBg: 'rgba(12, 189, 115, 0.1)',
    iconBorder: 'rgba(12, 189, 115, 0.2)',
    title: 'When Done',
    sub: '✓ Submit your answers',
    dotColor: '#0CBD73',
    rules: [
      'Review all questions before submitting',
      'Read the confirmation dialog carefully',
      'Once submitted, you cannot go back',
      'Your results appear immediately after',
    ],
  },
];

/* ─── Inline styles ─── */
const S = {
  wrap: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: '#F5FBF8',
    color: '#2B3674',
    fontFamily: '"Inter", "Poppins", "Roboto", "Helvetica", "Arial", sans-serif',
    overflowX: 'hidden',
    overflowY: 'auto',
    zIndex: 9999,
  },
  bgPattern: {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 0,
    backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(13, 64, 108, 0.05) 1px, transparent 0)',
    backgroundSize: '24px 24px',
  },
  content: {
    position: 'relative',
    zIndex: 1,
    maxWidth: 1000,
    margin: '0 auto',
    padding: '40px 24px',
  },
  header: {
    textAlign: 'center',
    marginBottom: 32,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(255, 82, 82, 0.1)',
    border: '1px solid rgba(255, 82, 82, 0.3)',
    color: '#FF5252',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.05em',
    padding: '6px 14px',
    borderRadius: 20,
    marginBottom: 16,
    textTransform: 'uppercase',
    animation: 'pulse 2s ease-in-out infinite',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#FF5252',
    animation: 'blink 1s ease-in-out infinite',
  },
  heroWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  heroBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    background: '#0D406C',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 32,
    boxShadow: '0 4px 12px rgba(13, 64, 108, 0.15)',
  },
  h1: {
    fontSize: 'clamp(24px, 4vw, 32px)',
    fontWeight: 700,
    lineHeight: 1.2,
    marginBottom: 8,
    color: '#0D406C',
  },
  subtitle: {
    fontSize: 15,
    color: '#707EAE',
    margin: 0,
  },
  alertBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    background: 'rgba(255, 171, 46, 0.1)',
    border: '2px solid rgba(255, 171, 46, 0.4)',
    borderRadius: 12,
    padding: '16px 20px',
    marginBottom: 24,
    animation: 'pulseBorder 2s ease-in-out infinite',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    background: 'rgba(255, 82, 82, 0.1)',
    border: '2px solid rgba(255, 82, 82, 0.4)',
    borderRadius: 12,
    padding: '16px 20px',
    marginBottom: 24,
    animation: 'pulseBorder 1.5s ease-in-out infinite',
  },
  bannerText: {
    fontSize: 14,
    color: '#2B3674',
    lineHeight: 1.6,
    margin: 0,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 20,
    marginBottom: 24,
  },
  card: (hovered, color) => ({
    background: hovered ? color : '#ffffff',
    border: `1px solid ${hovered ? 'rgba(13, 64, 108, 0.2)' : 'rgba(13, 64, 108, 0.08)'}`,
    borderRadius: 12,
    padding: 20,
    transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s, background 0.2s',
    transform: hovered ? 'translateY(-2px)' : 'none',
    cursor: 'default',
    boxShadow: hovered ? '0 8px 24px rgba(13, 64, 108, 0.1)' : '0 1px 3px rgba(0, 0, 0, 0.05)',
  }),
  cardIconRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  cardIcon: (bg, border) => ({
    width: 36,
    height: 36,
    borderRadius: 8,
    background: bg,
    border: `1px solid ${border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }),
  cardTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#0D406C',
    margin: 0,
  },
  cardSub: {
    fontSize: 12,
    color: '#707EAE',
    margin: 0,
    marginTop: 1,
  },
  ruleList: {
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    margin: 0,
    padding: 0,
  },
  ruleItem: (color) => ({
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    fontSize: 13,
    color: '#475569',
    lineHeight: 1.5,
  }),
  ruleDot: (color) => ({
    width: 4,
    height: 4,
    borderRadius: '50%',
    background: color,
    flexShrink: 0,
    marginTop: 6,
  }),
  ctaBox: {
    background: '#ffffff',
    border: '1px solid rgba(13, 64, 108, 0.1)',
    borderRadius: 16,
    padding: 'clamp(24px, 4vw, 36px)',
    textAlign: 'center',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
  },
  ctaLabel: {
    fontSize: 13,
    color: '#707EAE',
    marginBottom: 6,
  },
  ctaStatus: (ready) => ({
    fontSize: 18,
    fontWeight: 600,
    color: ready ? '#0CBD73' : '#0D406C',
    marginBottom: 16,
    transition: 'color 0.3s',
  }),
  progressWrap: {
    width: '100%',
    maxWidth: 400,
    height: 8,
    background: 'rgba(13, 64, 108, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    margin: '0 auto 24px',
  },
  progressFill: (pct) => ({
    height: '100%',
    borderRadius: 4,
    background: pct >= 100 ? '#0CBD73' : '#FF5252',
    width: `${pct}%`,
    transition: 'width 0.3s linear, background 0.3s ease',
    animation: pct >= 100 ? 'none' : 'pulse 1s ease-in-out infinite',
  }),
  btnRow: {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  btnCancel: {
    padding: '12px 24px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    border: '1.5px solid rgba(13, 64, 108, 0.2)',
    background: 'transparent',
    color: '#0D406C',
    transition: 'all 0.2s',
  },
  btnStart: (ready) => ({
    padding: '12px 32px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: ready ? 'pointer' : 'not-allowed',
    border: 'none',
    color: ready ? '#ffffff' : '#A3AED0',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    transition: 'all 0.2s',
    background: ready ? '#0D406C' : 'rgba(13, 64, 108, 0.1)',
    boxShadow: ready ? '0 4px 12px rgba(13, 64, 108, 0.2)' : 'none',
  }),
};

/* ─── Orb component ─── */
const Orb = ({ style }) => (
  <div
    style={{
      position: 'absolute',
      borderRadius: '50%',
      filter: 'blur(60px)',
      opacity: 0.4,
      ...style,
    }}
  />
);

/* ─── Bouncing Alert Icon ─── */
const BouncingAlert = () => (
  <div
    style={{
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      animation: 'bounce 1s ease-in-out infinite',
    }}
  >
    <div
      style={{
        position: 'absolute',
        width: 'clamp(80px, 10vw, 100px)',
        height: 'clamp(80px, 10vw, 100px)',
        borderRadius: '50%',
        background: 'rgba(255, 82, 82, 0.2)',
        animation: 'pop 1.5s ease-in-out infinite',
      }}
    />
    <div
      style={{
        position: 'absolute',
        width: 'clamp(60px, 8vw, 80px)',
        height: 'clamp(60px, 8vw, 80px)',
        borderRadius: '50%',
        background: 'rgba(255, 82, 82, 0.3)',
        animation: 'pop 1.5s ease-in-out infinite 0.2s',
      }}
    />
    <div
      style={{
        width: 'clamp(48px, 6vw, 64px)',
        height: 'clamp(48px, 6vw, 64px)',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #FF5252, #FF8A80)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 'clamp(24px, 3vw, 36px)',
        color: '#fff',
        boxShadow: '0 6px 20px rgba(255, 82, 82, 0.5)',
        zIndex: 1,
      }}
    >
      ⚠️
    </div>
  </div>
);

/* ─── Instruction card ─── */
const InstructionCard = ({ card }) => {
  const [hovered, setHovered] = useState(false);
  const hoverColor = card.iconBg.replace('0.1', '0.15');
  return (
    <div
      style={S.card(hovered, hoverColor)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={S.cardIconRow}>
        <div style={S.cardIcon(card.iconBg, card.iconBorder)}>
          <i
            className={`ti ${card.iconClass}`}
            aria-hidden="true"
            style={{ color: card.iconColor, fontSize: 18 }}
          />
        </div>
        <div>
          <p style={S.cardTitle}>{card.title}</p>
          <p style={S.cardSub}>{card.sub}</p>
        </div>
      </div>
      <ul style={S.ruleList}>
        {card.rules.map((rule, i) => (
          <li key={i} style={S.ruleItem(card.dotColor)}>
            <span style={S.ruleDot(card.dotColor)} />
            {rule}
          </li>
        ))}
      </ul>
    </div>
  );
};

/* ─── Main component ─── */
const ExamInstructions = ({ exam, onProceed, onCancel }) => {
  const [countdown, setCountdown] = useState(10);
  const [ready, setReady] = useState(false);

  const timeLimit =
    exam?.timeLimit ?? exam?.exam?.timeLimit ?? 60;
  const calculatorEnabled =
    exam?.calculatorEnabled ?? exam?.exam?.calculatorEnabled ?? false;

  useEffect(() => {
    if (countdown <= 0) {
      setReady(true);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const pct = ((10 - countdown) / 10) * 100;

  const cards = [
    {
      ...CARD_DATA[0],
      rules: [
        <>You have <strong style={{ color: '#0D406C' }}>{timeLimit} minutes</strong> once you click Start</>,
        'Timer is always visible in the corner',
        'You get a warning at 10 minutes left',
        'When time is up, answers submit automatically',
      ],
    },
    ...CARD_DATA.slice(1, 4),
    ...(calculatorEnabled
      ? [{
          key: 'calculator',
          iconClass: 'ti-calculator',
          iconColor: '#0CBD73',
          iconBg: 'rgba(12, 189, 115, 0.1)',
          iconBorder: 'rgba(12, 189, 115, 0.2)',
          title: 'Calculator',
          sub: '🧮 Available for all questions',
          dotColor: '#0CBD73',
          rules: [
            'A calculator is available during the exam',
            'Click the calculator icon in the toolbar to open it',
            'Scientific functions are included',
            'The calculator does not save your work',
          ],
        }]
      : []),
    ...CARD_DATA.slice(4),
  ];

  const examTitle = exam?.title || exam?.exam?.title || 'Exam';

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.8); }
        }
        @keyframes pulseBorder {
          0%, 100% { border-color: rgba(255, 171, 46, 0.4); }
          50% { border-color: rgba(255, 171, 46, 0.8); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes pop {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.3); opacity: 0; }
        }
      `}</style>

      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css"
      />

      <div style={S.wrap}>
        {/* Background pattern */}
        <div style={S.bgPattern} />

        <div style={S.content}>
          {/* Header */}
          <div style={S.header}>
            <div style={S.badge}>
              <span style={S.badgeDot} />
              {examTitle}
            </div>

            <div style={S.heroWrap}>
              <BouncingAlert />
            </div>

            <h1 style={S.h1}>⚠️ Ready to Start?</h1>
            <p style={S.subtitle}>
              Read this carefully. You cannot restart once you begin.
            </p>
          </div>

          {/* Warning banner */}
          <div style={S.alertBanner}>
            <span style={{ fontSize: 20, flexShrink: 0, animation: 'blink 1s ease-in-out infinite' }}>⚠️</span>
            <p style={S.bannerText}>
              <strong style={{ color: '#FFAB2E' }}>Do not start unless you are ready.</strong> This exam is timed and your answers are saved in real time. The timer cannot be paused. Make sure your device is charged and your internet connection is stable.
            </p>
          </div>

          {/* Instruction cards */}
          <div style={S.grid}>
            {cards.map((card, i) => (
              <InstructionCard key={card.key} card={card} />
            ))}
          </div>

          {/* No-restart banner */}
          <div style={S.errorBanner}>
            <span style={{ fontSize: 20, flexShrink: 0, animation: 'blink 1s ease-in-out infinite' }}>🚫</span>
            <p style={S.bannerText}>
              <strong style={{ color: '#FF5252' }}>No restarts allowed.</strong> Once you click Start, the timer begins immediately. There are no pauses, breaks, or restarts. Make sure you are in a quiet place with no distractions before you begin.
            </p>
          </div>

          {/* CTA box */}
          <div style={S.ctaBox}>
            <p style={S.ctaLabel}>
              {ready ? 'Ready when you are' : 'Please read the instructions above'}
            </p>
            <p style={S.ctaStatus(ready)}>
              {ready
                ? '✓ All instructions read — you may proceed'
                : `Waiting ${countdown}s…`}
            </p>
            <div style={S.progressWrap}>
              <div style={S.progressFill(pct)} />
            </div>
            <div style={S.btnRow}>
              {onCancel && (
                <button
                  style={S.btnCancel}
                  onClick={onCancel}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(13, 64, 108, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(13, 64, 108, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'rgba(13, 64, 108, 0.2)';
                  }}
                >
                  Cancel
                </button>
              )}
              <button
                style={S.btnStart(ready)}
                disabled={!ready}
                onClick={ready ? onProceed : undefined}
                onMouseEnter={(e) => {
                  if (ready) {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(13, 64, 108, 0.25)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (ready) {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(13, 64, 108, 0.2)';
                  }
                }}
              >
                <i
                  className={ready ? 'ti ti-player-play' : 'ti ti-clock'}
                  aria-hidden="true"
                  style={{ fontSize: 16 }}
                />
                {ready ? 'Start exam' : `Wait ${countdown}s…`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ExamInstructions;