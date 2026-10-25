'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import PageHeader from '@/components/PageHeader';
import { dayLabel, timeOfDay } from '@/lib/format';

type EventType = 'created' | 'joined' | 'contribution' | 'withdrawal' | 'decision';

type Event = {
  id: string;
  timestamp: string;
  type: EventType;
  text: string;
};

type Filter = 'all' | 'contribution' | 'withdrawal' | 'decision' | 'members';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'contribution', label: 'Contributions' },
  { key: 'withdrawal', label: 'Withdrawals' },
  { key: 'decision', label: 'Decisions' },
  { key: 'members', label: 'Members' },
];

function matchesFilter(type: EventType, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'members') return type === 'created' || type === 'joined';
  return type === filter;
}

function typeLook(type: EventType): { bg: string; ink: string; icon: React.ReactNode } {
  switch (type) {
    case 'contribution':
      return { bg: 'var(--tile-mint-bg)', ink: 'var(--tile-mint-ic)', icon: <path d="M12 5v14M5 12h14" /> };
    case 'withdrawal':
      return { bg: 'var(--tile-peach-bg)', ink: 'var(--tile-peach-ic)', icon: <path d="M7 17L17 7M9 7h8v8" /> };
    case 'decision':
      return { bg: 'var(--tile-sky-bg)', ink: 'var(--tile-sky-ic)', icon: <path d="M5 12.5l4.5 4.5L19 7.5" /> };
    case 'joined':
      return {
        bg: 'var(--tile-sand-bg)',
        ink: 'var(--tile-sand-ic)',
        icon: (
          <>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" />
          </>
        ),
      };
    default:
      return {
        bg: 'var(--tile-sand-bg)',
        ink: 'var(--tile-sand-ic)',
        icon: <path d="M5 21V4h11l-2 4 2 4H5" />,
      };
  }
}

