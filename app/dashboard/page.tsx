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

      setProjects(
        (projectsData ?? []).map((p) => ({
          ...p,
          role: roleByProjectId[p.id],
        }))
      );
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
    <main style={{ maxWidth: 600, margin: '60px auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Welcome, {email}</h1>
        <button onClick={handleLogout}>Log out</button>
      </div>

      <div style={{ margin: '24px 0' }}>
        <a href="/projects/new">
          <button>+ Start a new project</button>
        </a>
      </div>

      <h2>Your projects</h2>
      {loadingProjects && <p>Loading...</p>}
      {!loadingProjects && projects.length === 0 && <p>You aren&apos;t part of any projects yet.</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {projects.map((project) => (
          <li key={project.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 8 }}>
            <a href={`/projects/${project.id}`}><strong>{project.title}</strong></a> — Target: KES {project.target_amount}
            <br />
            Your role: {project.role} · Status: {project.status}
            <br />
            Shareable link: <code>/p/{project.slug}</code>
          </li>
        ))}
      </ul>
    </main>
  );
}