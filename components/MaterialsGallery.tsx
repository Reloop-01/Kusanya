'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const BUCKET = 'project-media';

type MediaItem = {
  id: string;
  kind: 'image' | 'video' | 'document';
  file_name: string;
  storage_path: string;
  size_bytes: number;
};

function formatSize(bytes: number): string {
  const mb = 1024 * 1024;
  if (bytes >= mb) return `${(bytes / mb).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Shows a project's photos, videos and PDFs in full. It loads its own data,
// so any page can use it with: <MaterialsGallery projectId={...} />
// It shows nothing at all if the project has no materials.
export default function MaterialsGallery({
  projectId,
  heading = 'Photos, videos & documents',
}: {
  projectId: string;
  heading?: string;
}) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: rows } = await supabase
        .from('project_media')
        .select('id, kind, file_name, storage_path, size_bytes')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      const list = (rows ?? []) as MediaItem[];
      if (cancelled) return;
      setMedia(list);
      if (list.length === 0) return;

      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(
          list.map((m) => m.storage_path),
          3600
        );
      const map: Record<string, string> = {};
      (signed ?? []).forEach((s) => {
        if (s.path && s.signedUrl) map[s.path] = s.signedUrl;
      });
      if (!cancelled) setUrls(map);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Close the full-screen photo with the Escape key.
  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightbox(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  const available = media.filter((m) => urls[m.storage_path]);
  if (available.length === 0) return null;

  const images = available.filter((m) => m.kind === 'image');
  const videos = available.filter((m) => m.kind === 'video');
  const documents = available.filter((m) => m.kind === 'document');
  const featuredImage = images[0];
  const otherImages = images.slice(1);

  const imageButton: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: 0,
    border: 'none',
    background: 'transparent',
    borderRadius: 14,
    overflow: 'hidden',
    cursor: 'zoom-in',
  };

  return (
    <section style={{ marginTop: 22 }}>
      <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>{heading}</h2>

      {featuredImage && (
        <button
          style={{ ...imageButton, marginBottom: otherImages.length > 0 ? 10 : 0 }}
          onClick={() => setLightbox({ url: urls[featuredImage.storage_path], name: featuredImage.file_name })}
          aria-label="View photo larger"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={urls[featuredImage.storage_path]}
            alt={featuredImage.file_name}
            style={{ width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', display: 'block' }}
          />
        </button>
      )}

      {otherImages.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
          {otherImages.map((m) => (
            <button
              key={m.id}
              style={imageButton}
              onClick={() => setLightbox({ url: urls[m.storage_path], name: m.file_name })}
              aria-label="View photo larger"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={urls[m.storage_path]}
                alt={m.file_name}
                style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block' }}
              />
            </button>
          ))}
        </div>
      )}

      {videos.map((m) => (
        <video
          key={m.id}
          src={urls[m.storage_path]}
          controls
          playsInline
          preload="metadata"
          style={{
            width: '100%',
            maxHeight: 420,
            marginTop: 10,
            borderRadius: 16,
            background: '#000000',
            display: 'block',
          }}
        />
      ))}

      {documents.map((m) => (
        <a
          key={m.id}
          href={urls[m.storage_path]}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginTop: 10,
            padding: '12px 14px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-track)',
            borderRadius: 14,
            color: 'var(--color-ink)',
            textDecoration: 'none',
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              flexShrink: 0,
              borderRadius: 10,
              background: 'var(--tile-peach-bg)',
              color: 'var(--tile-peach-ic)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7 3h7l5 5v13H7z" />
              <path d="M14 3v5h5" />
            </svg>
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {m.file_name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>PDF · {formatSize(m.size_bytes)}</div>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>Open</span>
        </a>
      ))}

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo"
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0, 0, 0, 0.88)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            cursor: 'zoom-out',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.url}
            alt={lightbox.name}
            style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }}
          />
          <button
            onClick={() => setLightbox(null)}
            aria-label="Close photo"
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              width: 40,
              height: 40,
              padding: 0,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.18)',
              color: '#FFFFFF',
              fontSize: 20,
              lineHeight: '40px',
            }}
          >
            ✕
          </button>
        </div>
      )}
    </section>
  );
}