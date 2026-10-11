'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Project = {
  id: string;
  title: string;
  purpose: string | null;
  target_amount: number;
  currency: string;
  deadline: string | null;
  status: string;
  payment_instructions: string | null;
};

export default function PublicProjectPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [project, setProject] = useState<Project | null>(null);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('projects')
        .select('id, title, purpose, target_amount, currency, deadline, status, payment_instructions')
        .eq('slug', slug)
        .single();

      setProject(data);

      const { data: totalData } = await supabase.rpc('get_project_total', {
        project_slug: slug,
      });
      setTotal(totalData ?? 0);

      const { data: userData } = await supabase.auth.getUser();
      if (userData.user && data) {
        const { data: membership } = await supabase
          .from('project_members')
          .select('role')
          .eq('project_id', data.id)
          .eq('user_id', userData.user.id)
          .maybeSingle();
        setIsMember(!!membership);
      }

      setLoading(false);
    }
    load();
  }, [slug]);

  if (loading) {
    return <main style={{ maxWidth: 480, margin: '60px auto', padding: 24 }}><p>Loading...</p></main>;
  }

  if (!project) {
    return (
      <main style={{ maxWidth: 480, margin: '60px auto', padding: 24 }}>
        <h1>Project not found</h1>
        <p>This link may be incorrect, or the project may be private.</p>
      </main>
    );
  }

  const percent = Math.min(100, Math.round((total / project.target_amount) * 100));

  return (
    <main style={{ maxWidth: 480, margin: '60px auto', padding: 24 }}>
      <div className="card">
        <div className="card-stripe"><span></span><span></span></div>
        {isMember && (
          <p style={{ marginBottom: 12 }}>
            <a href={`/projects/${project.id}`}>You&apos;re a member — go to the full project →</a>
          </p>
        )}
        <h1>{project.title}</h1>
        {project.purpose && <p style={{ marginBottom: 20 }}>{project.purpose}</p>}

                {total >= project.target_amount ? (
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
            <p className="muted-text" style={{ marginBottom: 18 }}>
              {project.currency} {total.toLocaleString()} raised of {project.currency}{' '}
              {project.target_amount.toLocaleString()} ({percent}%)
            </p>
          </>
        )}

        <p className="muted-text" style={{ marginBottom: 4 }}>
          {project.deadline && <>Deadline: {project.deadline} · </>}Status: {project.status}
        </p>
      </div>

      {project.payment_instructions && (
        <div
          style={{
            border: `1px solid var(--color-primary)`,
            background: 'var(--color-track)',
            borderRadius: 10,
            padding: 16,
            marginTop: 20,
          }}
        >
          <h2 style={{ marginTop: 0, color: 'var(--color-primary)' }}>How to contribute</h2>
          <p style={{ whiteSpace: 'pre-line' }}>{project.payment_instructions}</p>
          <p className="muted-text" style={{ marginTop: 8 }}>
            After paying, let the organizer know so they can confirm your contribution.
          </p>
        </div>
      )}
    </main>
  );
}