'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import PageHeader from '@/components/PageHeader';
import { CountUp } from '@/components/ProjectProgress';
import { initialsOf, timeAgo } from '@/lib/format';

type Contribution = {
  id: string;
  contributor_name: string | null;
  amount: number;
  reference: string | null;
  status: string;
  created_at: string;
  is_anonymous: boolean;
};

type Filter = 'all' | 'pending' | 'confirmed' | 'rejected';

function statusStyle(status: string): React.CSSProperties {
  if (status === 'confirmed') return { background: 'var(--tile-mint-bg)', color: 'var(--tile-mint-ic)' };
  if (status === 'rejected') return { background: 'var(--tile-peach-bg)', color: 'var(--tile-peach-ic)' };
  return { background: 'var(--tile-sand-bg)', color: 'var(--tile-sand-ic)' };
}

function StatTile({
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

export default function ContributionsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [projectTitle, setProjectTitle] = useState('');
  const [projectStatus, setProjectStatus] = useState('active');
  const [currency, setCurrency] = useState('KES');
  const [loadingList, setLoadingList] = useState(true);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.push('/login');
      return;
    }

    const { data: membership } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userData.user.id)
      .maybeSingle();

    const allowed = membership?.role === 'organizer' || membership?.role === 'administrator';
    setHasAccess(allowed);
    setCheckingAccess(false);

    if (!allowed) return;

    const { data: project } = await supabase
      .from('projects')
      .select('title, status, currency')
      .eq('id', projectId)
      .single();
    setProjectTitle(project?.title ?? '');
    setProjectStatus(project?.status ?? 'active');
    setCurrency(project?.currency ?? 'KES');

    const { data: contribs } = await supabase
      .from('contributions')
      .select('id, contributor_name, amount, reference, status, created_at, is_anonymous')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    setContributions(contribs ?? []);
    setLoadingList(false);
  }, [projectId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Heads-up if this reference (e.g. an M-Pesa code) was already recorded.
  const referenceKey = reference.trim().toLowerCase();
  const duplicate = referenceKey
    ? contributions.find((c) => (c.reference ?? '').trim().toLowerCase() === referenceKey)
    : undefined;

  async function handleAddContribution(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);

    const { error: insertError } = await supabase.from('contributions').insert({
      project_id: projectId,
      contributor_name: name,
      amount: Number(amount),
      reference: reference.trim() || null,
      status: 'pending',
      is_anonymous: isAnonymous,
    });

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setName('');
    setAmount('');
    setReference('');
    setIsAnonymous(false);
    setNotice('Contribution recorded. It is pending until you confirm it below.');
    setTimeout(() => setNotice(''), 5000);
    loadData();
  }

  async function updateStatus(item: Contribution, status: 'confirmed' | 'rejected') {
    if (status === 'rejected') {
      const sure = window.confirm(
        `Reject this contribution of ${currency} ${item.amount.toLocaleString()}? It will not count toward the project total.`
      );
      if (!sure) return;
    }
    setBusyId(item.id);
    await supabase.from('contributions').update({ status }).eq('id', item.id);
    await loadData();
    setBusyId(null);
  }

  if (checkingAccess) {
    return <main style={{ maxWidth: 600, margin: '60px auto', padding: 24 }}><p>Loading...</p></main>;
  }

  if (!hasAccess) {
    return (
      <main style={{ maxWidth: 600, margin: '60px auto', padding: 24 }}>
        <h1>Not authorized</h1>
        <p style={{ marginBottom: 16 }}>Only the organizer or an administrator can record contributions.</p>
        <a href={`/projects/${projectId}`}>Back to project</a>
      </main>
    );
  }

  const isActive = projectStatus === 'active';

  const confirmed = contributions.filter((c) => c.status === 'confirmed');
  const pending = contributions.filter((c) => c.status === 'pending');
  const rejected = contributions.filter((c) => c.status === 'rejected');
  const confirmedTotal = confirmed.reduce((sum, c) => sum + c.amount, 0);

  const counts: Record<Filter, number> = {
    all: contributions.length,
    pending: pending.length,
    confirmed: confirmed.length,
    rejected: rejected.length,
  };

  const query = search.trim().toLowerCase();
  const visible = contributions.filter((c) => {
    if (filter !== 'all' && c.status !== filter) return false;
    if (!query) return true;
    return (
      (c.contributor_name ?? '').toLowerCase().includes(query) ||
      (c.reference ?? '').toLowerCase().includes(query)
    );
  });

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'rejected', label: 'Rejected' },
  ];

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '24px 22px 8px' }}>
      <PageHeader
        backHref={`/projects/${projectId}`}
        backLabel="Back to project"
        title="Contributions"
        subtitle={projectTitle}
      />

      {/* ---------- SUMMARY ---------- */}
      <div
        className="k-rise"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, animationDelay: '0.05s' }}
      >
        <StatTile label="CONFIRMED" bg="var(--tile-mint-bg)" ink="var(--tile-mint-ic)">
          {currency} <CountUp value={confirmedTotal} />
        </StatTile>
        <StatTile label="PENDING" bg="var(--tile-sand-bg)" ink="var(--tile-sand-ic)">
          <CountUp value={pending.length} />
        </StatTile>
        <StatTile label="ENTRIES" bg="var(--tile-sky-bg)" ink="var(--tile-sky-ic)">
          <CountUp value={contributions.length} />
        </StatTile>
      </div>

      {/* ---------- RECORD A CONTRIBUTION ---------- */}
      <section className="card k-rise" style={{ marginTop: 16, borderRadius: 20, padding: 18, animationDelay: '0.1s' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 17 }}>Record a contribution</h2>
        <p className="muted-text" style={{ margin: '0 0 14px', fontSize: 13 }}>
          Add it once the payment has reached your account, then confirm it below.
        </p>

        {isActive ? (
          <form onSubmit={handleAddContribution} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="text"
              placeholder="Contributor name"
              aria-label="Contributor name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
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
                placeholder="Amount"
                aria-label="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                style={{ width: '100%', paddingLeft: 52 }}
              />
            </div>
            <div>
              <input
                type="text"
                placeholder="Reference / M-Pesa code (optional)"
                aria-label="Reference or M-Pesa code"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                style={{ width: '100%' }}
              />
              {duplicate && (
                <p
                  role="alert"
                  style={{
                    margin: '6px 2px 0',
                    fontSize: 12,
                    lineHeight: 1.4,
                    color: 'var(--tile-sand-ic)',
                    background: 'var(--tile-sand-bg)',
                    borderRadius: 10,
                    padding: '6px 10px',
                  }}
                >
                  Heads-up: this reference was already recorded
                  {duplicate.contributor_name ? ` for ${duplicate.contributor_name}` : ''} ({currency}{' '}
                  {duplicate.amount.toLocaleString()}, {duplicate.status}). Check it is not a duplicate before adding.
                </p>
              )}
            </div>

            {/* Anonymous switch */}
            <button
              type="button"
              role="switch"
              aria-checked={isAnonymous}
              onClick={() => setIsAnonymous((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: '10px 12px',
                textAlign: 'left',
                borderRadius: 14,
                border: '1px solid var(--color-track)',
                background: 'var(--color-surface)',
                color: 'var(--color-ink)',
                fontWeight: 400,
                fontSize: 14,
              }}
            >
              <span
                style={{
                  position: 'relative',
                  width: 42,
                  height: 24,
                  flexShrink: 0,
                  borderRadius: 999,
                  background: isAnonymous ? 'var(--color-primary)' : 'var(--color-input-border)',
                  transition: 'background-color 0.2s ease',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 3,
                    left: isAnonymous ? 21 : 3,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: '#FFFFFF',
                    transition: 'left 0.2s ease',
                  }}
                />
              </span>
              <span>This contributor wishes to remain anonymous</span>
            </button>

            {error && (
              <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 13, margin: 0 }}>
                {error}
              </p>
            )}
            {notice && (
              <p
                role="status"
                className="k-rise"
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: 'var(--tile-mint-ic)',
                  background: 'var(--tile-mint-bg)',
                  borderRadius: 10,
                  padding: '8px 12px',
                }}
              >
                ✓ {notice}
              </p>
            )}

            <button type="submit" disabled={loading} style={{ width: '100%', height: 48 }}>
              {loading ? 'Saving...' : 'Add contribution'}
            </button>
          </form>
        ) : (
          <p className="muted-text">
            This project is {projectStatus} and no longer accepting new contributions.
          </p>
        )}
      </section>

      {/* ---------- ALL CONTRIBUTIONS ---------- */}
      <h2 style={{ margin: '26px 0 10px', fontSize: 17 }}>All contributions</h2>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {filters.map((f) => {
          const selected = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
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
              {f.label} · {counts[f.key]}
            </button>
          );
        })}
      </div>

      <input
        type="search"
        placeholder="Search by name or reference"
        aria-label="Search contributions"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', marginBottom: 12 }}
      />

      {loadingList && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="k-skeleton" style={{ height: 84, borderRadius: 18 }} />
          ))}
        </div>
      )}

      {!loadingList && contributions.length === 0 && (
        <p className="muted-text" style={{ fontSize: 13 }}>
          No contributions recorded yet. When someone pays, record it above.
        </p>
      )}
      {!loadingList && contributions.length > 0 && visible.length === 0 && (
        <p className="muted-text" style={{ fontSize: 13 }}>
          Nothing matches that filter or search.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visible.map((c, index) => {
          const busy = busyId === c.id;
          return (
            <article
              key={c.id}
              className="k-rise"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-track)',
                borderRadius: 18,
                padding: 14,
                boxShadow: '0 4px 14px var(--color-shadow)',
                animationDelay: `${Math.min(index * 0.04, 0.4)}s`,
                opacity: busy ? 0.6 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    flexShrink: 0,
                    borderRadius: '50%',
                    background: c.is_anonymous ? 'var(--color-track)' : 'var(--tile-sky-bg)',
                    color: c.is_anonymous ? 'var(--color-muted)' : 'var(--tile-sky-ic)',
                    fontSize: 13,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {c.is_anonymous || !c.contributor_name ? (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" />
                    </svg>
                  ) : (
                    initialsOf(c.contributor_name)
                  )}
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 14 }}>{c.contributor_name}</strong>
                    {c.is_anonymous && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: 'var(--color-accent)',
                          letterSpacing: 0.4,
                        }}
                      >
                        ANONYMOUS
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                    {timeAgo(c.created_at)}
                    {c.reference && <> · ref: {c.reference}</>}
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'var(--font-heading), sans-serif', fontWeight: 700, fontSize: 16 }}>
                    {currency} {c.amount.toLocaleString()}
                  </div>
                  <span
                    style={{
                      ...statusStyle(c.status),
                      display: 'inline-block',
                      marginTop: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 9px',
                      borderRadius: 999,
                      textTransform: 'capitalize',
                    }}
                  >
                    {c.status}
                  </span>
                </div>
              </div>

              {c.is_anonymous && (
                <p className="muted-text" style={{ margin: '10px 0 0', fontSize: 12, fontStyle: 'italic' }}>
                  Visible to you for reconciliation only — don&apos;t name them publicly.
                </p>
              )}

              {c.status === 'pending' && (
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => updateStatus(c, 'confirmed')}
                    disabled={busy}
                    style={{ flex: 1, height: 40, padding: 0 }}
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => updateStatus(c, 'rejected')}
                    disabled={busy}
                    style={{
                      flex: 1,
                      height: 40,
                      padding: 0,
                      background: 'transparent',
                      color: 'var(--color-danger)',
                      border: '1.5px solid var(--color-danger)',
                    }}
                  >
                    Reject
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}