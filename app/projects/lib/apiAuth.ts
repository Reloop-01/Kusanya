import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// SERVER ONLY. Reads the login token the browser sent along with the request
// and asks Supabase whose token it is. Returns the user's id, or null if the
// token is missing, fake, or expired.
export async function getCallerId(req: NextRequest): Promise<string | null> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

// SERVER ONLY. True if this user is the organizer (creator) of the project.
export async function isOrganizer(userId: string, projectId: unknown): Promise<boolean> {
  if (typeof projectId !== 'string') return false;

  const { data } = await supabaseAdmin
    .from('projects')
    .select('organizer_id')
    .eq('id', projectId)
    .maybeSingle();

  return !!data && data.organizer_id === userId;
}

// True if a timestamp from the database is less than `minutes` minutes old.
// Used so a notification can only be triggered right after the action it announces.
export function isRecent(timestamp: string | null | undefined, minutes: number): boolean {
  if (!timestamp) return false;
  return Date.now() - new Date(timestamp).getTime() < minutes * 60 * 1000;
}