export default function ActivityPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState('');
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

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

    if (!membership) {
      setCheckingAccess(false);
      setMyRole(null);
      return;
    }
    setMyRole(membership.role);
    setCheckingAccess(false);

    const { data: project } = await supabase
      .from('projects')
      .select('title, created_at')
      .eq('id', projectId)
      .single();
    setProjectTitle(project?.title ?? '');

    const { data: names } = await supabase.rpc('get_project_member_names', {
      p_project_id: projectId,
    });
    const nameById: Record<string, string> = {};
    (names ?? []).forEach((n: { user_id: string; full_name: string }) => {
      nameById[n.user_id] = n.full_name;
    });

    const list: Event[] = [];

    if (project) {
      list.push({
        id: 'created',
        timestamp: project.created_at,
        type: 'created',
        text: `${project.title} was created`,
      });
    }

    const { data: memberRows } = await supabase
      .from('project_members')
      .select('id, user_id, role, created_at')
      .eq('project_id', projectId);
    (memberRows ?? []).forEach((m) => {
      list.push({
        id: `member-${m.id}`,
        timestamp: m.created_at,
        type: 'joined',
        text: `${nameById[m.user_id] ?? 'Someone'} joined as ${m.role}`,
      });
    });

    // This query only returns rows if the viewer's role has contribution read access —
    // for other roles it simply comes back empty, which is correct, not an error.
    const { data: contribs } = await supabase
      .from('contributions')
      .select('id, contributor_name, amount, status, created_at, is_anonymous')
      .eq('project_id', projectId);
    (contribs ?? []).forEach((c) => {
      const who = c.is_anonymous ? 'An anonymous contributor' : c.contributor_name;
      list.push({
        id: `contribution-${c.id}`,
        timestamp: c.created_at,
        type: 'contribution',
        text: `${who} contributed KES ${c.amount.toLocaleString()} — ${c.status}`,
      });
    });

    const { data: requests } = await supabase
      .from('withdrawal_requests')
      .select('id, amount, purpose, requester_id, created_at')
      .eq('project_id', projectId);
    (requests ?? []).forEach((r) => {
      list.push({
        id: `request-${r.id}`,
        timestamp: r.created_at,
        type: 'withdrawal',
        text: `${nameById[r.requester_id] ?? 'Someone'} requested KES ${r.amount.toLocaleString()} for "${r.purpose}"`,
      });
    });

    const requestIds = (requests ?? []).map((r) => r.id);
    const amountByRequestId: Record<string, number> = {};
    (requests ?? []).forEach((r) => {
      amountByRequestId[r.id] = r.amount;
    });

    if (requestIds.length > 0) {
      const { data: approvals } = await supabase
        .from('withdrawal_approvals')
        .select('id, withdrawal_id, approver_id, decision, reason, created_at')
        .in('withdrawal_id', requestIds);
      (approvals ?? []).forEach((a) => {
        const amount = amountByRequestId[a.withdrawal_id];
        let text = `${nameById[a.approver_id] ?? 'Someone'} ${a.decision} a KES ${amount?.toLocaleString() ?? '?'} withdrawal`;
        if (a.reason) text += ` — "${a.reason}"`;
        list.push({
          id: `approval-${a.id}`,
          timestamp: a.created_at,
          type: 'decision',
          text,
        });
      });
    }

    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setEvents(list);
    setLoadingEvents(false);
  }, [projectId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (checkingAccess) {
    return <main style={{ maxWidth: 600, margin: '60px auto', padding: 24 }}><p>Loading...</p></main>;
  }

  if (!myRole) {
    return (
      <main style={{ maxWidth: 600, margin: '60px auto', padding: 24 }}>
        <h1>Not authorized</h1>
        <p style={{ marginBottom: 16 }}>You&apos;re not a member of this project.</p>
        <a href="/dashboard">Back to dashboard</a>
      </main>
    );
  }

  const counts: Record<Filter, number> = {
    all: events.length,
    contribution: events.filter((e) => e.type === 'contribution').length,
    withdrawal: events.filter((e) => e.type === 'withdrawal').length,
    decision: events.filter((e) => e.type === 'decision').length,
    members: events.filter((e) => e.type === 'created' || e.type === 'joined').length,
  };

  const visible = events.filter((e) => matchesFilter(e.type, filter));

  // Group by day, newest first (the list is already sorted)
  const groups: { label: string; items: Event[] }[] = [];
  visible.forEach((e) => {
    const label = dayLabel(e.timestamp);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(e);
    else groups.push({ label, items: [e] });
  });

  let animationIndex = 0;

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '24px 22px 8px' }}>
      <PageHeader
        backHref={`/projects/${projectId}`}
        backLabel="Back to project"
        title="Activity"
        subtitle={`Everything that has happened on ${projectTitle || 'this project'}, newest first.`}
      />

      {/* Filters */}
      <div className="k-rise" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18, animationDelay: '0.05s' }}>
        {FILTERS.map((f) => {
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

      {loadingEvents && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div className="k-skeleton" style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="k-skeleton" style={{ height: 13, width: '75%' }} />
                <div className="k-skeleton" style={{ height: 11, width: '30%', marginTop: 8 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loadingEvents && events.length === 0 && <p className="muted-text">Nothing to show yet.</p>}
      {!loadingEvents && events.length > 0 && visible.length === 0 && (
        <p className="muted-text">Nothing in this category yet.</p>
      )}

      {groups.map((group) => (
        <section key={group.label} style={{ marginBottom: 22 }}>
          <h2
            style={{
              margin: '0 0 12px',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              color: 'var(--color-muted)',
            }}
          >
            {group.label}
          </h2>

          <div>
            {group.items.map((e, index) => {
              const look = typeLook(e.type);
              const isLast = index === group.items.length - 1;
              const delay = Math.min(animationIndex++ * 0.04, 0.5);
              return (
                <div
                  key={e.id}
                  className="k-rise"
                  style={{
                    position: 'relative',
                    paddingLeft: 48,
                    paddingBottom: isLast ? 0 : 16,
                    animationDelay: `${delay}s`,
                  }}
                >
                  {!isLast && (
                    <span
                      style={{
                        position: 'absolute',
                        left: 16,
                        top: 34,
                        bottom: 0,
                        width: 2,
                        background: 'var(--color-track)',
                      }}
                    />
                  )}
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      background: look.bg,
                      color: look.ink,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      {look.icon}
                    </svg>
                  </span>
                  <div style={{ fontSize: 14, lineHeight: 1.45, paddingTop: 5 }}>{e.text}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                    {timeOfDay(e.timestamp)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}