'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import AuthShell from '@/components/AuthShell';
import PasswordField from '@/components/PasswordField';

const MIN_PASSWORD = 8;

type Status = 'checking' | 'ready' | 'invalid' | 'done';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // The link in the email signs the person in for a moment, just to change the password.
  useEffect(() => {
    let cancelled = false;

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setStatus('ready');
      }
    });

    // Give the link a moment to be read, then check whether it worked.
    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setStatus((current) => (current === 'checking' ? (data.session ? 'ready' : 'invalid') : current));
    }, 1500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, []);

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const longEnough = password.length >= MIN_PASSWORD;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!longEnough) {
      setError(`Your new password needs at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('The two passwords do not match. Please check them and try again.');
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setStatus('done');
    setTimeout(() => router.push('/dashboard'), 2000);
  }

  if (status === 'checking') {
    return (
      <AuthShell title="One moment" subtitle="Checking your link">
        <div className="k-skeleton" style={{ height: 14, width: '70%', marginBottom: 10 }} />
        <div className="k-skeleton" style={{ height: 44 }} />
      </AuthShell>
    );
  }

  if (status === 'invalid') {
    return (
      <AuthShell title="This link has expired" subtitle="Reset links only work once, for a short time">
        <p style={{ margin: '0 0 14px', fontSize: 14, lineHeight: 1.5 }}>
          No problem. Request a new link and we&apos;ll email you again.
        </p>
        <a href="/forgot-password">
          <button style={{ width: '100%', height: 48 }}>Request a new link</button>
        </a>
        <p className="muted-text" style={{ marginTop: 16, textAlign: 'center' }}>
          <a href="/login">Back to log in</a>
        </p>
      </AuthShell>
    );
  }

  if (status === 'done') {
    return (
      <AuthShell title="Password updated" subtitle="You're all set">
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: '0 auto 12px',
              borderRadius: '50%',
              background: 'var(--tile-mint-bg)',
              color: 'var(--tile-mint-ic)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'k-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both',
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </div>
          <p style={{ margin: 0, fontSize: 15 }}>Your password has been changed. Taking you to Home…</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Pick something you don't use anywhere else">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <PasswordField
            value={password}
            onChange={setPassword}
            placeholder="New password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
          />
          <p
            style={{
              margin: '6px 4px 0',
              fontSize: 12,
              color: longEnough ? 'var(--color-primary)' : 'var(--color-muted)',
            }}
          >
            {longEnough ? '✓ ' : ''}Use at least {MIN_PASSWORD} characters.
          </p>
        </div>

        <div>
          <PasswordField
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Confirm new password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
            invalid={mismatch}
          />
          {mismatch && (
            <p role="alert" style={{ margin: '6px 4px 0', fontSize: 12, color: 'var(--color-danger)' }}>
              The passwords do not match yet.
            </p>
          )}
          {confirmPassword.length > 0 && !mismatch && (
            <p style={{ margin: '6px 4px 0', fontSize: 12, color: 'var(--color-primary)' }}>✓ The passwords match.</p>
          )}
        </div>

        {error && (
          <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 13, margin: 0 }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={saving} style={{ width: '100%', height: 48 }}>
          {saving ? 'Saving...' : 'Update password'}
        </button>
      </form>
    </AuthShell>
  );
}