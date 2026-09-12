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
};

export default function ProjectHubPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [total, setTotal] = useState(0);
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
      .select('title, purpose, target_amount, currency, deadline, status, slug')
      .eq('id', projectId)
      .single();
    setProject(projectData);

    const { data: totalData } = await supabase.rpc('get_project_total_for_member', {
      p_project_id: projectId,
    });
    setTotal(totalData ?? 0);
  }, [projectId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const canRecordContributions = myRole === 'organizer' || myRole === 'administrator';

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

  return (
    <main style={{ maxWidth: 600, margin: '60px auto', padding: 24 }}>
      <h1>{project.title}</h1>
      {project.purpose && <p>{project.purpose}</p>}

      <div style={{ margin: '20px 0' }}>
        <div style={{ background: '#eee', borderRadius: 8, height: 16, overflow: 'hidden' }}>
          <div style={{ background: '#22a06b', height: '100%', width: `${percent}%` }} />
        </div>
        <p style={{ marginTop: 8 }}>
          {project.currency} {total.toLocaleString()} raised of {project.currency}{' '}
          {project.target_amount.toLocaleString()} ({percent}%)
        </p>
      </div>

      {project.deadline && <p><strong>Deadline:</strong> {project.deadline}</p>}
      <p><strong>Status:</strong> {project.status} · <strong>Your role:</strong> {myRole}</p>

      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, margin: '24px 0', textAlign: 'center' }}>
        <QRCodeSVG
          value={`${typeof window !== 'undefined' ? window.location.origin : ''}/p/${project.slug}`}
          size={160}
        />
        <p style={{ marginTop: 12, wordBreak: 'break-all' }}>
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
      </div>
    </main>
  );
}