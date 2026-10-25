import PageHero from '@/components/PageHero';

// The frame for sign-up and login: green hero on top, form card floating over it.
export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <main style={{ paddingBottom: 40 }}>
      <PageHero title={title} subtitle={subtitle} maxWidth={460} />
      <div style={{ maxWidth: 460, margin: '0 auto', padding: '0 22px' }}>
        <div
          className="card k-rise"
          style={{
            position: 'relative',
            zIndex: 1,
            marginTop: -18,
            borderRadius: 20,
            padding: 20,
            boxShadow: '0 10px 30px var(--color-shadow)',
          }}
        >
          {children}
        </div>
      </div>
    </main>
  );
}