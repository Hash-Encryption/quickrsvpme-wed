import type { ClientEntitlement, ProductId } from '@/backend/types';

export const TEMPORARY_BUILD_EVENT_ALLOWANCE = 5;

let runtimeOverrideEnabled: boolean | null = null;

export function setBuildAccessPolicyOverride(enabled: boolean | null): void {
  runtimeOverrideEnabled = enabled;
}

export function isBuildAccessPolicyEnabled(): boolean {
  if (runtimeOverrideEnabled !== null) {
    return runtimeOverrideEnabled;
  }
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DISABLE_BUILD_ENTITLEMENTS === 'true') {
    return false;
  }
  return true;
}

export function resolveBuildEntitlements(
  rawEntitlements: ClientEntitlement[],
  clientId: string | null | undefined,
  isAuthenticated: boolean,
): ClientEntitlement[] {
  if (!isAuthenticated || !clientId) {
    return rawEntitlements;
  }

  if (!isBuildAccessPolicyEnabled()) {
    return rawEntitlements;
  }

  const products: ProductId[] = ['wedding', 'party'];
  const result: ClientEntitlement[] = [...rawEntitlements];

  for (const product of products) {
    const existing = rawEntitlements.find((item) => item.product_id === product);
    if (!existing) {
      result.push({
        id: `provisional-build-${product}-${clientId}`,
        client_id: clientId,
        product_id: product,
        status: 'active',
        starts_at: '2026-01-01T00:00:00.000Z',
        ends_at: null,
        policy_overrides: {
          event_limit: TEMPORARY_BUILD_EVENT_ALLOWANCE,
          publication_limit: TEMPORARY_BUILD_EVENT_ALLOWANCE,
          temporary_build_access: true,
        },
      });
    }
  }

  return result;
}
