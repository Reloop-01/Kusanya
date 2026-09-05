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
};

export default function PublicProjectPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [project, setProject] = useState<Project | null>(null);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('projects')
        .select('id, title, purpose, target_amount, currency, deadline, status')
        .eq('slug', slug)
        .single();

      setProject(data);

      const { data: totalData } = await supabase.rpc('get_project_total', {
        project_slug: slug,
      });
      setTotal(totalData ?? 0);

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
      <p><strong>Status:</strong> {project.status}</p>
    </main>
  );
}