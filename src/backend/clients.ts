import { toBackendError } from './errors';
import { getSupabase } from './supabase';
import type { ClientAccount } from './types';

export async function getCurrentClient(): Promise<ClientAccount> {
  const client = getSupabase();
  const { data: clientId, error: provisionError } = await client.rpc('ensure_client_account');
  if (provisionError) throw toBackendError(provisionError);
  const { data, error } = await client.from('clients').select('id, display_name, status, created_at, updated_at').eq('id', clientId).single();
  if (error) throw toBackendError(error);
  return data as ClientAccount;
}

export async function isPlatformAdmin(): Promise<boolean> {
  const { data, error } = await getSupabase().rpc('is_platform_admin');
  if (error) throw toBackendError(error);
  return data === true;
}
