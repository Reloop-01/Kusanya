'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/* =====================================================================
   THE WORDS ON THIS PAGE
   Edit the text in this section. You do not need to touch the layout below.
   Keep every claim true to what Kusanya does today.
   ===================================================================== */

const HERO = {
  eyebrow: 'Transparent group finance',
  title: 'Group money, fully accounted for.',
  text: 'Kusanya is the transparent ledger for chamas, churches, families and community fundraisers. Every contribution is recorded, every withdrawal needs approval, and every balance is visible to the people who matter.',
};

// The sliding cards on the first screen: what Kusanya lets you do.
const SLIDES = [
  {
    title: 'Support public projects',
    text: 'Browse community fundraisers anyone can back, or join a private group by invitation.',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
      </>
    ),
  },
  {
    title: 'Run your chama or group fund',
    text: 'Record every contribution and keep one shared ledger that everyone can trust.',
    icon: (
      <>
        <path d="M5 4h11l3 3v13H5z" />
        <path d="M8 10h8M8 14h8M8 18h5" />
      </>
    ),
  },
  {
    title: 'Approve withdrawals together',
    text: 'Money only leaves a project when the people you chose say yes.',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12.5l3 3 5-6" />
      </>
    ),
  },
  {
    title: 'Share with a link or QR code',
    text: 'Every project gets its own page that you can send to anyone, anywhere.',
    icon: (
      <>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4" />
      </>
    ),
  },
  {
    title: 'Show what the money is for',
    text: 'Add photos, videos and documents so supporters can see the story behind the cause.',
    icon: (
      <>
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <circle cx="9" cy="10" r="1.5" />
        <path d="M4 17l5-4 4 3 3-2 4 3" />
      </>
    ),
  },
  {
    title: 'Keep a complete record',
    text: 'A timeline shows who contributed, requested and approved, and when.',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  },
];

// Everything below appears when someone taps "Learn more".

const AUDIENCES = [
  {
    label: 'If you organize',
    title: 'Run the group’s money with real controls',
    points: [
      'Set a target, a deadline and who must approve every withdrawal',
      'Record contributions and confirm them against actual payments',
      'Withdrawals are checked against the available balance before they can be approved',
      'Give your team the right role: administrator, approver or auditor',
    ],
  },
  {
    label: 'If you contribute',
    title: 'Give with confidence and see where it stands',
    points: [
      'Follow live progress toward the target, with milestones along the way',
      'Know that withdrawals need approval from people the group trusts, not one person’s word',
      'Ask the organizer to record your gift anonymously if you prefer',
      'See photos, videos and documents that explain what the money is for',
    ],
  },
];

const ORGANIZER_STEPS = [
  {
    title: 'Set up the fund',
    text: 'Create a project with a target and a deadline, then choose who approves withdrawals and how many approvals are needed.',
  },
  {
    title: 'Record and confirm contributions',
    text: 'Contributors pay by M-Pesa, bank transfer or cash. You record each payment and confirm it, so the ledger always matches reality.',
  },
  {
    title: 'Withdraw only with approval',
    text: 'Each withdrawal request needs the approvals your rules require, with a reason and evidence attached. The balance is checked every time.',
  },
];

const CONTRIBUTOR_STEPS = [
  { title: 'Open the link or scan the QR code', text: 'Every project has its own page showing progress and purpose.' },
  { title: 'Pay the organizer directly', text: 'Follow the payment instructions on the page. Kusanya never takes the money.' },
  { title: 'Watch it counted', text: 'Once the organizer confirms your contribution, the project total moves forward.' },
];

const CONTROLS = [
  {
    title: 'Contribution ledger',
    text: 'Every contribution is recorded, then confirmed or rejected. Nothing counts until it is confirmed.',
    icon: (
      <>
        <path d="M5 4h11l3 3v13H5z" />
        <path d="M8 10h8M8 14h8M8 18h5" />
      </>
    ),
  },
  {
    title: 'Multi-approver withdrawals',
    text: 'Money only leaves a project when the required number of approvers say yes. A rejection needs a reason.',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12.5l3 3 5-6" />
      </>
    ),
  },
  {
    title: 'Balance guardrails',
    text: 'A request can never exceed the available balance, and the approval rules are locked at the moment it is made.',
    icon: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  },
  {
    title: 'Role-based access',
    text: 'Organizer, administrator, approver, auditor and contributor each see and do only what their role allows.',
    icon: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5" />
        <circle cx="17.5" cy="9" r="2.5" />
        <path d="M17 14.5c2.5 0 4.5 1.5 4.5 4" />
      </>
    ),
  },
  {
    title: 'Complete audit trail',
    text: 'A timeline records who created, joined, contributed, requested and approved, and when.',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  },
  {
    title: 'Evidence and context',
    text: 'Attach photos, videos and documents so supporters and approvers can see what the money is for.',
    icon: (
      <>
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <circle cx="9" cy="10" r="1.5" />
        <path d="M4 17l5-4 4 3 3-2 4 3" />
      </>
    ),
  },
];

