'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import AuthShell from '@/components/AuthShell';

function friendlyError(message: string): string {
  if (message.toLowerCase().includes('rate limit')) {
    return 'Too many requests right now. Please wait a few minutes and try again.';
  }
  return message;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Counts down the seconds before another email can be requested.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function sendLink() {
    setError('');
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (resetError) {
      setError(friendlyError(resetError.message));
      return;
    }

    // We show the same message whether or not the email has an account,
    // so nobody can use this page to find out who is registered.
    setSent(true);
    setCooldown(60);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await sendLink();
  }

  if (sent) {
    return (
      <AuthShell title="Check your email" subtitle="Your reset link is on its way">
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
            }}
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 7l9 6 9-6" />
            </svg>
          </div>
          <p style={{ margin: '0 0 8px', fontSize: 15, lineHeight: 1.5 }}>
            If an account exists for <strong>{email.trim()}</strong>, we&apos;ve sent a link to reset the password.
          </p>
          <p className="muted-text" style={{ margin: '0 0 14px', fontSize: 13 }}>
            It can take a minute to arrive. Check your spam folder too.
          </p>

          {error && (
            <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 13, margin: '0 0 10px' }}>
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={sendLink}
            disabled={loading || cooldown > 0}
            style={{
              background: 'transparent',
              color: 'var(--color-primary)',
              border: '1.5px solid var(--color-primary)',
            }}
          >
            {loading ? 'Sending...' : cooldown > 0 ? `Send again in ${cooldown}s` : 'Send the email again'}
          </button>

          <p className="muted-text" style={{ marginTop: 18 }}>
            <a href="/login">Back to log in</a>
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot your password?" subtitle="We'll email you a link to choose a new one">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="email"
          placeholder="Your email"
          aria-label="Your email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {error && (
          <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 13, margin: 0 }}>
            {error}
          </p>
        )}
        <button type="submit" disabled={loading} style={{ width: '100%', height: 48 }}>
          {loading ? 'Sending...' : 'Send reset link'}
        </button>
      </form>

      <p className="muted-text" style={{ marginTop: 16, textAlign: 'center' }}>
        Remembered it? <a href="/login">Log in</a>
      </p>
    </AuthShell>
  );
}