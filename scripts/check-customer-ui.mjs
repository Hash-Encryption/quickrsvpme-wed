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

  // Phase 2 Master Revamp: Arabic seed auto-localization
  const seedBlocks = [
    {
      id: 'catering',
      key: 'catering',
      enabled: true,
      label: 'Catering',
      eyebrow: 'YOUR TABLE',
      content: {
        heading: 'A seat at our table',
        entree: ['Rosemary chicken', 'Miso-glazed salmon', 'Garden ravioli'],
      },
    },
    {
      id: 'dress',
      key: 'dress',
      enabled: true,
      label: 'Dress code',
      eyebrow: 'THE ATTIRE',
      content: {
        heading: 'Garden formal',
        note: 'A little polished, a little effortless. Suits, silk, and evening colors are encouraged.',
      },
    },
    {
      id: 'schedule',
      key: 'schedule',
      enabled: true,
      label: 'Schedule',
      eyebrow: 'THE EVENING',
      content: { heading: 'A day in full bloom' },
    },
    {
      id: 'faq',
      key: 'faq',
      enabled: true,
      label: 'FAQ',
      eyebrow: 'GOOD TO KNOW',
      content: {
        heading: 'Before you join us',
        questions: [{ q: 'Can I bring a plus one?', a: 'Your invitation notes your guest allowance.' }],
      },
    },
  ];

  const arHtml = renderToStaticMarkup(
    h(PartyInvitationRenderer, {
      event: defaultPartyEvent,
      blocks: seedBlocks,
      invitationLocale: 'ar',
    })
  );
  assert.ok(arHtml.includes('الضيافة والعشاء'), 'AR seed auto-localization missing catering eyebrow');
  assert.ok(arHtml.includes('نتشرف بحضوركم على مائدة العشاء'), 'AR seed auto-localization missing catering heading');
  assert.ok(arHtml.includes('القهوة السعودية والضيافة الترحيبية'), 'AR seed auto-localization missing catering item');
  assert.ok(arHtml.includes('الزي المطلوب'), 'AR seed auto-localization missing dress eyebrow');
  assert.ok(arHtml.includes('الزي الرسمي السعودي / كاجوال أنيق'), 'AR seed auto-localization missing dress heading');
  assert.ok(arHtml.includes('برنامج الأمسية'), 'AR seed auto-localization missing schedule eyebrow');
  assert.ok(arHtml.includes('معلومات الوصول والمواقف'), 'AR seed auto-localization missing faq eyebrow');
  assert.ok(arHtml.includes('هل تتوفر خدمة صف السيارات (Valet)؟'), 'AR seed auto-localization missing faq question');

  // Phase 2 Master Revamp: 4 Architectural Layouts & Etiquette Badges & VIP Gate Pass QR
  const layouts = ['corporate', 'custom', 'birthday', 'baby-shower'];
  for (const tid of layouts) {
    const layoutHtml = renderToStaticMarkup(
      h(PartyInvitationRenderer, {
        event: {
          ...defaultPartyEvent,
          templateId: tid,
          title: `Milestone ${tid}`,
          logoUrl: 'https://example.com/logo.png',
          mapUrl: 'https://maps.google.com/?q=Riyadh',
          etiquetteBadges: ['الدخول ببطاقة الدعوة', 'خدمة صف السيارات (Valet)'],
        },
        blocks: [],
        invitationLocale: 'ar',
      })
    );
    assert.ok(layoutHtml.includes(`party-template--${tid}`), `Missing template class for ${tid}`);
    assert.ok(layoutHtml.includes(`Milestone ${tid}`), `Missing title for ${tid}`);
    assert.ok(layoutHtml.includes('https://example.com/logo.png'), `Missing logo for ${tid}`);
    assert.ok(layoutHtml.includes('الدخول ببطاقة الدعوة'), `Missing etiquette badge in ${tid}`);

    if (tid === 'corporate') {
      assert.ok(layoutHtml.includes('maps.google.com'), 'Corporate layout missing maps link');
    } else if (tid === 'custom') {
      assert.ok(layoutHtml.includes('✦'), 'Custom Majlis layout missing ornament');
    }
  }

  // Phase 2 Master Revamp: VIP Gate Pass view with luxury QR
  const vipPassHtml = renderToStaticMarkup(
    h(PartyInvitationRenderer, {
      event: defaultPartyEvent,
      blocks: [],
      invitationLocale: 'ar',
      preview: true,
      rsvpStatus: 'accepted',
      guestName: 'سلطان بن عبدالعزيز',
      passId: 'VIP-9988-77',
      allowedCompanions: 1,
    })
  );
  assert.ok(vipPassHtml.includes('VIP-9988-77'), 'VIP Gate Pass missing passId');
  assert.ok(vipPassHtml.includes('سلطان بن عبدالعزيز'), 'VIP Gate Pass missing guestName');
  assert.ok(vipPassHtml.includes('data-testid="qr-pass"'), 'VIP Gate Pass missing luxury QR pass mark');

  // Overhaul: Certify Background Modes & Custom Section Layouts
  for (const bgMode of ['full-pinned', 'frame-9-16', 'hero-banner']) {
    const bgHtml = renderToStaticMarkup(
      h(PartyInvitationRenderer, {
        event: {
          ...defaultPartyEvent,
          backgroundImageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957',
          backgroundMode: bgMode,
          backgroundBlur: 4,
        },
        blocks: [],
        invitationLocale: 'ar',
      })
    );
    assert.ok(bgHtml.includes('https://images.unsplash.com/photo-1544620347-c4fd4a3d5957'), `Missing bg url in mode ${bgMode}`);
    if (bgMode === 'hero-banner') {
      assert.ok(bgHtml.includes('h-56'), 'Hero banner mode missing top cover height');
    }
  }

  // Overhaul: Certify Custom Smart Section Layouts (editorial-card, bullet-grid, image-spotlight, stats-highlights)
  const customSectionBlocks = [
    {
      id: 'blk-spotlight',
      key: 'text',
      enabled: true,
      label: 'Speaker Spotlight',
      eyebrow: 'KEYNOTE',
      content: {
        heading: 'Eng. Fahad Al-Otaibi',
        note: 'Executive VP of Innovation',
        customLayout: 'image-spotlight',
        imageUrl: 'https://example.com/speaker.jpg',
        badge: 'VIP Speaker',
        buttonLabel: 'View Bio',
        url: 'https://example.com/bio',
        bullets: ['20+ years of leadership', 'Keynote address'],
      },
    },
    {
      id: 'blk-bullets',
      key: 'text',
      enabled: true,
      label: 'Guidelines',
      eyebrow: 'INSTRUCTIONS',
      content: {
        heading: 'Valet & Access',
        customLayout: 'bullet-grid',
        bullets: ['Gate 4 for VIPs', 'Valet parking available'],
      },
    },
    {
      id: 'blk-stats',
      key: 'text',
      enabled: true,
      label: 'Impact',
      eyebrow: 'METRICS',
      content: {
        heading: 'Annual Milestones',
        customLayout: 'stats-highlights',
        bullets: ['500+ Attendees', '12 Awards Presented', '99% Satisfaction'],
      },
    },
  ];

  const customSectionsHtml = renderToStaticMarkup(
    h(PartyInvitationRenderer, {
      event: defaultPartyEvent,
      blocks: customSectionBlocks,
      invitationLocale: 'ar',
    })
  );
  assert.ok(customSectionsHtml.includes('Eng. Fahad Al-Otaibi'), 'Missing keynote speaker heading');
  assert.ok(customSectionsHtml.includes('VIP Speaker'), 'Missing badge in spotlight layout');
  assert.ok(customSectionsHtml.includes('Gate 4 for VIPs'), 'Missing bullet in bullet-grid layout');
  assert.ok(customSectionsHtml.includes('500+ Attendees'), 'Missing stat in stats-highlights layout');

  console.log('PASS: loading/disabled controls, chip semantics, CustomerBottomNav, AR/EN Wedding/Party navigation, 10 text contrast pairs, Party multi-block preview/public parity, Phase 2 Saudi blueprints, Arabic seed auto-localization, 4 architectural layouts, VIP gate pass QR, background modes, custom section layouts.');
} finally {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else delete globalThis.localStorage;
  if (originalLocation) Object.defineProperty(globalThis, 'location', originalLocation);
  else delete globalThis.location;
  await server.close();
}
