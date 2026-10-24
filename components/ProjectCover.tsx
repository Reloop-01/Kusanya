'use client';

import { supabase } from '@/lib/supabaseClient';

const BUCKET = 'project-media';

export type MediaKind = 'image' | 'video' | 'document';

export type MediaRow = {
  project_id: string;
  kind: MediaKind;
  storage_path: string;
};

export type ProjectCoverInfo = {
  media: MediaRow[];
  coverUrl: string | null;
};

// Loads the materials of many projects at once. The first upload is the cover.
// Only cover photos get a temporary link (videos and PDFs show an icon instead).
export async function loadProjectCovers(projectIds: string[]): Promise<Record<string, ProjectCoverInfo>> {
  const result: Record<string, ProjectCoverInfo> = {};
  projectIds.forEach((id) => {
    result[id] = { media: [], coverUrl: null };
  });
  if (projectIds.length === 0) return result;

  const { data: rows } = await supabase
    .from('project_media')
    .select('project_id, kind, storage_path, created_at')
    .in('project_id', projectIds)
    .order('created_at', { ascending: true });

  ((rows ?? []) as MediaRow[]).forEach((row) => {
    if (result[row.project_id]) result[row.project_id].media.push(row);
  });

  const coverPaths: string[] = [];
  projectIds.forEach((id) => {
    const cover = result[id].media[0];
    if (cover && cover.kind === 'image') coverPaths.push(cover.storage_path);
  });

  if (coverPaths.length > 0) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(coverPaths, 3600);
    const urlByPath: Record<string, string> = {};
    (signed ?? []).forEach((s) => {
      if (s.path && s.signedUrl) urlByPath[s.path] = s.signedUrl;
    });
    projectIds.forEach((id) => {
      const cover = result[id].media[0];
      if (cover && cover.kind === 'image') result[id].coverUrl = urlByPath[cover.storage_path] ?? null;
    });
  }

  return result;
}

export function mediaSummary(media: MediaRow[]): string {
  const photos = media.filter((m) => m.kind === 'image').length;
  const videos = media.filter((m) => m.kind === 'video').length;
  const documents = media.filter((m) => m.kind === 'document').length;
  const parts: string[] = [];
  if (photos > 0) parts.push(`${photos} photo${photos === 1 ? '' : 's'}`);
  if (videos > 0) parts.push(`${videos} video${videos === 1 ? '' : 's'}`);
  if (documents > 0) parts.push(`${documents} PDF${documents === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

export function CoverPreview({ info }: { info: ProjectCoverInfo | undefined }) {
  const media = info?.media ?? [];
  const cover = media[0];
  const summary = mediaSummary(media);

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

  if (cover && cover.kind === 'image' && info?.coverUrl) {
    content = (
      <div style={frame}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={info.coverUrl}
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
      <div style={{ ...frame, background: 'var(--tile-peach-bg)', color: 'var(--tile-peach-ic)' }}>
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