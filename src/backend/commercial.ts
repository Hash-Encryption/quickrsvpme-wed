import type { CommercialSource, ProductPolicy, ProductRecord } from '@/app/commercial';
import { toBackendError } from './errors';
import { getSupabase } from './supabase';

export async function loadCommercialSource(): Promise<CommercialSource> {
  const client = getSupabase();
  const [products, policies] = await Promise.all([
    client.from('products').select('id, enabled').order('id'),
    client.from('product_policies').select('product_id, configuration').order('product_id'),
  ]);
  if (products.error) throw toBackendError(products.error);
  if (policies.error) throw toBackendError(policies.error);
  return {
    products: (products.data ?? []) as ProductRecord[],
    policies: (policies.data ?? []) as ProductPolicy[],
    publications: null,
  };
}
