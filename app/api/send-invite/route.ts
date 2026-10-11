import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { toEmail, projectTitle, role, signupUrl } = await req.json();

    const { error: sendError } = await resend.emails.send({
      from: 'Kusanya <onboarding@resend.dev>',
      to: toEmail,
      subject: `You're invited to join "${projectTitle}" on Kusanya`,
      text: `Hi,\n\nYou've been invited to join "${projectTitle}" on Kusanya as ${role}.\n\nKusanya helps groups collect and manage money transparently, with every contribution and withdrawal recorded and approved together.\n\nCreate your free account to join: ${signupUrl}`,
    });

    if (sendError) {
      console.error(`Failed to email ${toEmail}:`, sendError);
      return NextResponse.json({ error: sendError.message }, { status: 500 });
    }

    return NextResponse.json({ sent: true });
  } catch (err: any) {
    console.error('send-invite error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}