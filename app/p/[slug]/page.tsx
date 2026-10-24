'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  FundingRing,
  MilestoneTrack,
  capitalize,
  daysLeftLabel,
  formatDeadline,
} from '@/components/ProjectProgress';

type Project = {
  id: string;
  title: string;
  purpose: string | null;
  target_amount: number;
  currency: string;
  deadline: string | null;
  status: string;
  payment_instructions: string | null;
};

type MediaItem = {
  id: string;
  kind: 'image' | 'video' | 'document';
  file_name: string;
  storage_path: string;
  size_bytes: number;
};

const BUCKET = 'project-media';

function formatSize(bytes: number): string {
  const mb = 1024 * 1024;
  if (bytes >= mb) return `${(bytes / mb).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Hero styling that differs between light and dark mode.
// (We will move these into globals.css during the animations step.)
const heroCss = `
  .k-sp-hero-bg {
    background: var(--color-hero);
    border-radius: 0 0 28px 28px;
    overflow: hidden;
  }
  .k-sp-ring { stroke-opacity: 0.5; }
  .k-sp-glow { display: none; }

  :root[data-theme="dark"] .k-sp-hero-bg {
    background: #145349;
    box-shadow: 0 1px 0 #2F7A6D, 0 14px 34px rgba(43, 196, 176, 0.14);
  }
  :root[data-theme="dark"] .k-sp-ring { stroke-opacity: 0.3; }
  :root[data-theme="dark"] .k-sp-glow { display: inline; }
`;

export default function PublicProjectPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [project, setProject] = useState<Project | null>(null);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [copied, setCopied] = useState(false);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    async function loadMedia(projectId: string) {
      const { data: rows } = await supabase
        .from('project_media')
        .select('id, kind, file_name, storage_path, size_bytes')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      const list = (rows ?? []) as MediaItem[];
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
      setMediaUrls(map);
    }

    async function load() {
      const { data } = await supabase
        .from('projects')
        .select('id, title, purpose, target_amount, currency, deadline, status, payment_instructions')
        .eq('slug', slug)
        .single();

      setProject(data);

      const { data: totalData } = await supabase.rpc('get_project_total', {
        project_slug: slug,
      });
      setTotal(totalData ?? 0);

      const { data: userData } = await supabase.auth.getUser();
      if (userData.user && data) {
        const { data: membership } = await supabase
          .from('project_members')
          .select('role')
          .eq('project_id', data.id)
          .eq('user_id', userData.user.id)
          .maybeSingle();
        setIsMember(!!membership);
      }

      setLoading(false);

      // The materials load after the page is already showing.
      if (data) loadMedia(data.id);
    }
    load();
  }, [slug]);

  // Close the full-screen photo with the Escape key.
  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightbox(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  async function handleShare() {
    if (!project) return;
    const url = `${window.location.origin}/p/${slug}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: project.title,
          text: `Support "${project.title}" on Kusanya`,
          url,
        });
        return;
      } catch (err) {
        // The person closed the share sheet: nothing more to do.
        if ((err as DOMException).name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // If copying is blocked there is nothing else to do here.
    }
  }

  function scrollToPaymentInstructions() {
    document.getElementById('how-to-contribute')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (loading) {
    return <main style={{ maxWidth: 480, margin: '60px auto', padding: 24 }}><p>Loading...</p></main>;
  }

  if (!project) {
    return (
      <main style={{ maxWidth: 480, margin: '60px auto', padding: 24 }}>
        <h1>Project not found</h1>
        <p style={{ marginBottom: 16 }}>This link may be incorrect, or the project may be private.</p>
        <a href="/discover">Discover public projects</a>
        {' · '}
        <a href="/">Go to Kusanya</a>
      </main>
    );
  }

  const percent =
    project.target_amount > 0 ? Math.min(100, Math.round((total / project.target_amount) * 100)) : 0;
  const isFullyFunded = project.target_amount > 0 && total >= project.target_amount;
  const isActive = project.status === 'active';

  // Days left for live projects, the status for closed ones.
  const chipText = isActive
    ? project.deadline
      ? daysLeftLabel(project.deadline)
      : null
    : capitalize(project.status);
  const chipStyle: React.CSSProperties = isActive
    ? { background: 'var(--tile-peach-bg)', color: 'var(--tile-peach-ic)' }
    : { background: 'var(--color-track)', color: 'var(--color-muted)' };

  const hasPaymentInstructions = !!project.payment_instructions;
  const showContribute = isActive && hasPaymentInstructions;

  // Materials, grouped by type (only those whose link was created successfully).
  const available = media.filter((m) => mediaUrls[m.storage_path]);
  const images = available.filter((m) => m.kind === 'image');
  const videos = available.filter((m) => m.kind === 'video');
  const documents = available.filter((m) => m.kind === 'document');
  const featuredImage = images[0];
  const otherImages = images.slice(1);

  const bigButton: React.CSSProperties = {
    flex: 1,
    height: 46,
    borderRadius: 999,
    fontSize: 15,
    fontWeight: 600,
    fontFamily: 'var(--font-body), sans-serif',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  };

  const exploreButton: React.CSSProperties = {
    flex: '1 1 170px',
    height: 44,
    borderRadius: 999,
    border: '1.5px solid var(--color-primary)',
    color: 'var(--color-primary)',
    fontSize: 14,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
  };

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
    <main style={{ paddingBottom: 40 }}>
      <style>{heroCss}</style>

      {/* ---------- HERO ---------- */}
      <section style={{ position: 'relative' }}>
        <div className="k-sp-hero-bg" style={{ position: 'absolute', inset: 0 }}>
          <svg
            width="150"
            height="150"
            viewBox="0 0 170 170"
            style={{ position: 'absolute', right: -30, top: -34 }}
            aria-hidden="true"
          >
            <circle className="k-sp-ring" cx="100" cy="70" r="58" fill="none" stroke="#F7931E" strokeWidth="2" />
            <circle className="k-sp-glow" cx="100" cy="70" r="58" fill="#F7931E" fillOpacity="0.14" />
            <circle cx="100" cy="70" r="38" fill="#F7931E" />
            <circle cx="100" cy="70" r="16" fill="#FFD27A" />
          </svg>
        </div>

        <div style={{ position: 'relative', maxWidth: 600, margin: '0 auto', padding: '18px 22px 40px' }}>
          <a
            href="/"
            style={{
              display: 'inline-block',
              padding: '4px 0',
              fontFamily: 'var(--font-heading), sans-serif',
              fontWeight: 700,
              fontSize: 16,
              color: 'var(--color-hero-sub)',
              textDecoration: 'none',
            }}
          >
            Kusanya
          </a>
          <h1 style={{ margin: '6px 0 0', fontSize: 26, lineHeight: 1.2, color: '#FFFFFF', maxWidth: '85%' }}>
            {project.title}
          </h1>
        </div>
      </section>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 22px' }}>
        {/* ---------- FLOATING CARD: ring and milestones ---------- */}
        <div
          className="card"
          style={{
            position: 'relative',
            zIndex: 1,
            marginTop: -26,
            borderRadius: 20,
            textAlign: 'center',
            boxShadow: '0 10px 30px var(--color-shadow)',
          }}
        >
          <FundingRing percent={percent} />

          <div style={{ fontSize: 14, margin: '4px 0 2px' }}>
            <strong>
              {project.currency} {total.toLocaleString()}
            </strong>{' '}
            <span style={{ color: 'var(--color-muted)' }}>of {project.target_amount.toLocaleString()}</span>
          </div>
          {project.deadline && (
            <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
              Deadline: {formatDeadline(project.deadline)}
            </div>
          )}

          {isFullyFunded && (
            <div
              style={{
                background: 'var(--color-primary)',
                color: 'var(--color-on-primary)',
                borderRadius: 12,
                padding: '10px 14px',
                marginTop: 14,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              🎉 Fully funded!
            </div>
          )}

          <MilestoneTrack percent={percent} />

          {chipText && (
            <span
              style={{
                ...chipStyle,
                display: 'inline-block',
                fontSize: 12,
                fontWeight: 600,
                padding: '5px 12px',
                borderRadius: 999,
              }}
            >
              {chipText}
            </span>
          )}
        </div>

        {/* ---------- CONTRIBUTE + SHARE ---------- */}
        <div style={{ display: 'flex', gap: 10, paddingTop: 16 }}>
          {showContribute && (
            <button onClick={scrollToPaymentInstructions} style={{ ...bigButton, border: 'none' }}>
              Contribute
            </button>
          )}
          <button
            onClick={handleShare}
            style={{
              ...bigButton,
              background: 'var(--color-surface)',
              color: 'var(--color-primary)',
              border: '2px solid var(--color-primary)',
            }}
          >
            {copied ? 'Link copied!' : 'Share'}
          </button>
        </div>

        {/* ---------- ABOUT ---------- */}
        {project.purpose && (
          <p style={{ marginTop: 18, fontSize: 14, lineHeight: 1.6, color: 'var(--color-ink)', whiteSpace: 'pre-line' }}>
            {project.purpose}
          </p>
        )}

        {/* ---------- MATERIALS ---------- */}
        {available.length > 0 && (
          <section style={{ marginTop: 22 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Photos, videos &amp; documents</h2>

            {featuredImage && (
              <button
                style={{ ...imageButton, marginBottom: otherImages.length > 0 ? 10 : 0 }}
                onClick={() => setLightbox({ url: mediaUrls[featuredImage.storage_path], name: featuredImage.file_name })}
                aria-label="View photo larger"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mediaUrls[featuredImage.storage_path]}
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
                    onClick={() => setLightbox({ url: mediaUrls[m.storage_path], name: m.file_name })}
                    aria-label="View photo larger"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={mediaUrls[m.storage_path]}
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
                src={mediaUrls[m.storage_path]}
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
                href={mediaUrls[m.storage_path]}
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
          </section>
        )}

        {/* ---------- HOW TO CONTRIBUTE (or a closed notice) ---------- */}
        {!isActive && (
          <p className="muted-text" style={{ marginTop: 18, fontSize: 13 }}>
            This project is {project.status} and is no longer accepting contributions.
          </p>
        )}

        {isActive && hasPaymentInstructions && (
          <div
            id="how-to-contribute"
            style={{
              marginTop: 22,
              background: 'var(--tile-mint-bg)',
              borderRadius: 16,
              padding: 14,
              scrollMarginTop: 16,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-heading), sans-serif',
                fontWeight: 700,
                fontSize: 15,
                color: 'var(--color-primary)',
                marginBottom: 4,
              }}
            >
              How to contribute
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-line' }}>
              {project.payment_instructions}
            </div>
            <p className="muted-text" style={{ marginTop: 8 }}>
              After paying, let the organizer know so they can confirm your contribution.
            </p>
          </div>
        )}

        {/* ---------- MEMBER LINK ---------- */}
        {isMember && (
          <a
            href={`/projects/${project.id}`}
            style={{
              display: 'block',
              marginTop: 16,
              padding: '14px 16px',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-track)',
              borderRadius: 14,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            You&apos;re a member — go to the full project →
          </a>
        )}

        {/* ---------- KEEP EXPLORING ---------- */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 28 }}>
          <a href="/discover" style={exploreButton}>
            Discover more projects
          </a>
          <a href="/" style={exploreButton}>
            About Kusanya
          </a>
        </div>

        {/* ---------- TRUST NOTE ---------- */}
        <p className="muted-text" style={{ marginTop: 22, textAlign: 'center', fontSize: 12 }}>
          Kusanya records contributions and approvals. It never holds the money.
        </p>
      </div>

      {/* ---------- FULL-SCREEN PHOTO ---------- */}
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
    </main>
  );
}