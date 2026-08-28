import { toBackendError } from './errors';
import { getSupabase } from './supabase';
import type { ClientEntitlement } from './types';

export async function listEntitlements(): Promise<ClientEntitlement[]> {
  const { data, error } = await getSupabase()
    .from('client_entitlements')
    .select('id, client_id, product_id, status, starts_at, ends_at, policy_overrides')
    .order('product_id');
  if (error) throw toBackendError(error);
  return (data ?? []) as ClientEntitlement[];
}
