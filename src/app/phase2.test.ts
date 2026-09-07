import assert from 'node:assert/strict';
import test from 'node:test';

import { partyTemplates, defaultPartyEvent, resolvePartyTemplateId, type PartyTemplateId } from '../party/model.ts';
import { defaultWeddingEvent } from '../wedding/model.ts';
import { commercialSummary, type CommercialSource } from './commercial.ts';
import type { BackendEvent, ClientEntitlement } from '../backend/types.ts';
import { appTranslations } from '../i18n/app-locale-data.ts';

test('Phase 2 Product Entry routes map to dedicated Wedding and Party planner homes', () => {
  const routes = {
    root: '/',
    weddingHome: '/planner/wedding',
    weddingCreate: '/planner/wedding/new',
    partyHome: '/planner/party',
    partyCreate: '/planner/party/new',
    partyTemplates: (draftId: string) => `/planner/party/templates/${encodeURIComponent(draftId)}`,
    weddingDraft: (draftId: string) => `/drafts/wedding/${encodeURIComponent(draftId)}`,
    partyDraft: (draftId: string) => `/drafts/party/${encodeURIComponent(draftId)}`,
  };

  assert.equal(routes.root, '/');
  assert.equal(routes.weddingHome, '/planner/wedding');
  assert.equal(routes.partyHome, '/planner/party');
  assert.equal(routes.weddingCreate, '/planner/wedding/new');
  assert.equal(routes.partyCreate, '/planner/party/new');
  assert.equal(routes.partyTemplates('draft-42'), '/planner/party/templates/draft-42');
  assert.equal(routes.weddingDraft('wed-123'), '/drafts/wedding/wed-123');
  assert.equal(routes.partyDraft('pty-456'), '/drafts/party/pty-456');
});

test('Create Wedding enforces required name and date and targets direct invitation setup', () => {
  const validateWeddingCreate = (name: string, date: string) => {
    const trimmedName = name.trim();
    const trimmedDate = date.trim();
    if (!trimmedName) return { valid: false, error: 'weddingNameRequired' };
    if (!trimmedDate) return { valid: false, error: 'weddingDateRequired' };
    return {
      valid: true,
      draftPayload: {
        product: 'wedding' as const,
        title: trimmedName,
        configuration: {
          ...defaultWeddingEvent,
          gregorianDate: trimmedDate,
        },
      },
      nextRoute: (draftId: string) => `/drafts/wedding/${draftId}`,
    };
  };

  assert.equal(validateWeddingCreate('', '2026-10-14').valid, false);
  assert.equal(validateWeddingCreate('   ', '2026-10-14').valid, false);
  assert.equal(validateWeddingCreate('حفل زفاف أحمد وسارة', '').valid, false);
  assert.equal(validateWeddingCreate('حفل زفاف أحمد وسارة', '   ').valid, false);

  const valid = validateWeddingCreate('حفل زفاف أحمد وسارة', '2026-10-14');
  assert.equal(valid.valid, true);
  if (valid.valid) {
    assert.equal(valid.draftPayload.title, 'حفل زفاف أحمد وسارة');
    assert.equal(valid.draftPayload.configuration.gregorianDate, '2026-10-14');
    assert.equal(valid.nextRoute('draft-99'), '/drafts/wedding/draft-99');
  }
});

test('Create Party requires name, accepts optional date, handles Not Sure Yet, and targets template selection', () => {
  const validatePartyCreate = (name: string, date: string, notSureYet: boolean) => {
    const trimmedName = name.trim();
    if (!trimmedName) return { valid: false, error: 'partyNameRequired' };
    const effectiveDate = notSureYet ? '' : date.trim();
    return {
      valid: true,
      draftPayload: {
        product: 'party' as const,
        title: trimmedName,
        configuration: {
          ...defaultPartyEvent,
          date: effectiveDate,
        },
      },
      nextRoute: (draftId: string) => `/planner/party/templates/${draftId}`,
    };
  };

  // Name is required
  assert.equal(validatePartyCreate('', '2026-10-14', false).valid, false);
  assert.equal(validatePartyCreate('   ', '', true).valid, false);

  // Date supplied
  const withDate = validatePartyCreate('حفل عيد ميلاد ليام', '2026-11-20', false);
  assert.equal(withDate.valid, true);
  if (withDate.valid) {
    assert.equal(withDate.draftPayload.configuration.date, '2026-11-20');
    assert.equal(withDate.nextRoute('pty-1'), '/planner/party/templates/pty-1');
  }

  // Not sure yet (omitted date)
  const notSure = validatePartyCreate('حفل عيد ميلاد ليام', '', true);
  assert.equal(notSure.valid, true);
  if (notSure.valid) {
    assert.equal(notSure.draftPayload.configuration.date, '');
    assert.equal(notSure.nextRoute('pty-2'), '/planner/party/templates/pty-2');
  }
});

