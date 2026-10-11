import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { projectId, projectTitle, status } = await req.json();

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
        subject: `${projectTitle} has been marked as ${status}`,
        text: `Hi ${profile.full_name ?? ''},\n\n"${projectTitle}" has been marked as ${status}.\n\nView it here: ${link}`,
      });
      if (sendError) {
        console.error(`Failed to email ${profile.email}:`, sendError);
      } else {
        sent++;
      }
    }

    return NextResponse.json({ sent });
  } catch (err: any) {
    console.error('notify-project-closed error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}