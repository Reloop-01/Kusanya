const OPTIONS = [
  {
    value: 'private',
    title: 'Private',
    text: 'Only people you add can see it. There is no public link.',
    icon: (
      <>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </>
    ),
  },
  {
    value: 'link_only',
    title: 'Anyone with the link',
    text: 'Anyone with the link or QR code can see it. It is not listed on Discover.',
    icon: (
      <>
        <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
        <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
      </>
    ),
  },
  {
    value: 'public',
    title: 'Public',
    text: 'Listed on Discover, so anyone can find and support it.',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
      </>
    ),
  },
];

export default function VisibilityPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Who can see this project"
      style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      {OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              width: '100%',
              padding: '12px 14px',
              textAlign: 'left',
              borderRadius: 16,
              border: `2px solid ${selected ? 'var(--color-primary)' : 'var(--color-track)'}`,
              background: selected ? 'var(--tile-mint-bg)' : 'var(--color-surface)',
              color: 'var(--color-ink)',
              fontWeight: 400,
            }}
          >
            <span
              style={{
                width: 40,
                height: 40,
                flexShrink: 0,
                borderRadius: 12,
                background: selected ? 'var(--color-primary)' : 'var(--color-track)',
                color: selected ? 'var(--color-on-primary)' : 'var(--color-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {option.icon}
              </svg>
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{option.title}</span>
              <span
                style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)', marginTop: 2, lineHeight: 1.4 }}
              >
                {option.text}
              </span>
            </span>
            {selected && (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{ animation: 'k-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both' }}
              >
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}