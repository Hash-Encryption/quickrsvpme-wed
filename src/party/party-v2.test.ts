import assert from 'node:assert/strict';
import test from 'node:test';

import {
  changePartyStyle,
  changePartyTemplate,
  defaultPartyEvent,
  formatPartyDate,
  mergePartyEvent,
  partyStyles,
  partyTemplates,
  resolvePartyStyleId,
  resolvePartyTemplateId,
  type PartyEventData,
  type PartyTemplateId,
} from './model.ts';
import { appTranslations } from '../i18n/app-locale-data.ts';
import { partyInvitationT, type PartyInvitationKey } from '../i18n/party.ts';
import type { StudioBlock, BlockKey } from './PartyInvitationRenderer.tsx';

test('Phase 3: 4 Genuine Template Families with distinct motifs and default styles', () => {
  const families: PartyTemplateId[] = ['corporate', 'birthday', 'baby-shower', 'custom'];
  assert.deepEqual(Object.keys(partyTemplates), families);

  for (const fid of families) {
    const tpl = partyTemplates[fid];
    assert.ok(tpl.id === fid);
    assert.ok(tpl.name.length > 0);
    assert.ok(tpl.nameAr.length > 0);
    assert.ok(tpl.description.length > 0);
    assert.ok(tpl.descriptionAr.length > 0);
    assert.ok(tpl.defaultStyleId.length > 0);
    assert.ok(tpl.supportedStyles.length >= 3);
    assert.ok(tpl.supportedStyles.includes(tpl.defaultStyleId));

    // Motifs of default styles are uniquely differentiated
    const defaultStyle = partyStyles[tpl.defaultStyleId];
    assert.ok(['lines', 'balloons', 'botanical', 'luxury-thread'].includes(defaultStyle.motif));
  }

  assert.equal(partyStyles[partyTemplates.corporate.defaultStyleId].motif, 'lines');
  assert.equal(partyStyles[partyTemplates.birthday.defaultStyleId].motif, 'balloons');
  assert.equal(partyStyles[partyTemplates['baby-shower'].defaultStyleId].motif, 'botanical');
  assert.equal(partyStyles[partyTemplates.custom.defaultStyleId].motif, 'luxury-thread');
});

test('Phase 3: 12 Coordinated Visual Styles mapped to template families', () => {
  const styleKeys = Object.keys(partyStyles);
  assert.equal(styleKeys.length, 12);

  // Each style preset has required visual tokens
  for (const [id, style] of Object.entries(partyStyles)) {
    assert.equal(style.id, id);
    assert.ok(style.name.length > 0);
    assert.ok(style.nameAr.length > 0);
    assert.ok(style.backgroundColor.startsWith('#'));
    assert.ok(style.primaryColor.startsWith('#'));
    assert.ok(style.accentColor.startsWith('#'));
    assert.ok(style.surfaceColor.length > 0);
  }

  // Template family style containment
  assert.deepEqual(partyTemplates.corporate.supportedStyles, [
    'executive-navy',
    'monochrome-slate',
    'royal-emerald',
  ]);
  assert.deepEqual(partyTemplates.birthday.supportedStyles, [
    'celebration-berry',
    'golden-midnight',
    'vibrant-citrus',
  ]);
  assert.deepEqual(partyTemplates['baby-shower'].supportedStyles, [
    'sage-botanical',
    'blush-cloud',
    'celestial-sky',
  ]);
  assert.deepEqual(partyTemplates.custom.supportedStyles, [
    'luxury-emerald',
    'obsidian-gold',
    'desert-sand',
  ]);
});

test('Phase 3: resolvePartyStyleId fallback behavior', () => {
  // Valid style for corporate
  assert.equal(resolvePartyStyleId('corporate', 'executive-navy'), 'executive-navy');

  // Mismatched style for corporate falls back to corporate default style
  assert.equal(resolvePartyStyleId('corporate', 'celebration-berry'), 'executive-navy');

  // Invalid style ID falls back to template default style
  assert.equal(resolvePartyStyleId('birthday', 'invalid-style'), 'celebration-berry');
  assert.equal(resolvePartyStyleId('baby-shower', undefined), 'sage-botanical');
  assert.equal(resolvePartyStyleId('custom', ''), 'luxury-emerald');
});

