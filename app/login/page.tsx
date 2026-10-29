'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import AuthShell from '@/components/AuthShell';
import PasswordField from '@/components/PasswordField';

function friendlyLoginError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes('invalid login credentials')) {
    return 'That email and password do not match. Please try again.';
  }
  if (text.includes('email not confirmed')) {
    return 'Please confirm your email first. Check your inbox for the link.';
  }
  return message;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setResendMessage('');
    setNeedsConfirmation(false);
    setLoading(true);

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);
    if (loginError) {
      setError(friendlyLoginError(loginError.message));
      setNeedsConfirmation(loginError.message.toLowerCase().includes('email not confirmed'));
      return;
    }
    router.push('/dashboard');
  }

  async function handleResend() {
    setResendMessage('');
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
    setResendMessage(resendError ? resendError.message : 'We have sent the confirmation email again.');
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in to see your projects">
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="email"
          placeholder="Email"
          aria-label="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <div>
          <PasswordField
            value={password}
            onChange={setPassword}
            placeholder="Password"
            autoComplete="current-password"
          />
          <div style={{ textAlign: 'right', marginTop: 6 }}>
            <a href="/forgot-password" style={{ fontSize: 13, fontWeight: 600 }}>
              Forgot password?
            </a>
          </div>
        </div>

        {error && (
          <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 13, margin: 0 }}>
            {error}
          </p>
        )}

        {needsConfirmation && (
          <div>
            <button
              type="button"
              onClick={handleResend}
              style={{
                background: 'transparent',
                color: 'var(--color-primary)',
                border: '1.5px solid var(--color-primary)',
                width: '100%',
              }}
            >
              Resend confirmation email
            </button>
            {resendMessage && (
              <p className="muted-text" style={{ marginTop: 8, fontSize: 13 }}>
                {resendMessage}
              </p>
            )}
          </div>
        )}

        <button type="submit" disabled={loading} style={{ width: '100%', height: 48 }}>
          {loading ? 'Logging in...' : 'Log in'}
        </button>
      </form>

      <p className="muted-text" style={{ marginTop: 16, textAlign: 'center' }}>
        No account yet? <a href="/signup">Sign up</a>
      </p>
    </AuthShell>
  );
}