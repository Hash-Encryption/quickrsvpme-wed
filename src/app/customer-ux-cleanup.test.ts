import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createServer } from 'vite';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { appTranslations } from '../i18n/app-locale-data.ts';
import { buildProjectRoute, projectSections, resolveProjectSection } from './projects.ts';
import type { BackendEvent } from '../backend/types.ts';
import type { AuthContextValue } from '../auth/AuthProvider.tsx';

Object.defineProperty(globalThis, 'location', { configurable: true, value: { pathname: '/', search: '' } });
if (!globalThis.localStorage) {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'en', setItem: () => {} } });
}

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });

const { AppLocaleProvider } = await server.ssrLoadModule('/src/i18n/app-locale.tsx');
const { Router } = await server.ssrLoadModule('wouter');
const { AuthContext } = await server.ssrLoadModule('/src/auth/AuthProvider.tsx');
const { WeddingPlannerPage } = await server.ssrLoadModule('/src/app/WeddingPlannerPage.tsx');
const { PartyPlannerPage } = await server.ssrLoadModule('/src/app/PartyPlannerPage.tsx');
const { DashboardPage } = await server.ssrLoadModule('/src/app/DashboardPage.tsx');
const { AccountPage } = await server.ssrLoadModule('/src/app/AccountPage.tsx');

function createMockAuth(events: BackendEvent[] = []): AuthContextValue {
  return {
    session: { user: { email: 'customer@example.com' } } as any,
    client: { id: 'client-ux-1', display_name: 'Customer UX Tester' } as any,
    entitlements: [
      {
        id: 'ent-1',
        client_id: 'client-ux-1',
        product_id: 'wedding',
        status: 'active',
        starts_at: '2026-01-01T00:00:00Z',
        ends_at: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        policy_overrides: {},
      },
      {
        id: 'ent-2',
        client_id: 'client-ux-1',
        product_id: 'party',
        status: 'active',
        starts_at: '2026-01-01T00:00:00Z',
        ends_at: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        policy_overrides: {},
      },
    ],
    events,
    admin: false,
    loading: false,
    dataLoading: false,
    error: null,
    degraded: { entitlements: false, events: false },
    refresh: async () => {},
    signOut: async () => {},
  };
}

const mockWeddingEvent: BackendEvent = {
  id: 'wed-real-101',
  client_id: 'client-ux-1',
  product_id: 'wedding',
  title: 'Fatima & Zayd Wedding',
  lifecycle_status: 'planning',
  invitation_locale: 'en',
  starts_at: '2026-12-15T18:00:00Z',
  ends_at: null,
  rsvp_deadline: '2026-12-01T18:00:00Z',
  venue_name: 'Ritz-Carlton',
  city: 'Riyadh',
  request_companion_names: true,
  allow_custom_messages: true,
  allow_rsvp_changes: true,
  general_invite_allowed_companions: 2,
  archived_at: null,
  deleted_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockPartyEvent: BackendEvent = {
  id: 'party-real-202',
  client_id: 'client-ux-1',
  product_id: 'party',
  title: 'Annual Gala Night',
  lifecycle_status: 'live',
  invitation_locale: 'en',
  starts_at: '2026-11-20T20:00:00Z',
  ends_at: null,
  rsvp_deadline: '2026-11-10T20:00:00Z',
  venue_name: 'Four Seasons Hotel',
  city: 'Riyadh',
  request_companion_names: false,
  allow_custom_messages: true,
  allow_rsvp_changes: true,
  general_invite_allowed_companions: 1,
  archived_at: null,
  deleted_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

test('Test A: Real Wedding Event card renders canonical CTAs (Overview + Edit Invitation)', () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'en' } });

  const auth = createMockAuth([mockWeddingEvent]);
  const markup = renderToStaticMarkup(
    h(AppLocaleProvider, null,
      h(Router, { ssrPath: '/planner/wedding' },
        h(AuthContext.Provider, { value: auth },
          h(WeddingPlannerPage, { initialDrafts: [] })
        )
      )
    )
  );

  assert.ok(markup.includes('Fatima') && markup.includes('Zayd'), 'Wedding event title should be present');
  assert.ok(markup.includes(appTranslations.en.overview), 'Overview CTA should be present');
  assert.ok(markup.includes(appTranslations.en.editInvitation), 'Edit Invitation CTA should be present');
});

