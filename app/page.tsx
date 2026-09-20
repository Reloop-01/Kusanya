export default function HomePage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '24px' }}>
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', flexWrap: 'wrap', gap: 12 }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 20, color: 'var(--color-primary)' }}>
          Kusanya
        </span>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <a href="/login">Log in</a>
          <a href="/signup"><button>Sign up</button></a>
        </div>
      </nav>

      <section style={{ textAlign: 'center', padding: '48px 0 32px' }}>
        <svg width="120" height="120" viewBox="0 0 120 120" style={{ margin: '0 auto 24px' }} aria-hidden="true">
          <circle cx="40" cy="60" r="26" fill="var(--color-track)" />
          <circle cx="80" cy="60" r="26" fill="var(--color-track)" />
          <circle cx="60" cy="60" r="26" fill="var(--color-primary)" fillOpacity="0.85" />
          <circle cx="60" cy="34" r="6" fill="var(--color-accent)" />
        </svg>

        <h1 style={{ fontSize: 32, marginBottom: 12 }}>Gather together. Grow together.</h1>
        <p style={{ fontSize: 16, maxWidth: 480, margin: '0 auto 28px', color: 'var(--color-muted)' }}>
          Kusanya helps chamas, churches, and community groups collect money transparently —
          with every contribution recorded and every withdrawal approved by the people you trust,
          not just one person.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/signup"><button style={{ padding: '12px 24px', fontSize: 15 }}>Start a project</button></a>
          <a href="/discover">
            <button style={{ padding: '12px 24px', fontSize: 15, background: 'transparent', color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}>
              Discover public projects
            </button>
          </a>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, padding: '32px 0 48px' }}>
        <div className="card">
          <div className="card-label"><span>Step 1</span></div>
          <h2 style={{ marginTop: 0, fontSize: 15 }}>Create a project</h2>
          <p className="muted-text">Set a target, a deadline, and get a shareable link and QR code instantly.</p>
        </div>
        <div className="card">
          <div className="card-label"><span>Step 2</span></div>
          <h2 style={{ marginTop: 0, fontSize: 15 }}>Collect together</h2>
          <p className="muted-text">Contributors pay directly, and every contribution is recorded and confirmed.</p>
        </div>
        <div className="card">
          <div className="card-label"><span>Step 3</span></div>
          <h2 style={{ marginTop: 0, fontSize: 15 }}>Approve together</h2>
          <p className="muted-text">Withdrawals need real approval from your team — never just one person&apos;s word.</p>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid var(--color-track)', padding: '20px 0', textAlign: 'center' }}>
        <p className="muted-text">Kusanya — built for groups that trust each other.</p>
      </footer>
    </main>
  );
}