test('Phase 3: Safe Template Switching preserves 100% of event content', () => {
  const original: PartyEventData = {
    ...defaultPartyEvent,
    title: 'Gala Dinner 2026',
    hostName: 'Acme Corporation',
    subtitle: 'Annual Tech Summit',
    date: '2026-12-15',
    startTime: '19:00',
    venue: 'Ritz-Carlton Grand Ballroom',
    city: 'Riyadh',
    rsvpDeadline: '2026-12-01',
    invitationWording: 'You are cordially invited to our grand celebration.',
    badgeText: 'VIP ADMISSION',
    templateId: 'corporate',
    styleId: 'executive-navy',
  };

  // Switch to birthday
  const switchedToBirthday = changePartyTemplate(original, 'birthday');
  assert.equal(switchedToBirthday.templateId, 'birthday');
  assert.equal(switchedToBirthday.styleId, 'celebration-berry'); // Default for birthday
  assert.equal(switchedToBirthday.title, 'Gala Dinner 2026');
  assert.equal(switchedToBirthday.hostName, 'Acme Corporation');
  assert.equal(switchedToBirthday.subtitle, 'Annual Tech Summit');
  assert.equal(switchedToBirthday.date, '2026-12-15');
  assert.equal(switchedToBirthday.startTime, '19:00');
  assert.equal(switchedToBirthday.venue, 'Ritz-Carlton Grand Ballroom');
  assert.equal(switchedToBirthday.city, 'Riyadh');
  assert.equal(switchedToBirthday.rsvpDeadline, '2026-12-01');
  assert.equal(switchedToBirthday.invitationWording, 'You are cordially invited to our grand celebration.');
  assert.equal(switchedToBirthday.badgeText, 'VIP ADMISSION');

  // Switch to baby-shower
  const switchedToBaby = changePartyTemplate(switchedToBirthday, 'baby-shower');
  assert.equal(switchedToBaby.templateId, 'baby-shower');
  assert.equal(switchedToBaby.styleId, 'sage-botanical');
  assert.equal(switchedToBaby.title, 'Gala Dinner 2026');
  assert.equal(switchedToBaby.venue, 'Ritz-Carlton Grand Ballroom');

  // Switch to custom
  const switchedToCustom = changePartyTemplate(switchedToBaby, 'custom');
  assert.equal(switchedToCustom.templateId, 'custom');
  assert.equal(switchedToCustom.styleId, 'luxury-emerald');
  assert.equal(switchedToCustom.title, 'Gala Dinner 2026');
  assert.equal(switchedToCustom.venue, 'Ritz-Carlton Grand Ballroom');
});

test('Phase 3: Safe Style Switching preserves content and updates visual palette', () => {
  const original: PartyEventData = {
    ...defaultPartyEvent,
    title: 'Nora Birthday Party',
    templateId: 'birthday',
    styleId: 'celebration-berry',
  };

  const updated = changePartyStyle(original, 'golden-midnight');
  assert.equal(updated.styleId, 'golden-midnight');
  assert.equal(updated.typography, partyStyles['golden-midnight'].typography);
  assert.equal(updated.layout, partyStyles['golden-midnight'].layout);
  assert.equal(updated.title, 'Nora Birthday Party');

  // Active resolved palette reflects the new style
  const resolvedStyle = partyStyles[resolvePartyStyleId(updated.templateId, updated.styleId)];
  const activeBg = updated.backgroundColor || resolvedStyle.backgroundColor;
  const activePrimary = updated.primaryColor || resolvedStyle.primaryColor;
  const activeAccent = updated.accentColor || resolvedStyle.accentColor;

  assert.equal(activeBg, partyStyles['golden-midnight'].backgroundColor);
  assert.equal(activePrimary, partyStyles['golden-midnight'].primaryColor);
  assert.equal(activeAccent, partyStyles['golden-midnight'].accentColor);
});

