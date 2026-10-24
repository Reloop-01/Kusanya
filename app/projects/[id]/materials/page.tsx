'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import PageHero from '@/components/PageHero';

const BUCKET = 'project-media';
const MAX_FILES = 10;
const MB = 1024 * 1024;

type Kind = 'image' | 'video' | 'document';

type MediaItem = {
  id: string;
  kind: Kind;
  file_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

const ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/webm,application/pdf';

function kindOf(mime: string): Kind | null {
  if (mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp') return 'image';
  if (mime === 'video/mp4' || mime === 'video/webm') return 'video';
  if (mime === 'application/pdf') return 'document';
  return null;
}

function extensionOf(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'video/mp4':
      return 'mp4';
    case 'video/webm':
      return 'webm';
    default:
      return 'pdf';
  }
}

function formatSize(bytes: number): string {
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Shrinks a photo to at most 1600 pixels on its longest side and saves it as a JPEG.
// Re-saving also removes hidden data such as the GPS location.
async function shrinkImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return file;

    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    if (!blob) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

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
  const [items, setItems] = useState<MediaItem[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploadStatus, setUploadStatus] = useState('');
  const [problems, setProblems] = useState<string[]>([]);

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

    const { data: project } = await supabase.from('projects').select('title').eq('id', projectId).single();
    setProjectTitle(project?.title ?? '');

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
  }, [projectId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleFiles(fileList: FileList | null) {
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
      const original = files[i];
      setUploadStatus(`Uploading ${i + 1} of ${files.length}…`);

      const kind = kindOf(original.type);
      if (!kind) {
        issues.push(`"${original.name}" is not a supported file type. Use JPG, PNG, WebP, MP4, WebM or PDF.`);
        continue;
      }

      if (kind === 'image' && original.size > 25 * MB) {
        issues.push(`"${original.name}" is too large (${formatSize(original.size)}). Photos can be up to 25 MB.`);
        continue;
      }
      if (kind === 'video' && original.size > 25 * MB) {
        issues.push(`"${original.name}" is too large (${formatSize(original.size)}). Videos can be up to 25 MB.`);
        continue;
      }
      if (kind === 'document' && original.size > 10 * MB) {
        issues.push(`"${original.name}" is too large (${formatSize(original.size)}). PDFs can be up to 10 MB.`);
        continue;
      }

      const file = kind === 'image' ? await shrinkImage(original) : original;
      if (kind === 'image' && file.size > 5 * MB) {
        issues.push(`"${original.name}" is still over 5 MB after shrinking. Please choose a smaller photo.`);
        continue;
      }

      const storagePath = `${projectId}/${crypto.randomUUID()}.${extensionOf(file.type)}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        issues.push(`Could not upload "${original.name}": ${uploadError.message}`);
        continue;
      }

      const { error: insertError } = await supabase.from('project_media').insert({
        project_id: projectId,
        kind,
        file_name: original.name,
        storage_path: storagePath,
        mime_type: file.type,
        size_bytes: file.size,
      });

      if (insertError) {
        // Tidy up: remove the file we just uploaded, since it could not be listed.
        await supabase.storage.from(BUCKET).remove([storagePath]);
        issues.push(`Could not save "${original.name}": ${insertError.message}`);
      }
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
    return (
      <main style={{ maxWidth: 600, margin: '60px auto', padding: 24 }}>
        <p>Loading...</p>
      </main>
    );
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
    <main style={{ paddingBottom: 40 }}>
      <PageHero
        title="Project materials"
        subtitle={projectTitle}
        backHref={`/projects/${projectId}`}
        backLabel="← Back to project"
      />

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 22px' }}>
        {/* Privacy warning */}
        <div
          style={{
            marginTop: 22,
            background: 'var(--tile-sand-bg)',
            color: 'var(--tile-sand-ic)',
            borderRadius: 14,
            padding: '12px 14px',
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <strong>Before you upload:</strong> everything here can be seen by anyone who can open the project page.
          Don&apos;t upload ID documents, medical records or other private details.
        </div>

        {/* Upload */}
        <div className="card" style={{ marginTop: 16, borderRadius: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-heading), sans-serif', fontWeight: 700, fontSize: 16 }}>
                Add photos, videos or PDFs
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                {items.length} of {MAX_FILES} used
              </div>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isFull || isUploading}
              style={{ flexShrink: 0 }}
            >
              {isUploading ? 'Uploading…' : 'Choose files'}
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            multiple
            style={{ display: 'none' }}
            onChange={(e) => handleFiles(e.target.files)}
          />

          <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: '12px 0 0', lineHeight: 1.5 }}>
            Photos (JPG, PNG, WebP) are shrunk automatically and hidden location data is removed. PDFs can be up to
            10 MB. Short videos (MP4, WebM) can be up to 25 MB.
          </p>

          {isUploading && <p style={{ fontSize: 13, fontWeight: 600, margin: '10px 0 0' }}>{uploadStatus}</p>}
        </div>

        {/* Problems */}
        {problems.length > 0 && (
          <div
            role="alert"
            style={{
              marginTop: 14,
              border: '1px solid var(--color-danger)',
              borderRadius: 14,
              padding: '10px 14px',
              fontSize: 13,
              color: 'var(--color-danger)',
              lineHeight: 1.5,
            }}
          >
            {problems.map((p, i) => (
              <div key={i}>{p}</div>
            ))}
          </div>
        )}

        {/* List */}
        <h2 style={{ margin: '24px 0 12px', fontSize: 16 }}>Your materials</h2>

        {items.length === 0 && (
          <p className="muted-text" style={{ fontSize: 13 }}>
            Nothing here yet. Add a photo, a short video or a PDF to help people understand what you are raising money
            for. The first one you add becomes the cover shown on the Discover page.
          </p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {items.map((item, index) => (
            <div
              key={item.id}
              style={{
                position: 'relative',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-track)',
                borderRadius: 14,
                overflow: 'hidden',
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
    </main>
  );
}