import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { toEmail, toName, projectTitle, role, projectUrl } = await req.json();

    const { error: sendError } = await resend.emails.send({
      from: 'Kusanya <onboarding@resend.dev>',
      to: toEmail,
      subject: `You've been added to ${projectTitle}`,
      text: `Hi ${toName ?? ''},\n\nYou've been added to "${projectTitle}" on Kusanya as ${role}.\n\nOpen it here: ${projectUrl}`,
    });

    if (sendError) {
      console.error(`Failed to email ${toEmail}:`, sendError);
      return NextResponse.json({ error: sendError.message }, { status: 500 });
    }

    return NextResponse.json({ sent: true });
  } catch (err: any) {
    console.error('notify-member-added error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}