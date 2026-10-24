// The green "Savanna Sunrise" header used at the top of pages:
// sun in the corner, a back link (or the Kusanya name), a title and a subtitle.
// The colours and the sun's glow live in globals.css.

type PageHeroProps = {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  maxWidth?: number;
};

export default function PageHero({ title, subtitle, backHref, backLabel, maxWidth = 700 }: PageHeroProps) {
  const linkStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '4px 0',
    fontSize: 13,
    color: 'var(--color-hero-sub)',
    textDecoration: 'none',
  };

  return (
    <section style={{ position: 'relative' }}>
      <div className="k-sp-hero-bg" style={{ position: 'absolute', inset: 0 }}>
        <svg
          width="150"
          height="150"
          viewBox="0 0 170 170"
          style={{ position: 'absolute', right: -30, top: -34 }}
          aria-hidden="true"
        >
          <circle className="k-sp-ring" cx="100" cy="70" r="58" fill="none" stroke="#F7931E" strokeWidth="2" />
          <circle className="k-sp-glow" cx="100" cy="70" r="58" fill="#F7931E" fillOpacity="0.14" />
          <circle cx="100" cy="70" r="38" fill="#F7931E" />
          <circle cx="100" cy="70" r="16" fill="#FFD27A" />
        </svg>
      </div>

      <div className="k-rise" style={{ position: 'relative', maxWidth, margin: '0 auto', padding: '18px 22px 30px' }}>
        {backHref ? (
          <a href={backHref} style={linkStyle}>
            {backLabel ?? '← Back'}
          </a>
        ) : (
          <a
            href="/"
            style={{
              ...linkStyle,
              fontFamily: 'var(--font-heading), sans-serif',
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            Kusanya
          </a>
        )}
        <h1 style={{ margin: '6px 0 0', fontSize: 28, lineHeight: 1.2, color: '#FFFFFF', maxWidth: '85%' }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-hero-sub)', maxWidth: '75%' }}>
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}