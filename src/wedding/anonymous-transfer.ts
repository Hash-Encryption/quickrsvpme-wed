import type { ProductId } from '../backend/types.ts';

export const anonymousDesignTransferKey = 'quickrsvp-anonymous-design-transfer';
export const anonymousDesignTransferResultKey = 'quickrsvp-anonymous-design-result';
export const anonymousDesignTransferredEvent = 'quickrsvp:design-transferred';
export const anonymousDesignTransferFailedEvent = 'quickrsvp:design-transfer-failed';
export const draftTransferMarkerKey = '_quickrsvp_anonymous_source';

export function requestAnonymousDesignTransfer(product: ProductId): void {
  sessionStorage.setItem(anonymousDesignTransferKey, product);
  sessionStorage.removeItem(anonymousDesignTransferResultKey);
}

export function transferredDraftResult(product: ProductId, draftId: string): string {
  return JSON.stringify({ product, draftId });
}

export function readTransferredDraftResult(value: string | null): { product: ProductId; draftId: string } | null {
  try {
    const result = JSON.parse(value ?? '') as { product?: unknown; draftId?: unknown };
    return (result.product === 'wedding' || result.product === 'party') && typeof result.draftId === 'string' && result.draftId
      ? { product: result.product, draftId: result.draftId }
      : null;
  } catch {
    return null;
  }
}

export function withDraftTransferMarker<T extends Record<string, unknown>>(configuration: T, sourceId: string): T {
  return { ...configuration, [draftTransferMarkerKey]: sourceId };
}

export function hasDraftTransferMarker(configuration: unknown, sourceId: string): boolean {
  return Boolean(configuration && typeof configuration === 'object' && (configuration as Record<string, unknown>)[draftTransferMarkerKey] === sourceId);
}