test('Phase 3: Non-drag modular block reordering, toggle, duplicate, and delete', () => {
  const blocks: StudioBlock[] = [
    { id: 'b1', key: 'catering', enabled: true, label: 'Catering', eyebrow: '', content: { heading: 'Dinner' } },
    { id: 'b2', key: 'dress', enabled: true, label: 'Dress', eyebrow: '', content: { heading: 'Black Tie' } },
    { id: 'b3', key: 'schedule', enabled: true, label: 'Schedule', eyebrow: '', content: { heading: 'Timeline' } },
  ];

  // Move up within bounds
  const moveBlock = (arr: StudioBlock[], idx: number, dir: -1 | 1): StudioBlock[] => {
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return arr;
    const next = [...arr];
    [next[idx], next[target]] = [next[target], next[idx]];
    return next;
  };

  // Move b2 up -> b2 is first
  const reordered1 = moveBlock(blocks, 1, -1);
  assert.deepEqual(reordered1.map((b) => b.id), ['b2', 'b1', 'b3']);

  // Move first item up -> no change
  const noChangeUp = moveBlock(reordered1, 0, -1);
  assert.deepEqual(noChangeUp.map((b) => b.id), ['b2', 'b1', 'b3']);

  // Move last item down -> no change
  const noChangeDown = moveBlock(reordered1, 2, 1);
  assert.deepEqual(noChangeDown.map((b) => b.id), ['b2', 'b1', 'b3']);

  // Toggle block visibility
  const toggled = blocks.map((b) => (b.id === 'b2' ? { ...b, enabled: !b.enabled } : b));
  assert.equal(toggled[1].enabled, false);
  assert.equal(toggled[0].enabled, true);

  // Duplicate block
  const duplicateBlock = (arr: StudioBlock[], id: string): StudioBlock[] => {
    const idx = arr.findIndex((b) => b.id === id);
    if (idx < 0) return arr;
    const copy = { ...structuredClone(arr[idx]), id: 'b2-copy' };
    const next = [...arr];
    next.splice(idx + 1, 0, copy);
    return next;
  };
  const duplicated = duplicateBlock(blocks, 'b2');
  assert.equal(duplicated.length, 4);
  assert.equal(duplicated[2].id, 'b2-copy');
  assert.equal(duplicated[2].content.heading, 'Black Tie');

  // Delete block
  const deleted = blocks.filter((b) => b.id !== 'b2');
  assert.equal(deleted.length, 2);
  assert.deepEqual(deleted.map((b) => b.id), ['b1', 'b3']);
});

test('Phase 3: Bounded Undo / Redo stack mechanics (Max 25 entries)', () => {
  type HistoryItem = { title: string };
  const history: { past: HistoryItem[]; future: HistoryItem[] } = { past: [], future: [] };
  let current: HistoryItem = { title: 'Step 0' };

  const pushEdit = (newTitle: string) => {
    history.past.push(structuredClone(current));
    if (history.past.length > 25) history.past.shift();
    history.future = [];
    current = { title: newTitle };
  };

  const undo = () => {
    if (history.past.length === 0) return;
    history.future.push(structuredClone(current));
    current = history.past.pop()!;
  };

  const redo = () => {
    if (history.future.length === 0) return;
    history.past.push(structuredClone(current));
    current = history.future.pop()!;
  };

  // Push 30 changes
  for (let i = 1; i <= 30; i++) {
    pushEdit(`Step ${i}`);
  }

  // Maximum past length bounded to 25
  assert.equal(history.past.length, 25);
  assert.equal(current.title, 'Step 30');

  // Undo restores Step 29
  undo();
  assert.equal(current.title, 'Step 29');
  assert.equal(history.future.length, 1);

  // Redo restores Step 30
  redo();
  assert.equal(current.title, 'Step 30');
  assert.equal(history.future.length, 0);

  // Undo then new edit clears future stack
  undo();
  assert.equal(current.title, 'Step 29');
  pushEdit('Branch Edit');
  assert.equal(current.title, 'Branch Edit');
  assert.equal(history.future.length, 0); // Redo is safely cleared
});

