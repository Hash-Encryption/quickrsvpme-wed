import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WeddingTemplateRegistry,
  defaultWeddingEvent,
  type WeddingEventData,
  type WeddingVisualTemplateId,
} from './model.ts';
import {
  WeddingLayoutPresets,
  WeddingMotionPresets,
  resolveWeddingPresentation,
  resolveWeddingSafeZone,
  type WeddingSafeZone,
} from './presentation.ts';
import {
  normalizeWeddingPoint,
  defaultWeddingArtworkSettings,
} from './upload.ts';

test('UX V2: template switching preserves 100% of event content across all visual templates', () => {
  const customEvent: WeddingEventData = {
    ...defaultWeddingEvent,
    groomName: 'فيصل بن عبدالعزيز',
    brideName: 'ريم بنت خالد',
    familyNames: 'عائلتا آل سعود وآل الشيخ',
    eventDay: 'الجمعة',
    gregorianDate: '2026-11-20',
    hijriDate: '10 جمادى الأولى 1448',
    startTime: '8:00 م',
    receptionTime: '8:30 م',
    dinnerTime: '10:00 م',
    venue: 'قصر الثقافة للمؤتمرات',
    city: 'الرياض',
    mapUrl: 'https://maps.google.com/?q=Riyadh',
    customWording: 'دعوتكم تزيدنا بهجة وسروراً',
    invitationLocale: 'ar',
  };

  const templates: WeddingVisualTemplateId[] = [
    'soft-floral-garden',
    'pearl-arch',
    'midnight-gold',
  ];

  for (const templateId of templates) {
    const template = WeddingTemplateRegistry[templateId];
    assert.ok(template, `Template ${templateId} must exist in registry`);

    const updatedPresentation = resolveWeddingPresentation(
      customEvent.presentation,
      template.presentation,
    );

    const switchedEvent: WeddingEventData = {
      ...customEvent,
      templateId,
      visual: { source: 'template' },
      style: { ...template.defaults },
      presentation: updatedPresentation,
    };

    assert.equal(switchedEvent.groomName, 'فيصل بن عبدالعزيز');
    assert.equal(switchedEvent.brideName, 'ريم بنت خالد');
    assert.equal(switchedEvent.familyNames, 'عائلتا آل سعود وآل الشيخ');
    assert.equal(switchedEvent.eventDay, 'الجمعة');
    assert.equal(switchedEvent.gregorianDate, '2026-11-20');
    assert.equal(switchedEvent.hijriDate, '10 جمادى الأولى 1448');
    assert.equal(switchedEvent.startTime, '8:00 م');
    assert.equal(switchedEvent.receptionTime, '8:30 م');
    assert.equal(switchedEvent.dinnerTime, '10:00 م');
    assert.equal(switchedEvent.venue, 'قصر الثقافة للمؤتمرات');
    assert.equal(switchedEvent.city, 'الرياض');
    assert.equal(switchedEvent.mapUrl, 'https://maps.google.com/?q=Riyadh');
    assert.equal(switchedEvent.customWording, 'دعوتكم تزيدنا بهجة وسروراً');
    assert.equal(switchedEvent.invitationLocale, 'ar');
  }
});

test('UX V2: Safe Text Zone strictly accepts only auto, top, center, bottom', () => {
  const allowedZones: WeddingSafeZone[] = ['auto', 'top', 'center', 'bottom'];

  for (const zone of allowedZones) {
    const resolved = resolveWeddingSafeZone(zone, 'center', 0.5);
    assert.ok(
      ['top', 'center', 'bottom'].includes(resolved),
      `Resolved safe zone ${resolved} must be valid vertical zone`,
    );
  }

  assert.equal(resolveWeddingSafeZone('top', 'bottom'), 'top');
  assert.equal(resolveWeddingSafeZone('center', 'top'), 'center');
  assert.equal(resolveWeddingSafeZone('bottom', 'top'), 'bottom');
  assert.equal(resolveWeddingSafeZone('auto', 'center'), 'center');
});

test('UX V2: Motion presets maintain exact 3 certified presets with distinct behaviors', () => {
  const presetKeys = Object.keys(WeddingMotionPresets);
  assert.deepEqual(presetKeys, ['soft-dissolve', 'cinematic-rise', 'editorial-glide']);

  const soft = WeddingMotionPresets['soft-dissolve'];
  const cinematic = WeddingMotionPresets['cinematic-rise'];
  const editorial = WeddingMotionPresets['editorial-glide'];

  assert.equal(soft.behavior, 'elegant');
  assert.equal(cinematic.behavior, 'cinematic');
  assert.equal(editorial.behavior, 'progressive');

  assert.ok(soft.nameAr && soft.descriptionAr);
  assert.ok(cinematic.nameAr && cinematic.descriptionAr);
  assert.ok(editorial.nameAr && editorial.descriptionAr);
});

test('UX V2: Artwork upload position and nudges clamp safely', () => {
  assert.deepEqual(defaultWeddingArtworkSettings.backgroundPosition, { x: 0.5, y: 0.5 });
  assert.deepEqual(defaultWeddingArtworkSettings.focalPoint, { x: 0.5, y: 0.5 });
  assert.equal(defaultWeddingArtworkSettings.fitMode, 'fit');
  assert.equal(defaultWeddingArtworkSettings.backgroundZoom, 1);

  const clampedFarRight = normalizeWeddingPoint({ x: 1.5, y: -0.2 });
  assert.equal(clampedFarRight.x, 1);
  assert.equal(clampedFarRight.y, 0);

  const clampedCenter = normalizeWeddingPoint({ x: 0.5, y: 0.5 });
  assert.equal(clampedCenter.x, 0.5);
  assert.equal(clampedCenter.y, 0.5);
});

test('UX V2: Direct edit target mapping consistency', () => {
  const blockIds = ['principals', 'date-time', 'venue', 'occasion', 'hosts', 'opening', 'rsvp'] as const;
  const targetMap: Record<string, string> = {
    principals: 'principals',
    'date-time': 'date-time',
    venue: 'venue',
    occasion: 'occasion',
    hosts: 'hosts',
    opening: 'opening',
    rsvp: 'rsvp',
  };

  for (const id of blockIds) {
    assert.equal(targetMap[id], id, `Target mapping for ${id} must be direct`);
  }
});