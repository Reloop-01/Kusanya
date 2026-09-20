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
  role: string;
  total: number;
};

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push('/login');
        return;
      }
      setEmail(userData.user.email ?? null);

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
        setLoadingProjects(false);
        return;
      }

      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, title, target_amount, slug, status')
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
      setLoadingProjects(false);
    }
    load();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (!email) return null;

  return (
    <main style={{ maxWidth: 700, margin: '60px auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h1 style={{ marginBottom: 0 }}>Welcome back</h1>
        <button onClick={handleLogout}>Log out</button>
      </div>
      <p className="muted-text" style={{ marginBottom: 24 }}>{email}</p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
        <a href="/projects/new">
          <button>+ Start a new project</button>
        </a>
        <a href="/discover">
          <button>Discover public projects</button>
        </a>
      </div>

      <h2>Your projects</h2>
      {loadingProjects && <p>Loading...</p>}
      {!loadingProjects && projects.length === 0 && <p>You aren&apos;t part of any projects yet.</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {projects.map((project) => {
          const percent = Math.min(100, Math.round((project.total / project.target_amount) * 100));
          return (
            <a key={project.id} href={`/projects/${project.id}`} className="card" style={{ display: 'block', color: 'inherit' }}>
              <div className="card-stripe"><span></span><span></span></div>
              <div className="card-label">
                <span>Your role: {project.role}</span>
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