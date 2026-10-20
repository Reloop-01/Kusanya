import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getCallerId, isOrganizer } from '@/lib/apiAuth';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const callerId = await getCallerId(req);
    if (!callerId) {
      return NextResponse.json({ error: 'Please log in.' }, { status: 401 });
    }

    const { inviteToken } = await req.json();
    if (typeof inviteToken !== 'string') {
      return NextResponse.json({ error: 'Missing invite.' }, { status: 400 });
    }

    // The recipient, role and link all come from the saved invite,
    // so the caller cannot choose who gets emailed or what link they get.
    const { data: invite } = await supabaseAdmin
      .from('project_invites')
      .select('project_id, email, role, token, invited_by')
      .eq('token', inviteToken)
      .maybeSingle();

    if (
      !invite ||
      invite.invited_by !== callerId ||
      !(await isOrganizer(callerId, invite.project_id))
    ) {
      return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
    }

    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('title')
      .eq('id', invite.project_id)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    }

    const signupUrl = `${req.nextUrl.origin}/signup?invite=${invite.token}`;

    const { error: sendError } = await resend.emails.send({
      from: 'Kusanya <onboarding@resend.dev>',
      to: invite.email,
      subject: `You're invited to join "${project.title}" on Kusanya`,
      text: `Hi,\n\nYou've been invited to join "${project.title}" on Kusanya as ${invite.role}.\n\nKusanya helps groups collect and manage money transparently, with every contribution and withdrawal recorded and approved together.\n\nCreate your free account to join: ${signupUrl}`,
    });

    if (sendError) {
      console.error(`Failed to email ${invite.email}:`, sendError);
      return NextResponse.json({ error: 'Could not send the email.' }, { status: 500 });
    }

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error('send-invite error:', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
