'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import PageHero from '@/components/PageHero';
import { CoverPreview, loadProjectCovers, ProjectCoverInfo } from '@/components/ProjectCover';

// Projects with these statuses are finished.
const CLOSED_STATUSES = ['completed', 'cancelled'];

type Project = {
  id: string;
  title: string;
  target_amount: number;
  currency: string | null;
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

function capitalize(text: string) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function Chip({ text, bg, ink }: { text: string; bg: string; ink: string }) {
  return (
    <span
      style={{
        background: bg,
        color: ink,
        fontSize: 11,
        fontWeight: 600,
        padding: '3px 9px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  );
}

function ProjectCard({ project, cover }: { project: Project; cover: ProjectCoverInfo | undefined }) {
  const percent =
    project.target_amount > 0 ? Math.min(100, Math.round((project.total / project.target_amount) * 100)) : 0;
  const currency = project.currency ?? 'KES';
  const isClosed = CLOSED_STATUSES.includes(project.status);

  return (
    <a
      href={`/projects/${project.id}`}
      style={{
        display: 'block',
        color: 'var(--color-ink)',
        textDecoration: 'none',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-track)',
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow: '0 6px 20px var(--color-shadow)',
      }}
    >
      <CoverPreview info={cover} />

      <div style={{ padding: 16 }}>
        <div
          style={{
            fontFamily: 'var(--font-heading), sans-serif',
            fontWeight: 700,
            fontSize: 17,
            lineHeight: 1.25,
          }}
        >
          {project.title}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          <Chip text={capitalize(project.role)} bg="var(--tile-sand-bg)" ink="var(--tile-sand-ic)" />
          <Chip text={visibilityLabel(project.visibility)} bg="var(--tile-mint-bg)" ink="var(--tile-mint-ic)" />
          {isClosed && <Chip text={capitalize(project.status)} bg="var(--color-track)" ink="var(--color-muted)" />}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
          <div
            style={{
              flex: 1,
              height: 8,
              borderRadius: 999,
              background: 'var(--color-track)',
              overflow: 'hidden',
            }}
            role="img"
            aria-label={`${percent} percent funded`}
          >
            <div
              style={{
                width: `${percent}%`,
                height: '100%',
                borderRadius: 999,
                background: isClosed ? 'var(--color-muted)' : 'var(--color-accent)',
              }}
            />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, minWidth: 34, textAlign: 'right' }}>{percent}%</span>
        </div>

        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 6 }}>
          {currency} {project.total.toLocaleString()} of {project.target_amount.toLocaleString()}
        </div>
      </div>
    </a>
  );
}

export default function YourProjectsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [covers, setCovers] = useState<Record<string, ProjectCoverInfo>>({});

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
        .select('id, title, target_amount, currency, slug, status, visibility')
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
      setCovers(await loadProjectCovers(projectIds));
      setLoading(false);
    }
    load();
  }, [router]);

  const activeProjects = projects.filter((p) => !CLOSED_STATUSES.includes(p.status));
  const closedProjects = projects.filter((p) => CLOSED_STATUSES.includes(p.status));

  return (
    <main style={{ paddingBottom: 8 }}>
      <PageHero title="Your projects" subtitle="Everything you're part of, in one place" />

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 22px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 22,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16 }}>{loading ? 'Projects' : `${activeProjects.length} active`}</h2>
          <a
            href="/projects/new"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 40,
              padding: '0 14px',
              border: '1.5px solid var(--color-primary)',
              color: 'var(--color-primary)',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            + New project
          </a>
        </div>

        {loading && (
          <p className="muted-text" style={{ marginTop: 16 }}>
            Loading your projects…
          </p>
        )}

        {!loading && projects.length === 0 && (
          <div className="card" style={{ borderRadius: 20, textAlign: 'center', padding: 24, marginTop: 16 }}>
            <h2 style={{ margin: '0 0 6px', fontSize: 17 }}>No projects yet</h2>
            <p className="muted-text" style={{ marginBottom: 16, fontSize: 13 }}>
              Start a project for your group, or ask an organizer to invite you to theirs.
            </p>
            <a href="/projects/new">
              <button>Start your first project</button>
            </a>
          </div>
        )}

        {activeProjects.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 14,
              marginTop: 16,
            }}
          >
            {activeProjects.map((project) => (
              <ProjectCard key={project.id} project={project} cover={covers[project.id]} />
            ))}
          </div>
        )}

        {closedProjects.length > 0 && (
          <>
            <h2 style={{ margin: '28px 0 0', fontSize: 16, color: 'var(--color-muted)' }}>
              Closed ({closedProjects.length})
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 14,
                marginTop: 14,
              }}
            >
              {closedProjects.map((project) => (
                <ProjectCard key={project.id} project={project} cover={covers[project.id]} />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}