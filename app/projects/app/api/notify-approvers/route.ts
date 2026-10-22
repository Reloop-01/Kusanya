import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getCallerId, isRecent } from '@/lib/apiAuth';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const callerId = await getCallerId(req);
    if (!callerId) {
      return NextResponse.json({ error: 'Please log in.' }, { status: 401 });
    }

    const { withdrawalId } = await req.json();
    if (typeof withdrawalId !== 'string') {
      return NextResponse.json({ error: 'Missing withdrawal.' }, { status: 400 });
    }

    // Everything in the email comes from the database, not from the request.
    const { data: request } = await supabaseAdmin
      .from('withdrawal_requests')
      .select('id, project_id, requester_id, amount, purpose, status, created_at')
      .eq('id', withdrawalId)
      .maybeSingle();

    // Only the person who made the request, only while it is pending,
    // and only shortly after it was created.
    if (
      !request ||
      request.requester_id !== callerId ||
      request.status !== 'pending' ||
      !isRecent(request.created_at, 10)
    ) {
      return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
    }

    const { data: members } = await supabaseAdmin
      .from('project_members')
      .select('user_id, role')
      .eq('project_id', request.project_id)
      .in('role', ['approver', 'administrator']);

    const eligibleUserIds = (members ?? [])
      .filter((m) => m.user_id !== request.requester_id)
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
      .eq('id', request.project_id)
      .single();

    const link = `${req.nextUrl.origin}/projects/${request.project_id}/withdrawals`;
    const amountText = Number(request.amount).toLocaleString('en-US');

    let sent = 0;
    for (const profile of profiles ?? []) {
      if (!profile.email) continue;
      const { error: sendError } = await resend.emails.send({
        from: 'Kusanya <onboarding@resend.dev>',
        to: profile.email,
        subject: `Approval needed: ${project?.title ?? 'a project'}`,
        text: `Hi ${profile.full_name ?? ''},\n\nA new withdrawal request for KES ${amountText} ("${request.purpose}") needs your approval on "${project?.title}".\n\nReview it here: ${link}`,
      });
      if (sendError) {
        console.error(`Failed to email ${profile.email}:`, sendError);
      } else {
        sent++;
      }
    }

    return NextResponse.json({ sent });
  } catch (err) {
    console.error('notify-approvers error:', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
