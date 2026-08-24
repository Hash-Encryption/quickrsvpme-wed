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

test('Party template registry contains three deterministic lightweight choices', () => {
  assert.deepEqual(Object.keys(partyTemplates), ['garden-glow', 'confetti-pop', 'skyline-toast']);
  for (const template of Object.values(partyTemplates)) assert.equal(resolvePartyTemplateId(template.id), template.id);
});

test('invalid Party templates fall back without mutating Party content', () => {
  const event = mergePartyEvent({ title: 'Dinner', templateId: 'future-template' as never });
  assert.equal(event.templateId, defaultPartyEvent.templateId);
  assert.equal(event.title, 'Dinner');
  assert.equal(resolvePartyTemplateId('toString'), defaultPartyEvent.templateId);
});

test('Party dates resolve independently for Arabic and English presentation', () => {
  assert.match(formatPartyDate('2026-10-14', 'en'), /October/);
  assert.notEqual(formatPartyDate('2026-10-14', 'ar'), formatPartyDate('2026-10-14', 'en'));
});