const TRUST_BAND = {
  title: 'Kusanya never holds your money.',
  text: 'Your group keeps its funds wherever it already does, whether that is M-Pesa, a bank account or cash. Kusanya is the shared record and the approval process around it. Its rules are enforced in the database, not only on screen, so they hold even if someone tries to bypass the app.',
};

/* =====================================================================
   LAYOUT (you should not need to change anything below this line)
   ===================================================================== */

const pageCss = `
  .k-lp-screen { min-height: 100vh; min-height: 100svh; }
  .k-lp-hero {
    background: var(--color-hero);
    border-radius: 0 0 36px 36px;
    overflow: hidden;
  }
  .k-lp-hill-1 { fill: var(--color-hill-1); }
  .k-lp-hill-2 { fill: var(--color-hill-2); }
  .k-lp-ring { stroke-opacity: 0.45; }
  .k-lp-glow { display: none; }
  .k-lp-band { background: var(--color-hero); }
  .k-lp-slides { scrollbar-width: none; }
  .k-lp-slides::-webkit-scrollbar { display: none; }

  :root[data-theme="dark"] .k-lp-hero {
    background: #145349;
    box-shadow: 0 1px 0 #2F7A6D, 0 14px 34px rgba(43, 196, 176, 0.14);
  }
  :root[data-theme="dark"] .k-lp-hill-1 { fill: #1B6B5F; }
  :root[data-theme="dark"] .k-lp-hill-2 { fill: #0E3F39; }
  :root[data-theme="dark"] .k-lp-ring { stroke-opacity: 0.3; }
  :root[data-theme="dark"] .k-lp-glow { display: inline; }
  :root[data-theme="dark"] .k-lp-band { background: #145349; box-shadow: inset 0 0 0 1px #2F7A6D; }
`;

const container: React.CSSProperties = { maxWidth: 960, margin: '0 auto', padding: '0 22px' };

const primaryCta: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 50,
  padding: '0 26px',
  borderRadius: 999,
  background: 'var(--color-accent)',
  color: '#0B2B27',
  fontSize: 15,
  fontWeight: 700,
  textDecoration: 'none',
};

const secondaryCta: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 50,
  padding: '0 24px',
  borderRadius: 999,
  border: '1.5px solid rgba(255, 255, 255, 0.6)',
  color: '#FFFFFF',
  fontSize: 15,
  fontWeight: 600,
  textDecoration: 'none',
};

// The two big buttons at the bottom of the first screen: side by side.
const heroCtaStyle: React.CSSProperties = {
  flex: '1 1 0',
  minWidth: 0,
  minHeight: 52,
  height: 'auto',
  padding: '8px 12px',
  fontSize: 14,
  lineHeight: 1.25,
  textAlign: 'center',
};

const sectionTitle: React.CSSProperties = {
  margin: '0 0 6px',
  fontSize: 26,
  lineHeight: 1.2,
};

function Check() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, marginTop: 2 }}
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function Steps({ steps }: { steps: { title: string; text: string }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
      {steps.map((step, i) => (
        <div
          key={step.title}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-track)',
            borderRadius: 18,
            padding: 18,
            boxShadow: '0 6px 20px var(--color-shadow)',
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'var(--color-accent)',
              color: '#0B2B27',
              fontFamily: 'var(--font-heading), sans-serif',
              fontWeight: 700,
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 10,
            }}
          >
            {i + 1}
          </div>
          <div style={{ fontFamily: 'var(--font-heading), sans-serif', fontWeight: 700, fontSize: 16 }}>
            {step.title}
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--color-muted)' }}>
            {step.text}
          </p>
        </div>
      ))}
    </div>
  );
}

// How far one slide is from the next (slide width plus the gap between slides).
function slideStep(scroller: HTMLDivElement): number {
  const first = scroller.children[0] as HTMLElement | undefined;
  const second = scroller.children[1] as HTMLElement | undefined;
  if (first && second) return Math.max(1, second.offsetLeft - first.offsetLeft);
  return Math.max(1, scroller.clientWidth);
}

