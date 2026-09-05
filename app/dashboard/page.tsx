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

      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, title, target_amount, slug, status')
        .order('created_at', { ascending: false });

      setProjects(projectsData ?? []);
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
      {!loadingProjects && projects.length === 0 && <p>You haven&apos;t created any projects yet.</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {projects.map((project) => (
          <li key={project.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 8 }}>
            <a href={`/projects/${project.id}`}><strong>{project.title}</strong></a> — Target: KES {project.target_amount.toLocaleString()}
            <br />
            Status: {project.status}
            <br />
            Shareable link (not live yet): <code>/p/{project.slug}</code>
          </li>
        ))}
      </ul>
    </main>
  );
}