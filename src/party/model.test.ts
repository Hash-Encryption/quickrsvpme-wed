import assert from 'node:assert/strict';
import test from 'node:test';

import { defaultPartyEvent, formatPartyDate, mergePartyEvent, partyTemplates, resolvePartyTemplateId } from './model.ts';

test('legacy Party state receives the complete safe event defaults', () => {
  assert.deepEqual(mergePartyEvent(undefined), defaultPartyEvent);
});

test('Party event fields merge without creating another authority', () => {
  const event = mergePartyEvent({ title: 'Graduation Night', city: 'Riyadh' });
  assert.equal(event.title, 'Graduation Night');
  assert.equal(event.city, 'Riyadh');
  assert.equal(event.venue, defaultPartyEvent.venue);
});

test('Party V2 template registry contains the four platform-managed choices', () => {
  assert.deepEqual(Object.keys(partyTemplates), ['corporate', 'birthday', 'baby-shower', 'custom']);
  for (const template of Object.values(partyTemplates)) assert.equal(resolvePartyTemplateId(template.id), template.id);
});

test('legacy Party template IDs migrate to their closest V2 presentation', () => {
  assert.equal(resolvePartyTemplateId('garden-glow'), 'custom');
  assert.equal(resolvePartyTemplateId('confetti-pop'), 'birthday');
  assert.equal(resolvePartyTemplateId('skyline-toast'), 'corporate');
});

test('invalid Party templates fall back without mutating Party content', () => {
  const event = mergePartyEvent({ title: 'Dinner', templateId: 'future-template' as never });
  assert.equal(event.templateId, defaultPartyEvent.templateId);
  assert.equal(event.title, 'Dinner');
  assert.equal(resolvePartyTemplateId('toString'), defaultPartyEvent.templateId);
});

test('Party V2 appearance values normalize without accepting unsafe color data', () => {
  const event = mergePartyEvent({ backgroundColor: 'url(javascript:bad)', primaryColor: '#123456', typography: 'modern', layout: 'editorial', motion: 'none', decorations: false });
  assert.equal(event.backgroundColor, null);
  assert.equal(event.primaryColor, '#123456');
  assert.equal(event.typography, 'modern');
  assert.equal(event.layout, 'editorial');
  assert.equal(event.motion, 'none');
  assert.equal(event.decorations, false);
});

test('Party dates resolve independently for Arabic and English presentation', () => {
  assert.match(formatPartyDate('2026-10-14', 'en'), /October/);
  assert.notEqual(formatPartyDate('2026-10-14', 'ar'), formatPartyDate('2026-10-14', 'en'));
});