function HeroCarousel() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [index, setIndex] = useState(0);

  // Move to the next card every few seconds (skipped for people who prefer reduced motion).
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const timer = setInterval(() => {
      const scroller = scrollerRef.current;
      if (!scroller || pausedRef.current) return;
      const step = slideStep(scroller);
      const current = Math.round(scroller.scrollLeft / step);
      const next = (current + 1) % SLIDES.length;
      scroller.scrollTo({ left: next * step, behavior: 'smooth' });
    }, 4000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  function pause() {
    pausedRef.current = true;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  }

  function resumeSoon() {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      pausedRef.current = false;
    }, 5000);
  }

  function handleScroll() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const i = Math.min(SLIDES.length - 1, Math.max(0, Math.round(scroller.scrollLeft / slideStep(scroller))));
    if (i !== index) setIndex(i);
  }

  function goTo(i: number) {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    pause();
    scroller.scrollTo({ left: i * slideStep(scroller), behavior: 'smooth' });
    resumeSoon();
  }

  return (
    <div>
      <div
        ref={scrollerRef}
        className="k-lp-slides"
        onScroll={handleScroll}
        onMouseEnter={pause}
        onMouseLeave={resumeSoon}
        onTouchStart={pause}
        onTouchEnd={resumeSoon}
        style={{
          position: 'relative',
          display: 'flex',
          gap: 12,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
        }}
      >
        {SLIDES.map((slide) => (
          <div
            key={slide.title}
            style={{
              flex: '0 0 100%',
              scrollSnapAlign: 'start',
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 16px',
              borderRadius: 18,
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.22)',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                flexShrink: 0,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.16)',
                color: 'var(--color-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {slide.icon}
              </svg>
            </div>
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-heading), sans-serif',
                  fontWeight: 700,
                  fontSize: 16,
                  color: '#FFFFFF',
                }}
              >
                {slide.title}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--color-hero-sub)', marginTop: 2 }}>
                {slide.text}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginTop: 8 }}>
        {SLIDES.map((slide, i) => (
          <button
            key={slide.title}
            onClick={() => goTo(i)}
            aria-label={`Show card ${i + 1} of ${SLIDES.length}`}
            style={{
              padding: 0,
              width: 20,
              height: 20,
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                display: 'block',
                height: 8,
                width: i === index ? 20 : 8,
                borderRadius: 999,
                background: i === index ? 'var(--color-accent)' : 'rgba(255, 255, 255, 0.35)',
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [checking, setChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user);
      setChecking(false);
    });

    // Old links such as /#how-it-works open the details straight away.
    if (window.location.hash === '#how-it-works' || window.location.hash === '#learn-more') {
      setShowMore(true);
    }
  }, []);

  const startHref = isLoggedIn ? '/projects/new' : '/signup';

  function openDetails() {
    setShowMore(true);
    setTimeout(() => {
      document.getElementById('learn-more')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  function closeDetails() {
    setShowMore(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <main style={{ paddingBottom: 24 }}>
      <style>{pageCss}</style>

      {/* ---------- FIRST SCREEN ---------- */}
      <section className="k-lp-screen" style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <div className="k-lp-hero" style={{ position: 'absolute', inset: 0 }}>
          <svg
            width="240"
            height="240"
            viewBox="0 0 240 240"
            style={{ position: 'absolute', right: -60, top: -64 }}
            aria-hidden="true"
          >
            <circle className="k-lp-ring" cx="120" cy="120" r="116" fill="none" stroke="#F7931E" strokeWidth="2" />
            <circle className="k-lp-ring" cx="120" cy="120" r="88" fill="none" stroke="#F7931E" strokeWidth="2" />
            <circle className="k-lp-glow" cx="120" cy="120" r="88" fill="#F7931E" fillOpacity="0.14" />
            <circle cx="120" cy="120" r="58" fill="#F7931E" />
            <circle cx="120" cy="120" r="24" fill="#FFD27A" />
          </svg>

          <svg
            viewBox="0 0 390 190"
            preserveAspectRatio="none"
            style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: 150 }}
            aria-hidden="true"
          >
            <path className="k-lp-hill-1" d="M0 190V120C60 96 120 98 190 116C250 132 320 106 390 112V190Z" />
            <path className="k-lp-hill-2" d="M0 190V146C70 130 140 138 220 148C290 156 340 140 390 144V190Z" />
          </svg>
        </div>

        <div
          style={{
            ...container,
            position: 'relative',
            width: '100%',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            paddingTop: 18,
            paddingBottom: 18,
          }}
        >
          {/* Top bar */}
          <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <a
              href="/"
              style={{
                fontFamily: 'var(--font-heading), sans-serif',
                fontWeight: 700,
                fontSize: 22,
                color: '#FFFFFF',
                textDecoration: 'none',
              }}
            >
              Kusanya
            </a>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {!checking && isLoggedIn ? (
                <a href="/dashboard" style={{ ...primaryCta, height: 40, padding: '0 18px', fontSize: 14 }}>
                  Go to Home
                </a>
              ) : (
                <>
                  <a href="/login" style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                    Log in
                  </a>
                  <a href="/signup" style={{ ...primaryCta, height: 40, padding: '0 18px', fontSize: 14 }}>
                    Sign up
                  </a>
                </>
              )}
            </div>
          </nav>

          {/* Headline */}
          <div style={{ maxWidth: 560, paddingTop: 36 }}>
            <span
              style={{
                display: 'inline-block',
                background: 'rgba(255, 255, 255, 0.14)',
                color: 'var(--color-hero-sub)',
                fontSize: 12,
                fontWeight: 600,
                padding: '4px 12px',
                borderRadius: 999,
                letterSpacing: 0.3,
              }}
            >
              {HERO.eyebrow}
            </span>
            <h1
              style={{
                margin: '14px 0 12px',
                fontSize: 'clamp(30px, 6vw, 46px)',
                lineHeight: 1.1,
                color: '#FFFFFF',
              }}
            >
              {HERO.title}
            </h1>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: 'var(--color-hero-sub)' }}>{HERO.text}</p>
          </div>

          {/* What Kusanya enables (sliding cards) */}
          <div style={{ maxWidth: 560, marginTop: 26 }}>
            <HeroCarousel />
          </div>

          {/* Buttons at the bottom of the screen, side by side */}
          <div style={{ marginTop: 'auto', paddingTop: 28 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'nowrap', maxWidth: 560 }}>
              <a href={startHref} style={{ ...primaryCta, ...heroCtaStyle }}>
                Start a project
              </a>
              <a href="/discover" style={{ ...secondaryCta, ...heroCtaStyle }}>
                Discover projects to support
              </a>
            </div>

            <button
              onClick={showMore ? closeDetails : openDetails}
              aria-expanded={showMore}
              aria-controls="learn-more"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                margin: '8px 0 0',
                padding: '10px 0',
                background: 'transparent',
                color: 'var(--color-hero-sub)',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {showMore ? 'Show less' : 'Learn more'}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{ transform: showMore ? 'rotate(180deg)' : 'none' }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* ---------- THE DETAILS (only after "Learn more") ---------- */}
      {showMore && (
        <div id="learn-more">
          {/* Two audiences */}
          <section style={{ ...container, marginTop: 48 }}>
            <h2 style={{ ...sectionTitle, textAlign: 'center' }}>
              Built for the people who run the money and the people who give it
            </h2>
            <p
              style={{
                margin: '0 auto 24px',
                maxWidth: 560,
                textAlign: 'center',
                fontSize: 14,
                color: 'var(--color-muted)',
              }}
            >
              One shared record, so everyone sees the same numbers.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {AUDIENCES.map((audience, index) => (
                <div
                  key={audience.label}
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-track)',
                    borderTop: `4px solid ${index === 0 ? 'var(--color-primary)' : 'var(--color-accent)'}`,
                    borderRadius: 20,
                    padding: 22,
                    boxShadow: '0 10px 30px var(--color-shadow)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                      color: index === 0 ? 'var(--color-primary)' : 'var(--color-accent)',
                    }}
                  >
                    {audience.label}
                  </div>
                  <h3 style={{ margin: '6px 0 14px', fontSize: 20 }}>{audience.title}</h3>
                  <ul
                    style={{
                      listStyle: 'none',
                      margin: 0,
                      padding: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    {audience.points.map((point) => (
                      <li
                        key={point}
                        style={{ display: 'flex', gap: 10, fontSize: 14, lineHeight: 1.5, color: 'var(--color-ink)' }}
                      >
                        <span style={{ color: 'var(--color-primary)', display: 'inline-flex' }}>
                          <Check />
                        </span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* How it works */}
          <section id="how-it-works" style={{ ...container, marginTop: 56 }}>
            <h2 style={sectionTitle}>How it works for organizers</h2>
            <p style={{ margin: '0 0 18px', fontSize: 14, color: 'var(--color-muted)' }}>
              Three steps from an empty fund to a fully accountable one.
            </p>
            <Steps steps={ORGANIZER_STEPS} />

            <h2 style={{ ...sectionTitle, marginTop: 40 }}>Giving to a project?</h2>
            <p style={{ margin: '0 0 18px', fontSize: 14, color: 'var(--color-muted)' }}>
              You don’t need an account to look, and giving takes minutes.
            </p>
            <Steps steps={CONTRIBUTOR_STEPS} />
          </section>

          {/* Financial controls */}
          <section style={{ ...container, marginTop: 56 }}>
            <h2 style={sectionTitle}>Financial controls, built in</h2>
            <p style={{ margin: '0 0 18px', fontSize: 14, color: 'var(--color-muted)' }}>
              The same discipline a well-run treasury uses, without the paperwork.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
              {CONTROLS.map((control, i) => {
                const tones = [
                  { bg: 'var(--tile-mint-bg)', ink: 'var(--tile-mint-ic)' },
                  { bg: 'var(--tile-sand-bg)', ink: 'var(--tile-sand-ic)' },
                  { bg: 'var(--tile-peach-bg)', ink: 'var(--tile-peach-ic)' },
                  { bg: 'var(--tile-sky-bg)', ink: 'var(--tile-sky-ic)' },
                ];
                const tone = tones[i % tones.length];
                return (
                  <div
                    key={control.title}
                    style={{
                      display: 'flex',
                      gap: 14,
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-track)',
                      borderRadius: 18,
                      padding: 16,
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        flexShrink: 0,
                        borderRadius: 14,
                        background: tone.bg,
                        color: tone.ink,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        {control.icon}
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontFamily: 'var(--font-heading), sans-serif', fontWeight: 700, fontSize: 15 }}>
                        {control.title}
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--color-muted)' }}>
                        {control.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Trust band */}
          <section style={{ ...container, marginTop: 56 }}>
            <div className="k-lp-band" style={{ borderRadius: 28, padding: '32px 26px', textAlign: 'center' }}>
              <h2 style={{ margin: '0 0 10px', fontSize: 26, color: '#FFFFFF' }}>{TRUST_BAND.title}</h2>
              <p
                style={{
                  margin: '0 auto',
                  maxWidth: 640,
                  fontSize: 15,
                  lineHeight: 1.65,
                  color: 'var(--color-hero-sub)',
                }}
              >
                {TRUST_BAND.text}
              </p>
            </div>
          </section>

          {/* Final call to action */}
          <section style={{ ...container, marginTop: 48, textAlign: 'center' }}>
            <h2 style={{ ...sectionTitle, margin: '0 0 8px' }}>
              Ready to bring accountability to your group’s money?
            </h2>
            <p style={{ margin: '0 auto 20px', maxWidth: 480, fontSize: 14, color: 'var(--color-muted)' }}>
              Start a project in minutes, or see what other communities are raising.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href={startHref} style={primaryCta}>
                Start a project
              </a>
              <a
                href="/discover"
                style={{
                  ...secondaryCta,
                  border: '1.5px solid var(--color-primary)',
                  color: 'var(--color-primary)',
                }}
              >
                Discover projects
              </a>
            </div>
          </section>

          {/* Footer */}
          <footer
            style={{
              ...container,
              marginTop: 48,
              paddingTop: 20,
              paddingBottom: 12,
              borderTop: '1px solid var(--color-track)',
              textAlign: 'center',
            }}
          >
            <div style={{ display: 'flex', gap: 18, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
              <a href="/discover" style={{ fontSize: 13, fontWeight: 600 }}>
                Discover
              </a>
              {!checking && isLoggedIn ? (
                <a href="/dashboard" style={{ fontSize: 13, fontWeight: 600 }}>
                  Home
                </a>
              ) : (
                <>
                  <a href="/login" style={{ fontSize: 13, fontWeight: 600 }}>
                    Log in
                  </a>
                  <a href="/signup" style={{ fontSize: 13, fontWeight: 600 }}>
                    Sign up
                  </a>
                </>
              )}
            </div>
            <button
              onClick={closeDetails}
              style={{
                background: 'transparent',
                color: 'var(--color-primary)',
                border: '1.5px solid var(--color-primary)',
                height: 40,
                padding: '0 18px',
                marginBottom: 14,
              }}
            >
              Show less
            </button>
            <p className="muted-text" style={{ margin: 0, fontSize: 12 }}>
              Kusanya — built for groups that trust each other. It records and approves; it never holds the money.
            </p>
          </footer>
        </div>
      )}
    </main>
  );
}