import { createClient } from "@supabase/supabase-js";

/**
 * Checks a password against the Supabase project this app already uses.
 * A fresh client is created so the shared server client does not keep the session.
 * Returns false when the password is wrong or Supabase is not configured.
 */
export async function supabasePasswordMatches(email: string, password: string): Promise<boolean> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !email || !password) return false;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  // scope local only. The default scope is global and revokes every session for this user.
  await client.auth.signOut({ scope: "local" }).catch(() => undefined);
  return !error && Boolean(data.user?.id);
}
