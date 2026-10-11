'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Avatar from '@/components/Avatar';

type Approval = {
  id: string;
  approver_id: string;
  decision: string;
  reason: string | null;
};

type Doc = {
  id: string;
  type: string;
  storage_path: string;
  created_at: string;
};

type WithdrawalRequest = {
  id: string;
  amount: number;
  purpose: string;
  status: string;
  requester_id: string;
  created_at: string;
  withdrawal_approvals: Approval[];
  documents: Doc[];
};

function statusColor(status: string) {
  if (status === 'approved' || status === 'paid') return 'var(--color-primary)';
  if (status === 'rejected') return 'var(--color-danger)';
  return 'var(--color-accent)';
}

function DocumentUploader({ projectId, withdrawalId, onUploaded }: { projectId: string; withdrawalId: string; onUploaded: () => void }) {
  const [docType, setDocType] = useState('receipt');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);

    const { data: userData } = await supabase.auth.getUser();
    const path = `${projectId}/${withdrawalId}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage.from('project-documents').upload(path, file);
    if (uploadError) {
      setUploading(false);
      setError(uploadError.message);
      return;
    }

    const { error: insertError } = await supabase.from('project_documents').insert({
      project_id: projectId,
      withdrawal_id: withdrawalId,
      type: docType,
      storage_path: path,
      uploaded_by: userData.user?.id,
    });

    setUploading(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    onUploaded();
  }

  return (
    <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <select value={docType} onChange={(e) => setDocType(e.target.value)} style={{ fontSize: 13, padding: 6 }}>
        <option value="quotation">Quotation</option>
        <option value="invoice">Invoice</option>
        <option value="receipt">Receipt</option>
        <option value="photo">Photo</option>
        <option value="other">Other</option>
      </select>
      <label style={{ cursor: 'pointer', color: 'var(--color-primary)', fontSize: 13, fontWeight: 500 }}>
        {uploading ? 'Uploading...' : '+ Attach evidence'}
        <input type="file" onChange={handleFile} disabled={uploading} style={{ display: 'none' }} />
      </label>
      {error && <span style={{ color: 'var(--color-danger)', fontSize: 12 }}>{error}</span>}
    </div>
  );
}

export default function WithdrawalsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [userId, setUserId] = useState('');
  const [myRole, setMyRole] = useState<string | null>(null);
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [nameById, setNameById] = useState<Record<string, string>>({});
  const [avatarById, setAvatarById] = useState<Record<string, string | null>>({});
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
    const avatars2: Record<string, string | null> = {};
    (names ?? []).forEach((n: any) => {
      names2[n.user_id] = n.full_name;
      avatars2[n.user_id] = n.avatar_url;
    });
    setNameById(names2);
    setAvatarById(avatars2);

    const { data: reqs } = await supabase
      .from('withdrawal_requests')
      .select('id, amount, purpose, status, requester_id, created_at, withdrawal_approvals(id, approver_id, decision, reason)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    const requestIds = (reqs ?? []).map((r) => r.id);
    let docsByRequest: Record<string, Doc[]> = {};

    if (requestIds.length > 0) {
      const { data: docs } = await supabase
        .from('project_documents')
        .select('id, withdrawal_id, type, storage_path, created_at')
        .in('withdrawal_id', requestIds);

      (docs ?? []).forEach((d: any) => {
        if (!docsByRequest[d.withdrawal_id]) docsByRequest[d.withdrawal_id] = [];
        docsByRequest[d.withdrawal_id].push(d);
      });
    }

    setRequests(
      (reqs ?? []).map((r: any) => ({
        ...r,
        documents: docsByRequest[r.id] ?? [],
      }))
    );
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

    if (insertError) {
      setLoading(false);
      setError(insertError.message);
      return;
    }

    try {
      await fetch('/api/notify-approvers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, requesterId: userId, amount: Number(amount), purpose }),
      });
    } catch (notifyError) {
      console.error('Failed to send approver notifications:', notifyError);
    }

    setLoading(false);
    setAmount('');
    setPurpose('');
    loadData();
  }

  async function handleDecision(withdrawalId: string, decision: 'approved' | 'rejected') {
    let reason: string | null = null;

    if (decision === 'rejected') {
      reason = window.prompt('Optional: why are you rejecting this request?');
      if (reason === null) return;
    }

    const { error: decisionError } = await supabase.from('withdrawal_approvals').insert({
      withdrawal_id: withdrawalId,
      approver_id: userId,
      decision,
      reason: reason || null,
    });
    if (decisionError) {
      alert(decisionError.message);
      return;
    }
    loadData();
  }

  async function handleViewDocument(path: string) {
    const { data, error: signError } = await supabase.storage
      .from('project-documents')
      .createSignedUrl(path, 60);

    if (signError || !data) {
      alert(signError?.message ?? 'Could not open this document.');
      return;
    }
    window.open(data.signedUrl, '_blank');
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
      <p style={{ marginBottom: 16 }}><a href={`/projects/${projectId}`}>← Back to project summary</a></p>
      <h1>Withdrawal requests</h1>

      {canRequest && (
        <div className="card" style={{ marginTop: 20, marginBottom: 20 }}>
          <h2 style={{ marginTop: 0 }}>Request a withdrawal</h2>
          <form onSubmit={handleCreateRequest} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input type="number" min="1" placeholder="Amount (KES)" value={amount}
              onChange={(e) => setAmount(e.target.value)} required />
            <input type="text" placeholder="Purpose (e.g. Pay venue deposit)" value={purpose}
              onChange={(e) => setPurpose(e.target.value)} required />
            {error && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p>}
            <button type="submit" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit request'}
            </button>
          </form>
        </div>
      )}

      <h2>All requests</h2>
      {requests.length === 0 && <p>No withdrawal requests yet.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {requests.map((r) => {
          const alreadyVoted = r.withdrawal_approvals.some((a) => a.approver_id === userId);
          const isRequester = r.requester_id === userId;

          return (
            <div key={r.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <strong>KES {r.amount.toLocaleString()}</strong>
                <span style={{ color: statusColor(r.status), fontWeight: 600, fontSize: 13 }}>{r.status}</span>
              </div>
              <p style={{ margin: '6px 0' }}>{r.purpose}</p>

              {r.withdrawal_approvals.length > 0 && (
                <div className="muted-text" style={{ marginTop: 8 }}>
                  {r.withdrawal_approvals.map((a) => (
                    <div key={a.id} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar url={avatarById[a.approver_id]} name={nameById[a.approver_id]} size={24} />
                        <span>{nameById[a.approver_id] ?? 'Unknown'}: {a.decision}</span>
                      </div>
                      {a.reason && (
                        <div style={{ fontStyle: 'italic', marginLeft: 32, marginTop: 2 }}>
                          &ldquo;{a.reason}&rdquo;
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {r.documents.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <p className="muted-text" style={{ fontSize: 12, marginBottom: 4 }}>Evidence:</p>
                  {r.documents.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => handleViewDocument(d.storage_path)}
                      style={{
                        background: 'transparent', color: 'var(--color-primary)',
                        border: '1px solid var(--color-track)', fontSize: 12,
                        padding: '4px 10px', marginRight: 6, marginBottom: 6,
                      }}
                    >
                      {d.type}
                    </button>
                  ))}
                </div>
              )}

              {(myRole === 'organizer' || myRole === 'administrator') && (
                <DocumentUploader projectId={projectId} withdrawalId={r.id} onUploaded={loadData} />
              )}

              {canApprove && !isRequester && !alreadyVoted && r.status === 'pending' && (
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <button onClick={() => handleDecision(r.id, 'approved')}>Approve</button>
                  <button
                    onClick={() => handleDecision(r.id, 'rejected')}
                    style={{ background: 'var(--color-danger)' }}
                  >
                    Reject
                  </button>
                </div>
              )}
              {isRequester && r.status === 'pending' && (
                <p className="muted-text" style={{ marginTop: 8 }}>
                  You requested this — you cannot approve your own request.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}