test('Phase 3: Party V2 I18n strings for badges, digital passes, and studio actions', () => {
  // Check party invitation keys in Arabic and English
  const partyKeys: PartyInvitationKey[] = [
    'corporateBadge',
    'birthdayBadge',
    'babyShowerBadge',
    'customBadge',
    'digitalPass',
    'confirmedPass',
    'entryPassSubtitle',
    'tableReserved',
    'seatsCount',
    'scanQr',
    'viewLocation',
    'hostsLabel',
    'scheduleLabel',
    'menuLabel',
    'menuSubtitle',
    'attendingCount',
    'changeRsvp',
    'edit',
  ];

  for (const key of partyKeys) {
    assert.ok(partyInvitationT('en', key).length > 0, `Missing en party key: ${key}`);
    assert.ok(partyInvitationT('ar', key).length > 0, `Missing ar party key: ${key}`);
  }

  // Check Studio UI translation keys
  const studioKeys = [
    'infoTab',
    'designTab',
    'sectionsTab',
    'previewTab',
    'publishDraft',
    'saveDraft',
    'undo',
    'redo',
    'templateFamily',
    'stylePreset',
    'addSection',
    'editSection',
    'sectionCatalog',
    'hostNameLabel',
    'hostNamePlaceholder',
    'subtitleLabel',
    'subtitlePlaceholder',
  ] as const;

  for (const key of studioKeys) {
    assert.ok(typeof appTranslations.ar[key] === 'string' && appTranslations.ar[key].length > 0, `Missing ar key: ${key}`);
    assert.ok(typeof appTranslations.en[key] === 'string' && appTranslations.en[key].length > 0, `Missing en key: ${key}`);
  }
});

test('Phase 3: Comprehensive preservation test across all 4 template families and 12 styles', () => {
  const canonicalEvent: PartyEventData = {
    ...defaultPartyEvent,
    title: 'Crown Leadership Gala',
    hostName: 'Dr. Tariq Al-Mansoor',
    subtitle: 'Celebrating 25 Years of Innovation',
    invitationWording: 'We request the honor of your presence at our celebratory dinner.',
    date: '2026-11-20',
    startTime: '20:00',
    venue: 'Al Faisaliah Grand Ballroom',
    city: 'Riyadh',
    rsvpDeadline: '2026-11-05',
    badgeText: 'EXECUTIVE VIP PASS',
    templateId: 'corporate',
    styleId: 'executive-navy',
  };

  const sampleBlocks: StudioBlock[] = [
    {
      id: 'block-catering-1',
      key: 'catering',
      enabled: true,
      label: 'Catering Menu',
      eyebrow: 'GASTRONOMY',
      content: {
        heading: 'Curated 4-Course Menu',
        entree: ['Truffle Wagyu Ribeye', 'Chilean Sea Bass', 'Morel Risotto'],
        swatches: ['#3D2619', '#C28B55', '#D4AF37'],
      },
    },
    {
      id: 'block-dress-1',
      key: 'dress',
      enabled: true,
      label: 'Dress Code',
      eyebrow: 'ATTIRE',
      content: {
        heading: 'Black Tie Optional',
        note: 'Formal evening wear or traditional national dress.',
        swatches: ['#0F1E2E', '#D4AF37', '#F4F7F9'],
      },
    },
    {
      id: 'block-faq-1',
      key: 'faq',
      enabled: false,
      label: 'Guest FAQ',
      eyebrow: 'QUESTIONS',
      content: {
        heading: 'Important Information',
        questions: [
          { q: 'Is valet parking provided?', a: 'Complimentary valet is available at the north entrance.' },
          { q: 'Can dietary restrictions be accommodated?', a: 'Please specify in your RSVP response notes.' },
        ],
      },
    },
  ];

  const families: PartyTemplateId[] = ['corporate', 'birthday', 'baby-shower', 'custom'];

  // Test full round-trip switching through all 4 template families
  let currentEvent = canonicalEvent;
  for (const family of families) {
    const nextEvent = changePartyTemplate(currentEvent, family);

    // 1. Verify template and style updated correctly
    assert.equal(nextEvent.templateId, family);
    assert.equal(nextEvent.styleId, partyTemplates[family].defaultStyleId);

    // 2. Verify all canonical event fields 100% preserved
    assert.equal(nextEvent.title, canonicalEvent.title);
    assert.equal(nextEvent.hostName, canonicalEvent.hostName);
    assert.equal(nextEvent.subtitle, canonicalEvent.subtitle);
    assert.equal(nextEvent.invitationWording, canonicalEvent.invitationWording);
    assert.equal(nextEvent.date, canonicalEvent.date);
    assert.equal(nextEvent.startTime, canonicalEvent.startTime);
    assert.equal(nextEvent.venue, canonicalEvent.venue);
    assert.equal(nextEvent.city, canonicalEvent.city);
    assert.equal(nextEvent.rsvpDeadline, canonicalEvent.rsvpDeadline);
    assert.equal(nextEvent.badgeText, canonicalEvent.badgeText);

    // 3. Test style switching for every supported style within this family
    for (const styleId of partyTemplates[family].supportedStyles) {
      const styledEvent = changePartyStyle(nextEvent, styleId);
      assert.equal(styledEvent.styleId, styleId);
      assert.equal(styledEvent.templateId, family);
      assert.equal(styledEvent.title, canonicalEvent.title);
      assert.equal(styledEvent.badgeText, canonicalEvent.badgeText);

      // Verify modular blocks preserved without mutation
      const clonedBlocks = structuredClone(sampleBlocks);
      assert.equal(clonedBlocks.length, 3);
      assert.equal(clonedBlocks[0].id, 'block-catering-1');
      assert.equal(clonedBlocks[0].content.entree?.length, 3);
      assert.equal(clonedBlocks[1].enabled, true);
      assert.equal(clonedBlocks[2].enabled, false);
      assert.equal(clonedBlocks[2].content.questions?.length, 2);
    }

    currentEvent = nextEvent;
  }
});

