import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { projectId, requesterId, amount, purpose } = await req.json();

    const { data: members } = await supabaseAdmin
      .from('project_members')
      .select('user_id, role')
      .eq('project_id', projectId)
      .in('role', ['approver', 'administrator']);

    const eligibleUserIds = (members ?? [])
      .filter((m) => m.user_id !== requesterId)
      .map((m) => m.user_id);

    if (eligibleUserIds.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .in('id', eligibleUserIds);

    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('title')
      .eq('id', projectId)
      .single();

    const link = `${req.nextUrl.origin}/projects/${projectId}/withdrawals`;

    let sent = 0;
    for (const profile of profiles ?? []) {
      if (!profile.email) continue;
      const { error: sendError } = await resend.emails.send({
        from: 'Kusanya <onboarding@resend.dev>',
        to: profile.email,
        subject: `Approval needed: ${project?.title ?? 'a project'}`,
        text: `Hi ${profile.full_name ?? ''},\n\nA new withdrawal request for KES ${amount} ("${purpose}") needs your approval on "${project?.title}".\n\nReview it here: ${link}`,
      });
      if (sendError) {
        console.error(`Failed to email ${profile.email}:`, sendError);
      } else {
        sent++;
      }
    }

    return NextResponse.json({ sent });
  } catch (err: any) {
    console.error('notify-approvers error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}