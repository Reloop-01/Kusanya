'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Project = {
  id: string;
  title: string;
  target_amount: number;
  slug: string;
  status: string;
  visibility: string;
  role: string;
  total: number;
};

function visibilityLabel(v: string) {
  if (v === 'public') return 'Public';
  if (v === 'private') return 'Private';
  return 'Link-only';
}

export default function YourProjectsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push('/login');
        return;
      }

      const { data: memberRows } = await supabase
        .from('project_members')
        .select('project_id, role')
        .eq('user_id', userData.user.id);

      const roleByProjectId: Record<string, string> = {};
      (memberRows ?? []).forEach((m) => {
        roleByProjectId[m.project_id] = m.role;
      });

      const projectIds = Object.keys(roleByProjectId);

      if (projectIds.length === 0) {
        setProjects([]);
        setLoading(false);
        return;
      }

      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, title, target_amount, slug, status, visibility')
        .in('id', projectIds)
        .order('created_at', { ascending: false });

      const withTotals = await Promise.all(
        (projectsData ?? []).map(async (p) => {
          const { data: total } = await supabase.rpc('get_project_total_for_member', {
            p_project_id: p.id,
          });
          return { ...p, role: roleByProjectId[p.id], total: total ?? 0 };
        })
      );

      setProjects(withTotals);
      setLoading(false);
    }
    load();
  }, [router]);

  return (
    <main style={{ maxWidth: 700, margin: '60px auto', padding: 24 }}>
      <p style={{ marginBottom: 16 }}><a href="/dashboard">← Back to home</a></p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ marginBottom: 0 }}>Your projects</h1>
        <a href="/projects/new"><button>+ New project</button></a>
      </div>

      {loading && <p>Loading...</p>}
      {!loading && projects.length === 0 && <p>You aren&apos;t part of any projects yet.</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {projects.map((project) => {
          const percent = Math.min(100, Math.round((project.total / project.target_amount) * 100));
          return (
            <a key={project.id} href={`/projects/${project.id}`} className="card" style={{ display: 'block', color: 'inherit' }}>
              <div className="card-stripe"><span></span><span></span></div>
              <div className="card-label" style={{ justifyContent: 'space-between' }}>
                <span>Your role: {project.role}</span>
                <span>{visibilityLabel(project.visibility)}</span>
              </div>
              <h1 style={{ fontSize: 16, marginBottom: 12 }}>{project.title}</h1>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${percent}%` }} />
              </div>
              <p className="muted-text">
                KES {project.total.toLocaleString()} of {project.target_amount.toLocaleString()} · {project.status}
              </p>
            </a>
          );
        })}
      </div>
    </main>
  );
}