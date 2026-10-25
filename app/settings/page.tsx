'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { getThemePreference, setThemePreference, type ThemePreference } from '@/lib/theme';
import PageHeader from '@/components/PageHeader';
import PasswordField from '@/components/PasswordField';
import { Section, Field, Notice, dangerButton } from '@/components/ui';
import { initialsOf } from '@/lib/format';

const MIN_PASSWORD = 8;

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
  {
    value: 'system',
    label: 'System',
    icon: (
      <>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </>
    ),
  },
  {
    value: 'light',
    label: 'Light',
    icon: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
      </>
    ),
  },
  { value: 'dark', label: 'Dark', icon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /> },
];

// Crops a photo to a square, shrinks it, and saves it as a JPEG.
// Re-saving also removes hidden data such as the GPS location.
async function makeAvatar(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - size) / 2;
    const sy = (bitmap.height - size) / 2;
    const target = Math.min(512, size);

    const canvas = document.createElement('canvas');
    canvas.width = target;
    canvas.height = target;
    const context = canvas.getContext('2d');
    if (!context) return file;

    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, target, target);
    context.drawImage(bitmap, sx, sy, size, size, 0, 0, target, target);

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    if (!blob) return file;
    return new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export default function AccountSettingsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [initial, setInitial] = useState({ name: '', phone: '' });
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [themePref, setThemePref] = useState<ThemePreference>('system');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    setThemePref(getThemePreference());

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
      setInitial({ name: profile?.full_name ?? '', phone: profile?.phone ?? '' });
      setAvatarUrl(profile?.avatar_url ?? null);
      setLoading(false);
    }
    load();
  }, [router]);

  function chooseTheme(pref: ThemePreference) {
    setThemePref(pref);
    setThemePreference(pref);
  }

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
    setInitial({ name: fullName, phone });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0];
    e.target.value = '';
    if (!chosen || !userId) return;

    setPhotoError('');

    if (!chosen.type.startsWith('image/')) {
      setPhotoError('Please choose a photo (JPG, PNG or WebP).');
      return;
    }
    if (chosen.size > 15 * 1024 * 1024) {
      setPhotoError('That photo is too large. Please choose one under 15 MB.');
      return;
    }

    setUploading(true);

    const file = await makeAvatar(chosen);
    const extension = file.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() ?? 'jpg');
    const filePath = `${userId}/avatar.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      setUploading(false);
      setPhotoError(uploadError.message);
      return;
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
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

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSaved(false);

    if (newPassword.length < MIN_PASSWORD) {
      setPasswordError(`Your new password needs at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('The two passwords do not match.');
      return;
    }

    setPasswordSaving(true);
    const { error: passwordUpdateError } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);

    if (passwordUpdateError) {
      setPasswordError(passwordUpdateError.message);
      return;
    }

    setNewPassword('');
    setConfirmPassword('');
    setPasswordSaved(true);
    setTimeout(() => setPasswordSaved(false), 4000);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (loading) {
    return <main style={{ maxWidth: 480, margin: '60px auto', padding: 24 }}><p>Loading...</p></main>;
  }

  const dirty = fullName !== initial.name || phone !== initial.phone;
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: '24px 22px 8px' }}>
      <PageHeader backHref="/dashboard" backLabel="Back to home" title="Account settings" subtitle={email} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* ---------- PROFILE ---------- */}
        <Section
          title="Your profile"
          hint="This is how other members see you"
          delay={0.05}
          icon={
            <>
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" />
            </>
          }
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <label style={{ position: 'relative', display: 'block', cursor: 'pointer', flexShrink: 0 }}>
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="Your profile photo"
                  style={{
                    width: 84,
                    height: 84,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid var(--color-track)',
                    display: 'block',
                    opacity: uploading ? 0.5 : 1,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 84,
                    height: 84,
                    borderRadius: '50%',
                    background: 'var(--color-track)',
                    color: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 28,
                    opacity: uploading ? 0.5 : 1,
                  }}
                >
                  {initialsOf(fullName)}
                </div>
              )}
              <span
                style={{
                  position: 'absolute',
                  right: -2,
                  bottom: -2,
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: 'var(--color-primary)',
                  color: 'var(--color-on-primary)',
                  border: '3px solid var(--color-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={uploading}
                style={{ display: 'none' }}
              />
            </label>
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700 }}>{uploading ? 'Uploading…' : 'Profile photo'}</div>
              <div style={{ color: 'var(--color-muted)' }}>
                Tap the photo to change it. It is cropped to a square automatically.
              </div>
            </div>
          </div>
          {photoError && <Notice kind="error">{photoError}</Notice>}

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Full name">
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
                style={{ width: '100%' }}
              />
            </Field>
            <Field label="Phone number">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                style={{ width: '100%' }}
              />
            </Field>
            <Field label="Email" hint="used to log in">
              <input type="email" value={email} readOnly style={{ width: '100%', opacity: 0.7 }} />
            </Field>
            {error && <Notice kind="error">{error}</Notice>}
            {saved && <Notice kind="success">✓ Your changes are saved.</Notice>}
            <button type="submit" disabled={saving || !dirty} style={{ height: 46 }}>
              {saving ? 'Saving...' : dirty ? 'Save changes' : 'No changes to save'}
            </button>
          </form>
        </Section>

        {/* ---------- APPEARANCE ---------- */}
        <Section
          title="Appearance"
          hint="System follows your phone or computer's own light or dark setting"
          delay={0.1}
          icon={<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />}
        >
          <div
            role="radiogroup"
            aria-label="Colour theme"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 6,
              padding: 5,
              borderRadius: 16,
              background: 'var(--color-track)',
            }}
          >
            {THEME_OPTIONS.map((option) => {
              const selected = themePref === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => chooseTheme(option.value)}
                  style={{
                    height: 44,
                    padding: 0,
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    background: selected ? 'var(--color-primary)' : 'transparent',
                    color: selected ? 'var(--color-on-primary)' : 'var(--color-ink)',
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {option.icon}
                  </svg>
                  {option.label}
                </button>
              );
            })}
          </div>
        </Section>

        {/* ---------- PASSWORD ---------- */}
        <Section
          title="Change password"
          hint="Choose a password you don't use anywhere else"
          delay={0.15}
          icon={
            <>
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </>
          }
        >
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <PasswordField
              value={newPassword}
              onChange={setNewPassword}
              placeholder="New password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD}
            />
            <PasswordField
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Confirm new password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD}
              invalid={passwordsMismatch}
            />
            {passwordsMismatch && <Notice kind="error">The passwords do not match yet.</Notice>}
            {passwordError && <Notice kind="error">{passwordError}</Notice>}
            {passwordSaved && <Notice kind="success">✓ Your password has been changed.</Notice>}
            <button type="submit" disabled={passwordSaving} style={{ height: 46 }}>
              {passwordSaving ? 'Updating...' : 'Update password'}
            </button>
          </form>
        </Section>

        {/* ---------- LOG OUT ---------- */}
        <Section title="Session" delay={0.2}>
          <button onClick={handleLogout} style={{ ...dangerButton, height: 46 }}>
            Log out
          </button>
        </Section>
      </div>
    </main>
  );
}