'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Member = {
  id: string;
  user_id: string;
  role: string;
  full_name: string | null;
};

export default function ProjectSettingsPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [projectTitle, setProjectTitle] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('approver');
  const [minApprovals, setMinApprovals] = useState('1');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    const { data: project } = await supabase
      .from('projects')
      .select('title')
      .eq('id', projectId)
      .single();
    setProjectTitle(project?.title ?? '');

    const { data: memberRows } = await supabase
      .from('project_members')
      .select('id, user_id, role, profiles(full_name)')
      .eq('project_id', projectId);

    setMembers(
      (memberRows ?? []).map((m: any) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        full_name: m.profiles?.full_name ?? 'Unknown',
      }))
    );

    const { data: rule } = await supabase
      .from('approval_rules')
      .select('min_approvals')
      .eq('project_id', projectId)
      .maybeSingle();

    if (rule) setMinApprovals(String(rule.min_approvals));
  }, [projectId]);

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
      setError(insertError.message);
      return;
    }

    setEmail('');
    loadData();
  }

  async function handleSaveRule(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const { error: upsertError } = await supabase
      .from('approval_rules')
      .upsert(
        { project_id: projectId, min_approvals: Number(minApprovals), total_approvers: members.length },
        { onConflict: 'project_id' }
      );

    if (upsertError) setError(upsertError.message);
  }

  return (
    <main style={{ maxWidth: 600, margin: '60px auto', padding: 24 }}>
      <h1>{projectTitle} — Settings</h1>

      <h2>Team members</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {members.map((m) => (
          <li key={m.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 8 }}>
            <strong>{m.full_name}</strong> — {m.role}
          </li>
        ))}
      </ul>

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

      <h2>Approval rule</h2>
      <form onSubmit={handleSaveRule} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label>
          Approvals required before a withdrawal is approved:
          <input type="number" min="1" value={minApprovals}
            onChange={(e) => setMinApprovals(e.target.value)} style={{ marginLeft: 8, width: 60 }} />
        </label>
        <button type="submit">Save</button>
      </form>
      <p style={{ color: '#666', fontSize: 14 }}>
        You currently have {members.length} team member(s). Choose a number equal to or less than that.
      </p>
    </main>
  );
}