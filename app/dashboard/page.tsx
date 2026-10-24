'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Avatar from '@/components/Avatar';

// Projects with these statuses are finished, so they are not "active".
const CLOSED_STATUSES = ['completed', 'cancelled'];

// The most projects the carousel will show.
const CAROUSEL_LIMIT = 6;

type ProjectWithTotal = {
  id: string;
  title: string;
  target_amount: number;
  status: string;
  total: number;
};

type ActivityItem = {
  id: string;
  projectId: string;
  kind: 'contribution' | 'withdrawal';
  text: string;
  sub: string;
  timestamp: string;
};

type QuickAction = {
  label: string;
  href: string;
  bg: string;
  ink: string;
  icon: React.ReactNode;
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function buildQuickActions(featuredId: string | null): QuickAction[] {
  const projectHref = featuredId ? `/projects/${featuredId}` : '/projects';
  const activityHref = featuredId ? `/projects/${featuredId}/activity` : '/projects';
  return [
    {
      label: 'Contribute',
      href: projectHref,
      bg: 'var(--tile-mint-bg)',
      ink: 'var(--tile-mint-ic)',
      icon: (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8M8 12h8" />
        </>
      ),
    },
    {
      label: 'Share',
      href: projectHref,
      bg: 'var(--tile-sand-bg)',
      ink: 'var(--tile-sand-ic)',
      icon: (
        <>
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4" />
        </>
      ),
    },
    {
      label: 'Approvals',
      href: projectHref,
      bg: 'var(--tile-peach-bg)',
      ink: 'var(--tile-peach-ic)',
      icon: (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12.5l3 3 5-6" />
        </>
      ),
    },
    {
      label: 'Activity',
      href: activityHref,
      bg: 'var(--tile-sky-bg)',
      ink: 'var(--tile-sky-ic)',
      icon: (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      ),
    },
  ];
}

function ProgressRing({ percent }: { percent: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" role="img" aria-label={`${percent} percent funded`}>
      <circle cx="32" cy="32" r={radius} fill="none" stroke="var(--color-track)" strokeWidth="7" />
      {percent > 0 && (
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${(percent / 100) * circumference} ${circumference}`}
          transform="rotate(-90 32 32)"
        />
      )}
      <text
        x="32"
        y="37"
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fill="var(--color-ink)"
        style={{ fontFamily: 'var(--font-heading), sans-serif' }}
      >
        {percent}%
      </text>
    </svg>
  );
}

// How far one slide is from the next (slide width plus the gap between slides).
function slideStep(scroller: HTMLDivElement): number {
  const first = scroller.children[0] as HTMLElement | undefined;
  const second = scroller.children[1] as HTMLElement | undefined;
  if (first && second) return Math.max(1, second.offsetLeft - first.offsetLeft);
  return Math.max(1, scroller.clientWidth);
}

function ProjectCarousel({
  projects,
  activeIndex,
  onIndexChange,
}: {
  projects: ProjectWithTotal[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Move to the next project every few seconds (skipped for people who prefer reduced motion).
  useEffect(() => {
    if (projects.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const timer = setInterval(() => {
      const scroller = scrollerRef.current;
      if (!scroller || pausedRef.current) return;
      const step = slideStep(scroller);
      const current = Math.round(scroller.scrollLeft / step);
      const next = (current + 1) % projects.length;
      scroller.scrollTo({ left: next * step, behavior: 'smooth' });
    }, 4500);

    return () => clearInterval(timer);
  }, [projects.length]);

  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  function pause() {
    pausedRef.current = true;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  }

  function resumeSoon() {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      pausedRef.current = false;
    }, 6000);
  }

  function handleScroll() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const step = slideStep(scroller);
    const index = Math.min(projects.length - 1, Math.max(0, Math.round(scroller.scrollLeft / step)));
    if (index !== activeIndex) onIndexChange(index);
  }

  function goTo(index: number) {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    pause();
    scroller.scrollTo({ left: index * slideStep(scroller), behavior: 'smooth' });
    resumeSoon();
  }

  return (
    <div>
      <div
        ref={scrollerRef}
        className="k-carousel"
        onScroll={handleScroll}
        onMouseEnter={pause}
        onMouseLeave={resumeSoon}
        onTouchStart={pause}
        onTouchEnd={resumeSoon}
        onFocus={pause}
        onBlur={resumeSoon}
        style={{
          position: 'relative',
          display: 'flex',
          gap: 12,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          padding: '2px 2px 14px',
        }}
      >
        {projects.map((project) => {
          const percent =
            project.target_amount > 0
              ? Math.min(100, Math.round((project.total / project.target_amount) * 100))
              : 0;
          return (
            <a
              key={project.id}
              href={`/projects/${project.id}`}
              className="card"
              style={{
                flex: '0 0 100%',
                scrollSnapAlign: 'start',
                display: 'block',
                boxSizing: 'border-box',
                color: 'var(--color-ink)',
                textDecoration: 'none',
                borderRadius: 20,
                boxShadow: '0 10px 30px var(--color-shadow)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-heading), sans-serif',
                      fontWeight: 700,
                      fontSize: 19,
                    }}
                  >
                    {project.title}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 2 }}>
                    KES {project.total.toLocaleString()} of {project.target_amount.toLocaleString()}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <ProgressRing percent={percent} />
                </div>
              </div>
            </a>
          );
        })}
      </div>

      {projects.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginTop: -4 }}>
          {projects.map((project, i) => (
            <button
              key={project.id}
              onClick={() => goTo(i)}
              aria-label={`Show project ${i + 1} of ${projects.length}`}
              style={{
                padding: 0,
                width: 20,
                height: 20,
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  display: 'block',
                  height: 8,
                  width: i === activeIndex ? 20 : 8,
                  borderRadius: 999,
                  background: i === activeIndex ? 'var(--color-accent)' : 'var(--color-track)',
                }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const chipStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
  background: 'var(--color-surface)',
  border: '1px solid var(--color-track)',
  borderRadius: 999,
  padding: '9px 12px',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--color-ink)',
  boxShadow: '0 6px 18px var(--color-shadow)',
  whiteSpace: 'nowrap',
};

// Hero styling that differs between light and dark mode.
// (We will move these into globals.css during the animations step.)
const heroCss = `
  .k-hero-bg {
    background: var(--color-hero);
    border-radius: 0 0 28px 28px;
    overflow: hidden;
  }
  .k-hill-1 { fill: var(--color-hill-1); }
  .k-hill-2 { fill: var(--color-hill-2); }

  .k-sun-ring-outer { stroke-opacity: 0.35; }
  .k-sun-dark-only { display: none; }

  .k-carousel { scrollbar-width: none; }
  .k-carousel::-webkit-scrollbar { display: none; }

  :root[data-theme="dark"] .k-hero-bg {
    background: #145349;
    box-shadow: 0 1px 0 #2F7A6D, 0 14px 34px rgba(43, 196, 176, 0.14);
  }
  :root[data-theme="dark"] .k-hill-1 { fill: #1B6B5F; }
  :root[data-theme="dark"] .k-hill-2 { fill: #0E3F39; }
  :root[data-theme="dark"] .k-sun-ring-outer { stroke-opacity: 0.3; }
  :root[data-theme="dark"] .k-sun-light-only { display: none; }
  :root[data-theme="dark"] .k-sun-dark-only { display: inline; }
`;

export default function HomePage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [projects, setProjects] = useState<ProjectWithTotal[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push('/login');
        return;
      }
      const userId = userData.user.id;
      setEmail(userData.user.email ?? null);

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', userId)
        .single();
      setFullName(profile?.full_name ?? '');
      setAvatarUrl(profile?.avatar_url ?? null);

      // Which projects am I a member of?
      const { data: memberRows } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', userId);
      const projectIds = Array.from(new Set((memberRows ?? []).map((m) => m.project_id as string)));

      if (projectIds.length === 0) {
        setProjects([]);
        setActivity([]);
        setLoadingData(false);
        return;
      }

      // Project details + each project's total (same method as the Projects page)
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, title, target_amount, status')
        .in('id', projectIds)
        .order('created_at', { ascending: false });

      const withTotals: ProjectWithTotal[] = await Promise.all(
        (projectsData ?? []).map(async (p) => {
          const { data: total } = await supabase.rpc('get_project_total_for_member', {
            p_project_id: p.id,
          });
          return {
            id: p.id as string,
            title: p.title as string,
            target_amount: p.target_amount as number,
            status: p.status as string,
            total: (total ?? 0) as number,
          };
        })
      );
      setProjects(withTotals);

      // Recent activity across all my projects
      const titleById: Record<string, string> = {};
      withTotals.forEach((p) => {
        titleById[p.id] = p.title;
      });

      const [contribRes, requestRes] = await Promise.all([
        supabase
          .from('contributions')
          .select('id, project_id, contributor_name, amount, status, created_at, is_anonymous')
          .in('project_id', projectIds)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('withdrawal_requests')
          .select('id, project_id, amount, purpose, created_at')
          .in('project_id', projectIds)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const items: ActivityItem[] = [];
      (contribRes.data ?? []).forEach((c) => {
        const who = c.is_anonymous ? 'An anonymous contributor' : c.contributor_name;
        items.push({
          id: `contribution-${c.id}`,
          projectId: c.project_id,
          kind: 'contribution',
          text: `${who} contributed KES ${c.amount.toLocaleString()}`,
          sub: `${titleById[c.project_id] ?? 'A project'} · ${timeAgo(c.created_at)} · ${c.status}`,
          timestamp: c.created_at,
        });
      });
      (requestRes.data ?? []).forEach((r) => {
        items.push({
          id: `withdrawal-${r.id}`,
          projectId: r.project_id,
          kind: 'withdrawal',
          text: `Withdrawal of KES ${r.amount.toLocaleString()} requested`,
          sub: `${titleById[r.project_id] ?? 'A project'} · ${timeAgo(r.created_at)}`,
          timestamp: r.created_at,
        });
      });
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivity(items.slice(0, 4));

      setLoadingData(false);
    }
    load();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (!email) return null;

  const firstName = fullName ? fullName.split(' ')[0] : '';

  // "Active" = not completed or cancelled. The carousel shows up to 6 active projects,
  // newest first. If none are active it shows the latest project instead.
  const activeProjects = projects.filter((p) => !CLOSED_STATUSES.includes(p.status));
  const carouselProjects =
    activeProjects.length > 0 ? activeProjects.slice(0, CAROUSEL_LIMIT) : projects.slice(0, 1);
  const featured = carouselProjects[activeIndex] ?? carouselProjects[0] ?? null;
  const totalCollected = projects.reduce((sum, p) => sum + p.total, 0);
  const quickActions = buildQuickActions(featured ? featured.id : null);

  return (
    <main>
      <style>{heroCss}</style>

      {/* ---------- HERO: sun, hills, greeting, chips ---------- */}
      <section style={{ position: 'relative', minHeight: 196 }}>
        <div className="k-hero-bg" style={{ position: 'absolute', inset: 0 }}>
          <svg
            width="160"
            height="160"
            viewBox="0 0 160 160"
            style={{ position: 'absolute', top: -40, right: -40 }}
            aria-hidden="true"
          >
            <circle className="k-sun-ring-outer" cx="80" cy="80" r="78" fill="none" stroke="#F7931E" strokeWidth="2" />
            <circle
              className="k-sun-light-only"
              cx="80"
              cy="80"
              r="58"
              fill="none"
              stroke="#F7931E"
              strokeOpacity="0.55"
              strokeWidth="2"
            />
            <circle className="k-sun-dark-only" cx="80" cy="80" r="58" fill="#F7931E" fillOpacity="0.14" />
            <circle cx="80" cy="80" r="38" fill="#F7931E" />
            <circle cx="80" cy="80" r="16" fill="#FFD27A" />
          </svg>

          <svg
            viewBox="0 0 390 190"
            preserveAspectRatio="none"
            style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: '100%' }}
            aria-hidden="true"
          >
            <path className="k-hill-1" d="M0 190V120C60 96 120 98 190 116C250 132 320 106 390 112V190Z" />
            <path className="k-hill-2" d="M0 190V146C70 130 140 138 220 148C290 156 340 140 390 144V190Z" />
          </svg>
        </div>

        <div
          style={{
            position: 'relative',
            maxWidth: 700,
            margin: '0 auto',
            padding: '26px 22px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <a href="/settings" aria-label="Account settings" style={{ flexShrink: 0 }}>
            <Avatar url={avatarUrl} name={fullName} size={52} />
          </a>
          <div>
            <div style={{ fontSize: 13, color: 'var(--color-hero-sub)' }}>{getGreeting()}</div>
            <h1 style={{ margin: 0, fontSize: 26, color: '#FFFFFF' }}>
              Hi{firstName ? `, ${firstName}` : ''}
            </h1>
          </div>
        </div>

        {!loadingData && projects.length > 0 && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: -18 }}>
            <div
              style={{
                maxWidth: 700,
                margin: '0 auto',
                padding: '0 22px',
                display: 'flex',
                gap: 10,
              }}
            >
              <span style={{ ...chipStyle, flexShrink: 0 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)' }} />
                {activeProjects.length} active {activeProjects.length === 1 ? 'project' : 'projects'}
              </span>
              <span style={chipStyle}>
                <span
                  style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-accent)', flexShrink: 0 }}
                />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  KES {totalCollected.toLocaleString()} collected
                </span>
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ---------- BODY ---------- */}
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 22px' }}>
        {/* Project carousel */}
        <div style={{ marginTop: 34 }}>
          {loadingData && <p className="muted-text">Loading your projects…</p>}

          {!loadingData && carouselProjects.length === 0 && (
            <div className="card" style={{ borderRadius: 20, textAlign: 'center', padding: 24 }}>
              <h2 style={{ margin: '0 0 6px', fontSize: 17 }}>No projects yet</h2>
              <p className="muted-text" style={{ marginBottom: 16, fontSize: 13 }}>
                Start a project for your group, or ask an organizer to invite you to theirs.
              </p>
              <a href="/projects/new">
                <button>Start your first project</button>
              </a>
            </div>
          )}

          {!loadingData && carouselProjects.length > 0 && (
            <>
              <ProjectCarousel
                projects={carouselProjects}
                activeIndex={activeIndex}
                onIndexChange={setActiveIndex}
              />
              {projects.length > 1 && (
                <p style={{ textAlign: 'right', marginTop: 4, fontSize: 13 }}>
                  <a href="/projects">All projects ({projects.length}) →</a>
                </p>
              )}
            </>
          )}
        </div>

        {/* Quick actions header + New project pill */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 18,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16 }}>Quick actions</h2>
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

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
            paddingTop: 14,
            textAlign: 'center',
          }}
        >
          {quickActions.map((action) => (
            <a
              key={action.label}
              href={action.href}
              style={{ display: 'block', color: 'var(--color-ink)', textDecoration: 'none' }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  margin: '0 auto 6px',
                  borderRadius: '50%',
                  background: action.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={action.ink}
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {action.icon}
                </svg>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{action.label}</div>
            </a>
          ))}
        </div>

        {/* Recent activity: each row opens that project's activity page */}
        <h2 style={{ margin: '26px 0 6px', fontSize: 16 }}>Recent activity</h2>
        {loadingData && <p className="muted-text">Loading…</p>}
        {!loadingData && activity.length === 0 && (
          <p className="muted-text" style={{ fontSize: 13 }}>
            Contributions and withdrawal requests from your projects will appear here.
          </p>
        )}
        <div>
          {activity.map((item, index) => {
            const isContribution = item.kind === 'contribution';
            return (
              <a
                key={item.id}
                href={`/projects/${item.projectId}/activity`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 0',
                  color: 'var(--color-ink)',
                  textDecoration: 'none',
                  borderBottom: index === activity.length - 1 ? 'none' : '1px solid var(--color-track)',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    flexShrink: 0,
                    borderRadius: '50%',
                    background: isContribution ? 'var(--tile-mint-bg)' : 'var(--tile-peach-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={isContribution ? 'var(--tile-mint-ic)' : 'var(--tile-peach-ic)'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {isContribution ? <path d="M12 5v14M5 12h14" /> : <path d="M7 17L17 7M9 7h8v8" />}
                  </svg>
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{item.text}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{item.sub}</div>
                </div>
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
                  style={{ flexShrink: 0 }}
                >
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </a>
            );
          })}
        </div>

        {/* Account footer (will move into Account settings later) */}
        <div
          style={{
            borderTop: '1px solid var(--color-track)',
            marginTop: 32,
            paddingTop: 20,
            textAlign: 'center',
          }}
        >
          <p className="muted-text" style={{ marginBottom: 12 }}>{email}</p>
          <button
            onClick={handleLogout}
            style={{
              background: 'transparent',
              color: 'var(--color-danger)',
              border: '1px solid var(--color-danger)',
            }}
          >
            Log out
          </button>
        </div>
      </div>
    </main>
  );
}