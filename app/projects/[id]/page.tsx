'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { QRCodeSVG } from 'qrcode.react';
import {
  FundingRing,
  MilestoneTrack,
  capitalize,
  daysLeftLabel,
  formatDeadline,
} from '@/components/ProjectProgress';
import MaterialsGallery from '@/components/MaterialsGallery';

type ProjectInfo = {
  title: string;
  purpose: string | null;
  target_amount: number;
  currency: string;
  deadline: string | null;
  status: string;
  slug: string;
  payment_instructions: string | null;
  visibility: string;
};

type Supporter = {
  key: string;
  initials: string | null; // null = anonymous (shown as a plain circle)
};

// Only these roles can see who the supporters are.
// (The database rules still decide what is actually returned.)
const LEDGER_ROLES = ['organizer', 'administrator', 'auditor'];

const AVATAR_TONES = [
  { bg: 'var(--tile-sand-bg)', ink: 'var(--tile-sand-ic)' },
  { bg: 'var(--tile-sky-bg)', ink: 'var(--tile-sky-ic)' },
  { bg: 'var(--tile-peach-bg)', ink: 'var(--tile-peach-ic)' },
  { bg: 'var(--tile-mint-bg)', ink: 'var(--tile-mint-ic)' },
];

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function RowLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-track)',
        borderRadius: 14,
        color: 'var(--color-ink)',
        fontSize: 14,
        fontWeight: 600,
        textDecoration: 'none',
      }}
    >
      {label}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--color-muted)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </a>
  );
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

