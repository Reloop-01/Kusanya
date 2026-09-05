'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function SignUpPage() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone: phone },
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
      <main style={{ maxWidth: 400, margin: '80px auto', padding: 24 }}>
        <h1>Check your email</h1>
        <p>We&apos;ve sent a confirmation link. Click it, then come back and log in.</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 400, margin: '80px auto', padding: 24 }}>
      <h1>Create your Kusanya account</h1>
      <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input type="text" placeholder="Full name" value={fullName}
          onChange={(e) => setFullName(e.target.value)} required />
        <input type="tel" placeholder="Phone number" value={phone}
          onChange={(e) => setPhone(e.target.value)} required />
        <input type="email" placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Creating account...' : 'Sign up'}
        </button>
      </form>
      <p style={{ marginTop: 16 }}>Already have an account? <a href="/login">Log in</a></p>
    </main>
  );
}