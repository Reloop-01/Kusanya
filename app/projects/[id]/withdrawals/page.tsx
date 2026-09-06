'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Approval = {
  id: string;
  approver_id: string;
  decision: string;
};

type WithdrawalRequest = {
  id: string;
  amount: number;
  purpose: string;
  status: string;
  requester_id: string;
  created_at: string;
  withdrawal_approvals: Approval[];
};

export default function WithdrawalsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [userId, setUserId] = useState('');
  const [myRole, setMyRole] = useState<string | null>(null);
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [nameById, setNameById] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.push('/login');
      return;
    }
    const uid = userData.user.id;
    setUserId(uid);

    const { data: membership } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', uid)
      .maybeSingle();

    setMyRole(membership?.role ?? null);
    setCheckingAccess(false);

    if (!membership) return;

    const { data: names } = await supabase.rpc('get_project_member_names', {
      p_project_id: projectId,
    });
    const names2: Record<string, string> = {};
    (names ?? []).forEach((n: any) => {
      names2[n.user_id] = n.full_name;
    });
    setNameById(names2);

    const { data: reqs } = await supabase
      .from('withdrawal_requests')
      .select('id, amount, purpose, status, requester_id, created_at, withdrawal_approvals(id, approver_id, decision)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    setRequests((reqs ?? []) as any);
  }, [projectId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCreateRequest(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: insertError } = await supabase.from('withdrawal_requests').insert({
      project_id: projectId,
      requester_id: userId,
      amount: Number(amount),
      purpose,
      status: 'pending',
    });

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setAmount('');
    setPurpose('');
    loadData();
  }

  async function handleDecision(withdrawalId: string, decision: 'approved' | 'rejected') {
    const { error: decisionError } = await supabase.from('withdrawal_approvals').insert({
      withdrawal_id: withdrawalId,
      approver_id: userId,
      decision,
    });
    if (decisionError) {
      alert(decisionError.message);
      return;
    }
    loadData();
  }

  const canRequest = myRole === 'organizer' || myRole === 'administrator';
  const canApprove = myRole === 'approver' || myRole === 'administrator';

  if (checkingAccess) {
    return <main style={{ maxWidth: 600, margin: '60px auto', padding: 24 }}><p>Loading...</p></main>;
  }

  if (!myRole) {
    return (
      <main style={{ maxWidth: 600, margin: '60px auto', padding: 24 }}>
        <h1>Not authorized</h1>
        <p>You&apos;re not a member of this project.</p>
        <a href="/dashboard">Back to dashboard</a>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 600, margin: '60px auto', padding: 24 }}>
      <h1>Withdrawal requests</h1>

      {canRequest && (
        <form onSubmit={handleCreateRequest} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          <h2>Request a withdrawal</h2>
          <input type="number" min="1" placeholder="Amount (KES)" value={amount}
            onChange={(e) => setAmount(e.target.value)} required />
          <input type="text" placeholder="Purpose (e.g. Pay venue deposit)" value={purpose}
            onChange={(e) => setPurpose(e.target.value)} required />
          {error && <p style={{ color: 'red' }}>{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? 'Submitting...' : 'Submit request'}
          </button>
        </form>
      )}

      <h2>All requests</h2>
      {requests.length === 0 && <p>No withdrawal requests yet.</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {requests.map((r) => {
          const alreadyVoted = r.withdrawal_approvals.some((a) => a.approver_id === userId);
          const isRequester = r.requester_id === userId;

          return (
            <li key={r.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <strong>KES {r.amount.toLocaleString()}</strong> — {r.purpose}
              <br />
              Status: <strong>{r.status}</strong>
              <ul>
                {r.withdrawal_approvals.map((a) => (
                  <li key={a.id}>{nameById[a.approver_id] ?? 'Unknown'}: {a.decision}</li>
                ))}
              </ul>
              {canApprove && !isRequester && !alreadyVoted && r.status === 'pending' && (
                <div style={{ marginTop: 8 }}>
                  <button onClick={() => handleDecision(r.id, 'approved')} style={{ marginRight: 8 }}>
                    Approve
                  </button>
                  <button onClick={() => handleDecision(r.id, 'rejected')}>Reject</button>
                </div>
              )}
              {isRequester && r.status === 'pending' && (
                <p style={{ color: '#666', fontSize: 14, marginTop: 8 }}>
                  You requested this — you cannot approve your own request.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}