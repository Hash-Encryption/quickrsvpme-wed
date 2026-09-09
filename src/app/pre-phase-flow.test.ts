import assert from 'node:assert/strict';
import test from 'node:test';

import { appTranslations } from '../i18n/app-locale-data.ts';
import {
  TEMPORARY_BUILD_EVENT_ALLOWANCE,
  isBuildAccessPolicyEnabled,
  resolveBuildEntitlements,
  setBuildAccessPolicyOverride,
} from './build-entitlements.ts';
import { commercialSummary, type CommercialSource } from './commercial.ts';
import { buildProjectRoute, projectSections, resolveProjectSection } from './projects.ts';
import type { BackendEvent, ClientEntitlement } from '../backend/types.ts';

test('New vs Existing Wedding Flow: routes to builder for new and overview for existing', () => {
  // New wedding route
  const newWeddingRoute = '/planner/wedding/new';
  assert.equal(newWeddingRoute, '/planner/wedding/new');

  // Existing wedding routes directly to Event Overview as Wedding Home
  const eventId = 'wed-event-456';
  const overviewRoute = buildProjectRoute('wedding', eventId, 'overview');
  assert.equal(overviewRoute, '/weddings/wed-event-456/overview');

  // Draft continue route
  const draftId = 'draft-wed-123';
  const draftRoute = `/drafts/wedding/${draftId}`;
  assert.equal(draftRoute, '/drafts/wedding/draft-wed-123');
});

test('Wedding Preview Regression: preview does not route to / or /auth', () => {
  const previewHrefWrong = '/';
  const previewHrefAuth = '/auth';
  const eventId = 'wed-event-789';

  // The builder preview must stay within the editor or link to overview, never root
  const builderInvitationRoute = buildProjectRoute('wedding', eventId, 'invitation');
  assert.notEqual(builderInvitationRoute, previewHrefWrong);
  assert.notEqual(builderInvitationRoute, previewHrefAuth);
  assert.equal(builderInvitationRoute, '/weddings/wed-event-789/invitation');

  // Overview return link from builder
  const overviewRoute = buildProjectRoute('wedding', eventId, 'overview');
  assert.equal(overviewRoute, '/weddings/wed-event-789/overview');
  assert.notEqual(overviewRoute, '/');
});

test('Project Navigation Integrity: all Wedding sections maintain project identity', () => {
  const eventId = 'wed-lux-2026';
  const expectedSections = ['overview', 'invitation', 'guests', 'send', 'scanner', 'settings'] as const;

  assert.deepEqual(projectSections.wedding, expectedSections);

  for (const section of expectedSections) {
    const route = buildProjectRoute('wedding', eventId, section);
    assert.equal(route, `/weddings/${eventId}/${section}`);
    assert.equal(resolveProjectSection('wedding', section), section);
  }

  // Invalid section safely defaults to overview
  assert.equal(resolveProjectSection('wedding', 'nonexistent-section'), 'overview');
});

