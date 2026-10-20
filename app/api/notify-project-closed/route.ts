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

    const { projectId } = await req.json();
    if (typeof projectId !== 'string') {
      return NextResponse.json({ error: 'Missing project.' }, { status: 400 });
    }

    // Only the project's organizer can trigger this.
    if (!(await isOrganizer(callerId, projectId))) {
      return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
    }

    // The title and status come from the database, and the project
    // must genuinely be closed.
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('title, status')
      .eq('id', projectId)
      .single();

    if (!project || !['completed', 'cancelled'].includes(project.status)) {
      return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
    }

    const { data: members } = await supabaseAdmin
      .from('project_members')
      .select('user_id')
      .eq('project_id', projectId);

    const userIds = (members ?? []).map((m) => m.user_id);
    if (userIds.length === 0) return NextResponse.json({ sent: 0 });

    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .in('id', userIds);

    const link = `${req.nextUrl.origin}/projects/${projectId}`;
    let sent = 0;
    for (const profile of profiles ?? []) {
      if (!profile.email) continue;
      const { error: sendError } = await resend.emails.send({
        from: 'Kusanya <onboarding@resend.dev>',
        to: profile.email,
        subject: `${project.title} has been marked as ${project.status}`,
        text: `Hi ${profile.full_name ?? ''},\n\n"${project.title}" has been marked as ${project.status}.\n\nView it here: ${link}`,
      });
      if (sendError) {
        console.error(`Failed to email ${profile.email}:`, sendError);
      } else {
        sent++;
      }
    }

    return NextResponse.json({ sent });
  } catch (err) {
    console.error('notify-project-closed error:', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
