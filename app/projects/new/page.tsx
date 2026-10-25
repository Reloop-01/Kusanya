'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import PageHeader from '@/components/PageHeader';
import { daysLeftLabel } from '@/components/ProjectProgress';
import { ACCEPT, MAX_FILES, MediaKind, checkFile, formatSize, kindOf, uploadProjectFile } from '@/lib/mediaUpload';

function slugify(text: string) {
  const base = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `${base}-${randomSuffix}`;
}

// "2026-10-31" for a date n days from today (local time)
function dateInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

const AMOUNT_CHIPS = [10000, 50000, 100000, 500000];
const DEADLINE_CHIPS = [30, 60, 90];

const VISIBILITY_OPTIONS = [
  {
    value: 'private',
    title: 'Private',
    text: 'Only people you add can see it. There is no public link.',
    icon: (
      <>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </>
    ),
  },
  {
    value: 'link_only',
    title: 'Anyone with the link',
    text: 'Anyone with the link or QR code can see it. It is not listed on Discover.',
    icon: (
      <>
        <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
        <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
      </>
    ),
  },
  {
    value: 'public',
    title: 'Public',
    text: 'Listed on Discover, so anyone can find and support it.',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
      </>
    ),
  },
];

type PendingFile = {
  id: string;
  file: File;
  kind: MediaKind;
  previewUrl: string | null;
};

