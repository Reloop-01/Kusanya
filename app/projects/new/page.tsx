'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

function slugify(text: string) {
  const base = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `${base}-${randomSuffix}`;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [visibility, setVisibility] = useState('link_only');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setError('You must be logged in to create a project.');
      setLoading(false);
      return;
    }

    const slug = slugify(title);

    const { data: project, error: insertError } = await supabase
      .from('projects')
      .insert({
        organizer_id: userData.user.id,
        title,
        purpose,
        target_amount: Number(targetAmount),
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
      return;
    }

    const { error: memberError } = await supabase.from('project_members').insert({
      project_id: project.id,
      user_id: userData.user.id,
      role: 'organizer',
    });

    setLoading(false);

    if (memberError) {
      setError(memberError.message);
      return;
    }

    router.push('/dashboard');
  }

  return (
        <main style={{ maxWidth: 480, margin: '60px auto', padding: 24 }}>
      <p style={{ marginBottom: 16 }}><a href="/dashboard">← Back to dashboard</a></p>
      <div className="card">
        <div className="card-stripe"><span></span><span></span></div>
        <h1>Start a new project</h1>
        <p className="muted-text" style={{ marginBottom: 20 }}>Set up a shareable project for your group.</p>
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label>
            Project title
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required style={{ width: '100%', marginTop: 4 }} />
          </label>
          <label>
            Purpose / description
            <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={3} style={{ width: '100%', marginTop: 4 }} />
          </label>
          <label>
            Target amount (KES)
            <input type="number" min="1" value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)} required style={{ width: '100%', marginTop: 4 }} />
          </label>
          <label>
            Deadline (optional)
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={{ width: '100%', marginTop: 4 }} />
          </label>
          <label>
            Who can see this project?
            <select value={visibility} onChange={(e) => setVisibility(e.target.value)} style={{ width: '100%', marginTop: 4 }}>
              <option value="private">Private (only people I add)</option>
              <option value="link_only">Anyone with the link</option>
              <option value="public">Public (searchable)</option>
            </select>
          </label>
          {error && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Creating...' : 'Create project'}
          </button>
        </form>
      </div>
    </main>
  );
}