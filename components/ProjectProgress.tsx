'use client';

import { useEffect, useRef, useState } from 'react';

export const MILESTONES = [25, 50, 75, 100];

export function capitalize(text: string) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

// Turns "2026-10-31" into a local date (no time-zone surprises).
export function parseDeadline(deadline: string): Date | null {
  const [y, m, d] = deadline.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function daysLeftLabel(deadline: string): string | null {
  const date = parseDeadline(deadline);
  if (!date) return null;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((date.getTime() - startOfToday.getTime()) / 86400000);
  if (diff < 0) return 'Deadline passed';
  if (diff === 0) return 'Last day';
  if (diff === 1) return '1 day left';
  return `${diff} days left`;
}

export function formatDeadline(deadline: string): string {
  const date = parseDeadline(deadline);
  if (!date) return deadline;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Counts from the current number up to the target. Skipped for people who prefer reduced motion.
export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  const valueRef = useRef(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      valueRef.current = target;
      setValue(target);
      return;
    }

    const from = valueRef.current;
    const start = performance.now();
    let frame = 0;

    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (target - from) * eased;
      valueRef.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}

// A number that counts up, e.g. <CountUp value={45000} /> shows 45,000
export function CountUp({ value }: { value: number }) {
  const shown = useCountUp(value);
  return <>{Math.round(shown).toLocaleString()}</>;
}

export function FundingRing({ percent }: { percent: number }) {
  const shown = useCountUp(percent, 1100);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg
      width="132"
      height="132"
      viewBox="0 0 132 132"
      role="img"
      aria-label={`${percent} percent funded`}
      style={{ display: 'block', margin: '0 auto' }}
    >
      <circle cx="66" cy="66" r={radius} fill="none" stroke="var(--color-track)" strokeWidth="10" />
      {shown > 0.5 && (
        <circle
          cx="66"
          cy="66"
          r={radius}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(shown / 100) * circumference} ${circumference}`}
          transform="rotate(-90 66 66)"
        />
      )}
      <text
        x="66"
        y="68"
        textAnchor="middle"
        fontSize="30"
        fontWeight="700"
        fill="var(--color-ink)"
        style={{ fontFamily: 'var(--font-heading), sans-serif' }}
      >
        {Math.round(shown)}%
      </text>
      <text
        x="66"
        y="88"
        textAnchor="middle"
        fontSize="12"
        fill="var(--color-muted)"
        style={{ fontFamily: 'var(--font-body), sans-serif' }}
      >
        {percent >= 100 ? 'fully funded' : 'funded'}
      </text>
    </svg>
  );
}

// The small ring used on Home project cards.
export function MiniRing({ percent }: { percent: number }) {
  const shown = useCountUp(percent, 1000);
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" role="img" aria-label={`${percent} percent funded`}>
      <circle cx="32" cy="32" r={radius} fill="none" stroke="var(--color-track)" strokeWidth="7" />
      {shown > 0.5 && (
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${(shown / 100) * circumference} ${circumference}`}
          transform="rotate(-90 32 32)"
        />
      )}
      <text
        x="32"
        y="37"
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fill="var(--color-ink)"
        style={{ fontFamily: 'var(--font-heading), sans-serif' }}
      >
        {Math.round(shown)}%
      </text>
    </svg>
  );
}

export function MilestoneTrack({ percent }: { percent: number }) {
  // The line fills in after the page appears, so you see it grow.
  const [animateIn, setAnimateIn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimateIn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // The line runs from the 25% dot to the 100% dot, so it fills from 0 to 75% of the width.
  const fill = animateIn ? Math.max(0, Math.min(75, percent - 25)) : 0;
  const latestReached = MILESTONES.filter((m) => percent >= m).pop();

  return (
    <div style={{ position: 'relative', margin: '16px 0 14px' }}>
      <div
        style={{
          position: 'absolute',
          top: 11,
          left: '12.5%',
          right: '12.5%',
          height: 3,
          background: 'var(--color-track)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 11,
          left: '12.5%',
          width: `${fill}%`,
          height: 3,
          background: 'var(--color-primary)',
          transition: 'width 1.1s cubic-bezier(0.2, 0.7, 0.2, 1) 0.2s',
        }}
      />
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {MILESTONES.map((m, i) => {
          const reached = percent >= m;
          const delay = 0.35 + i * 0.18;
          let animation: string | undefined;
          if (reached) {
            animation = `k-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}s both`;
            if (m === latestReached) {
              animation += `, k-pulse-ring 1.6s ease-out ${delay + 0.4}s 2`;
            }
          }
          return (
            <div key={m} title={reached ? `${m}% reached` : `${m}% not reached yet`}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  boxSizing: 'border-box',
                  margin: '0 auto 4px',
                  borderRadius: '50%',
                  background: reached ? 'var(--color-primary)' : 'var(--color-surface)',
                  border: reached ? 'none' : '2px solid var(--color-input-border)',
                  color: 'var(--color-on-primary)',
                  fontSize: 13,
                  lineHeight: '24px',
                  animation,
                }}
              >
                {reached ? '✓' : ''}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{m}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}