'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Project = {
  id: string;
  title: string;
  purpose: string | null;
  target_amount: number;
  currency: string;
  slug: string;
  deadline: string | null;
};

type ProjectWithTotal = Project & { total: number };

export default function DiscoverPage() {
  const [projects, setProjects] = useState<ProjectWithTotal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('projects')
        .select('id, title, purpose, target_amount, currency, slug, deadline')
        .eq('visibility', 'public')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      const withTotals = await Promise.all(
        (data ?? []).map(async (p) => {
          const { data: total } = await supabase.rpc('get_project_total', {
            project_slug: p.slug,
          });
          return { ...p, total: total ?? 0 };
        })
      );

      setProjects(withTotals);
      setLoading(false);
    }
    load();
  }, []);

  return (
        <main style={{ maxWidth: 600, margin: '60px auto', padding: 24 }}>
      <p style={{ marginBottom: 16 }}><a href="/">← Back to home</a></p>
      <h1>Discover public projects</h1>
      <p className="muted-text" style={{ marginBottom: 24 }}>Community fundraisers anyone can support.</p>

      {loading && <p>Loading...</p>}
      {!loading && projects.length === 0 && <p>No public projects right now.</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {projects.map((p) => {
          const percent = Math.min(100, Math.round((p.total / p.target_amount) * 100));
          return (
            <a key={p.id} href={`/p/${p.slug}`} className="card" style={{ display: 'block', color: 'inherit' }}>
              <div className="card-stripe"><span></span><span></span></div>
              <div className="card-label">
                <i className="ti ti-users" style={{ fontSize: 16 }} aria-hidden="true"></i>
                <span>Community project</span>
              </div>
              <h1 style={{ fontSize: 16, marginBottom: 12 }}>{p.title}</h1>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${percent}%` }} />
              </div>
              <p className="muted-text">
                {p.currency} {p.total.toLocaleString()} of {p.currency} {p.target_amount.toLocaleString()}
              </p>
            </a>
          );
        })}
      </div>
    </main>
  );
}