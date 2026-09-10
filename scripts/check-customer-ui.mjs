import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Uses the installed Vite/React runtime; no new test dependency or backend access.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const originalLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
try {
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { pathname: '/', search: '' } });
  const { Button, Chip, LoadingState, CustomerBottomNav } = await server.ssrLoadModule('/src/components/customer-ui.tsx');
  const { ProjectShell } = await server.ssrLoadModule('/src/app/ProjectShell.tsx');
  const { AppLocaleProvider, appTranslations } = await server.ssrLoadModule('/src/i18n/app-locale.tsx');
  const { Router } = await server.ssrLoadModule('wouter');
  const busy = renderToStaticMarkup(h(Button, { loading: true }, 'Saving'));
  assert.match(busy, /disabled=""/);
  assert.match(busy, /aria-busy="true"/);
  assert.match(busy, /type="button"/);
  assert.match(renderToStaticMarkup(h(Button, { type: 'submit' }, 'Save')), /type="submit"/);
  assert.match(renderToStaticMarkup(h(Chip, { selected: true }, 'All')), /aria-pressed="true"/);
  assert.match(renderToStaticMarkup(h(Chip, { selected: false, disabled: true }, 'Unavailable')), /disabled=""/);
  assert.match(renderToStaticMarkup(h(LoadingState, { label: 'Loading' })), /role="status"/);

  // Check CustomerBottomNav
  for (const activeTab of ['home', 'wedding', 'party', 'account']) {
    const navMarkup = renderToStaticMarkup(h(AppLocaleProvider, null, h(Router, null, h(CustomerBottomNav, { active: activeTab }))));
    assert.ok(navMarkup.includes('href="/"'));
    assert.ok(navMarkup.includes('href="/planner/wedding"'));
    assert.ok(navMarkup.includes('href="/planner/party"'));
    assert.ok(navMarkup.includes('href="/account"'));
    assert.equal((navMarkup.match(/aria-current="page"/g) ?? []).length, 1, `CustomerBottomNav should have 1 active tab for ${activeTab}`);
  }

  for (const locale of ['ar', 'en']) {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => locale } });
    for (const type of ['wedding', 'party']) {
      const root = type === 'wedding' ? 'weddings' : 'parties';
      const markup = renderToStaticMarkup(h(AppLocaleProvider, null, h(Router, { ssrPath: `/${root}/fixture/guests` }, h(ProjectShell, { project: { id: 'fixture', type, name: 'Example', date: '', venue: '' }, section: 'guests' }, 'Content'))));
      for (const section of ['overview', 'invitation', 'guests', 'send', 'scanner', 'settings']) {
        assert.ok(markup.includes(`href="/${root}/fixture/${section}"`), `${locale}/${type}: missing ${section}`);
      }
      assert.equal((markup.match(/aria-current="page"/g) ?? []).length, 2, 'Desktop and mobile expose the same current destination');
      assert.ok(markup.includes(appTranslations[locale].guests));
    }
  }

  // Certify AccountPage in both AR and EN, including normal and degraded states
  const { AccountPage } = await server.ssrLoadModule('/src/app/AccountPage.tsx');
  for (const locale of ['ar', 'en']) {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => locale } });
    const normalHtml = renderToStaticMarkup(
      h(AppLocaleProvider, null,
        h(Router, { ssrPath: '/account' },
          h(AccountPage, {
            name: 'Sara Al-Mansoor',
            email: 'sara@example.com',
            commercial: {
              wedding: { product: 'wedding', enabled: true, status: 'active', startsAt: '2026-01-01', endsAt: null, limit: 20, used: 2, remaining: 18, unlimited: false, draftLimit: 20, archiveReplayDays: null },
              party: { product: 'party', enabled: true, status: 'none', startsAt: null, endsAt: null, limit: null, used: null, remaining: null, unlimited: false, draftLimit: null, archiveReplayDays: null },
            },
            onSave: async () => {},
            onSignOut: () => {},
          })
        )
      )
    );
    assert.ok(normalHtml.includes('sara@example.com'));
    assert.ok(normalHtml.includes('Sara Al-Mansoor'));
    assert.ok(normalHtml.includes(appTranslations[locale].account));
    assert.ok(normalHtml.includes(appTranslations[locale].weddingAccess));
    assert.ok(normalHtml.includes(appTranslations[locale].signOut));
    assert.ok(normalHtml.includes('href="/account"'));

    // Degraded state certification
    const degradedHtml = renderToStaticMarkup(
      h(AppLocaleProvider, null,
        h(Router, { ssrPath: '/account' },
          h(AccountPage, {
            name: 'Sara Al-Mansoor',
            email: 'sara@example.com',
            commercial: {},
            onSave: async () => {},
            onSignOut: () => {},
            degraded: true,
            onRefresh: async () => {},
          })
        )
      )
    );
    assert.ok(degradedHtml.includes(appTranslations[locale].entitlementsLoadFailed));
    assert.ok(degradedHtml.includes(appTranslations[locale].retry));
  }
  // Check actual semantic text/background pairs, including muted and status text.
  const css = await readFile(new URL('../src/customer-ui.css', import.meta.url), 'utf8');
  const tokens = Object.fromEntries([...css.matchAll(/--qr-([\w-]+): (#[\da-f]{6});/g)].map(m => [m[1], m[2]]));
  const luminance = hex => hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  for (const [fg, bg] of [['text', 'canvas'], ['secondary', 'surface'], ['muted', 'surface'], ['placeholder', 'surface'], ['on-primary', 'primary'], ['on-gold', 'gold-subtle'], ...['success', 'warning', 'error', 'info'].map(t => [t, `${t}-subtle`])]) {
    const values = [luminance(tokens[fg]), luminance(tokens[bg])].sort((a, b) => b - a);
    const contrast = (values[0] + .05) / (values[1] + .05);
    assert.ok(contrast >= 4.5, `${fg}/${bg} contrast ${contrast.toFixed(2)} < 4.5`);
  }

  // Regression test: PartyPlanner V2 multi-block rendering across Preview, Edit, and Public Guest invitation
  const { PartyInvitationRenderer } = await server.ssrLoadModule('/src/party/PartyInvitationRenderer.tsx');
  const { defaultPartyEvent } = await server.ssrLoadModule('/src/party/model.ts');

  const testEvent = {
    ...defaultPartyEvent,
    title: 'Executive Summit & Celebration Gala',
    hostName: 'Dr. Nora Al-Mansoor',
    date: '2026-11-20',
    startTime: '19:00',
    venue: 'Four Seasons Grand Ballroom',
    city: 'Riyadh',
    templateId: 'corporate',
    styleId: 'executive-navy',
  };

  const testBlocks = [
    {
      id: 'block-host-1',
      key: 'host',
      enabled: true,
      label: 'Host Welcome',
      eyebrow: 'HOST',
      content: { heading: 'Welcome Note from Dr. Nora', note: 'We are thrilled to celebrate this milestone together.' },
    },
    {
      id: 'block-text-1',
      key: 'text',
      enabled: true,
      label: 'Special Remarks',
      eyebrow: 'MESSAGE',
      content: { heading: 'Special Welcome Remarks', note: 'An exclusive evening of achievement and community.' },
    },
    {
      id: 'block-venue-1',
      key: 'venue',
      enabled: true,
      label: 'Venue Directions',
      eyebrow: 'LOCATION',
      content: { heading: 'Arriving at Four Seasons', note: 'Entrance via North Gate. Valet parking available.' },
    },
    {
      id: 'block-schedule-1',
      key: 'schedule',
      enabled: true,
      label: 'Evening Itinerary',
      eyebrow: 'TIMELINE',
      content: { heading: 'Evening Timeline' },
    },
    {
      id: 'block-catering-1',
      key: 'catering',
      enabled: true,
      label: 'Gastronomy Menu',
      eyebrow: 'DINING',
      content: { heading: 'Curated 4-Course Menu', entree: ['Wagyu Ribeye', 'Seared Seabass', 'Truffle Risotto'], swatches: ['#3D2619', '#C28B55', '#D4AF37'] },
    },
    {
      id: 'block-faq-1',
      key: 'faq',
      enabled: true,
      label: 'Attendee FAQ',
      eyebrow: 'FAQ',
      content: { heading: 'Frequently Asked Questions', questions: [{ q: 'Is there a dress code?', a: 'Black-tie optional.' }] },
    },
    {
      id: 'block-cta-1',
      key: 'cta',
      enabled: true,
      label: 'Event Website',
      eyebrow: 'LINKS',
      content: { heading: 'Visit Summit Portal', url: 'https://summit.example.com' },
    },
    {
      id: 'block-divider-1',
      key: 'divider',
      enabled: true,
      label: 'Divider',
      eyebrow: 'DIVIDER',
      content: { heading: '' },
    },
    {
      id: 'block-spacer-1',
      key: 'spacer',
      enabled: true,
      label: 'Spacer',
      eyebrow: 'SPACER',
      content: { heading: '' },
    },
    {
      id: 'block-disabled-1',
      key: 'faq',
      enabled: false,
      label: 'Hidden FAQ',
      eyebrow: 'HIDDEN',
      content: { heading: 'DISABLED_SECRET_FAQ', questions: [{ q: 'Hidden Q', a: 'Hidden A' }] },
    },
  ];

  const modes = [
    { name: 'preview', isEditMode: false, preview: true, rsvpStatus: 'accepted' },
    { name: 'edit', isEditMode: true, preview: false, rsvpStatus: 'accepted' },
    { name: 'public-pending', isEditMode: false, preview: false, rsvpStatus: 'pending' },
    { name: 'public-accepted', isEditMode: false, preview: false, rsvpStatus: 'accepted' },
    { name: 'public-declined', isEditMode: false, preview: false, rsvpStatus: 'declined' },
  ];

  for (const mode of modes) {
    const html = renderToStaticMarkup(
      h(PartyInvitationRenderer, {
        event: testEvent,
        blocks: testBlocks,
        invitationLocale: 'en',
        isEditMode: mode.isEditMode,
        preview: mode.preview,
        rsvpStatus: mode.rsvpStatus,
        guestName: 'Tariq Al-Sabah',
      })
    );

    // 1. All enabled blocks must be rendered in data-testid="section-blocks"
    assert.ok(html.includes('data-testid="section-blocks"'), `${mode.name}: section-blocks missing`);
    assert.ok(html.includes('Welcome Note from Dr. Nora'), `${mode.name}: host block missing`);
    assert.ok(html.includes('Special Welcome Remarks'), `${mode.name}: text block missing`);
    assert.ok(html.includes('Arriving at Four Seasons'), `${mode.name}: venue block missing`);
    assert.ok(html.includes('Evening Timeline'), `${mode.name}: schedule block missing`);
    assert.ok(html.includes('Curated 4-Course Menu'), `${mode.name}: catering block missing`);
    assert.ok(html.includes('Wagyu Ribeye'), `${mode.name}: catering entree missing`);
    assert.ok(html.includes('Frequently Asked Questions'), `${mode.name}: FAQ block missing`);
    assert.ok(html.includes('Visit Summit Portal'), `${mode.name}: CTA block missing`);
    assert.ok(html.includes('data-testid="party-block-divider"'), `${mode.name}: divider missing`);
    assert.ok(html.includes('data-testid="party-block-spacer"'), `${mode.name}: spacer missing`);

    // 2. Disabled block MUST NOT be rendered
    assert.ok(!html.includes('DISABLED_SECRET_FAQ'), `${mode.name}: disabled block was rendered!`);

    // 3. Strict configured order verification
    const posHost = html.indexOf('Welcome Note from Dr. Nora');
    const posText = html.indexOf('Special Welcome Remarks');
    const posVenue = html.indexOf('Arriving at Four Seasons');
    const posSchedule = html.indexOf('Evening Timeline');
    const posCatering = html.indexOf('Curated 4-Course Menu');
    const posFaq = html.indexOf('Frequently Asked Questions');
    const posCta = html.indexOf('Visit Summit Portal');

    assert.ok(posHost < posText, `${mode.name}: host must precede text`);
    assert.ok(posText < posVenue, `${mode.name}: text must precede venue`);
    assert.ok(posVenue < posSchedule, `${mode.name}: venue must precede schedule`);
    assert.ok(posSchedule < posCatering, `${mode.name}: schedule must precede catering`);
    assert.ok(posCatering < posFaq, `${mode.name}: catering must precede faq`);
    assert.ok(posFaq < posCta, `${mode.name}: faq must precede cta`);
  }

  console.log('PASS: loading/disabled controls, chip semantics, CustomerBottomNav, AR/EN Wedding/Party navigation, 10 text contrast pairs, Party multi-block preview/public parity.');
} finally {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else delete globalThis.localStorage;
  if (originalLocation) Object.defineProperty(globalThis, 'location', originalLocation);
  else delete globalThis.location;
  await server.close();
}
