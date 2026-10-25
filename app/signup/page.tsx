'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import AuthShell from '@/components/AuthShell';
import PasswordField from '@/components/PasswordField';

const MIN_PASSWORD = 8;

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [inviteInfo, setInviteInfo] = useState<{ project_title: string; role: string } | null>(null);

  useEffect(() => {
    if (!inviteToken) return;
    supabase
      .rpc('get_invite_details', { p_token: inviteToken })
      .maybeSingle()
      .then(({ data }) => {
        if (data) setInviteInfo(data as { project_title: string; role: string });
      });
  }, [inviteToken]);

  const longEnough = password.length >= MIN_PASSWORD;
  const showMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const showMatch = confirmPassword.length > 0 && password === confirmPassword;

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!longEnough) {
      setError(`Your password needs at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('The two passwords do not match. Please check them and try again.');
      return;
    }

    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim(), phone: phone.trim(), invite_token: inviteToken ?? undefined },
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    // When email confirmation is on, an email that already has an account comes back
    // with no identities instead of an error.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError('An account with this email may already exist. Try logging in instead.');
      return;
    }

    // Email confirmation is off: the person is already signed in.
    if (data.session) {
      router.push('/dashboard');
      return;
    }

    // Email confirmation is on: ask them to check their inbox.
    setSuccess(true);
  }

  async function handleResend() {
    setResendMessage('');
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
    setResendMessage(resendError ? resendError.message : 'We have sent the confirmation email again.');
  }

  if (success) {
    return (
      <AuthShell title="Check your email" subtitle="One more step to get started">
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
            We&apos;ve sent a confirmation link to <strong>{email.trim()}</strong>. Click it, then come back and log in.
          </p>
          {inviteInfo && (
            <p className="muted-text" style={{ marginBottom: 12 }}>
              Once confirmed, you&apos;ll automatically join &ldquo;{inviteInfo.project_title}&rdquo; as {inviteInfo.role}.
            </p>
          )}

          <button
            type="button"
            onClick={handleResend}
            style={{
              background: 'transparent',
              color: 'var(--color-primary)',
              border: '1.5px solid var(--color-primary)',
              marginTop: 8,
            }}
          >
            Resend email
          </button>
          {resendMessage && (
            <p className="muted-text" style={{ marginTop: 10, fontSize: 13 }}>
              {resendMessage}
            </p>
          )}

          <p className="muted-text" style={{ marginTop: 18 }}>
            <a href="/login">Back to log in</a>
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start coordinating your group's funds"
    >
      {inviteInfo && (
        <div
          style={{
            background: 'var(--tile-mint-bg)',
            color: 'var(--tile-mint-ic)',
            borderRadius: 14,
            padding: '12px 14px',
            fontSize: 13,
            lineHeight: 1.5,
            marginBottom: 16,
          }}
        >
          You&apos;ve been invited to join <strong>&ldquo;{inviteInfo.project_title}&rdquo;</strong> as{' '}
          <strong>{inviteInfo.role}</strong>. Sign up to accept.
        </div>
      )}

      <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="text"
          placeholder="Full name"
          aria-label="Full name"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
        <input
          type="tel"
          placeholder="Phone number"
          aria-label="Phone number"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
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
            placeholder="Confirm password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
            invalid={showMismatch}
          />
          {showMismatch && (
            <p role="alert" style={{ margin: '6px 4px 0', fontSize: 12, color: 'var(--color-danger)' }}>
              The passwords do not match yet.
            </p>
          )}
          {showMatch && (
            <p style={{ margin: '6px 4px 0', fontSize: 12, color: 'var(--color-primary)' }}>✓ The passwords match.</p>
          )}
        </div>

        {error && (
          <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 13, margin: 0 }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} style={{ width: '100%', height: 48 }}>
          {loading ? 'Creating account...' : 'Sign up'}
        </button>
      </form>

      <p className="muted-text" style={{ marginTop: 16, textAlign: 'center' }}>
        Already have an account? <a href="/login">Log in</a>
      </p>
    </AuthShell>
  );
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <main style={{ maxWidth: 380, margin: '100px auto', padding: 24 }}>
          <p>Loading...</p>
        </main>
      }
    >
      <SignUpForm />
    </Suspense>
  );
}