// Small building blocks shared by the plain-style pages.

export const outlineButton: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--color-primary)',
  border: '1.5px solid var(--color-primary)',
};

export const dangerButton: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--color-danger)',
  border: '1.5px solid var(--color-danger)',
};

// A card with a title (and an optional icon and hint) on top.
export function Section({
  title,
  hint,
  icon,
  delay = 0,
  id,
  children,
}: {
  title: string;
  hint?: string;
  icon?: React.ReactNode;
  delay?: number;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="card k-rise"
      style={{ borderRadius: 20, padding: 18, animationDelay: `${delay}s`, scrollMarginTop: 16 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        {icon && (
          <span
            style={{
              width: 34,
              height: 34,
              flexShrink: 0,
              borderRadius: 11,
              background: 'var(--tile-mint-bg)',
              color: 'var(--tile-mint-ic)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {icon}
            </svg>
          </span>
        )}
        <div>
          <h2 style={{ margin: 0, fontSize: 16 }}>{title}</h2>
          {hint && <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 1 }}>{hint}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>
      {label}
      {hint && <span style={{ fontWeight: 400, color: 'var(--color-muted)' }}> · {hint}</span>}
      <div style={{ marginTop: 6, fontWeight: 400 }}>{children}</div>
    </label>
  );
}

export function FilterChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        height: 34,
        padding: '0 14px',
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 600,
        border: `1.5px solid ${selected ? 'var(--color-primary)' : 'var(--color-input-border)'}`,
        background: selected ? 'var(--color-primary)' : 'var(--color-surface)',
        color: selected ? 'var(--color-on-primary)' : 'var(--color-ink)',
      }}
    >
      {label}
    </button>
  );
}

export function Pill({ text, bg, ink }: { text: string; bg: string; ink: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        background: bg,
        color: ink,
        fontSize: 11,
        fontWeight: 700,
        padding: '3px 10px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
        textTransform: 'capitalize',
      }}
    >
      {text}
    </span>
  );
}

export function Notice({
  kind,
  children,
}: {
  kind: 'error' | 'success' | 'info';
  children: React.ReactNode;
}) {
  const look: React.CSSProperties =
    kind === 'error'
      ? { border: '1px solid var(--color-danger)', color: 'var(--color-danger)' }
      : kind === 'success'
        ? { background: 'var(--tile-mint-bg)', color: 'var(--tile-mint-ic)' }
        : { background: 'var(--tile-sand-bg)', color: 'var(--tile-sand-ic)' };
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className="k-rise"
      style={{ borderRadius: 12, padding: '9px 13px', fontSize: 13, lineHeight: 1.45, ...look }}
    >
      {children}
    </div>
  );
}

// A number box with the currency written inside it, e.g. KES [   ]
export function CurrencyInput({
  currency,
  value,
  onChange,
  placeholder,
  required,
}: {
  currency: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <span
        style={{
          position: 'absolute',
          left: 12,
          top: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--color-muted)',
          pointerEvents: 'none',
        }}
      >
        {currency}
      </span>
      <input
        type="number"
        min="1"
        inputMode="numeric"
        placeholder={placeholder}
        aria-label={placeholder ?? 'Amount'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        style={{ width: '100%', paddingLeft: 52 }}
      />
    </div>
  );
}

export function StatTile({
  label,
  bg,
  ink,
  children,
}: {
  label: string;
  bg: string;
  ink: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: bg, color: ink, borderRadius: 16, padding: '12px 14px', minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, opacity: 0.85 }}>{label}</div>
      <div
        style={{
          fontFamily: 'var(--font-heading), sans-serif',
          fontWeight: 700,
          fontSize: 20,
          marginTop: 2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </div>
    </div>
  );
}