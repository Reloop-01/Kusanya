'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Contribution = {
  id: string;
  contributor_name: string | null;
  amount: number;
  reference: string | null;
  status: string;
  created_at: string;
};

export default function ContributionsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [projectTitle, setProjectTitle] = useState('');
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.push('/login');
      return;
    }

    const { data: membership } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userData.user.id)
      .maybeSingle();

    const allowed = membership?.role === 'organizer' || membership?.role === 'administrator';
    setHasAccess(allowed);
    setCheckingAccess(false);

    if (!allowed) return;

    const { data: project } = await supabase
      .from('projects')
      .select('title')
      .eq('id', projectId)
      .single();
    setProjectTitle(project?.title ?? '');

    const { data: contribs } = await supabase
      .from('contributions')
      .select('id, contributor_name, amount, reference, status, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    setContributions(contribs ?? []);
  }, [projectId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAddContribution(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: insertError } = await supabase.from('contributions').insert({
      project_id: projectId,
      contributor_name: name,
      amount: Number(amount),
      reference: reference || null,
      status: 'pending',
    });

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setName('');
    setAmount('');
    setReference('');
    loadData();
  }

  async function updateStatus(id: string, status: 'confirmed' | 'rejected') {
    await supabase.from('contributions').update({ status }).eq('id', id);
    loadData();
  }

  if (checkingAccess) {
    return <main style={{ maxWidth: 600, margin: '60px auto', padding: 24 }}><p>Loading...</p></main>;
  }

  if (!hasAccess) {
    return (
      <main style={{ maxWidth: 600, margin: '60px auto', padding: 24 }}>
        <h1>Not authorized</h1>
        <p>Only the organizer or an administrator can record contributions.</p>
        <a href={`/projects/${projectId}`}>Back to project</a>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 600, margin: '60px auto', padding: 24 }}>
      <h1>{projectTitle} — Contributions</h1>

      <h2>Record a contribution</h2>
      <form onSubmit={handleAddContribution} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
        <input type="text" placeholder="Contributor name" value={name}
          onChange={(e) => setName(e.target.value)} required />
        <input type="number" min="1" placeholder="Amount (KES)" value={amount}
          onChange={(e) => setAmount(e.target.value)} required />
        <input type="text" placeholder="Reference / M-Pesa code (optional)" value={reference}
          onChange={(e) => setReference(e.target.value)} />
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Add contribution'}
        </button>
      </form>

      <h2>All contributions</h2>
      {contributions.length === 0 && <p>No contributions recorded yet.</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {contributions.map((c) => (
          <li key={c.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 8 }}>
            <strong>{c.contributor_name}</strong> — KES {c.amount.toLocaleString()}
            {c.reference && <> (ref: {c.reference})</>}
            <br />
            Status: <strong>{c.status}</strong>
            {c.status === 'pending' && (
              <div style={{ marginTop: 8 }}>
                <button onClick={() => updateStatus(c.id, 'confirmed')} style={{ marginRight: 8 }}>
                  Confirm
                </button>
                <button onClick={() => updateStatus(c.id, 'rejected')}>Reject</button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <p style={{ marginTop: 24 }}><a href={`/projects/${projectId}`}>← Back to project summary</a></p>
    </main>
  );
}