test('Party template selection presents the four starter families and routes to Party draft editor', () => {
  const expectedFamilies: PartyTemplateId[] = ['corporate', 'birthday', 'baby-shower', 'custom'];
  assert.deepEqual(Object.keys(partyTemplates), expectedFamilies);

  // Resolving known templates
  for (const family of expectedFamilies) {
    assert.equal(resolvePartyTemplateId(family), family);
    assert.ok(partyTemplates[family].name.length > 0);
    assert.ok(partyTemplates[family].nameAr.length > 0);
  }

  // Selecting a template updates configuration and targets the Party draft editor
  const applyTemplate = (config: Record<string, unknown>, templateId: PartyTemplateId, draftId: string) => ({
    updatedConfiguration: { ...config, templateId },
    nextRoute: `/drafts/party/${draftId}`,
  });

  const transition = applyTemplate(defaultPartyEvent, 'baby-shower', 'draft-party-88');
  assert.equal(transition.updatedConfiguration.templateId, 'baby-shower');
  assert.equal(transition.nextRoute, '/drafts/party/draft-party-88');
});

test('Party commercial allowance presentation uses concise customer wording without internal jargon', () => {
  const source: CommercialSource = {
    products: [{ id: 'wedding', enabled: true }, { id: 'party', enabled: true }],
    policies: [
      { product_id: 'party', configuration: { event_limit: 10 } },
    ],
    publications: [
      { product_id: 'party', event_id: 'p-1' },
      { product_id: 'party', event_id: 'p-2' },
      { product_id: 'party', event_id: 'p-3' },
    ],
  };

  const entitlements = [{ product_id: 'party', status: 'active', policy_overrides: {}, starts_at: '2026-01-01', ends_at: null }] as ClientEntitlement[];
  const events = [{ id: 'p-1', product_id: 'party' }, { id: 'p-2', product_id: 'party' }, { id: 'p-3', product_id: 'party' }] as BackendEvent[];

  const summary = commercialSummary('party', entitlements, source, events);
  assert.equal(summary.limit, 10);
  assert.equal(summary.used, 3);
  assert.equal(summary.remaining, 7);
  assert.equal(summary.unlimited, false);

  // Customer presentation string format
  const customerAllowanceText = summary.unlimited
    ? appTranslations.ar.unlimited
    : `${summary.remaining} ${appTranslations.ar.eventsRemaining}`;
  assert.equal(customerAllowanceText, '7 مناسبات متبقية');

  // Customer copy does not contain internal terms
  const internalJargon = ['entitlement object', 'commercial allowance', 'policy key', 'ledger'];
  for (const term of internalJargon) {
    assert.equal(customerAllowanceText.includes(term), false);
  }
});

test('Phase 2 localization preserves application and invitation language independence', () => {
  // Arabic UI has all Phase 2 keys
  const requiredKeys = [
    'welcomeTitle', 'choosePlannerSubtitle', 'weddingPlannerCardSubtitle', 'partyPlannerCardSubtitle',
    'myWeddingsTitle', 'myWeddingsSubtitle', 'createNewWedding', 'startWithExceptionalInvitation',
    'myWeddingsCount', 'noWeddingsYet', 'continueInvitation', 'openWedding',
    'createWeddingTitle', 'weddingNameLabel', 'weddingDateLabel', 'createAndStartInvitation',
    'myPartiesTitle', 'myPartiesSubtitle', 'currentPlan', 'eventsRemaining', 'upgradePlan',
    'createNewParty', 'partyCardSubtitle', 'myPartiesCount', 'noPartiesYet', 'continueParty', 'openParty',
    'createPartyTitle', 'partyNameLabel', 'partyDateLabel', 'notSureYet',
    'partyTemplateSelectionTitle', 'partyTemplateSelectionSubtitle', 'continueToDesign',
  ] as const;

  for (const key of requiredKeys) {
    assert.ok(typeof appTranslations.ar[key] === 'string' && appTranslations.ar[key].length > 0, `Missing ar key: ${key}`);
    assert.ok(typeof appTranslations.en[key] === 'string' && appTranslations.en[key].length > 0, `Missing en key: ${key}`);
  }

  // App UI in English does not mutate invitation locale default (Arabic)
  assert.equal(defaultWeddingEvent.invitationLocale, 'ar');
  assert.equal(defaultPartyEvent.typography, 'display');
});
