// A plain page header: back link, title and a short line underneath.
export default function PageHeader({
  backHref,
  backLabel,
  title,
  subtitle,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="k-rise" style={{ marginBottom: 20 }}>
      <a
        href={backHref}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 0',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-muted)',
          textDecoration: 'none',
        }}
      >
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
        >
          <path d="M15 6l-6 6 6 6" />
        </svg>
        {backLabel}
      </a>
      <h1 style={{ margin: '6px 0 0', fontSize: 28 }}>{title}</h1>
      {subtitle && (
        <p className="muted-text" style={{ margin: '4px 0 0', fontSize: 14 }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}