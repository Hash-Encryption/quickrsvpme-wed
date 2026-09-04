import assert from 'node:assert/strict';
import test from 'node:test';

import { commercialSummary, normalizePublicationPolicy, type CommercialSource } from './commercial.ts';
import type { BackendEvent, ClientEntitlement } from '../backend/types.ts';

const source: CommercialSource = {
  products: [{ id: 'wedding', enabled: true }, { id: 'party', enabled: true }],
  policies: [
    { product_id: 'wedding', configuration: { publication_limit: 1, design_draft_limit: 2 } },
    { product_id: 'party', configuration: { event_limit: 3 } },
  ],
  publications: [{ product_id: 'wedding', event_id: 'event-1' }],
};

test('commercial summaries keep products independent and entitlement overrides authoritative', () => {
  const entitlements = [{ product_id: 'wedding', status: 'active', policy_overrides: { publication_limit: 2 }, starts_at: '2026-01-01', ends_at: null }] as ClientEntitlement[];
  const events = [{ id: 'event-1', product_id: 'wedding' }] as BackendEvent[];
  assert.deepEqual(commercialSummary('wedding', entitlements, source, events), {
    product: 'wedding', enabled: true, status: 'active', startsAt: '2026-01-01', endsAt: null,
    limit: 2, used: 1, remaining: 1, unlimited: false, draftLimit: 2, archiveReplayDays: null,
  });
  assert.equal(commercialSummary('party', entitlements, source, events).status, 'none');
});

test('missing publication-ledger access stays unknown instead of inventing usage', () => {
  const summary = commercialSummary('wedding', [], { ...source, publications: null }, []);
  assert.equal(summary.used, null);
  assert.equal(summary.remaining, null);
});

test('Party publication settings feed the shared backend publication authority', () => {
  assert.deepEqual(normalizePublicationPolicy('party', { event_limit: 1 }), { event_limit: 1, publication_limit: 1 });
  assert.deepEqual(normalizePublicationPolicy('wedding', { publication_limit: 2 }), { publication_limit: 2 });
});
