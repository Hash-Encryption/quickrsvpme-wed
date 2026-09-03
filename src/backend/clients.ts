import { toBackendError } from './errors';
import { getSupabase } from './supabase';
import type { ClientAccount } from './types';

export async function getCurrentClient(signal?: AbortSignal): Promise<ClientAccount> {
  const client = getSupabase();
  const provision = client.rpc('ensure_client_account');
  const { data: clientId, error: provisionError } = await (signal ? provision.abortSignal(signal) : provision);
  if (provisionError) throw toBackendError(provisionError);
  const account = client.from('clients').select('id, display_name, status, created_at, updated_at').eq('id', clientId);
  const { data, error } = await (signal ? account.abortSignal(signal) : account).single();
  if (error) throw toBackendError(error);
  return data as ClientAccount;
}

export async function isPlatformAdmin(signal?: AbortSignal): Promise<boolean> {
  const request = getSupabase().rpc('is_platform_admin');
  const { data, error } = await (signal ? request.abortSignal(signal) : request);
  if (error) throw toBackendError(error);
  return data === true;
}

export async function updateCurrentClientDisplayName(id: string, displayName: string): Promise<void> {
  const { error } = await getSupabase().from('clients').update({ display_name: displayName.trim() }).eq('id', id);
  if (error) throw toBackendError(error);
}
