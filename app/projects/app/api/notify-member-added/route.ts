import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getCallerId, isOrganizer, isRecent } from '@/lib/apiAuth';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const callerId = await getCallerId(req);
    if (!callerId) {
      return NextResponse.json({ error: 'Please log in.' }, { status: 401 });
    }

    const { projectId, memberUserId } = await req.json();
    if (typeof projectId !== 'string' || typeof memberUserId !== 'string') {
      return NextResponse.json({ error: 'Missing details.' }, { status: 400 });
    }

    // Only the project's organizer can trigger this.
    if (!(await isOrganizer(callerId, projectId))) {
      return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
    }

    // The person must really have just been added to this project.
    const { data: member } = await supabaseAdmin
      .from('project_members')
      .select('user_id, role, created_at')
      .eq('project_id', projectId)
      .eq('user_id', memberUserId)
      .maybeSingle();

    if (!member || !isRecent(member.created_at, 10)) {
      return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', memberUserId)
      .maybeSingle();

    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('title')
      .eq('id', projectId)
      .single();

    if (!profile?.email || !project) {
      return NextResponse.json({ sent: false });
    }

    const projectUrl = `${req.nextUrl.origin}/projects/${projectId}`;

    const { error: sendError } = await resend.emails.send({
      from: 'Kusanya <onboarding@resend.dev>',
      to: profile.email,
      subject: `You've been added to ${project.title}`,
      text: `Hi ${profile.full_name ?? ''},\n\nYou've been added to "${project.title}" on Kusanya as ${member.role}.\n\nOpen it here: ${projectUrl}`,
    });

    if (sendError) {
      console.error(`Failed to email ${profile.email}:`, sendError);
      return NextResponse.json({ error: 'Could not send the email.' }, { status: 500 });
    }

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error('notify-member-added error:', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
