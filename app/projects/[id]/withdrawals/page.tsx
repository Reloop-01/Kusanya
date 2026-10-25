'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { authFetch } from '@/lib/authFetch';
import Avatar from '@/components/Avatar';
import PageHeader from '@/components/PageHeader';
import { CountUp } from '@/components/ProjectProgress';
import { Section, Field, FilterChip, Pill, Notice, CurrencyInput, StatTile, outlineButton, dangerButton } from '@/components/ui';
import { timeAgo } from '@/lib/format';

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

type Filter = 'all' | 'pending' | 'approved' | 'rejected';

function statusLook(status: string): { bg: string; ink: string } {
  if (status === 'approved' || status === 'paid') return { bg: 'var(--tile-mint-bg)', ink: 'var(--tile-mint-ic)' };
  if (status === 'rejected') return { bg: 'var(--tile-peach-bg)', ink: 'var(--tile-peach-ic)' };
  return { bg: 'var(--tile-sand-bg)', ink: 'var(--tile-sand-ic)' };
}

function matchesFilter(status: string, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'approved') return status === 'approved' || status === 'paid';
  return status === filter;
}

// Makes a file name safe to use as a storage key.
function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function DocumentUploader({
  projectId,
  withdrawalId,
  onUploaded,
}: {
  projectId: string;
  withdrawalId: string;
  onUploaded: () => void;
}) {
  const [docType, setDocType] = useState('receipt');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setUploading(true);

    const { data: userData } = await supabase.auth.getUser();
    const path = `${projectId}/${withdrawalId}/${Date.now()}-${safeFileName(file.name)}`;

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
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          aria-label="Type of evidence"
          style={{ fontSize: 13, padding: '7px 10px' }}
        >
          <option value="quotation">Quotation</option>
          <option value="invoice">Invoice</option>
          <option value="receipt">Receipt</option>
          <option value="photo">Photo</option>
          <option value="other">Other</option>
        </select>
        <label
          style={{
            cursor: uploading ? 'default' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            height: 34,
            padding: '0 14px',
            borderRadius: 999,
            border: '1.5px dashed var(--color-primary)',
            color: 'var(--color-primary)',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {uploading ? 'Uploading…' : '+ Attach evidence'}
          <input type="file" onChange={handleFile} disabled={uploading} style={{ display: 'none' }} />
        </label>
      </div>
      {error && (
        <div style={{ marginTop: 8 }}>
          <Notice kind="error">{error}</Notice>
        </div>
      )}
    </div>
  );
}

export default function WithdrawalsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [userId, setUserId] = useState('');
  const [myRole, setMyRole] = useState<string | null>(null);
  const [currency, setCurrency] = useState('KES');
  const [available, setAvailable] = useState<number | null>(null);
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [nameById, setNameById] = useState<Record<string, string>>({});
  const [avatarById, setAvatarById] = useState<Record<string, string | null>>({});
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<WithdrawalRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

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

    const { data: project } = await supabase.from('projects').select('currency').eq('id', projectId).single();
    setCurrency(project?.currency ?? 'KES');

    const { data: availableData } = await supabase.rpc('get_project_available_balance', {
      p_project_id: projectId,
    });
    setAvailable(availableData ?? 0);

    const { data: names } = await supabase.rpc('get_project_member_names', {
      p_project_id: projectId,
    });
    const names2: Record<string, string> = {};
    const avatars2: Record<string, string | null> = {};
    (names ?? []).forEach((n: { user_id: string; full_name: string; avatar_url: string | null }) => {
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
    const docsByRequest: Record<string, Doc[]> = {};

    if (requestIds.length > 0) {
      const { data: docs } = await supabase
        .from('project_documents')
        .select('id, withdrawal_id, type, storage_path, created_at')
        .in('withdrawal_id', requestIds);

      (docs ?? []).forEach((d: Doc & { withdrawal_id: string }) => {
        if (!docsByRequest[d.withdrawal_id]) docsByRequest[d.withdrawal_id] = [];
        docsByRequest[d.withdrawal_id].push(d);
      });
    }

    setRequests(
      (reqs ?? []).map((r) => ({
        ...(r as unknown as WithdrawalRequest),
        documents: docsByRequest[r.id] ?? [],
      }))
    );
    setLoadingList(false);
  }, [projectId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCreateRequest(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);

    const { data: inserted, error: insertError } = await supabase
      .from('withdrawal_requests')
      .insert({
        project_id: projectId,
        requester_id: userId,
        amount: Number(amount),
        purpose,
        status: 'pending',
      })
      .select('id')
      .single();

    if (insertError) {
      setLoading(false);
      setError(insertError.message);
      return;
    }

    try {
      if (inserted) {
        await authFetch('/api/notify-approvers', { withdrawalId: inserted.id });
      }
    } catch (notifyError) {
      console.error('Failed to send approver notifications:', notifyError);
    }

    setLoading(false);
    setAmount('');
    setPurpose('');
    setNotice('Request submitted. The approvers have been notified.');
    setTimeout(() => setNotice(''), 6000);
    loadData();
  }

  async function submitDecision(withdrawalId: string, decision: 'approved' | 'rejected', reason: string | null) {
    setActionError('');
    setBusyId(withdrawalId);

    const { error: decisionError } = await supabase.from('withdrawal_approvals').insert({
      withdrawal_id: withdrawalId,
      approver_id: userId,
      decision,
      reason: reason || null,
    });

    setBusyId(null);
    if (decisionError) {
      setActionError(decisionError.message);
      return false;
    }
    await loadData();
    return true;
  }

  async function handleApprove(r: WithdrawalRequest) {
    const sure = window.confirm(
      `Approve ${currency} ${r.amount.toLocaleString()} for "${r.purpose}"? Your decision cannot be undone.`
    );
    if (!sure) return;
    await submitDecision(r.id, 'approved', null);
  }

  async function handleConfirmReject() {
    if (!rejecting) return;
    const ok = await submitDecision(rejecting.id, 'rejected', rejectReason.trim() || null);
    if (ok) {
      setRejecting(null);
      setRejectReason('');
    }
  }

  async function handleViewDocument(path: string) {
    setActionError('');
    // Open the tab straight away so the browser doesn't block it, then point it at the file.
    const win = window.open('', '_blank');
    const { data, error: signError } = await supabase.storage
      .from('project-documents')
      .createSignedUrl(path, 60);

    if (signError || !data) {
      win?.close();
      setActionError(signError?.message ?? 'Could not open this document.');
      return;
    }
    if (win) win.location.href = data.signedUrl;
    else window.location.href = data.signedUrl;
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
        <p style={{ marginBottom: 16 }}>You&apos;re not a member of this project.</p>
        <a href="/dashboard">Back to dashboard</a>
      </main>
    );
  }

  const pending = requests.filter((r) => r.status === 'pending');
  const approvedTotal = requests
    .filter((r) => r.status === 'approved' || r.status === 'paid')
    .reduce((sum, r) => sum + r.amount, 0);

  const counts: Record<Filter, number> = {
    all: requests.length,
    pending: pending.length,
    approved: requests.filter((r) => matchesFilter(r.status, 'approved')).length,
    rejected: requests.filter((r) => r.status === 'rejected').length,
  };
  const visible = requests.filter((r) => matchesFilter(r.status, filter));

  const amountNumber = Number(amount);
  const overBalance = available !== null && amountNumber > available;

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ];

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '24px 22px 8px' }}>
      <PageHeader
        backHref={`/projects/${projectId}`}
        backLabel="Back to project"
        title="Withdrawal requests"
        subtitle="Money only leaves the project when the approvers agree."
      />

      {/* ---------- SUMMARY ---------- */}
      <div
        className="k-rise"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, animationDelay: '0.05s' }}
      >
        <StatTile label="AVAILABLE" bg="var(--tile-mint-bg)" ink="var(--tile-mint-ic)">
          {currency} <CountUp value={available ?? 0} />
        </StatTile>
        <StatTile label="PENDING" bg="var(--tile-sand-bg)" ink="var(--tile-sand-ic)">
          <CountUp value={pending.length} />
        </StatTile>
        <StatTile label="APPROVED" bg="var(--tile-sky-bg)" ink="var(--tile-sky-ic)">
          {currency} <CountUp value={approvedTotal} />
        </StatTile>
      </div>

      {/* ---------- REQUEST A WITHDRAWAL ---------- */}
      {canRequest && (
        <div style={{ marginTop: 16 }}>
          <Section
            title="Request a withdrawal"
            hint={
              available !== null
                ? `Available to withdraw: ${currency} ${available.toLocaleString()}`
                : undefined
            }
            delay={0.1}
            icon={<path d="M7 17L17 7M9 7h8v8" />}
          >
            <form onSubmit={handleCreateRequest} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Amount">
                <CurrencyInput currency={currency} value={amount} onChange={setAmount} placeholder="Amount" required />
              </Field>
              {available !== null && available > 0 && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <FilterChip
                    label={`Max ${available.toLocaleString()}`}
                    selected={amountNumber === available}
                    onClick={() => setAmount(String(available))}
                  />
                </div>
              )}
              {overBalance && (
                <Notice kind="info">
                  This is more than the available balance. The request will be refused unless more contributions are
                  confirmed first.
                </Notice>
              )}
              <Field label="What is it for?">
                <input
                  type="text"
                  placeholder="e.g. Pay venue deposit"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  required
                  style={{ width: '100%' }}
                />
              </Field>
              {error && <Notice kind="error">{error}</Notice>}
              {notice && <Notice kind="success">✓ {notice}</Notice>}
              <button type="submit" disabled={loading} style={{ height: 48 }}>
                {loading ? 'Submitting...' : 'Submit request'}
              </button>
            </form>
          </Section>
        </div>
      )}

      {/* ---------- ALL REQUESTS ---------- */}
      <h2 style={{ margin: '26px 0 10px', fontSize: 17 }}>All requests</h2>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {filters.map((f) => (
          <FilterChip
            key={f.key}
            label={`${f.label} · ${counts[f.key]}`}
            selected={filter === f.key}
            onClick={() => setFilter(f.key)}
          />
        ))}
      </div>

      {actionError && (
        <div style={{ marginBottom: 12 }}>
          <Notice kind="error">{actionError}</Notice>
        </div>
      )}

      {loadingList && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1].map((i) => (
            <div key={i} className="k-skeleton" style={{ height: 120, borderRadius: 18 }} />
          ))}
        </div>
      )}

      {!loadingList && requests.length === 0 && (
        <p className="muted-text" style={{ fontSize: 13 }}>
          No withdrawal requests yet.
        </p>
      )}
      {!loadingList && requests.length > 0 && visible.length === 0 && (
        <p className="muted-text" style={{ fontSize: 13 }}>
          Nothing in this category.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {visible.map((r, index) => {
          const alreadyVoted = r.withdrawal_approvals.some((a) => a.approver_id === userId);
          const isRequester = r.requester_id === userId;
          const look = statusLook(r.status);
          const approvedCount = r.withdrawal_approvals.filter((a) => a.decision === 'approved').length;
          const rejectedCount = r.withdrawal_approvals.filter((a) => a.decision === 'rejected').length;
          const busy = busyId === r.id;

          return (
            <article
              key={r.id}
              className="k-rise"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-track)',
                borderRadius: 18,
                padding: 16,
                boxShadow: '0 4px 14px var(--color-shadow)',
                animationDelay: `${Math.min(index * 0.05, 0.4)}s`,
                opacity: busy ? 0.6 : 1,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div style={{ fontFamily: 'var(--font-heading), sans-serif', fontWeight: 700, fontSize: 20 }}>
                  {currency} {r.amount.toLocaleString()}
                </div>
                <Pill text={r.status} bg={look.bg} ink={look.ink} />
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.45 }}>{r.purpose}</p>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>
                Requested by {nameById[r.requester_id] ?? 'someone'} · {timeAgo(r.created_at)}
              </div>

              {/* Votes */}
              <div style={{ marginTop: 12 }}>
                {r.withdrawal_approvals.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                    {r.status === 'pending' ? 'Waiting for approvers to respond.' : 'No approvals recorded.'}
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      {r.withdrawal_approvals.map((a) => (
                        <span
                          key={a.id}
                          title={`${nameById[a.approver_id] ?? 'Unknown'}: ${a.decision}`}
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: a.decision === 'approved' ? 'var(--color-primary)' : 'var(--color-danger)',
                          }}
                        />
                      ))}
                      <span style={{ fontSize: 12, color: 'var(--color-muted)', marginLeft: 4 }}>
                        {approvedCount} approved · {rejectedCount} rejected
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {r.withdrawal_approvals.map((a) => (
                        <div key={a.id}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                            <Avatar url={avatarById[a.approver_id]} name={nameById[a.approver_id]} size={24} />
                            <span>
                              {nameById[a.approver_id] ?? 'Unknown'}{' '}
                              <strong
                                style={{
                                  color: a.decision === 'approved' ? 'var(--color-primary)' : 'var(--color-danger)',
                                }}
                              >
                                {a.decision}
                              </strong>
                            </span>
                          </div>
                          {a.reason && (
                            <div style={{ fontStyle: 'italic', fontSize: 13, marginLeft: 32, marginTop: 2, color: 'var(--color-muted)' }}>
                              &ldquo;{a.reason}&rdquo;
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Evidence */}
              {r.documents.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-muted)', marginBottom: 6 }}>
                    EVIDENCE
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {r.documents.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => handleViewDocument(d.storage_path)}
                        style={{
                          ...outlineButton,
                          border: '1px solid var(--color-input-border)',
                          height: 32,
                          padding: '0 12px',
                          fontSize: 12,
                          textTransform: 'capitalize',
                        }}
                      >
                        {d.type}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(myRole === 'organizer' || myRole === 'administrator') && (
                <DocumentUploader projectId={projectId} withdrawalId={r.id} onUploaded={loadData} />
              )}

              {canApprove && !isRequester && !alreadyVoted && r.status === 'pending' && (
                <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                  <button onClick={() => handleApprove(r)} disabled={busy} style={{ flex: 1, height: 42, padding: 0 }}>
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      setRejecting(r);
                      setRejectReason('');
                      setActionError('');
                    }}
                    disabled={busy}
                    style={{ ...dangerButton, flex: 1, height: 42, padding: 0 }}
                  >
                    Reject
                  </button>
                </div>
              )}
              {isRequester && r.status === 'pending' && (
                <p className="muted-text" style={{ marginTop: 10, fontSize: 12 }}>
                  You requested this, so you cannot approve your own request.
                </p>
              )}
            </article>
          );
        })}
      </div>

      {/* ---------- REJECT BOX ---------- */}
      {rejecting && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Reject this request"
          onClick={() => setRejecting(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            className="card k-rise"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 420, borderRadius: 20, padding: 20 }}
          >
            <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>Reject this request?</h2>
            <p className="muted-text" style={{ margin: '0 0 12px', fontSize: 13 }}>
              {currency} {rejecting.amount.toLocaleString()} for &ldquo;{rejecting.purpose}&rdquo;. Your decision cannot be
              undone.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Optional: tell the organizer why"
              style={{ width: '100%' }}
            />
            {actionError && (
              <div style={{ marginTop: 10 }}>
                <Notice kind="error">{actionError}</Notice>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                onClick={() => setRejecting(null)}
                style={{ ...outlineButton, flex: 1, height: 44, padding: 0 }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={busyId === rejecting.id}
                style={{ flex: 1, height: 44, padding: 0, background: 'var(--color-danger)' }}
              >
                {busyId === rejecting.id ? 'Rejecting...' : 'Reject request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}