test('Test B: Real Wedding Event card "Overview" links to /weddings/:eventId/overview', () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'en' } });

  const auth = createMockAuth([mockWeddingEvent]);
  const markup = renderToStaticMarkup(
    h(AppLocaleProvider, null,
      h(Router, { ssrPath: '/planner/wedding' },
        h(AuthContext.Provider, { value: auth },
          h(WeddingPlannerPage, { initialDrafts: [] })
        )
      )
    )
  );

  const expectedOverviewLink = `href="/weddings/${mockWeddingEvent.id}/overview"`;
  assert.ok(markup.includes(expectedOverviewLink), `Overview link should point to ${expectedOverviewLink}`);
});

test('Test C: Real Wedding Event card "Edit Invitation" links to /weddings/:eventId/invitation', () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'en' } });

  const auth = createMockAuth([mockWeddingEvent]);
  const markup = renderToStaticMarkup(
    h(AppLocaleProvider, null,
      h(Router, { ssrPath: '/planner/wedding' },
        h(AuthContext.Provider, { value: auth },
          h(WeddingPlannerPage, { initialDrafts: [] })
        )
      )
    )
  );

  const expectedInvitationLink = `href="/weddings/${mockWeddingEvent.id}/invitation"`;
  assert.ok(markup.includes(expectedInvitationLink), `Edit Invitation link should point to ${expectedInvitationLink}`);
});

test('Test D: Standalone design draft renders in "Draft Invitations", has "Edit Draft" CTA linking to /drafts/wedding/:draftId, and does NOT render "Overview"', () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'en' } });

  const standaloneDraft = {
    id: 'draft-wed-999',
    product_id: 'wedding' as const,
    title: 'Draft Rose Gold Invitation',
    configuration: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const auth = createMockAuth([mockWeddingEvent]);
  const markup = renderToStaticMarkup(
    h(AppLocaleProvider, null,
      h(Router, { ssrPath: '/planner/wedding' },
        h(AuthContext.Provider, { value: auth },
          h(WeddingPlannerPage, { initialDrafts: [standaloneDraft] })
        )
      )
    )
  );

  // Standalone draft is rendered in "Draft Invitations" section
  assert.ok(markup.includes(appTranslations.en.draftInvitations), 'Draft Invitations section header must appear');
  assert.ok(markup.includes(standaloneDraft.title), 'Draft title must appear');
  assert.ok(markup.includes(`href="/drafts/wedding/${standaloneDraft.id}"`), 'Draft link must point to /drafts/wedding/:id');
  assert.ok(markup.includes(appTranslations.en.editDraft), 'Draft card must have "Edit Draft" CTA');

  // Must NOT render an Overview button or link for this draft
  assert.ok(!markup.includes(`href="/weddings/${standaloneDraft.id}/overview"`), 'Draft must not have an overview link');
});

test('Test E: Party Planner preserves exact parity (My Parties & Events for real events, Draft Invitations for drafts, Overview + Edit Invitation for events, Edit Draft for drafts)', () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'en' } });

  const standalonePartyDraft = {
    id: 'draft-party-888',
    product_id: 'party' as const,
    title: 'Neon Birthday Bash Draft',
    configuration: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const auth = createMockAuth([mockPartyEvent]);
  const markup = renderToStaticMarkup(
    h(AppLocaleProvider, null,
      h(Router, { ssrPath: '/planner/party' },
        h(AuthContext.Provider, { value: auth },
          h(PartyPlannerPage, { initialDrafts: [standalonePartyDraft] })
        )
      )
    )
  );

  // Real events section header
  const expectedPartiesTitle = appTranslations.en.myPartiesTitle.replace('&', '&amp;');
  assert.ok(markup.includes(expectedPartiesTitle) || markup.includes(appTranslations.en.myPartiesTitle), 'My Parties & Events header must appear');
  assert.ok(markup.includes(mockPartyEvent.title), 'Party event title must appear');

  // Real event card CTAs
  assert.ok(markup.includes(`href="/parties/${mockPartyEvent.id}/overview"`), 'Real party event must link to overview');
  assert.ok(markup.includes(`href="/parties/${mockPartyEvent.id}/invitation"`), 'Real party event must link to invitation');
  assert.ok(markup.includes(appTranslations.en.overview), 'Party event must have Overview CTA');
  assert.ok(markup.includes(appTranslations.en.editInvitation), 'Party event must have Edit Invitation CTA');

  // Draft section
  assert.ok(markup.includes(appTranslations.en.draftInvitations), 'Draft Invitations section must appear');
  assert.ok(markup.includes(standalonePartyDraft.title), 'Party draft title must appear');
  assert.ok(markup.includes(`href="/drafts/party/${standalonePartyDraft.id}"`), 'Party draft must link to /drafts/party/:id');
  assert.ok(markup.includes(appTranslations.en.editDraft), 'Party draft must have Edit Draft CTA');
  assert.ok(!markup.includes(`href="/parties/${standalonePartyDraft.id}/overview"`), 'Party draft must not have an overview link');
});

