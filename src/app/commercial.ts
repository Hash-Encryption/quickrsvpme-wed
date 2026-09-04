import type { BackendEvent, ClientEntitlement, ProductId } from '../backend/types.ts';

export type ProductPolicy = { product_id: ProductId; configuration: Record<string, unknown> };
export type ProductRecord = { id: ProductId; enabled: boolean };
export type PublicationRecord = { product_id?: ProductId; event_id?: string };
export type CommercialSource = {
  products: ProductRecord[];
  policies: ProductPolicy[];
  publications: PublicationRecord[] | null;
};

export type CommercialSummary = {
  product: ProductId;
  enabled: boolean;
  status: ClientEntitlement['status'] | 'none';
  startsAt: string | null;
  endsAt: string | null;
  limit: number | null;
  used: number | null;
  remaining: number | null;
  unlimited: boolean;
  draftLimit: number | null;
  archiveReplayDays: number | null;
};

const integer = (value: unknown): number | null => typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;

export const normalizePublicationPolicy = (product: ProductId, policy: Record<string, unknown>): Record<string, unknown> =>
  product === 'party' && policy.publication_limit === undefined && policy.event_limit !== undefined
    ? { ...policy, publication_limit: policy.event_limit }
    : policy;

export function commercialSummary(product: ProductId, entitlements: ClientEntitlement[], source: CommercialSource, events: BackendEvent[]): CommercialSummary {
  const entitlement = entitlements.find((item) => item.product_id === product);
  const policy = source.policies.find((item) => item.product_id === product)?.configuration ?? {};
  const effective = { ...policy, ...(entitlement?.policy_overrides ?? {}) };
  const limit = integer(product === 'party' ? effective.event_limit ?? effective.publication_limit : effective.publication_limit);
  const unlimited = effective.allow_unlimited_publication === true;
  const eventProducts = new Map(events.map((event) => [event.id, event.product_id]));
  const used = source.publications === null ? null : source.publications.filter((item) => item.product_id === product || (item.event_id && eventProducts.get(item.event_id) === product)).length;
  return {
    product,
    enabled: source.products.find((item) => item.id === product)?.enabled ?? false,
    status: entitlement?.status ?? 'none',
    startsAt: entitlement?.starts_at ?? null,
    endsAt: entitlement?.ends_at ?? null,
    limit,
    used,
    remaining: unlimited || limit === null || used === null ? null : Math.max(limit - used, 0),
    unlimited,
    draftLimit: integer(effective.design_draft_limit),
    archiveReplayDays: effective.archive_replay_enabled === true ? integer(effective.archive_replay_days) : null,
  };
}