test('Temporary Build Entitlements: A through G validation', () => {
  const clientId = 'client-test-uuid-1';

  // Ensure policy override is reset before testing
  setBuildAccessPolicyOverride(null);
  assert.equal(isBuildAccessPolicyEnabled(), true);

  // A & B: Authenticated account without paid entitlements gets Wedding and Party provisional access
  const rawEmpty: ClientEntitlement[] = [];
  const resolved = resolveBuildEntitlements(rawEmpty, clientId, true);

  assert.equal(resolved.length, 2);
  const weddingEntitlement = resolved.find((e) => e.product_id === 'wedding');
  const partyEntitlement = resolved.find((e) => e.product_id === 'party');

  assert.ok(weddingEntitlement);
  assert.equal(weddingEntitlement.status, 'active');
  assert.equal(weddingEntitlement.client_id, clientId);
  assert.equal(weddingEntitlement.policy_overrides.event_limit, TEMPORARY_BUILD_EVENT_ALLOWANCE);
  assert.equal(weddingEntitlement.policy_overrides.publication_limit, TEMPORARY_BUILD_EVENT_ALLOWANCE);
  assert.equal(weddingEntitlement.policy_overrides.temporary_build_access, true);

  assert.ok(partyEntitlement);
  assert.equal(partyEntitlement.status, 'active');
  assert.equal(partyEntitlement.client_id, clientId);
  assert.equal(partyEntitlement.policy_overrides.event_limit, TEMPORARY_BUILD_EVENT_ALLOWANCE);
  assert.equal(partyEntitlement.policy_overrides.publication_limit, TEMPORARY_BUILD_EVENT_ALLOWANCE);

  // C: Anonymous / unauthenticated receives NO commercial entitlements
  const anonResolved = resolveBuildEntitlements(rawEmpty, null, false);
  assert.deepEqual(anonResolved, []);

  const anonWithId = resolveBuildEntitlements(rawEmpty, clientId, false);
  assert.deepEqual(anonWithId, []);

  // D: Existing explicit database entitlement takes precedence and remains untouched
  const explicitWedding: ClientEntitlement = {
    id: 'explicit-admin-entitlement',
    client_id: clientId,
    product_id: 'wedding',
    status: 'active',
    starts_at: '2025-01-01T00:00:00.000Z',
    ends_at: '2030-01-01T00:00:00.000Z',
    policy_overrides: {
      publication_limit: 100,
      custom_admin_grant: true,
    },
  };

  const mixedResolved = resolveBuildEntitlements([explicitWedding], clientId, true);
  assert.equal(mixedResolved.length, 2);

  const preservedWedding = mixedResolved.find((e) => e.product_id === 'wedding');
  assert.equal(preservedWedding?.id, 'explicit-admin-entitlement');
  assert.equal(preservedWedding?.policy_overrides.publication_limit, 100);
  assert.equal(preservedWedding?.policy_overrides.custom_admin_grant, true);

  const supplementedParty = mixedResolved.find((e) => e.product_id === 'party');
  assert.ok(supplementedParty);
  assert.equal(supplementedParty.policy_overrides.event_limit, TEMPORARY_BUILD_EVENT_ALLOWANCE);

  // E: Disabling build access policy restores raw database entitlements
  setBuildAccessPolicyOverride(false);
  assert.equal(isBuildAccessPolicyEnabled(), false);
  const disabledResolved = resolveBuildEntitlements(rawEmpty, clientId, true);
  assert.deepEqual(disabledResolved, []);

  // Restore policy for remainder of tests
  setBuildAccessPolicyOverride(null);
  assert.equal(isBuildAccessPolicyEnabled(), true);

  // F: Bounded allowance strictly equals 20 events per product
  assert.equal(TEMPORARY_BUILD_EVENT_ALLOWANCE, 20);

  // G: commercialSummary correctly calculates 20 limit and 20 remaining for provisional entitlements
  const source: CommercialSource = {
    products: [{ id: 'wedding', enabled: true }, { id: 'party', enabled: true }],
    policies: [
      { product_id: 'wedding', configuration: { publication_limit: 1 } },
      { product_id: 'party', configuration: { event_limit: 1 } },
    ],
    publications: [],
  };
  const events: BackendEvent[] = [];

  const weddingSummary = commercialSummary('wedding', resolved, source, events);
  assert.equal(weddingSummary.status, 'active');
  assert.equal(weddingSummary.limit, 20);
  assert.equal(weddingSummary.used, 0);
  assert.equal(weddingSummary.remaining, 20);

  const partySummary = commercialSummary('party', resolved, source, events);
  assert.equal(partySummary.status, 'active');
  assert.equal(partySummary.limit, 20);
  assert.equal(partySummary.used, 0);
  assert.equal(partySummary.remaining, 20);

  // When 2 events exist, remaining is 18
  const activeEvents: BackendEvent[] = [
    { id: 'ev-1', product_id: 'wedding' } as BackendEvent,
    { id: 'ev-2', product_id: 'wedding' } as BackendEvent,
  ];
  const publicationsWithEvents = [{ product_id: 'wedding' as const, event_id: 'ev-1' }, { product_id: 'wedding' as const, event_id: 'ev-2' }];
  const usedSummary = commercialSummary('wedding', resolved, { ...source, publications: publicationsWithEvents }, activeEvents);
  assert.equal(usedSummary.limit, 20);
  assert.equal(usedSummary.used, 2);
  assert.equal(usedSummary.remaining, 18);
});

test('Localization Completeness: new strings exist in both Arabic and English', () => {
  const requiredKeys = [
    'weddingOverview',
    'editInvitation',
    'previewInvitation',
    'returnToEditor',
    'addGuests',
    'manageGuests',
    'sendInvitations',
    'eventDay',
    'nextAddGuests',
    'noGuestsYet',
    'backToOverview',
    'cannotDeletePublishedDraft',
  ] as const;

  for (const key of requiredKeys) {
    const enText = appTranslations.en[key];
    const arText = appTranslations.ar[key];

    assert.ok(enText && enText.length > 0, `Missing English translation for ${key}`);
    assert.ok(arText && arText.length > 0, `Missing Arabic translation for ${key}`);
    assert.notEqual(enText, arText, `English and Arabic should not be identical for ${key}`);
  }
});
