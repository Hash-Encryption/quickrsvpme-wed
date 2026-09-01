import { toBackendError } from './errors';
import { getSupabase } from './supabase';
import type { ClientEntitlement } from './types';

export async function listEntitlements(signal?: AbortSignal): Promise<ClientEntitlement[]> {
  const request = getSupabase()
    .from('client_entitlements')
    .select('id, client_id, product_id, status, starts_at, ends_at, policy_overrides')
    .order('product_id');
  const { data, error } = await (signal ? request.abortSignal(signal) : request);
  if (error) throw toBackendError(error);
  return (data ?? []) as ClientEntitlement[];
}
