'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { QRCodeSVG } from 'qrcode.react';

type ProjectInfo = {
  title: string;
  purpose: string | null;
  target_amount: number;
  currency: string;
  deadline: string | null;
  status: string;
  slug: string;
  payment_instructions: string | null;
  visibility: string;
};

export default function ProjectHubPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [total, setTotal] = useState(0);
  const [available, setAvailable] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

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

    setMyRole(membership?.role ?? null);
    setCheckingAccess(false);

    if (!membership) return;

    const { data: projectData } = await supabase
      .from('projects')
      .select('title, purpose, target_amount, currency, deadline, status, slug, payment_instructions, visibility')
      .eq('id', projectId)
      .single();
    setProject(projectData);

    const { data: totalData } = await supabase.rpc('get_project_total_for_member', {
      p_project_id: projectId,
    });
    setTotal(totalData ?? 0);

    const { data: availableData } = await supabase.rpc('get_project_available_balance', {
      p_project_id: projectId,
    });
    setAvailable(availableData ?? 0);
  }, [projectId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const canRecordContributions = myRole === 'organizer' || myRole === 'administrator';
  const isOrganizer = myRole === 'organizer';

  if (checkingAccess) {
    return <main style={{ maxWidth: 600, margin: '60px auto', padding: 24 }}><p>Loading...</p></main>;
  }

  if (!myRole || !project) {
    return (
      <main style={{ maxWidth: 600, margin: '60px auto', padding: 24 }}>
        <h1>Not authorized</h1>
        <p>You&apos;re not a member of this project.</p>
        <a href="/dashboard">Back to dashboard</a>
      </main>
    );
  }

  const percent = Math.min(100, Math.round((total / project.target_amount) * 100));
  const isFullyFunded = total >= project.target_amount;

  return (
    <main style={{ maxWidth: 600, margin: '60px auto', padding: 24 }}>
      <p style={{ marginBottom: 16 }}><a href="/dashboard">← Back to dashboard</a></p>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-stripe"><span></span><span></span></div>
        <div className="card-label" style={{ justifyContent: 'space-between' }}>
          <span>Your role: {myRole}</span>
          <span>{project.visibility === 'public' ? 'Public' : project.visibility === 'private' ? 'Private' : 'Link-only'}</span>
        </div>
        <h1>{project.title}</h1>
        {project.purpose && <p style={{ marginBottom: 18 }}>{project.purpose}</p>}

        {isFullyFunded ? (
          <div style={{ background: 'var(--color-primary)', color: 'white', borderRadius: 10, padding: '14px 16px', marginBottom: 14, textAlign: 'center' }}>
            <strong>🎉 Fully funded!</strong>
            <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.9 }}>
              {project.currency} {total.toLocaleString()} raised of {project.currency} {project.target_amount.toLocaleString()}
            </p>
          </div>
        ) : (
          <>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${percent}%` }} />
            </div>
            <p className="muted-text" style={{ marginBottom: 14 }}>
              {project.currency} {total.toLocaleString()} raised of {project.currency}{' '}
              {project.target_amount.toLocaleString()} ({percent}%)
            </p>
          </>
        )}

        {available !== null && (
          <p className="muted-text" style={{ marginBottom: 8 }}>
            Available to withdraw: <strong style={{ color: 'var(--color-ink)' }}>{project.currency} {available.toLocaleString()}</strong>
          </p>
        )}

        <p className="muted-text">
          {project.deadline && <>Deadline: {project.deadline} · </>}Status: {project.status}
        </p>
      </div>

      {project.payment_instructions ? (
        <div
          style={{
            border: '1px solid var(--color-primary)',
            background: 'var(--color-track)',
            borderRadius: 10,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <h2 style={{ marginTop: 0, color: 'var(--color-primary)' }}>How to contribute</h2>
          <p style={{ whiteSpace: 'pre-line' }}>{project.payment_instructions}</p>
        </div>
      ) : (
        isOrganizer && (
          <p className="muted-text" style={{ marginBottom: 20 }}>
            You haven&apos;t added payment instructions yet — visitors won&apos;t know how to pay.{' '}
            <a href={`/projects/${projectId}/settings`}>Add them in Settings</a>.
          </p>
        )
      )}

      <div className="card" style={{ textAlign: 'center', marginBottom: 20 }}>
        <QRCodeSVG
          value={`${typeof window !== 'undefined' ? window.location.origin : ''}/p/${project.slug}`}
          size={160}
        />
        <p className="muted-text" style={{ marginTop: 12, marginBottom: 12, wordBreak: 'break-all' }}>
          {typeof window !== 'undefined' ? window.location.origin : ''}/p/{project.slug}
        </p>
        <button
          onClick={() => {
            navigator.clipboard.writeText(`${window.location.origin}/p/${project.slug}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? 'Copied!' : 'Copy link to share'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {canRecordContributions && (
          <a href={`/projects/${projectId}/contributions`}>
            <button style={{ width: '100%' }}>Record a contribution</button>
          </a>
        )}
        <a href={`/projects/${projectId}/settings`}>
          <button style={{ width: '100%' }}>Team & approval settings</button>
        </a>
                <a href={`/projects/${projectId}/withdrawals`}>
          <button style={{ width: '100%' }}>Withdrawal requests</button>
        </a>
        <a href={`/projects/${projectId}/activity`}>
          <button style={{ width: '100%' }}>Activity</button>
        </a>
      </div>
    </main>
  );
}