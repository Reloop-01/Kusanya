'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { authFetch } from '@/lib/authFetch';
import Avatar from '@/components/Avatar';
import PageHeader from '@/components/PageHeader';
import VisibilityPicker from '@/components/VisibilityPicker';
import { Section, Field, FilterChip, Pill, Notice, CurrencyInput, outlineButton } from '@/components/ui';

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

const ROLE_LOOK: Record<string, { bg: string; ink: string }> = {
  organizer: { bg: 'var(--tile-sand-bg)', ink: 'var(--tile-sand-ic)' },
  administrator: { bg: 'var(--tile-sky-bg)', ink: 'var(--tile-sky-ic)' },
  approver: { bg: 'var(--tile-mint-bg)', ink: 'var(--tile-mint-ic)' },
  auditor: { bg: 'var(--tile-peach-bg)', ink: 'var(--tile-peach-ic)' },
  contributor: { bg: 'var(--color-track)', ink: 'var(--color-muted)' },
};

const ROLE_GUIDE = [
  { role: 'organizer', text: 'Owns the project: edits its details and manages the team and rules.' },
  { role: 'administrator', text: 'Records contributions, requests withdrawals and can approve them.' },
  { role: 'approver', text: 'Approves or rejects withdrawal requests.' },
  { role: 'auditor', text: 'View only. Can see everything but change nothing.' },
  { role: 'contributor', text: 'A supporter who is part of the project.' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const JUMPS = [
  { id: 'details', label: 'Details' },
  { id: 'payment', label: 'Payment' },
  { id: 'team', label: 'Team' },
  { id: 'rule', label: 'Approvals' },
];

export default function ProjectSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [meId, setMeId] = useState('');
  const [myRole, setMyRole] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('approver');
  const [minApprovals, setMinApprovals] = useState(1);
  const [paymentInstructions, setPaymentInstructions] = useState('');

  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [currency, setCurrency] = useState('KES');
  const [targetAmount, setTargetAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [visibility, setVisibility] = useState('link_only');
  const [status, setStatus] = useState('active');
  const [detailsError, setDetailsError] = useState('');
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [detailsSaving, setDetailsSaving] = useState(false);

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
    setMeId(userData.user.id);

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
      .select('title, purpose, currency, target_amount, deadline, visibility, status, payment_instructions')
      .eq('id', projectId)
      .single();

    setTitle(project?.title ?? '');
    setPurpose(project?.purpose ?? '');
    setCurrency(project?.currency ?? 'KES');
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
    (names ?? []).forEach((n: { user_id: string; full_name: string; avatar_url: string | null }) => {
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

    if (rule) setMinApprovals(Number(rule.min_approvals));
  }, [projectId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSaveDetails(e: React.FormEvent) {
    e.preventDefault();
    setDetailsError('');
    setDetailsSaved(false);
    setDetailsSaving(true);

    const { data: current } = await supabase
      .from('projects')
      .select('status, title')
      .eq('id', projectId)
      .single();
    const previousStatus = current?.status;

    const closing = previousStatus !== status && (status === 'completed' || status === 'cancelled');
    if (closing) {
      const sure = window.confirm(
        `Mark this project as ${status}? New contributions will be blocked and all members will be notified.`
      );
      if (!sure) {
        setDetailsSaving(false);
        return;
      }
    }

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
      setDetailsSaving(false);
      setDetailsError(updateError.message);
      return;
    }

    if (closing) {
      try {
        await authFetch('/api/notify-project-closed', { projectId });
      } catch (notifyError) {
        console.error('Failed to notify members of closure:', notifyError);
      }
    }

    setDetailsSaving(false);
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

    const foundId = (found as { id: string }).id;

    const { error: insertError } = await supabase.from('project_members').insert({
      project_id: projectId,
      user_id: foundId,
      role,
    });

    if (insertError) {
      setLoading(false);
      if (insertError.code === '23505') {
        setError('This person already has a role on this project. One person can only have one role.');
      } else {
        setError(insertError.message);
      }
      return;
    }

    try {
      await authFetch('/api/notify-member-added', {
        projectId,
        memberUserId: foundId,
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
      await authFetch('/api/send-invite', { inviteToken: invite.token });
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
        { project_id: projectId, min_approvals: minApprovals, total_approvers: members.length },
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
        <p style={{ marginBottom: 16 }}>You&apos;re not a member of this project.</p>
        <a href="/dashboard">Back to dashboard</a>
      </main>
    );
  }

  const maxApprovals = Math.max(1, members.length);
  const stepperButton: React.CSSProperties = {
    width: 44,
    height: 44,
    padding: 0,
    borderRadius: '50%',
    fontSize: 22,
    lineHeight: 1,
  };

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '24px 22px 8px' }}>
      <PageHeader
        backHref={`/projects/${projectId}`}
        backLabel="Back to project"
        title="Settings"
        subtitle={title}
      />

      {/* Jump links */}
      <div className="k-rise" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, animationDelay: '0.03s' }}>
        {JUMPS.map((j) => (
          <FilterChip
            key={j.id}
            label={j.label}
            selected={false}
            onClick={() => document.getElementById(j.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          />
        ))}
        {isOrganizer && (
          <a
            href={`/projects/${projectId}/materials`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 34,
              padding: '0 14px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              border: '1.5px solid var(--color-input-border)',
              color: 'var(--color-ink)',
              textDecoration: 'none',
            }}
          >
            Photos &amp; documents →
          </a>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* ---------- PROJECT DETAILS ---------- */}
        <Section
          id="details"
          title="Project details"
          delay={0.05}
          icon={
            <>
              <path d="M5 4h11l3 3v13H5z" />
              <path d="M8 10h8M8 14h8" />
            </>
          }
        >
          {isOrganizer ? (
            <form onSubmit={handleSaveDetails} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Title">
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required style={{ width: '100%' }} />
              </Field>
              <Field label="Purpose / description">
                <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={4} style={{ width: '100%' }} />
              </Field>
              <Field label="Target amount">
                <CurrencyInput
                  currency={currency}
                  value={targetAmount}
                  onChange={setTargetAmount}
                  placeholder="Target amount"
                  required
                />
              </Field>
              <Field label="Deadline" hint="optional">
                <input
                  type="date"
                  value={deadline ?? ''}
                  onChange={(e) => setDeadline(e.target.value)}
                  style={{ width: '100%' }}
                />
              </Field>
              {deadline && (
                <div>
                  <FilterChip label="Remove deadline" selected={false} onClick={() => setDeadline('')} />
                </div>
              )}

              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Who can see this project?</div>
                <VisibilityPicker value={visibility} onChange={setVisibility} />
                {visibility === 'private' && (
                  <div style={{ marginTop: 10 }}>
                    <Notice kind="info">
                      Making a project private turns off its public link and QR code. Anyone who had the link will no
                      longer be able to open it.
                    </Notice>
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Project status</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {STATUS_OPTIONS.map((option) => (
                    <FilterChip
                      key={option.value}
                      label={option.label}
                      selected={status === option.value}
                      onClick={() => setStatus(option.value)}
                    />
                  ))}
                </div>
                {status !== 'active' && (
                  <div style={{ marginTop: 10 }}>
                    <Notice kind="info">
                      A {status} project no longer accepts contributions. Withdrawals can still be requested and
                      approved. Members are notified when you save.
                    </Notice>
                  </div>
                )}
              </div>

              {detailsError && <Notice kind="error">{detailsError}</Notice>}
              {detailsSaved && <Notice kind="success">✓ Details saved.</Notice>}
              <button type="submit" disabled={detailsSaving} style={{ height: 46 }}>
                {detailsSaving ? 'Saving...' : 'Save details'}
              </button>
            </form>
          ) : (
            <p className="muted-text" style={{ margin: 0 }}>
              Only the organizer can edit the project&apos;s details.
            </p>
          )}
        </Section>

        {/* ---------- HOW TO CONTRIBUTE ---------- */}
        <Section
          id="payment"
          title="How to contribute"
          hint="Shown to everyone who opens the project"
          delay={0.1}
          icon={
            <>
              <rect x="3" y="6" width="18" height="12" rx="2" />
              <circle cx="12" cy="12" r="2.5" />
            </>
          }
        >
          {isOrganizer ? (
            <form onSubmit={handleSavePaymentInstructions} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <textarea
                placeholder={'e.g. M-Pesa Paybill: 247247\nAccount: PIANO2026\nPlease use your name as the reference.'}
                value={paymentInstructions}
                onChange={(e) => setPaymentInstructions(e.target.value)}
                rows={5}
                style={{ width: '100%' }}
              />
              {paymentError && <Notice kind="error">{paymentError}</Notice>}
              {paymentSaved && <Notice kind="success">✓ Payment instructions saved.</Notice>}
              <button type="submit" style={{ height: 46 }}>
                Save instructions
              </button>
            </form>
          ) : (
            <p style={{ whiteSpace: 'pre-line', margin: 0, fontSize: 14 }}>
              {paymentInstructions || "The organizer hasn't added payment instructions yet."}
            </p>
          )}
        </Section>

        {/* ---------- TEAM ---------- */}
        <Section
          id="team"
          title="Team members"
          hint={`${members.length} ${members.length === 1 ? 'person' : 'people'} on this project`}
          delay={0.15}
          icon={
            <>
              <circle cx="9" cy="8" r="3.5" />
              <path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5" />
              <circle cx="17.5" cy="9" r="2.5" />
              <path d="M17 14.5c2.5 0 4.5 1.5 4.5 4" />
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {members.map((m) => {
              const look = ROLE_LOOK[m.role] ?? ROLE_LOOK.contributor;
              return (
                <div
                  key={m.id}
                  style={{
                    border: '1px solid var(--color-track)',
                    borderRadius: 14,
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <Avatar url={m.avatar_url} name={m.full_name} size={36} />
                  <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600 }}>
                    {m.full_name}
                    {m.user_id === meId && (
                      <span style={{ fontWeight: 400, color: 'var(--color-muted)' }}> (you)</span>
                    )}
                  </div>
                  <Pill text={m.role} bg={look.bg} ink={look.ink} />
                </div>
              );
            })}
          </div>

          {invites.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-muted)', marginBottom: 6 }}>
                PENDING INVITES
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {invites.map((inv) => (
                  <div
                    key={inv.id}
                    style={{
                      border: '1px dashed var(--color-input-border)',
                      borderRadius: 14,
                      padding: '10px 12px',
                      fontSize: 13,
                      color: 'var(--color-muted)',
                    }}
                  >
                    {inv.email} — invited as {inv.role}
                  </div>
                ))}
              </div>
            </div>
          )}

          {isOrganizer ? (
            <>
              <form onSubmit={handleAddMember} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Add someone</div>
                <input
                  type="email"
                  placeholder="Their email"
                  aria-label="Their email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setNotFoundEmail('');
                  }}
                  required
                />
                <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Their role">
                  <option value="approver">Approver (can approve/reject withdrawals)</option>
                  <option value="administrator">Administrator (can also record contributions)</option>
                  <option value="contributor">Contributor</option>
                  <option value="auditor">Auditor (view only)</option>
                </select>
                {error && <Notice kind="error">{error}</Notice>}
                <button type="submit" disabled={loading} style={{ height: 46 }}>
                  {loading ? 'Checking...' : 'Add team member'}
                </button>
              </form>

              {notFoundEmail && (
                <div
                  className="k-rise"
                  style={{ padding: 14, background: 'var(--tile-sand-bg)', borderRadius: 14, color: 'var(--tile-sand-ic)' }}
                >
                  <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.45 }}>
                    <strong>{notFoundEmail}</strong> doesn&apos;t have a Kusanya account yet. Invite them?
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={handleSendInvite} disabled={invitingLoading} style={{ height: 42 }}>
                      {invitingLoading ? 'Sending...' : `Send invite as ${notFoundRole}`}
                    </button>
                    <button onClick={() => setNotFoundEmail('')} style={{ ...outlineButton, height: 42 }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="muted-text" style={{ margin: 0 }}>
              Only the organizer can add or change team members.
            </p>
          )}

          {/* Role guide */}
          <div style={{ background: 'var(--color-track)', borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-muted)', marginBottom: 8 }}>
              WHAT EACH ROLE CAN DO
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ROLE_GUIDE.map((item) => {
                const look = ROLE_LOOK[item.role];
                return (
                  <div key={item.role} style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 13, lineHeight: 1.4 }}>
                    <span style={{ flexShrink: 0, width: 104 }}>
                      <Pill text={item.role} bg={look.bg} ink={look.ink} />
                    </span>
                    <span>{item.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Section>

        {/* ---------- APPROVAL RULE ---------- */}
        <Section
          id="rule"
          title="Approval rule"
          hint="How many people must agree before a withdrawal is approved"
          delay={0.2}
          icon={
            <>
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12.5l3 3 5-6" />
            </>
          }
        >
          {isOrganizer ? (
            <form onSubmit={handleSaveRule} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                <button
                  type="button"
                  aria-label="Require one fewer approval"
                  onClick={() => setMinApprovals((n) => Math.max(1, n - 1))}
                  disabled={minApprovals <= 1}
                  style={stepperButton}
                >
                  −
                </button>
                <div style={{ textAlign: 'center', minWidth: 90 }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-heading), sans-serif',
                      fontWeight: 700,
                      fontSize: 38,
                      lineHeight: 1,
                    }}
                  >
                    {minApprovals}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>
                    of {members.length} team {members.length === 1 ? 'member' : 'members'}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Require one more approval"
                  onClick={() => setMinApprovals((n) => Math.min(maxApprovals, n + 1))}
                  disabled={minApprovals >= maxApprovals}
                  style={stepperButton}
                >
                  +
                </button>
              </div>
              <p className="muted-text" style={{ margin: 0, fontSize: 12, textAlign: 'center' }}>
                The rule can&apos;t exceed the number of eligible approvers.
              </p>
              {ruleError && <Notice kind="error">{ruleError}</Notice>}
              {ruleSaved && <Notice kind="success">✓ Approval rule saved.</Notice>}
              <button type="submit" style={{ height: 46 }}>
                Save rule
              </button>
            </form>
          ) : (
            <p style={{ margin: 0, fontSize: 14 }}>
              This project currently requires <strong>{minApprovals}</strong> approval(s) per withdrawal.
            </p>
          )}
        </Section>
      </div>
    </main>
  );
}