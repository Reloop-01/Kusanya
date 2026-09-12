'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Member = {
  id: string;
  user_id: string;
  role: string;
  full_name: string;
};

export default function ProjectSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('approver');
  const [minApprovals, setMinApprovals] = useState('1');
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [error, setError] = useState('');
  const [ruleError, setRuleError] = useState('');
  const [ruleSaved, setRuleSaved] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSaved, setPaymentSaved] = useState(false);
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

    if (!membership) {
      setCheckingAccess(false);
      setMyRole(null);
      return;
    }
    setMyRole(membership.role);
    setCheckingAccess(false);

    const { data: project } = await supabase
      .from('projects')
      .select('title, payment_instructions')
      .eq('id', projectId)
      .single();
    setProjectTitle(project?.title ?? '');
    setPaymentInstructions(project?.payment_instructions ?? '');

    const { data: memberRows } = await supabase
      .from('project_members')
      .select('id, user_id, role')
      .eq('project_id', projectId);

    const { data: names } = await supabase.rpc('get_project_member_names', {
      p_project_id: projectId,
    });
    const nameById: Record<string, string> = {};
    (names ?? []).forEach((n: any) => {
      nameById[n.user_id] = n.full_name;
    });

    setMembers(
      (memberRows ?? []).map((m) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        full_name: nameById[m.user_id] ?? 'Unknown',
      }))
    );

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

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data: found, error: lookupError } = await supabase
      .rpc('find_member_by_email', { lookup_email: email })
      .maybeSingle();

    if (lookupError || !found) {
      setError('No Kusanya account found with that email. They need to sign up first.');
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from('project_members').insert({
      project_id: projectId,
      user_id: (found as any).id,
      role,
    });

    setLoading(false);

    if (insertError) {
      if (insertError.code === '23505') {
        setError('This person already has a role on this project. Remove their existing role first to change it.');
      } else {
        setError(insertError.message);
      }
      return;
    }

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
      <h1>{projectTitle} — Settings</h1>

      <h2>How to contribute</h2>
      {isOrganizer ? (
        <form onSubmit={handleSavePaymentInstructions} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          <textarea
            placeholder={'e.g. M-Pesa Paybill: 247247\nAccount: PIANO2026\nPlease use your name as the reference.'}
            value={paymentInstructions}
            onChange={(e) => setPaymentInstructions(e.target.value)}
            rows={4}
            style={{ width: '100%' }}
          />
          <button type="submit">Save</button>
          {paymentSaved && <span style={{ color: 'green' }}>Saved!</span>}
          {paymentError && <p style={{ color: 'red' }}>{paymentError}</p>}
          <p style={{ color: '#666', fontSize: 14 }}>
            This is shown publicly on your project&apos;s shareable page, so anyone with the link knows exactly how to pay.
          </p>
        </form>
      ) : (
        <p style={{ whiteSpace: 'pre-line', marginBottom: 32 }}>
          {paymentInstructions || 'The organizer hasn\'t added payment instructions yet.'}
        </p>
      )}

      <h2>Team members</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {members.map((m) => (
          <li key={m.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 8 }}>
            <strong>{m.full_name}</strong> — {m.role}
          </li>
        ))}
      </ul>

      {isOrganizer ? (
        <form onSubmit={handleAddMember} style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '16px 0 32px' }}>
          <input type="email" placeholder="Their email (must already have a Kusanya account)"
            value={email} onChange={(e) => setEmail(e.target.value)} required />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="approver">Approver (can approve/reject withdrawals)</option>
            <option value="administrator">Administrator (can also record contributions)</option>
            <option value="contributor">Contributor</option>
            <option value="auditor">Auditor (view only)</option>
          </select>
          {error && <p style={{ color: 'red' }}>{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? 'Adding...' : 'Add team member'}
          </button>
        </form>
      ) : (
        <p style={{ color: '#666', fontSize: 14, margin: '16px 0 32px' }}>
          Only the organizer can add or change team members.
        </p>
      )}

      <h2>Approval rule</h2>
      {isOrganizer ? (
        <form onSubmit={handleSaveRule} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label>
            Approvals required before a withdrawal is approved:
            <input type="number" min="1" value={minApprovals}
              onChange={(e) => setMinApprovals(e.target.value)} style={{ marginLeft: 8, width: 60 }} />
          </label>
          <button type="submit">Save</button>
          {ruleSaved && <span style={{ color: 'green' }}>Saved!</span>}
        </form>
      ) : (
        <p>This project currently requires <strong>{minApprovals}</strong> approval(s) per withdrawal.</p>
      )}
      {ruleError && <p style={{ color: 'red' }}>{ruleError}</p>}
      {isOrganizer && (
        <p style={{ color: '#666', fontSize: 14 }}>
          You currently have {members.length} team member(s). The rule can&apos;t exceed the number of eligible approvers.
        </p>
      )}
    </main>
  );
}