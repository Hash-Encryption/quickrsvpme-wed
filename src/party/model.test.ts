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
} from './model.ts';

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

test('Party styles resolve correctly for their respective template families', () => {
  assert.equal(resolvePartyStyleId('corporate', 'executive-navy'), 'executive-navy');
  assert.equal(resolvePartyStyleId('corporate', 'monochrome-slate'), 'monochrome-slate');
  assert.equal(resolvePartyStyleId('corporate', 'invalid-style'), 'executive-navy');
  assert.equal(resolvePartyStyleId('birthday', 'celebration-berry'), 'celebration-berry');
  assert.equal(resolvePartyStyleId('birthday', 'executive-navy'), 'celebration-berry'); // style belongs to corporate, not birthday
  assert.ok(partyStyles['executive-navy'].motif === 'lines');
  assert.ok(partyStyles['celebration-berry'].motif === 'balloons');
  assert.ok(partyStyles['sage-botanical'].motif === 'botanical');
  assert.ok(partyStyles['luxury-emerald'].motif === 'luxury-thread');
});

test('changing Party template preserves all entered event content', () => {
  const initial = mergePartyEvent({
    title: 'Acme Annual Summit',
    hostName: 'Acme Leadership',
    subtitle: 'Celebrating 10 Years of Innovation',
    venue: 'Ritz-Carlton',
    city: 'Riyadh',
    date: '2026-11-20',
    startTime: '18:00',
    invitationWording: 'Please join us for our annual flagship gala.',
    templateId: 'corporate',
  });

  // Switch to birthday
  const switched = changePartyTemplate(initial, 'birthday');
  assert.equal(switched.templateId, 'birthday');
  assert.equal(switched.title, 'Acme Annual Summit');
  assert.equal(switched.hostName, 'Acme Leadership');
  assert.equal(switched.subtitle, 'Celebrating 10 Years of Innovation');
  assert.equal(switched.venue, 'Ritz-Carlton');
  assert.equal(switched.city, 'Riyadh');
  assert.equal(switched.date, '2026-11-20');
  assert.equal(switched.startTime, '18:00');
  assert.equal(switched.invitationWording, 'Please join us for our annual flagship gala.');
  // Style should default to birthday's default style
  assert.equal(switched.styleId, 'celebration-berry');
});

test('changing Party style preserves all event content and applies visual tokens', () => {
  const initial = mergePartyEvent({
    title: 'Liam 5th Birthday',
    hostName: 'Liam Parents',
    templateId: 'birthday',
    styleId: 'celebration-berry',
  });

  const updated = changePartyStyle(initial, 'golden-midnight');
  assert.equal(updated.styleId, 'golden-midnight');
  assert.equal(updated.templateId, 'birthday');
  assert.equal(updated.title, 'Liam 5th Birthday');
  assert.equal(updated.hostName, 'Liam Parents');
  assert.equal(updated.typography, partyStyles['golden-midnight'].typography);
  assert.equal(updated.decorations, partyStyles['golden-midnight'].decorations);
});
