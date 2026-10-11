'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AccountSettingsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [photoError, setPhotoError] = useState('');

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push('/login');
        return;
      }
      setUserId(userData.user.id);
      setEmail(userData.user.email ?? '');

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone, avatar_url')
        .eq('id', userData.user.id)
        .single();

      setFullName(profile?.full_name ?? '');
      setPhone(profile?.phone ?? '');
      setAvatarUrl(profile?.avatar_url ?? null);
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaved(false);
    setSaving(true);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ full_name: fullName, phone })
      .eq('id', userId);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    setPhotoError('');
    setUploading(true);

    const fileExt = file.name.split('.').pop();
    const filePath = `${userId}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      setUploading(false);
      setPhotoError(uploadError.message);
      return;
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
    // Add a changing query string so the browser doesn't keep showing a cached old photo
    const freshUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: freshUrl })
      .eq('id', userId);

    setUploading(false);

    if (updateError) {
      setPhotoError(updateError.message);
      return;
    }

    setAvatarUrl(freshUrl);
  }

  if (loading) {
    return <main style={{ maxWidth: 480, margin: '60px auto', padding: 24 }}><p>Loading...</p></main>;
  }

  const initials = fullName
    ? fullName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <main style={{ maxWidth: 480, margin: '60px auto', padding: 24 }}>
      <p style={{ marginBottom: 16 }}><a href="/dashboard">← Back to home</a></p>

      <div className="card">
        <h1>Account settings</h1>
        <p className="muted-text" style={{ marginBottom: 20 }}>{email}</p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Your profile photo"
              style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--color-track)' }}
            />
          ) : (
            <div
              style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'var(--color-track)', color: 'var(--color-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 24,
              }}
            >
              {initials}
            </div>
          )}
          <div>
            <label style={{ cursor: 'pointer' }}>
              <span style={{ color: 'var(--color-primary)', fontWeight: 500, fontSize: 14 }}>
                {uploading ? 'Uploading...' : 'Change photo'}
              </span>
              <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} style={{ display: 'none' }} />
            </label>
            {photoError && <p style={{ color: 'var(--color-danger)', fontSize: 12, marginTop: 4 }}>{photoError}</p>}
          </div>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label>
            Full name
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
              required style={{ width: '100%', marginTop: 4 }} />
          </label>
          <label>
            Phone number
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              style={{ width: '100%', marginTop: 4 }} />
          </label>
          {error && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p>}
          <button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          {saved && <span style={{ color: 'var(--color-primary)', fontSize: 13 }}>Saved!</span>}
        </form>
      </div>
    </main>
  );
}