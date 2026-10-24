// The green "Savanna Sunrise" header used at the top of pages:
// sun in the corner, a back link (or the Kusanya name), a title and a subtitle.

type PageHeroProps = {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  maxWidth?: number;
};

const heroCss = `
  .k-sp-hero-bg {
    background: var(--color-hero);
    border-radius: 0 0 28px 28px;
    overflow: hidden;
  }
  .k-sp-ring { stroke-opacity: 0.5; }
  .k-sp-glow { display: none; }

  :root[data-theme="dark"] .k-sp-hero-bg {
    background: #145349;
    box-shadow: 0 1px 0 #2F7A6D, 0 14px 34px rgba(43, 196, 176, 0.14);
  }
  :root[data-theme="dark"] .k-sp-ring { stroke-opacity: 0.3; }
  :root[data-theme="dark"] .k-sp-glow { display: inline; }
`;

export default function PageHero({ title, subtitle, backHref, backLabel, maxWidth = 700 }: PageHeroProps) {
  const linkStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '4px 0',
    fontSize: 13,
    color: 'var(--color-hero-sub)',
    textDecoration: 'none',
  };

  return (
    <>
      <style>{heroCss}</style>
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

        <div style={{ position: 'relative', maxWidth, margin: '0 auto', padding: '18px 22px 30px' }}>
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
    </>
  );
}