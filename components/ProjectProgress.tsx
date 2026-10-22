// Shared pieces for showing a project's progress: the ring, the milestone
// ticks, and the little helpers for deadlines.

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

export function FundingRing({ percent }: { percent: number }) {
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
      {percent > 0 && (
        <circle
          cx="66"
          cy="66"
          r={radius}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(percent / 100) * circumference} ${circumference}`}
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
        {percent}%
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

export function MilestoneTrack({ percent }: { percent: number }) {
  // The line runs from the 25% dot to the 100% dot, so it fills from 0 to 75% of the width.
  const fill = Math.max(0, Math.min(75, percent - 25));
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
        }}
      />
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {MILESTONES.map((m) => {
          const reached = percent >= m;
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