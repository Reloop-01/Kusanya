'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Tab = {
  href: string;
  label: string;
  isActive: (path: string) => boolean;
  icon: React.ReactNode;
};

const tabs: Tab[] = [
  {
    href: '/dashboard',
    label: 'Home',
    isActive: (p) => p === '/dashboard',
    icon: <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />,
  },
  {
    href: '/projects',
    label: 'Projects',
    isActive: (p) => p.startsWith('/projects'),
    icon: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  },
  {
    href: '/discover',
    label: 'Discover',
    isActive: (p) => p.startsWith('/discover'),
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
      </>
    ),
  },
  {
    href: '/settings',
    label: 'Account',
    isActive: (p) => p.startsWith('/settings'),
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" />
      </>
    ),
  },
];

// The tab bar only appears on these areas of the app.
const SHOW_ON = ['/dashboard', '/projects', '/discover', '/settings'];

export default function TabBar() {
  const pathname = usePathname() ?? '';
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setLoggedIn(!!data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const inShownArea = SHOW_ON.some((prefix) => pathname.startsWith(prefix));
  if (!loggedIn || !inShownArea) return null;

  return (
    <>
      <style>{`
        .k-tabbar {
          --tabbar-bg: #0B2B27;
          --tabbar-border: transparent;
          --tabbar-icon: #BFE3DC;
          --tabbar-active-icon: #0B2B27;
          position: fixed;
          left: 50%;
          transform: translateX(-50%);
          bottom: calc(16px + env(safe-area-inset-bottom, 0px));
          width: calc(100% - 44px);
          max-width: 420px;
          height: 60px;
          border-radius: 30px;
          background: var(--tabbar-bg);
          border: 1px solid var(--tabbar-border);
          display: flex;
          align-items: center;
          justify-content: space-around;
          box-shadow: 0 12px 30px rgba(11, 43, 39, 0.35);
          z-index: 50;
        }
        :root[data-theme="dark"] .k-tabbar {
          --tabbar-bg: #12332E;
          --tabbar-border: #1B4A43;
        }
        .k-tab {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--tabbar-icon);
          text-decoration: none;
        }
        .k-tab:hover { text-decoration: none; }
        .k-tab:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }
        .k-tab[aria-current="page"] {
          background: #F26B21;
          color: var(--tabbar-active-icon);
          box-shadow: 0 0 16px rgba(242, 107, 33, 0.6);
        }
        .k-tabbar-spacer { height: calc(96px + env(safe-area-inset-bottom, 0px)); }
      `}</style>

      <nav className="k-tabbar" aria-label="Main navigation">
        {tabs.map((tab) => {
          const active = tab.isActive(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="k-tab"
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={active ? 2 : 1.9}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {tab.icon}
              </svg>
            </Link>
          );
        })}
      </nav>

      <div className="k-tabbar-spacer" aria-hidden="true" />
    </>
  );
}