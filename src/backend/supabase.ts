import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { BackendError } from './errors';

let browserClient: SupabaseClient | undefined;
const expectedSupabaseHost = 'dfmfdlfamjgzfztupngm.supabase.co';

export function getSupabase(): SupabaseClient {
  if (browserClient) return browserClient;
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) throw new BackendError('configuration', 'Supabase public environment variables are missing.');
  if (new URL(url).hostname !== expectedSupabaseHost) throw new BackendError('configuration', 'Supabase project configuration is invalid.');
  browserClient = createClient(url, publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return browserClient;
}