function Section({
  number,
  title,
  hint,
  delay,
  children,
}: {
  number: number;
  title: string;
  hint?: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <section className="card k-rise" style={{ borderRadius: 20, padding: 18, animationDelay: `${delay}s` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span
          style={{
            width: 28,
            height: 28,
            flexShrink: 0,
            borderRadius: '50%',
            background: 'var(--color-accent)',
            color: '#0B2B27',
            fontFamily: 'var(--font-heading), sans-serif',
            fontWeight: 700,
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {number}
        </span>
        <div>
          <h2 style={{ margin: 0, fontSize: 16 }}>{title}</h2>
          {hint && <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{hint}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>
      {label}
      {hint && <span style={{ fontWeight: 400, color: 'var(--color-muted)' }}> · {hint}</span>}
      <div style={{ marginTop: 6, fontWeight: 400 }}>{children}</div>
    </label>
  );
}

function QuickChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        height: 34,
        padding: '0 14px',
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 600,
        border: `1.5px solid ${selected ? 'var(--color-primary)' : 'var(--color-input-border)'}`,
        background: selected ? 'var(--color-primary)' : 'var(--color-surface)',
        color: selected ? 'var(--color-on-primary)' : 'var(--color-ink)',
      }}
    >
      {label}
    </button>
  );
}

export default function NewProjectPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [visibility, setVisibility] = useState('link_only');
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [fileProblems, setFileProblems] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ projectId: string; issues: string[] } | null>(null);

  // Remember the preview links so they can be released when the page closes.
  const filesRef = useRef<PendingFile[]>([]);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);
  useEffect(() => {
    return () => {
      filesRef.current.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
    };
  }, []);

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    const problems: string[] = [];
    const accepted: PendingFile[] = [];
    let room = MAX_FILES - files.length;

    for (const file of incoming) {
      const problem = checkFile(file);
      if (problem) {
        problems.push(problem);
        continue;
      }
      if (room <= 0) {
        problems.push(`A project can have up to ${MAX_FILES} files. "${file.name}" was not added.`);
        continue;
      }
      const kind = kindOf(file.type) as MediaKind;
      accepted.push({
        id: crypto.randomUUID(),
        file,
        kind,
        previewUrl: kind === 'image' ? URL.createObjectURL(file) : null,
      });
      room -= 1;
    }

    setFileProblems(problems);
    if (accepted.length > 0) setFiles((current) => [...current, ...accepted]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeFile(id: string) {
    setFiles((current) => {
      const target = current.find((f) => f.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((f) => f.id !== id);
    });
  }

  function makeCover(id: string) {
    setFiles((current) => {
      const target = current.find((f) => f.id === id);
      if (!target) return current;
      return [target, ...current.filter((f) => f.id !== id)];
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const amount = Number(targetAmount);
    if (!amount || amount < 1) {
      setError('Please enter a target amount of at least 1.');
      return;
    }
    if (deadline && deadline < dateInDays(0)) {
      setError('The deadline cannot be in the past.');
      return;
    }

    setLoading(true);
    setStatus('Creating your project…');

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setError('You must be logged in to create a project.');
      setLoading(false);
      setStatus('');
      return;
    }

    const slug = slugify(title);

    const { data: project, error: insertError } = await supabase
      .from('projects')
      .insert({
        organizer_id: userData.user.id,
        title: title.trim(),
        purpose,
        target_amount: amount,
        deadline: deadline || null,
        visibility,
        status: 'active',
        slug,
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      setStatus('');
      return;
    }

    const { error: memberError } = await supabase.from('project_members').insert({
      project_id: project.id,
      user_id: userData.user.id,
      role: 'organizer',
    });

    if (memberError) {
      setError(memberError.message);
      setLoading(false);
      setStatus('');
      return;
    }

    // The files can only be added once you are the organizer, so they go last.
    const issues: string[] = [];
    for (let i = 0; i < files.length; i++) {
      setStatus(`Uploading file ${i + 1} of ${files.length}…`);
      const problem = await uploadProjectFile(project.id, files[i].file);
      if (problem) issues.push(problem);
    }

    files.forEach((f) => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });

    setLoading(false);
    setStatus('');

    if (issues.length === 0) {
      router.push(`/projects/${project.id}`);
      return;
    }
    setResult({ projectId: project.id, issues });
  }

  // ----- After creating: some files did not upload -----
  if (result) {
    return (
      <main style={{ maxWidth: 560, margin: '0 auto', padding: '24px 22px 8px' }}>
        <div className="card k-rise" style={{ borderRadius: 20, padding: 20 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'var(--tile-mint-bg)',
              color: 'var(--tile-mint-ic)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Your project is live</h1>
          <p className="muted-text" style={{ margin: '6px 0 14px', fontSize: 14 }}>
            It was created, but some files could not be added. You can add them again from Project materials.
          </p>
          <div
            role="alert"
            style={{
              border: '1px solid var(--color-danger)',
              borderRadius: 14,
              padding: '10px 14px',
              fontSize: 13,
              color: 'var(--color-danger)',
              lineHeight: 1.5,
              marginBottom: 16,
            }}
          >
            {result.issues.map((issue, i) => (
              <div key={i}>{issue}</div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href={`/projects/${result.projectId}`}>
              <button>Open the project</button>
            </a>
            <a href={`/projects/${result.projectId}/materials`}>
              <button
                style={{
                  background: 'transparent',
                  color: 'var(--color-primary)',
                  border: '1.5px solid var(--color-primary)',
                }}
              >
                Add materials again
              </button>
            </a>
          </div>
        </div>
      </main>
    );
  }

  const amountNumber = Number(targetAmount);
  const visibilityTitle = VISIBILITY_OPTIONS.find((o) => o.value === visibility)?.title ?? '';
  const coverPreview = files.find((f) => f.kind === 'image' && f.previewUrl)?.previewUrl ?? null;
  const previewDays = deadline ? daysLeftLabel(deadline) : null;

  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: '24px 22px 8px' }}>
      <PageHeader
        backHref="/projects"
        backLabel="Back to projects"
        title="Start a new project"
        subtitle="Set up a shareable fund for your group. It takes about two minutes."
      />

      <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* ---------- 1. THE BASICS ---------- */}
        <Section number={1} title="The basics" delay={0.05}>
          <Field label="Project title">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Mama Wanjiku's medical fund"
              required
              style={{ width: '100%' }}
            />
          </Field>
          <Field label="What is the money for?" hint="optional">
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={4}
              placeholder="Tell people who this is for and why it matters. Clear stories get more support."
              style={{ width: '100%' }}
            />
          </Field>
        </Section>

        {/* ---------- 2. YOUR GOAL ---------- */}
        <Section number={2} title="Your goal" delay={0.1}>
          <Field label="Target amount">
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 12,
                  top: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--color-muted)',
                  pointerEvents: 'none',
                }}
              >
                KES
              </span>
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                required
                style={{ width: '100%', paddingLeft: 52 }}
              />
            </div>
          </Field>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {AMOUNT_CHIPS.map((amount) => (
              <QuickChip
                key={amount}
                label={amount.toLocaleString()}
                selected={amountNumber === amount}
                onClick={() => setTargetAmount(String(amount))}
              />
            ))}
          </div>
          {amountNumber > 0 && (
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-primary)' }}>
              Goal: KES {amountNumber.toLocaleString()}
            </div>
          )}

          <Field label="Deadline" hint="optional">
            <input
              type="date"
              value={deadline}
              min={dateInDays(0)}
              onChange={(e) => setDeadline(e.target.value)}
              style={{ width: '100%' }}
            />
          </Field>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {DEADLINE_CHIPS.map((days) => (
              <QuickChip
                key={days}
                label={`+${days} days`}
                selected={deadline === dateInDays(days)}
                onClick={() => setDeadline(dateInDays(days))}
              />
            ))}
            <QuickChip label="No deadline" selected={deadline === ''} onClick={() => setDeadline('')} />
          </div>
        </Section>

        {/* ---------- 3. WHO CAN SEE IT ---------- */}
        <Section number={3} title="Who can see it" delay={0.15}>
          <div role="radiogroup" aria-label="Who can see this project" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {VISIBILITY_OPTIONS.map((option) => {
              const selected = visibility === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setVisibility(option.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    padding: '12px 14px',
                    textAlign: 'left',
                    borderRadius: 16,
                    border: `2px solid ${selected ? 'var(--color-primary)' : 'var(--color-track)'}`,
                    background: selected ? 'var(--tile-mint-bg)' : 'var(--color-surface)',
                    color: 'var(--color-ink)',
                    fontWeight: 400,
                  }}
                >
                  <span
                    style={{
                      width: 40,
                      height: 40,
                      flexShrink: 0,
                      borderRadius: 12,
                      background: selected ? 'var(--color-primary)' : 'var(--color-track)',
                      color: selected ? 'var(--color-on-primary)' : 'var(--color-muted)',
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
                      {option.icon}
                    </svg>
                  </span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{option.title}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)', marginTop: 2, lineHeight: 1.4 }}>
                      {option.text}
                    </span>
                  </span>
                  {selected && (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--color-primary)"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      style={{ animation: 'k-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both' }}
                    >
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </Section>

        {/* ---------- 4. MATERIALS ---------- */}
        <Section
          number={4}
          title="Photos, videos & documents"
          hint="Optional. You can also add these later."
          delay={0.2}
        >
          <div
            style={{
              background: 'var(--tile-sand-bg)',
              color: 'var(--tile-sand-ic)',
              borderRadius: 14,
              padding: '10px 14px',
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            {visibility === 'private'
              ? 'Only members of the project will see these.'
              : 'Anyone who can open the project page can see these. Don’t upload ID documents, medical records or other private details.'}
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
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
              addFiles(e.dataTransfer.files);
            }}
            style={{
              border: `2px dashed ${dragging ? 'var(--color-primary)' : 'var(--color-input-border)'}`,
              background: dragging ? 'var(--tile-mint-bg)' : 'transparent',
              borderRadius: 16,
              padding: '22px 16px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease, border-color 0.2s ease',
            }}
          >
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 16V5M7 9l5-5 5 5" />
              <path d="M5 16v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3" />
            </svg>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>Tap to choose files, or drag them here</div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4, lineHeight: 1.5 }}>
              Photos (JPG, PNG, WebP) are shrunk automatically. PDFs up to 10 MB, short videos up to 25 MB. Up to{' '}
              {MAX_FILES} files.
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            multiple
            style={{ display: 'none' }}
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />

          {fileProblems.length > 0 && (
            <div
              role="alert"
              style={{
                border: '1px solid var(--color-danger)',
                borderRadius: 14,
                padding: '10px 14px',
                fontSize: 13,
                color: 'var(--color-danger)',
                lineHeight: 1.5,
              }}
            >
              {fileProblems.map((p, i) => (
                <div key={i}>{p}</div>
              ))}
            </div>
          )}

          {files.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
              {files.map((f, index) => (
                <div
                  key={f.id}
                  className="k-rise"
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
                        top: 6,
                        left: 6,
                        zIndex: 1,
                        background: 'var(--color-accent)',
                        color: '#0B2B27',
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 999,
                      }}
                    >
                      Cover
                    </span>
                  )}
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '4 / 3',
                      background: 'var(--color-track)',
                      color: 'var(--color-muted)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      overflow: 'hidden',
                    }}
                  >
                    {f.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={f.previewUrl}
                        alt={f.file.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      <>
                        <svg
                          width="26"
                          height="26"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          {f.kind === 'video' ? (
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
                        {f.kind === 'video' ? 'Video' : 'PDF'}
                      </>
                    )}
                  </div>
                  <div style={{ padding: '6px 8px 8px' }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={f.file.name}
                    >
                      {f.file.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--color-muted)' }}>{formatSize(f.file.size)}</div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => makeCover(f.id)}
                          style={{
                            background: 'transparent',
                            color: 'var(--color-primary)',
                            padding: 0,
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          Make cover
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFile(f.id)}
                        style={{
                          background: 'transparent',
                          color: 'var(--color-danger)',
                          padding: 0,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ---------- LIVE PREVIEW ---------- */}
        <section className="k-rise" style={{ animationDelay: '0.25s' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-muted)', margin: '0 0 8px 4px', letterSpacing: 0.5 }}>
            HOW YOUR PROJECT WILL LOOK
          </div>
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-track)',
              borderRadius: 18,
              overflow: 'hidden',
              boxShadow: '0 6px 20px var(--color-shadow)',
            }}
          >
            <div
              style={{
                width: '100%',
                aspectRatio: '16 / 8',
                background: 'var(--tile-mint-bg)',
                color: 'var(--tile-mint-ic)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {coverPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverPreview}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <svg
                  width="34"
                  height="34"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="4" y="5" width="16" height="14" rx="2" />
                  <circle cx="9" cy="10" r="1.5" />
                  <path d="M4 17l5-4 4 3 3-2 4 3" />
                </svg>
              )}
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ fontFamily: 'var(--font-heading), sans-serif', fontWeight: 700, fontSize: 17 }}>
                {title.trim() || 'Your project title'}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
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
                  {visibilityTitle}
                </span>
                {previewDays && (
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
                    {previewDays}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
                <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--color-track)' }} />
                <span style={{ fontSize: 12, fontWeight: 700 }}>0%</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 6 }}>
                KES 0 of {amountNumber > 0 ? amountNumber.toLocaleString() : '—'}
              </div>
            </div>
          </div>
        </section>

        {error && (
          <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 13, margin: 0 }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} style={{ width: '100%', height: 50, fontSize: 15 }}>
          {loading ? status || 'Creating…' : 'Create project'}
        </button>
      </form>
    </main>
  );
}