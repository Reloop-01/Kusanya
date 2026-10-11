'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Avatar from '@/components/Avatar';

function NavTile({ href, icon, title, description, color }: { href: string; icon: string; title: string; description: string; color: string }) {
  return (
    <a
      href={href}
      className="card"
      style={{
        display: 'block',
        color: 'inherit',
        textAlign: 'center',
        flex: '1 1 180px',
        maxWidth: 220,
      }}
    >
      <div style={{ height: 4, margin: '-16px -16px 14px', background: color }}></div>
      <i className={`ti ${icon}`} style={{ fontSize: 28, color }} aria-hidden="true"></i>
      <h2 style={{ fontSize: 15, margin: '10px 0 4px' }}>{title}</h2>
      <p className="muted-text" style={{ fontSize: 13 }}>{description}</p>
    </a>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push('/login');
        return;
      }
      setEmail(userData.user.email ?? null);

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', userData.user.id)
        .single();
      setFullName(profile?.full_name ?? '');
      setAvatarUrl(profile?.avatar_url ?? null);
    }
    load();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (!email) return null;

  return (
    <main style={{ maxWidth: 700, margin: '60px auto', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 32 }}>
        <a href="/settings" aria-label="Account settings">
          <Avatar url={avatarUrl} name={fullName} size={52} />
        </a>
        <div>
          <h1 style={{ marginBottom: 2 }}>Hi{fullName ? `, ${fullName.split(' ')[0]}` : ''}</h1>
          <p className="muted-text">What would you like to do?</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 16 }}>
        <NavTile
          href="/projects"
          icon="ti-folder"
          title="Your Projects"
          description="View and manage the projects you're part of"
          color="#008575"
        />
        <NavTile
          href="/discover"
          icon="ti-world"
          title="Discover"
          description="Browse public projects anyone can support"
          color="#f36f2b"
        />
        <NavTile
          href="/projects/new"
          icon="ti-circle-plus"
          title="Start a New Project"
          description="Create a shareable project for your group"
          color="#D9A441"
        />
        <NavTile
          href="/settings"
          icon="ti-settings"
          title="Account Settings"
          description="Update your photo, name and contact details"
          color="#5B7C72"
        />
        <NavTile
          href="/#how-it-works"
          icon="ti-info-circle"
          title="How Kusanya Works"
          description="A quick refresher on the three steps"
          color="#B5651D"
        />
      </div>

      <div style={{ borderTop: '1px solid var(--color-track)', marginTop: 40, paddingTop: 20, textAlign: 'center' }}>
        <p className="muted-text" style={{ marginBottom: 12 }}>{email}</p>
        <button onClick={handleLogout} style={{ background: 'transparent', color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}>
          Log out
        </button>
      </div>
    </main>
  );
}