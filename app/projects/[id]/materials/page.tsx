'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import PageHeader from '@/components/PageHeader';
import { Section, Notice } from '@/components/ui';
import { ACCEPT, BUCKET, MAX_FILES, MediaKind, formatSize, uploadProjectFile } from '@/lib/mediaUpload';

type MediaItem = {
  id: string;
  kind: MediaKind;
  file_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

function Preview({ item, url }: { item: MediaItem; url: string | undefined }) {
  const box: React.CSSProperties = {
    width: '100%',
    aspectRatio: '4 / 3',
    background: 'var(--color-track)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    color: 'var(--color-muted)',
    fontSize: 12,
    fontWeight: 600,
    overflow: 'hidden',
  };

  if (item.kind === 'image' && url) {
    return (
      <div style={box}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={item.file_name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    );
  }

  return (
    <div style={box}>
      <svg
        width="30"
        height="30"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {item.kind === 'video' ? (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M10 8.5l6 3.5-6 3.5z" />
          </>
        ) : (
          <>
            <path d="M7 3h7l5 5v13H7z" />
            <path d="M14 3v5h5" />
          </>
        )}
      </svg>
      {item.kind === 'video' ? 'Video' : 'PDF'}
    </div>
  );
}

export default function MaterialsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [projectTitle, setProjectTitle] = useState('');
  const [visibility, setVisibility] = useState('link_only');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploadStatus, setUploadStatus] = useState('');
  const [problems, setProblems] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  const loadData = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.push('/login');
      return;
    }

    const { data: membership } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userData.user.id)
      .maybeSingle();

    const organizer = membership?.role === 'organizer';
    setIsOrganizer(organizer);
    setCheckingAccess(false);
    if (!organizer) return;

    const { data: project } = await supabase
      .from('projects')
      .select('title, visibility')
      .eq('id', projectId)
      .single();
    setProjectTitle(project?.title ?? '');
    setVisibility(project?.visibility ?? 'link_only');

    const { data: rows } = await supabase
      .from('project_media')
      .select('id, kind, file_name, storage_path, mime_type, size_bytes, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    const list = (rows ?? []) as MediaItem[];
    setItems(list);

    if (list.length > 0) {
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
      setUrls(map);
    } else {
      setUrls({});
    }
    setLoadingList(false);
  }, [projectId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleFiles(fileList: FileList | File[] | null) {
    if (!fileList || fileList.length === 0) return;
    setProblems([]);

    const issues: string[] = [];
    let files = Array.from(fileList);

    const slotsLeft = MAX_FILES - items.length;
    if (files.length > slotsLeft) {
      issues.push(
        slotsLeft <= 0
          ? `This project already has ${MAX_FILES} files. Delete one before adding another.`
          : `You can add ${slotsLeft} more file${slotsLeft === 1 ? '' : 's'}. Only the first ${slotsLeft} will be uploaded.`
      );
      files = files.slice(0, Math.max(0, slotsLeft));
    }

    for (let i = 0; i < files.length; i++) {
      setUploadStatus(`Uploading ${i + 1} of ${files.length}…`);
      const problem = await uploadProjectFile(projectId, files[i]);
      if (problem) issues.push(problem);
    }

    setUploadStatus('');
    setProblems(issues);
    if (fileInputRef.current) fileInputRef.current.value = '';
    await loadData();
  }

  async function handleDelete(item: MediaItem) {
    const sure = window.confirm(`Delete "${item.file_name}"? This cannot be undone.`);
    if (!sure) return;

    setProblems([]);
    const { error: deleteError } = await supabase.from('project_media').delete().eq('id', item.id);
    if (deleteError) {
      setProblems([`Could not delete "${item.file_name}": ${deleteError.message}`]);
      return;
    }
    await supabase.storage.from(BUCKET).remove([item.storage_path]);
    await loadData();
  }

  if (checkingAccess) {
    return <main style={{ maxWidth: 600, margin: '60px auto', padding: 24 }}><p>Loading...</p></main>;
  }

  if (!isOrganizer) {
    return (
      <main style={{ maxWidth: 600, margin: '60px auto', padding: 24 }}>
        <h1>Not authorized</h1>
        <p style={{ marginBottom: 16 }}>Only the project organizer can manage project materials.</p>
        <a href={`/projects/${projectId}`}>Back to project</a>
      </main>
    );
  }

  const isFull = items.length >= MAX_FILES;
  const isUploading = uploadStatus !== '';

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '24px 22px 8px' }}>
      <PageHeader
        backHref={`/projects/${projectId}`}
        backLabel="Back to project"
        title="Project materials"
        subtitle={projectTitle}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="k-rise" style={{ animationDelay: '0.03s' }}>
          <Notice kind="info">
            {visibility === 'private' ? (
              <>Only members of this project can see these files.</>
            ) : (
              <>
                <strong>Before you upload:</strong> everything here can be seen by anyone who can open the project
                page. Don&apos;t upload ID documents, medical records or other private details.
              </>
            )}
          </Notice>
        </div>

        {/* ---------- UPLOAD ---------- */}
        <Section
          title="Add photos, videos or PDFs"
          hint={`${items.length} of ${MAX_FILES} used`}
          delay={0.08}
          icon={
            <>
              <path d="M12 16V5M7 9l5-5 5 5" />
              <path d="M5 16v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3" />
            </>
          }
        >
          <div
            role="button"
            tabIndex={0}
            aria-disabled={isFull || isUploading}
            onClick={() => !isFull && !isUploading && fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !isFull && !isUploading) {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!isFull && !isUploading) handleFiles(e.dataTransfer.files);
            }}
            style={{
              border: `2px dashed ${dragging ? 'var(--color-primary)' : 'var(--color-input-border)'}`,
              background: dragging ? 'var(--tile-mint-bg)' : 'transparent',
              borderRadius: 16,
              padding: '22px 16px',
              textAlign: 'center',
              cursor: isFull || isUploading ? 'default' : 'pointer',
              opacity: isFull ? 0.6 : 1,
              transition: 'background-color 0.2s ease, border-color 0.2s ease',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {isUploading
                ? uploadStatus
                : isFull
                  ? 'This project has the most files allowed'
                  : 'Tap to choose files, or drag them here'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4, lineHeight: 1.5 }}>
              Photos (JPG, PNG, WebP) are shrunk automatically and hidden location data is removed. PDFs up to 10 MB,
              short videos (MP4, WebM) up to 25 MB.
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            multiple
            style={{ display: 'none' }}
            onChange={(e) => handleFiles(e.target.files)}
          />

          {problems.length > 0 && (
            <Notice kind="error">
              {problems.map((p, i) => (
                <div key={i}>{p}</div>
              ))}
            </Notice>
          )}
        </Section>

        {/* ---------- LIST ---------- */}
        <div>
          <h2 style={{ margin: '8px 0 12px', fontSize: 17 }}>Your materials</h2>

          {loadingList && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="k-skeleton" style={{ height: 170, borderRadius: 14 }} />
              ))}
            </div>
          )}

          {!loadingList && items.length === 0 && (
            <p className="muted-text" style={{ fontSize: 13 }}>
              Nothing here yet. Add a photo, a short video or a PDF to help people understand what you are raising
              money for. The first one you add becomes the cover shown on the Discover page.
            </p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {items.map((item, index) => (
              <div
                key={item.id}
                className="k-rise"
                style={{
                  position: 'relative',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-track)',
                  borderRadius: 14,
                  overflow: 'hidden',
                  animationDelay: `${Math.min(index * 0.05, 0.4)}s`,
                }}
              >
                {index === 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      zIndex: 1,
                      background: 'var(--color-accent)',
                      color: '#0B2B27',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 999,
                    }}
                  >
                    Cover
                  </span>
                )}
                <Preview item={item} url={urls[item.storage_path]} />
                <div style={{ padding: '8px 10px 10px' }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={item.file_name}
                  >
                    {item.file_name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{formatSize(item.size_bytes)}</div>
                  <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
                    {urls[item.storage_path] && (
                      <a
                        href={urls[item.storage_path]}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 12, fontWeight: 600 }}
                      >
                        Open
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(item)}
                      style={{
                        background: 'transparent',
                        color: 'var(--color-danger)',
                        padding: 0,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}