import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import { toBackendError } from './errors';
import { getSupabase } from './supabase';

export async function getSession(): Promise<Session | null> {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw toBackendError(error);
  return data.session;
}

export function onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
  return getSupabase().auth.onAuthStateChange(callback).data.subscription;
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) throw toBackendError(error);
}

export async function signUp(email: string, password: string, displayName: string): Promise<boolean> {
  const { data, error } = await getSupabase().auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName.trim() } },
  });
  if (error) throw toBackendError(error);
  return data.session === null;
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw toBackendError(error);
}
