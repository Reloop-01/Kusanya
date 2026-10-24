'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import PageHero from '@/components/PageHero';
import { daysLeftLabel } from '@/components/ProjectProgress';

const BUCKET = 'project-media';

type Project = {
  id: string;
  title: string;
  purpose: string | null;
  target_amount: number;
  currency: string;
  slug: string;
  deadline: string | null;
};

type MediaKind = 'image' | 'video' | 'document';

type MediaRow = {
  project_id: string;
  kind: MediaKind;
  storage_path: string;
};

type DiscoverProject = Project & {
  total: number;
  media: MediaRow[];
  coverUrl: string | null;
};

function mediaSummary(media: MediaRow[]): string {
  const photos = media.filter((m) => m.kind === 'image').length;
  const videos = media.filter((m) => m.kind === 'video').length;
  const documents = media.filter((m) => m.kind === 'document').length;
  const parts: string[] = [];
  if (photos > 0) parts.push(`${photos} photo${photos === 1 ? '' : 's'}`);
  if (videos > 0) parts.push(`${videos} video${videos === 1 ? '' : 's'}`);
  if (documents > 0) parts.push(`${documents} PDF${documents === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

function CoverPreview({ project }: { project: DiscoverProject }) {
  const cover = project.media[0];
  const summary = mediaSummary(project.media);

  const frame: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    aspectRatio: '16 / 10',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  };

  let content: React.ReactNode;

  if (cover && cover.kind === 'image' && project.coverUrl) {
    content = (
      <div style={frame}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={project.coverUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    );
  } else if (cover && cover.kind === 'video') {
    content = (
      <div style={{ ...frame, background: 'linear-gradient(135deg, #0B2B27, #145349)', color: '#FFFFFF' }}>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M9 6.5v11l9-5.5z" />
          </svg>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Video</span>
      </div>
    );
  } else if (cover && cover.kind === 'document') {
    content = (
      <div
        style={{
          ...frame,
          background: 'var(--tile-peach-bg)',
          color: 'var(--tile-peach-ic)',
        }}
      >
        <svg
          width="34"
          height="34"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M7 3h7l5 5v13H7z" />
          <path d="M14 3v5h5" />
        </svg>
        <span style={{ fontSize: 12, fontWeight: 600 }}>PDF document</span>
      </div>
    );
  } else {
    // No materials yet: a small sunrise picture.
    content = (
      <div style={{ ...frame, background: 'var(--color-hero)' }}>
        <svg
          viewBox="0 0 320 200"
          preserveAspectRatio="xMidYMid slice"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          aria-hidden="true"
        >
          <circle cx="250" cy="56" r="40" fill="#F7931E" fillOpacity="0.25" />
          <circle cx="250" cy="56" r="26" fill="#F7931E" />
          <circle cx="250" cy="56" r="11" fill="#FFD27A" />
          <path d="M0 200V130C50 108 100 110 160 126C220 142 270 118 320 124V200Z" fill="var(--color-hill-1)" />
          <path d="M0 200V162C60 148 120 154 190 164C250 172 290 160 320 162V200Z" fill="var(--color-hill-2)" />
        </svg>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {content}
      {summary && (
        <span
          style={{
            position: 'absolute',
            left: 10,
            bottom: 10,
            background: 'rgba(11, 43, 39, 0.75)',
            color: '#FFFFFF',
            fontSize: 11,
            fontWeight: 600,
            padding: '3px 9px',
            borderRadius: 999,
          }}
        >
          {summary}
        </span>
      )}
    </div>
  );
}

function DiscoverCard({ project }: { project: DiscoverProject }) {
  const percent =
    project.target_amount > 0 ? Math.min(100, Math.round((project.total / project.target_amount) * 100)) : 0;
  const isFullyFunded = project.target_amount > 0 && project.total >= project.target_amount;
  const daysLabel = project.deadline ? daysLeftLabel(project.deadline) : null;

  return (
    <a
      href={`/p/${project.slug}`}
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
      <CoverPreview project={project} />

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

        {project.purpose && (
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 13,
              lineHeight: 1.45,
              color: 'var(--color-muted)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {project.purpose}
          </p>
        )}

        {(isFullyFunded || daysLabel) && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {isFullyFunded && (
              <span
                style={{
                  background: 'var(--tile-mint-bg)',
                  color: 'var(--tile-mint-ic)',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '3px 9px',
                  borderRadius: 999,
                }}
              >
                Fully funded
              </span>
            )}
            {daysLabel && (
              <span
                style={{
                  background: 'var(--tile-peach-bg)',
                  color: 'var(--tile-peach-ic)',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '3px 9px',
                  borderRadius: 999,
                }}
              >
                {daysLabel}
              </span>
            )}
          </div>
        )}

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
                background: 'var(--color-accent)',
              }}
            />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, minWidth: 34, textAlign: 'right' }}>{percent}%</span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            marginTop: 8,
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--color-muted)', minWidth: 0 }}>
            {project.currency} {project.total.toLocaleString()} of {project.currency}{' '}
            {project.target_amount.toLocaleString()}
          </div>
          <span
            style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              height: 32,
              padding: '0 14px',
              borderRadius: 999,
              background: 'var(--color-primary)',
              color: 'var(--color-on-primary)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            See more →
          </span>
        </div>
      </div>
    </a>
  );
}

export default function DiscoverPage() {
  const [projects, setProjects] = useState<DiscoverProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('projects')
        .select('id, title, purpose, target_amount, currency, slug, deadline')
        .eq('visibility', 'public')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      const list: Project[] = data ?? [];

      // Totals for every project
      const totals = await Promise.all(
        list.map(async (p) => {
          const { data: total } = await supabase.rpc('get_project_total', {
            project_slug: p.slug,
          });
          return (total ?? 0) as number;
        })
      );

      // Materials for every project in one request (the first upload is the cover)
      const mediaByProject: Record<string, MediaRow[]> = {};
      if (list.length > 0) {
        const { data: mediaRows } = await supabase
          .from('project_media')
          .select('project_id, kind, storage_path, created_at')
          .in(
            'project_id',
            list.map((p) => p.id)
          )
          .order('created_at', { ascending: true });

        ((mediaRows ?? []) as MediaRow[]).forEach((row) => {
          if (!mediaByProject[row.project_id]) mediaByProject[row.project_id] = [];
          mediaByProject[row.project_id].push(row);
        });
      }

      // Temporary links for the cover photos only (videos and PDFs show an icon)
      const coverPaths: string[] = [];
      list.forEach((p) => {
        const cover = mediaByProject[p.id]?.[0];
        if (cover && cover.kind === 'image') coverPaths.push(cover.storage_path);
      });

      const urlByPath: Record<string, string> = {};
      if (coverPaths.length > 0) {
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(coverPaths, 3600);
        (signed ?? []).forEach((s) => {
          if (s.path && s.signedUrl) urlByPath[s.path] = s.signedUrl;
        });
      }

      const combined: DiscoverProject[] = list.map((p, i) => {
        const media = mediaByProject[p.id] ?? [];
        const cover = media[0];
        return {
          ...p,
          total: totals[i],
          media,
          coverUrl: cover && cover.kind === 'image' ? urlByPath[cover.storage_path] ?? null : null,
        };
      });

      setProjects(combined);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <main style={{ paddingBottom: 40 }}>
      <PageHero title="Discover" subtitle="Community fundraisers anyone can support" />

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 22px' }}>
        {loading && (
          <p className="muted-text" style={{ marginTop: 22 }}>
            Loading…
          </p>
        )}

        {!loading && projects.length === 0 && (
          <div className="card" style={{ borderRadius: 20, textAlign: 'center', padding: 24, marginTop: 22 }}>
            <h2 style={{ margin: '0 0 6px', fontSize: 17 }}>No public projects right now</h2>
            <p className="muted-text" style={{ fontSize: 13 }}>
              When a group makes its project public, it will show up here. Check back soon.
            </p>
          </div>
        )}

        {projects.length > 0 && (
          <>
            <h2 style={{ margin: '22px 0 0', fontSize: 16 }}>
              {projects.length} {projects.length === 1 ? 'project' : 'projects'} to support
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 14,
                marginTop: 14,
              }}
            >
              {projects.map((project) => (
                <DiscoverCard key={project.id} project={project} />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}