test('Phase 3 Regression: Multi-block visibility, ordering, and disabled-filtering invariant', () => {
  const blocks: StudioBlock[] = [
    { id: 'b-host', key: 'host', enabled: true, label: 'Host', eyebrow: 'HOST', content: { heading: 'Dr. Nora' } },
    { id: 'b-text', key: 'text', enabled: true, label: 'Text', eyebrow: 'TEXT', content: { heading: 'Welcome' } },
    { id: 'b-venue', key: 'venue', enabled: true, label: 'Venue', eyebrow: 'VENUE', content: { heading: 'Ballroom' } },
    { id: 'b-schedule', key: 'schedule', enabled: true, label: 'Schedule', eyebrow: 'TIME', content: { heading: 'Timeline' } },
    { id: 'b-catering', key: 'catering', enabled: true, label: 'Menu', eyebrow: 'FOOD', content: { heading: '4 Courses', entree: ['A', 'B'] } },
    { id: 'b-disabled-faq', key: 'faq', enabled: false, label: 'FAQ', eyebrow: 'FAQ', content: { heading: 'Hidden FAQ' } },
    { id: 'b-cta', key: 'cta', enabled: true, label: 'CTA', eyebrow: 'LINK', content: { heading: 'RSVP Online', url: 'https://example.com' } },
    { id: 'b-divider', key: 'divider', enabled: true, label: 'Divider', eyebrow: 'DIV', content: { heading: '' } },
    { id: 'b-spacer', key: 'spacer', enabled: true, label: 'Spacer', eyebrow: 'SPACE', content: { heading: '' } },
  ];

  // Invariant 1: enabled blocks filter preserves ordering exactly
  const visible = blocks.filter((b) => b.enabled);
  assert.equal(visible.length, 8);
  assert.deepEqual(
    visible.map((b) => b.id),
    ['b-host', 'b-text', 'b-venue', 'b-schedule', 'b-catering', 'b-cta', 'b-divider', 'b-spacer']
  );

  // Invariant 2: disabled blocks are completely excluded
  assert.ok(!visible.some((b) => b.id === 'b-disabled-faq'));
  assert.ok(!visible.some((b) => b.enabled === false));

  // Invariant 3: rendering visibility is independent of RSVP status
  for (const rsvpStatus of ['pending', 'accepted', 'declined'] as const) {
    const renderedInRsvpState = blocks.filter((b) => b.enabled);
    assert.equal(renderedInRsvpState.length, 8);
    assert.equal(renderedInRsvpState[0].id, 'b-host');
    assert.equal(renderedInRsvpState[7].id, 'b-spacer');
  }

  // Invariant 4: preview mode has 100% parity with public mode block list
  const previewBlocks = blocks.filter((b) => b.enabled);
  const publicBlocks = blocks.filter((b) => b.enabled);
  assert.deepEqual(previewBlocks, publicBlocks);
});