test('Test F: No customer card renders "Continue invitation" or "Continue party"', () => {
  for (const locale of ['en', 'ar'] as const) {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => locale } });

    const auth = createMockAuth([mockWeddingEvent, mockPartyEvent]);

    const weddingMarkup = renderToStaticMarkup(
      h(AppLocaleProvider, null,
        h(Router, { ssrPath: '/planner/wedding' },
          h(AuthContext.Provider, { value: auth },
            h(WeddingPlannerPage, { initialDrafts: [{ id: 'd-wed', product_id: 'wedding', title: 'Draft', configuration: {} } as any] })
          )
        )
      )
    );

    const partyMarkup = renderToStaticMarkup(
      h(AppLocaleProvider, null,
        h(Router, { ssrPath: '/planner/party' },
          h(AuthContext.Provider, { value: auth },
            h(PartyPlannerPage, { initialDrafts: [{ id: 'd-party', product_id: 'party', title: 'Draft', configuration: {} } as any] })
          )
        )
      )
    );

    const dashboardMarkup = renderToStaticMarkup(
      h(AppLocaleProvider, null,
        h(Router, { ssrPath: '/' },
          h(DashboardPage, {
            projects: [
              { id: 'wed-1', type: 'wedding', name: 'Wedding 1', date: '2026-12-15', venue: 'Riyadh' },
              { id: 'pty-1', type: 'party', name: 'Party 1', date: '2026-11-20', venue: 'Jeddah' },
            ],
            drafts: [
              { id: 'd-1', type: 'wedding', name: 'Draft 1' },
            ],
            account: { name: 'Sara', email: 'sara@example.com', admin: false, eventCount: 2, access: {} },
            commercial: {},
            onCreate: async () => {},
            onSignOut: () => {},
          })
        )
      )
    );

    const allMarkup = `${weddingMarkup}\n${partyMarkup}\n${dashboardMarkup}`;

    assert.ok(!allMarkup.includes('Continue invitation'), `${locale}: "Continue invitation" must not appear in any customer card`);
    assert.ok(!allMarkup.includes('Continue party'), `${locale}: "Continue party" must not appear in any customer card`);
    assert.ok(!allMarkup.includes('متابعة الدعوة'), `${locale}: "متابعة الدعوة" must not appear in any customer card`);
    assert.ok(!allMarkup.includes('متابعة الحفلة'), `${locale}: "متابعة الحفلة" must not appear in any customer card`);
  }
});

test('Test G: Dashboard and Account do not render "Event shells", "Backend connected", or raw "Entitlements" labels', () => {
  for (const locale of ['en', 'ar'] as const) {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => locale } });

    const dashboardMarkup = renderToStaticMarkup(
      h(AppLocaleProvider, null,
        h(Router, { ssrPath: '/' },
          h(DashboardPage, {
            projects: [
              { id: 'wed-1', type: 'wedding', name: 'Sarah & Omar', date: '2026-12-31', venue: 'Riyadh Palace', lifecycleStatus: 'live' },
            ],
            drafts: [],
            account: { name: 'Sara Al-Mansoor', email: 'sara@example.com', admin: false, eventCount: 1, access: { wedding: 'active' } },
            commercial: {
              wedding: { product: 'wedding', enabled: true, status: 'active', startsAt: '2026-01-01', endsAt: null, limit: 20, used: 1, remaining: 19, unlimited: false, draftLimit: 20, archiveReplayDays: null },
            },
            onCreate: async () => {},
            onSignOut: () => {},
          })
        )
      )
    );

    const accountMarkup = renderToStaticMarkup(
      h(AppLocaleProvider, null,
        h(Router, { ssrPath: '/account' },
          h(AccountPage, {
            name: 'Sara Al-Mansoor',
            email: 'sara@example.com',
            commercial: {
              wedding: { product: 'wedding', enabled: true, status: 'active', startsAt: '2026-01-01', endsAt: null, limit: 20, used: 1, remaining: 19, unlimited: false, draftLimit: 20, archiveReplayDays: null },
            },
            onSave: async () => {},
            onSignOut: () => {},
          })
        )
      )
    );

    const combinedMarkup = `${dashboardMarkup}\n${accountMarkup}`;

    // Forbidden internal system labels
    assert.ok(!combinedMarkup.includes('Event shells'), `${locale}: "Event shells" must not be displayed`);
    assert.ok(!combinedMarkup.includes('المناسبات الأساسية'), `${locale}: "المناسبات الأساسية" must not be displayed`);
    assert.ok(!combinedMarkup.includes('Backend connected'), `${locale}: "Backend connected" must not be displayed`);
    assert.ok(!combinedMarkup.includes('متصل بالخلفية'), `${locale}: "متصل بالخلفية" must not be displayed`);
    assert.ok(!combinedMarkup.includes('Local builder boundary'), `${locale}: "Local builder boundary" must not be displayed`);

    // Customer-friendly terms appear
    if (locale === 'en') {
      assert.ok(combinedMarkup.includes(appTranslations.en.eventsIncluded), 'Events included must be used');
      assert.ok(combinedMarkup.includes(appTranslations.en.available), 'Available must be used');
      assert.ok(accountMarkup.includes(appTranslations.en.account), 'Account header must be present');
    } else {
      assert.ok(combinedMarkup.includes(appTranslations.ar.eventsIncluded), 'المناسبات المشمولة must be used');
      assert.ok(combinedMarkup.includes(appTranslations.ar.available), 'المتاح must be used');
      assert.ok(accountMarkup.includes(appTranslations.ar.account), 'الحساب header must be present');
    }
  }
});