export default function ProjectHubPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [total, setTotal] = useState(0);
  const [available, setAvailable] = useState<number | null>(null);
  const [supporters, setSupporters] = useState<Supporter[]>([]);
  const [copied, setCopied] = useState(false);

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

    setMyRole(membership?.role ?? null);
    setCheckingAccess(false);

    if (!membership) return;

    const { data: projectData } = await supabase
      .from('projects')
      .select('title, purpose, target_amount, currency, deadline, status, slug, payment_instructions, visibility')
      .eq('id', projectId)
      .single();
    setProject(projectData);

    const { data: totalData } = await supabase.rpc('get_project_total_for_member', {
      p_project_id: projectId,
    });
    setTotal(totalData ?? 0);

    const { data: availableData } = await supabase.rpc('get_project_available_balance', {
      p_project_id: projectId,
    });
    setAvailable(availableData ?? 0);

    // Supporters: only for roles that can see the full ledger.
    if (LEDGER_ROLES.includes(membership.role)) {
      const { data: contribs } = await supabase
        .from('contributions')
        .select('contributor_name, is_anonymous, created_at')
        .eq('project_id', projectId)
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false });

      const rows = contribs ?? [];
      const keyOf = (name: string | null) => (name ?? '').trim().toLowerCase();

      // If a person ever gave anonymously, we treat them as anonymous everywhere.
      const anonymousKeys = new Set<string>();
      rows.forEach((c) => {
        if (c.is_anonymous) anonymousKeys.add(keyOf(c.contributor_name));
      });

      const seen = new Set<string>();
      const list: Supporter[] = [];
      rows.forEach((c, index) => {
        const key = keyOf(c.contributor_name) || `unnamed-${index}`;
        if (seen.has(key)) return;
        seen.add(key);
        const isAnon = anonymousKeys.has(key) || !c.contributor_name;
        list.push({ key, initials: isAnon ? null : initialsOf(c.contributor_name as string) });
      });
      setSupporters(list);
    } else {
      setSupporters([]);
    }
  }, [projectId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleShare() {
    if (!project) return;
    const url = `${window.location.origin}/p/${project.slug}`;

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
      // If copying is blocked, the QR card below still shows the link.
    }
  }

  function scrollToPaymentInstructions() {
    document.getElementById('how-to-contribute')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const canRecordContributions = myRole === 'organizer' || myRole === 'administrator';
  const isOrganizer = myRole === 'organizer';

  if (checkingAccess) {
    return <main style={{ maxWidth: 600, margin: '60px auto', padding: 24 }}><p>Loading...</p></main>;
  }

  if (!myRole || !project) {
    return (
      <main style={{ maxWidth: 600, margin: '60px auto', padding: 24 }}>
        <h1>Not authorized</h1>
        <p>You&apos;re not a member of this project.</p>
        <a href="/dashboard">Back to dashboard</a>
      </main>
    );
  }

  const percent =
    project.target_amount > 0 ? Math.min(100, Math.round((total / project.target_amount) * 100)) : 0;
  const isActive = project.status === 'active';
  const isPrivate = project.visibility === 'private';
  const visibilityLabel =
    project.visibility === 'public' ? 'Public' : isPrivate ? 'Private' : 'Link-only';

  // The chip next to the supporters: days left for live projects, status for closed ones.
  const chipText = isActive
    ? project.deadline
      ? daysLeftLabel(project.deadline)
      : null
    : capitalize(project.status);
  const chipStyle: React.CSSProperties = isActive
    ? { background: 'var(--tile-peach-bg)', color: 'var(--tile-peach-ic)' }
    : { background: 'var(--color-track)', color: 'var(--color-muted)' };

  // Contribute button: what it does depends on the project and the person's role.
  const hasPaymentInstructions = !!project.payment_instructions;
  const showContribute = isActive && (hasPaymentInstructions || canRecordContributions);
  const showShare = !isPrivate;

  const visibleSupporters = supporters.slice(0, 3);
  const extraSupporters = Math.max(0, supporters.length - 3);

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
    textDecoration: 'none',
    cursor: 'pointer',
  };

  return (
    <main style={{ paddingBottom: 8 }}>
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

        <div style={{ position: 'relative', maxWidth: 600, margin: '0 auto', padding: '22px 22px 40px' }}>
          <a href="/projects" style={{ fontSize: 13, color: 'var(--color-hero-sub)', textDecoration: 'none' }}>
            ← Your projects
          </a>
          <h1 style={{ margin: '10px 0 0', fontSize: 26, lineHeight: 1.2, color: '#FFFFFF' }}>
            {project.title}
          </h1>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                background: 'var(--tile-mint-bg)',
                color: 'var(--tile-mint-ic)',
                fontSize: 12,
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: 999,
              }}
            >
              {visibilityLabel}
            </span>
            <span
              style={{
                background: 'var(--tile-sand-bg)',
                color: 'var(--tile-sand-ic)',
                fontSize: 12,
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: 999,
              }}
            >
              {capitalize(myRole)}
            </span>
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 22px' }}>
        {/* ---------- FLOATING CARD: ring, milestones, supporters ---------- */}
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

          {available !== null && (
            <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
              Available to withdraw:{' '}
              <strong style={{ color: 'var(--color-ink)' }}>
                {project.currency} {available.toLocaleString()}
              </strong>
            </div>
          )}
          {project.deadline && (
            <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
              Deadline: {formatDeadline(project.deadline)}
            </div>
          )}

          <MilestoneTrack percent={percent} />

          {/* Supporters + days-left chip */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {visibleSupporters.map((s, i) => {
                const tone = AVATAR_TONES[i % AVATAR_TONES.length];
                return (
                  <div
                    key={s.key}
                    title={s.initials ? undefined : 'Anonymous supporter'}
                    style={{
                      width: 30,
                      height: 30,
                      marginLeft: i === 0 ? 0 : -8,
                      borderRadius: '50%',
                      background: s.initials ? tone.bg : 'var(--color-track)',
                      color: s.initials ? tone.ink : 'var(--color-muted)',
                      border: '2px solid var(--color-surface)',
                      fontSize: 11,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {s.initials ?? (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" />
                      </svg>
                    )}
                  </div>
                );
              })}
              {extraSupporters > 0 && (
                <div
                  style={{
                    width: 30,
                    height: 30,
                    marginLeft: -8,
                    borderRadius: '50%',
                    background: 'var(--color-ink)',
                    color: 'var(--color-bg)',
                    border: '2px solid var(--color-surface)',
                    fontSize: 11,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  +{extraSupporters}
                </div>
              )}
              {supporters.length > 0 && (
                <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--color-muted)' }}>
                  {supporters.length} {supporters.length === 1 ? 'supporter' : 'supporters'}
                </span>
              )}
            </div>

            {chipText && (
              <span
                style={{
                  ...chipStyle,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '5px 12px',
                  borderRadius: 999,
                  whiteSpace: 'nowrap',
                }}
              >
                {chipText}
              </span>
            )}
          </div>
        </div>

        {/* ---------- CONTRIBUTE + SHARE ---------- */}
        {(showContribute || showShare) && (
          <div style={{ display: 'flex', gap: 10, paddingTop: 16 }}>
            {showContribute &&
              (hasPaymentInstructions ? (
                <button
                  onClick={scrollToPaymentInstructions}
                  style={{ ...bigButton, border: 'none' }}
                >
                  Contribute
                </button>
              ) : (
                <a
                  href={`/projects/${projectId}/contributions`}
                  style={{
                    ...bigButton,
                    background: 'var(--color-primary)',
                    color: 'var(--color-on-primary)',
                  }}
                >
                  Contribute
                </a>
              ))}
            {showShare && (
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
            )}
          </div>
        )}

        {/* ---------- ABOUT ---------- */}
        {project.purpose && (
          <p style={{ marginTop: 18, fontSize: 14, lineHeight: 1.6, color: 'var(--color-ink)', whiteSpace: 'pre-line' }}>
            {project.purpose}
          </p>
        )}

        {/* ---------- MATERIALS (photos, videos, PDFs) ---------- */}
        <MaterialsGallery projectId={projectId} />

        {/* ---------- HOW TO CONTRIBUTE ---------- */}
        {project.payment_instructions ? (
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
          </div>
        ) : (
          isOrganizer && (
            <p className="muted-text" style={{ marginTop: 16 }}>
              You haven&apos;t added payment instructions yet — visitors won&apos;t know how to pay.{' '}
              <a href={`/projects/${projectId}/settings`}>Add them in Settings</a>.
            </p>
          )
        )}

        {/* ---------- QR CODE (hidden for private projects: their link doesn't work) ---------- */}
        {!isPrivate && (
          <div className="card" style={{ textAlign: 'center', marginTop: 20, borderRadius: 20 }}>
            <QRCodeSVG
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/p/${project.slug}`}
              size={160}
            />
            <p className="muted-text" style={{ marginTop: 12, marginBottom: 12, wordBreak: 'break-all' }}>
              {typeof window !== 'undefined' ? window.location.origin : ''}/p/{project.slug}
            </p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/p/${project.slug}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        )}

        {/* ---------- MANAGE ---------- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
          {canRecordContributions && (
            <RowLink href={`/projects/${projectId}/contributions`} label="Record a contribution" />
          )}
          {isOrganizer && (
            <RowLink href={`/projects/${projectId}/materials`} label="Project materials (photos, videos, PDFs)" />
          )}
          <RowLink href={`/projects/${projectId}/settings`} label="Team & approval settings" />
          <RowLink href={`/projects/${projectId}/withdrawals`} label="Withdrawal requests" />
          <RowLink href={`/projects/${projectId}/activity`} label="Activity" />
        </div>
      </div>
    </main>
  );
}