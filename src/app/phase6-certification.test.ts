import assert from 'node:assert/strict';
import test from 'node:test';

import { commercialSummary, type CommercialSource } from './commercial.ts';
import {
  TEMPORARY_BUILD_EVENT_ALLOWANCE,
  isBuildAccessPolicyEnabled,
  resolveBuildEntitlements,
} from './build-entitlements.ts';
import {
  emptyOperationalState,
  findProjectGuestByToken,
  invitationUrl,
  projectKey,
  scanProjectGuest,
  updateOperationalGuest,
  type OperationalGuest,
} from './operations.ts';
import { appTranslations } from '../i18n/app-locale-data.ts';
import { getWhatsAppShareUrl } from '../wedding/model.ts';
import { checkinStatus, extractScanToken } from '../backend/phase3-model.ts';

test('Phase 6: temporary build allowances invariant is exactly 20 across all dimensions', () => {
  assert.equal(TEMPORARY_BUILD_EVENT_ALLOWANCE, 20);

  // When policy is active, empty entitlements receive provisional 20-event allowances for wedding and party
  const provisional = resolveBuildEntitlements([], 'test-client-1', true);
  assert.equal(provisional.length, 2);

  const wedding = provisional.find((item) => item.product_id === 'wedding');
  assert.ok(wedding);
  assert.equal(wedding?.policy_overrides.event_limit, 20);
  assert.equal(wedding?.policy_overrides.publication_limit, 20);

  const party = provisional.find((item) => item.product_id === 'party');
  assert.ok(party);
  assert.equal(party?.policy_overrides.event_limit, 20);
  assert.equal(party?.policy_overrides.publication_limit, 20);
});

test('Phase 6: commercial summary truthful presentation distinguishes unavailable from none', () => {
  const source: CommercialSource = {
    products: [{ id: 'wedding', enabled: true }, { id: 'party', enabled: true }],
    policies: [
      { product_id: 'wedding', configuration: { publication_limit: 20 } },
      { product_id: 'party', configuration: { event_limit: 20 } },
    ],
    publications: null, // Ledger unavailable
  };

  const summary = commercialSummary('wedding', [], source, []);
  assert.equal(summary.status, 'none');
  assert.equal(summary.used, null);
  assert.equal(summary.remaining, null); // Must not invent fake usage
});

test('Phase 6: personalized token isolation strictly separates Guest A and Guest B across all operations', () => {
  const origin = 'https://quickrsvp.me';
  const baseUrl = '/';
  const tokenA = 'TOKEN_ALPHA_GUEST_A';
  const tokenB = 'TOKEN_BETA_GUEST_B';

  const guestA: OperationalGuest = {
    id: 'guest-a-id',
    name: 'Nora Al-Hassan',
    phone: '+966501112222',
    token: tokenA,
    allowedCompanions: 2,
    rsvp: 'accepted',
    guestCount: 2,
    message: 'Looking forward to celebrating!',
    checkedIn: false,
  };

  const guestB: OperationalGuest = {
    id: 'guest-b-id',
    name: 'Faisal Al-Otaibi',
    phone: '+966503334444',
    token: tokenB,
    allowedCompanions: 1,
    rsvp: 'pending',
    guestCount: 0,
    message: '',
    checkedIn: false,
  };

  const pKey = projectKey('wedding', 'event-proj-1');
  let state = emptyOperationalState();
  state = {
    version: 1,
    guestsByProject: {
      [pKey]: [guestA, guestB],
    },
  };

  // URL Isolation
  const urlA = invitationUrl(origin, baseUrl, tokenA);
  const urlB = invitationUrl(origin, baseUrl, tokenB);
  assert.ok(urlA.includes(tokenA));
  assert.ok(!urlA.includes(tokenB));
  assert.ok(urlB.includes(tokenB));
  assert.ok(!urlB.includes(tokenA));

  // WhatsApp share link isolation
  const waA = getWhatsAppShareUrl('wedding', 'Nora & Faisal Wedding', guestA.phone, urlA);
  const waB = getWhatsAppShareUrl('wedding', 'Nora & Faisal Wedding', guestB.phone, urlB);
  assert.ok(waA.includes(encodeURIComponent(urlA)));
  assert.ok(!waA.includes(encodeURIComponent(urlB)));
  assert.ok(waB.includes(encodeURIComponent(urlB)));
  assert.ok(!waB.includes(encodeURIComponent(urlA)));

  // Lookup isolation
  const foundA = findProjectGuestByToken(state, pKey, tokenA);
  const foundB = findProjectGuestByToken(state, pKey, tokenB);
  assert.equal(foundA?.id, 'guest-a-id');
  assert.equal(foundB?.id, 'guest-b-id');

  // Mutation isolation: updating Guest A does not mutate Guest B
  state = updateOperationalGuest(state, pKey, 'guest-a-id', { checkedIn: true });
  assert.equal(findProjectGuestByToken(state, pKey, tokenA)?.checkedIn, true);
  assert.equal(findProjectGuestByToken(state, pKey, tokenB)?.checkedIn, false);
});

test('Phase 6: scanner safety guarantees SCAN resolves details first and never automatically checks in', () => {
  const pKey = projectKey('wedding', 'event-proj-1');
  const guest: OperationalGuest = {
    id: 'guest-scanned-1',
    name: 'Sarah Al-Saud',
    phone: '+966505556666',
    token: 'QR_SCAN_SAFE_TOKEN',
    allowedCompanions: 1,
    rsvp: 'accepted',
    guestCount: 2,
    message: '',
    checkedIn: false,
  };

  const state = {
    version: 1 as const,
    guestsByProject: {
      [pKey]: [guest],
    },
  };

  // 1. Scanning returns resolution only
  const scanResult = scanProjectGuest(state, pKey, 'QR_SCAN_SAFE_TOKEN');
  assert.equal(scanResult.status, 'valid');
  assert.equal(scanResult.guestId, 'guest-scanned-1');

  // Guest is still NOT checked in in state
  assert.equal(state.guestsByProject[pKey][0].checkedIn, false);

  // 2. Token from another event is rejected
  const otherEventKey = projectKey('wedding', 'different-event-99');
  const wrongEventScan = scanProjectGuest(state, otherEventKey, 'QR_SCAN_SAFE_TOKEN');
  assert.equal(wrongEventScan.status, 'invalid');

  // 3. Headcount status safety
  assert.equal(checkinStatus(0, 2), 'not_arrived');
  assert.equal(checkinStatus(1, 2), 'partial');
  assert.equal(checkinStatus(2, 2), 'complete');
  assert.equal(checkinStatus(3, 2), 'complete'); // Overflow clamped
});

test('Phase 6: customer-facing localization contains degraded state messaging with zero backend leakage', () => {
  for (const locale of ['ar', 'en'] as const) {
    const translations = appTranslations[locale];
    assert.ok(translations.eventsLoadFailed, `Missing eventsLoadFailed in ${locale}`);
    assert.ok(translations.entitlementsLoadFailed, `Missing entitlementsLoadFailed in ${locale}`);

    // No leaked backend terms in consumer translations
    const text = `${translations.eventsLoadFailed} ${translations.entitlementsLoadFailed}`;
    assert.ok(!/supabase|rpc|sql|jwt|table|ledger/i.test(text), `Backend leak in ${locale}: ${text}`);
  }
});