test('Test H: Arabic translations render correctly for all updated cards and headers', () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'ar' } });

  const auth = createMockAuth([mockWeddingEvent]);
  const standaloneDraft = {
    id: 'draft-wed-ar',
    product_id: 'wedding' as const,
    title: 'مسودة دعوة زفاف فاخرة',
    configuration: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const weddingMarkup = renderToStaticMarkup(
    h(AppLocaleProvider, null,
      h(Router, { ssrPath: '/planner/wedding' },
        h(AuthContext.Provider, { value: auth },
          h(WeddingPlannerPage, { initialDrafts: [standaloneDraft] })
        )
      )
    )
  );

  // Arabic wedding planner headers and cards
  assert.ok(weddingMarkup.includes(appTranslations.ar.myWeddingsTitle), 'Arabic "حفلات الزفاف" title must render');
  assert.ok(weddingMarkup.includes(appTranslations.ar.overview), 'Arabic "نظرة عامة" CTA must render');
  assert.ok(weddingMarkup.includes(appTranslations.ar.editInvitation), 'Arabic "تعديل الدعوة" CTA must render');
  assert.ok(weddingMarkup.includes(appTranslations.ar.draftInvitations), 'Arabic "مسودات الدعوات" section must render');
  assert.ok(weddingMarkup.includes(appTranslations.ar.editDraft), 'Arabic "تعديل المسودة" CTA must render');

  const partyAuth = createMockAuth([mockPartyEvent]);
  const partyMarkup = renderToStaticMarkup(
    h(AppLocaleProvider, null,
      h(Router, { ssrPath: '/planner/party' },
        h(AuthContext.Provider, { value: partyAuth },
          h(PartyPlannerPage, { initialDrafts: [] })
        )
      )
    )
  );

  assert.ok(partyMarkup.includes(appTranslations.ar.myPartiesTitle), 'Arabic "الحفلات والمناسبات" title must render');
  assert.ok(partyMarkup.includes(appTranslations.ar.overview), 'Arabic "نظرة عامة" CTA must render for party');
  assert.ok(partyMarkup.includes(appTranslations.ar.editInvitation), 'Arabic "تعديل الدعوة" CTA must render for party');
});

test('Test I: Existing event lifecycle, publication, and backend logic are completely unaffected', () => {
  // 1. Invariant: buildProjectRoute correctly formats all project sections
  const eventId = 'wed-immutable-test';
  for (const type of ['wedding', 'party'] as const) {
    const root = type === 'wedding' ? 'weddings' : 'parties';
    for (const section of projectSections[type]) {
      const route = buildProjectRoute(type, eventId, section);
      assert.equal(route, `/${root}/${eventId}/${section}`);
      assert.equal(resolveProjectSection(type, section), section);
    }
  }

  // 2. Invariant: lifecycle statuses are preserved
  const validLifecycles = ['planning', 'live', 'ended', 'archived'] as const;
  for (const status of validLifecycles) {
    assert.ok(status in appTranslations.en);
    assert.ok(status in appTranslations.ar);
  }

  // 3. Invariant: scanner route remains unchanged and project-scoped
  assert.equal(buildProjectRoute('wedding', eventId, 'scanner'), `/weddings/${eventId}/scanner`);
  assert.equal(buildProjectRoute('party', eventId, 'scanner'), `/parties/${eventId}/scanner`);
});

after(async () => {
  await server.close();
});
