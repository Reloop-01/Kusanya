'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Avatar from '@/components/Avatar';

type Member = {
  id: string;
  user_id: string;
  role: string;
  full_name: string;
  avatar_url: string | null;
};

type Invite = {
  id: string;
  email: string;
  role: string;
  status: string;
};

export default function ProjectSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('approver');
  const [minApprovals, setMinApprovals] = useState('1');
  const [paymentInstructions, setPaymentInstructions] = useState('');

  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [visibility, setVisibility] = useState('link_only');
  const [status, setStatus] = useState('active');
  const [detailsError, setDetailsError] = useState('');
  const [detailsSaved, setDetailsSaved] = useState(false);

  const [error, setError] = useState('');
  const [notFoundEmail, setNotFoundEmail] = useState('');
  const [notFoundRole, setNotFoundRole] = useState('');
  const [ruleError, setRuleError] = useState('');
  const [ruleSaved, setRuleSaved] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSaved, setPaymentSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [invitingLoading, setInvitingLoading] = useState(false);

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

    if (!membership) {
      setCheckingAccess(false);
      setMyRole(null);
      return;
    }
    setMyRole(membership.role);
    setCheckingAccess(false);

    const { data: project } = await supabase
      .from('projects')
      .select('title, purpose, target_amount, deadline, visibility, status, payment_instructions')
      .eq('id', projectId)
      .single();

    setTitle(project?.title ?? '');
    setPurpose(project?.purpose ?? '');
    setTargetAmount(project?.target_amount != null ? String(project.target_amount) : '');
    setDeadline(project?.deadline ?? '');
    setVisibility(project?.visibility ?? 'link_only');
    setStatus(project?.status ?? 'active');
    setPaymentInstructions(project?.payment_instructions ?? '');

    const { data: memberRows } = await supabase
      .from('project_members')
      .select('id, user_id, role')
      .eq('project_id', projectId);

    const { data: names } = await supabase.rpc('get_project_member_names', {
      p_project_id: projectId,
    });
    const nameById: Record<string, string> = {};
    const avatarById: Record<string, string | null> = {};
    (names ?? []).forEach((n: any) => {
      nameById[n.user_id] = n.full_name;
      avatarById[n.user_id] = n.avatar_url;
    });

    setMembers(
      (memberRows ?? []).map((m) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        full_name: nameById[m.user_id] ?? 'Unknown',
        avatar_url: avatarById[m.user_id] ?? null,
      }))
    );

    const { data: inviteRows } = await supabase
      .from('project_invites')
      .select('id, email, role, status')
      .eq('project_id', projectId)
      .eq('status', 'pending');
    setInvites(inviteRows ?? []);

    const { data: rule } = await supabase
      .from('approval_rules')
      .select('min_approvals')
      .eq('project_id', projectId)
      .maybeSingle();

    if (rule) setMinApprovals(String(rule.min_approvals));
  }, [projectId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSaveDetails(e: React.FormEvent) {
    e.preventDefault();
    setDetailsError('');
    setDetailsSaved(false);

    const { data: current } = await supabase
      .from('projects')
      .select('status, title')
      .eq('id', projectId)
      .single();
    const previousStatus = current?.status;

    const { error: updateError } = await supabase
      .from('projects')
      .update({
        title,
        purpose,
        target_amount: Number(targetAmount),
        deadline: deadline || null,
        visibility,
        status,
      })
      .eq('id', projectId);

    if (updateError) {
      setDetailsError(updateError.message);
      return;
    }

    if (previousStatus !== status && (status === 'completed' || status === 'cancelled')) {
      try {
        await fetch('/api/notify-project-closed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, projectTitle: title, status }),
        });
      } catch (notifyError) {
        console.error('Failed to notify members of closure:', notifyError);
      }
    }

    setDetailsSaved(true);
    setTimeout(() => setDetailsSaved(false), 3000);
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotFoundEmail('');
    setLoading(true);

    const { data: found, error: lookupError } = await supabase
      .rpc('find_member_by_email', { lookup_email: email })
      .maybeSingle();

    if (lookupError || !found) {
      setNotFoundEmail(email);
      setNotFoundRole(role);
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from('project_members').insert({
      project_id: projectId,
      user_id: (found as any).id,
      role,
    });

    if (insertError) {
      setLoading(false);
      if (insertError.code === '23505') {
        setError('This person already has a role on this project. Remove their existing role first to change it.');
      } else {
        setError(insertError.message);
      }
      return;
    }

    try {
      await fetch('/api/notify-member-added', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: email,
          toName: (found as any).full_name,
          projectTitle: title,
          role,
          projectUrl: `${window.location.origin}/projects/${projectId}`,
        }),
      });
    } catch (notifyError) {
      console.error('Failed to notify new member:', notifyError);
    }

    setLoading(false);
    setEmail('');
    loadData();
  }

  async function handleSendInvite() {
    setInvitingLoading(true);
    setError('');

    const { data: userData } = await supabase.auth.getUser();

    const { data: invite, error: inviteError } = await supabase
      .from('project_invites')
      .insert({
        project_id: projectId,
        email: notFoundEmail,
        role: notFoundRole,
        invited_by: userData.user?.id,
      })
      .select()
      .single();

    if (inviteError || !invite) {
      setInvitingLoading(false);
      setError(inviteError?.message ?? 'Could not create the invite.');
      return;
    }

    try {
      await fetch('/api/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: notFoundEmail,
          projectTitle: title,
          role: notFoundRole,
          signupUrl: `${window.location.origin}/signup?invite=${invite.token}`,
        }),
      });
    } catch (sendError) {
      console.error('Failed to send invite email:', sendError);
    }

    setInvitingLoading(false);
    setNotFoundEmail('');
    setEmail('');
    loadData();
  }

  async function handleSaveRule(e: React.FormEvent) {
    e.preventDefault();
    setRuleError('');
    setRuleSaved(false);

    const { error: upsertError } = await supabase
      .from('approval_rules')
      .upsert(
        { project_id: projectId, min_approvals: Number(minApprovals), total_approvers: members.length },
        { onConflict: 'project_id' }
      );

    if (upsertError) {
      setRuleError(upsertError.message);
      return;
    }
    setRuleSaved(true);
    setTimeout(() => setRuleSaved(false), 3000);
  }

  async function handleSavePaymentInstructions(e: React.FormEvent) {
    e.preventDefault();
    setPaymentError('');
    setPaymentSaved(false);

    const { error: updateError } = await supabase
      .from('projects')
      .update({ payment_instructions: paymentInstructions })
      .eq('id', projectId);

    if (updateError) {
      setPaymentError(updateError.message);
      return;
    }
    setPaymentSaved(true);
    setTimeout(() => setPaymentSaved(false), 3000);
  }

  const isOrganizer = myRole === 'organizer';

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
      <h1>{title} — Settings</h1>

      <div className="card" style={{ marginTop: 20, marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Project details</h2>
        {isOrganizer ? (
          <form onSubmit={handleSaveDetails} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label>
              Title
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required style={{ width: '100%', marginTop: 4 }} />
            </label>
            <label>
              Purpose / description
              <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={3} style={{ width: '100%', marginTop: 4 }} />
            </label>
            <label>
              Target amount (KES)
              <input type="number" min="1" value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)} required style={{ width: '100%', marginTop: 4 }} />
            </label>
            <label>
              Deadline
              <input type="date" value={deadline ?? ''} onChange={(e) => setDeadline(e.target.value)} style={{ width: '100%', marginTop: 4 }} />
            </label>
            <label>
              Who can see this project?
              <select value={visibility} onChange={(e) => setVisibility(e.target.value)} style={{ width: '100%', marginTop: 4 }}>
                <option value="private">Private (only people I add)</option>
                <option value="link_only">Anyone with the link</option>
                <option value="public">Public</option>
              </select>
            </label>
            <label>
              Project status
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: '100%', marginTop: 4 }}>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            {detailsError && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{detailsError}</p>}
            <button type="submit">Save details</button>
            {detailsSaved && <span style={{ color: 'var(--color-primary)', fontSize: 13 }}>Saved!</span>}
          </form>
        ) : (
          <p className="muted-text">Only the organizer can edit the project&apos;s details.</p>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>How to contribute</h2>
        {isOrganizer ? (
          <form onSubmit={handleSavePaymentInstructions} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <textarea
              placeholder={'e.g. M-Pesa Paybill: 247247\nAccount: PIANO2026\nPlease use your name as the reference.'}
              value={paymentInstructions}
              onChange={(e) => setPaymentInstructions(e.target.value)}
              rows={4}
              style={{ width: '100%' }}
            />
            <button type="submit">Save</button>
            {paymentSaved && <span style={{ color: 'var(--color-primary)', fontSize: 13 }}>Saved!</span>}
            {paymentError && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{paymentError}</p>}
          </form>
        ) : (
          <p style={{ whiteSpace: 'pre-line' }}>
            {paymentInstructions || 'The organizer hasn\'t added payment instructions yet.'}
          </p>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Team members</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {members.map((m) => (
            <div
              key={m.id}
              style={{
                border: '1px solid var(--color-track)',
                borderRadius: 8,
                padding: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Avatar url={m.avatar_url} name={m.full_name} size={34} />
              <div>
                <strong>{m.full_name}</strong> <span className="muted-text">— {m.role}</span>
              </div>
            </div>
          ))}
        </div>

        {invites.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p className="muted-text" style={{ marginBottom: 6 }}>Pending invites:</p>
            {invites.map((inv) => (
              <div key={inv.id} style={{ border: '1px dashed var(--color-track)', borderRadius: 8, padding: 10, marginBottom: 6 }}>
                <span className="muted-text">{inv.email} — invited as {inv.role}</span>
              </div>
            ))}
          </div>
        )}

        {isOrganizer ? (
          <>
            <form onSubmit={handleAddMember} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input type="email" placeholder="Their email" value={email}
                onChange={(e) => { setEmail(e.target.value); setNotFoundEmail(''); }} required />
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="approver">Approver (can approve/reject withdrawals)</option>
                <option value="administrator">Administrator (can also record contributions)</option>
                <option value="contributor">Contributor</option>
                <option value="auditor">Auditor (view only)</option>
              </select>
              {error && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p>}
              <button type="submit" disabled={loading}>
                {loading ? 'Checking...' : 'Add team member'}
              </button>
            </form>

            {notFoundEmail && (
              <div style={{ marginTop: 12, padding: 12, background: 'var(--color-track)', borderRadius: 8 }}>
                <p style={{ margin: '0 0 8px', fontSize: 14 }}>
                  {notFoundEmail} doesn&apos;t have a Kusanya account yet. Invite them?
                </p>
                <button onClick={handleSendInvite} disabled={invitingLoading}>
                  {invitingLoading ? 'Sending...' : `Send invite as ${notFoundRole}`}
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="muted-text">Only the organizer can add or change team members.</p>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Approval rule</h2>
        {isOrganizer ? (
          <form onSubmit={handleSaveRule} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <label>
              Approvals required before a withdrawal is approved:
              <input type="number" min="1" value={minApprovals}
                onChange={(e) => setMinApprovals(e.target.value)} style={{ marginLeft: 8, width: 60 }} />
            </label>
            <button type="submit">Save</button>
            {ruleSaved && <span style={{ color: 'var(--color-primary)', fontSize: 13 }}>Saved!</span>}
          </form>
        ) : (
          <p>This project currently requires <strong>{minApprovals}</strong> approval(s) per withdrawal.</p>
        )}
        {ruleError && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{ruleError}</p>}
        {isOrganizer && (
          <p className="muted-text" style={{ marginTop: 8 }}>
            You currently have {members.length} team member(s). The rule can&apos;t exceed the number of eligible approvers.
          </p>
        )}
      </div>
    </main>
  );
}