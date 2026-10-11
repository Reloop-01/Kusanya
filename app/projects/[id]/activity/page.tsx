'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Event = {
  id: string;
  timestamp: string;
  type: 'created' | 'joined' | 'contribution' | 'withdrawal' | 'decision';
  text: string;
};

function typeColor(type: Event['type']) {
  if (type === 'contribution') return 'var(--color-primary)';
  if (type === 'withdrawal') return 'var(--color-accent)';
  if (type === 'decision') return 'var(--color-primary)';
  return 'var(--color-track)';
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
    (names ?? []).forEach((n: any) => {
      nameById[n.user_id] = n.full_name;
    });

    const events: Event[] = [];

    if (project) {
      events.push({
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
      events.push({
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
      events.push({
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
      events.push({
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
        events.push({
          id: `approval-${a.id}`,
          timestamp: a.created_at,
          type: 'decision',
          text,
        });
      });
    }

    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setEvents(events);
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
        <p>You&apos;re not a member of this project.</p>
        <a href="/dashboard">Back to dashboard</a>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 600, margin: '60px auto', padding: 24 }}>
      <p style={{ marginBottom: 16 }}><a href={`/projects/${projectId}`}>← Back to project summary</a></p>
      <h1>{projectTitle} — Activity</h1>
      <p className="muted-text" style={{ marginBottom: 24 }}>Everything that&apos;s happened on this project, newest first.</p>

      {loadingEvents && <p>Loading...</p>}
      {!loadingEvents && events.length === 0 && <p>Nothing to show yet.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {events.map((e) => (
          <div
            key={e.id}
            style={{
              borderLeft: `3px solid ${typeColor(e.type)}`,
              paddingLeft: 14,
              paddingTop: 10,
              paddingBottom: 10,
            }}
          >
            <p style={{ margin: 0 }}>{e.text}</p>
            <p className="muted-text" style={{ margin: 0, fontSize: 12 }}>
              {new Date(e.timestamp).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}