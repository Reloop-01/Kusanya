'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function SignUpPage() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<{ project_title: string; role: string } | null>(null);

  useEffect(() => {
    if (!inviteToken) return;
    supabase
      .rpc('get_invite_details', { p_token: inviteToken })
      .maybeSingle()
      .then(({ data }) => {
        if (data) setInviteInfo(data as any);
      });
  }, [inviteToken]);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone: phone, invite_token: inviteToken ?? undefined },
      },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSuccess(true);
  }

  if (success) {
    return (
      <main style={{ maxWidth: 380, margin: '100px auto', padding: 24 }}>
        <div className="card">
          <div className="card-stripe"><span></span><span></span></div>
          <h1>Check your email</h1>
          <p>We&apos;ve sent a confirmation link. Click it, then come back and log in.</p>
          {inviteInfo && (
            <p className="muted-text" style={{ marginTop: 12 }}>
              Once confirmed, you&apos;ll automatically join &ldquo;{inviteInfo.project_title}&rdquo; as {inviteInfo.role}.
            </p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 380, margin: '100px auto', padding: 24 }}>
      <div className="card">
        <div className="card-stripe"><span></span><span></span></div>
        <h1>Create your account</h1>
        {inviteInfo ? (
          <p className="muted-text" style={{ marginBottom: 20 }}>
            You&apos;ve been invited to join &ldquo;{inviteInfo.project_title}&rdquo; as {inviteInfo.role}. Sign up to accept.
          </p>
        ) : (
          <p className="muted-text" style={{ marginBottom: 20 }}>Start coordinating your group&apos;s funds.</p>
        )}
        <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="text" placeholder="Full name" value={fullName}
            onChange={(e) => setFullName(e.target.value)} required />
          <input type="tel" placeholder="Phone number" value={phone}
            onChange={(e) => setPhone(e.target.value)} required />
          <input type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          {error && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Creating account...' : 'Sign up'}
          </button>
        </form>
        <p className="muted-text" style={{ marginTop: 16 }}>Already have an account? <a href="/login">Log in</a></p>
      </div>
    </main>
  );
}