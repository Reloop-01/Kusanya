import { supabase } from '@/lib/supabaseClient';

// BROWSER ONLY. Sends a POST request to one of our /api routes and attaches
// the logged-in user's token, so the server can check who is asking.
export async function authFetch(url: string, body: unknown): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? '';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    console.error(`Request to ${url} failed with status ${response.status}`);
  }
  return response;
}
