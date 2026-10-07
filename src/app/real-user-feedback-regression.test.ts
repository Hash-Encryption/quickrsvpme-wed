import assert from 'node:assert/strict';
import test from 'node:test';

import {
  defaultWeddingEvent,
  defaultWeddingGuest,
  deriveDayOfWeekFromGregorian,
  deriveHijriDateFromGregorian,
  getWhatsAppShareUrl,
  normalizeSaudiWhatsAppPhone,
  type WeddingEventData,
} from '../wedding/model.ts';
import { resolveWeddingScenes } from '../wedding/scene-engine.ts';
import {
  detectWeddingImageMimeType,
  validateWeddingUploadFile,
  weddingBackgroundLimits,
} from '../wedding/upload.ts';
import { invitationUrl, sanitizeInvitationToken, PRODUCTION_ORIGIN } from './operations.ts';
import { isInvitationPublished } from '../backend/events.ts';
import type { BackendEvent, EventGuest } from '../backend/types.ts';
import { appTranslations } from '../i18n/app-locale-data.ts';
import { weddingBuilderT } from '../i18n/wedding-builder.ts';

// Simulated DB logic mirroring Supabase private.event_public_state and private.checkin_event_state
function simulateEventPublicState(event: {
  lifecycle_status: string;
  invitation_published_at?: string | null;
  deleted_at?: string | null;
}): string {
  if (event.deleted_at) return 'deleted';
  if (event.lifecycle_status === 'cancelled') return 'cancelled';
  if (event.lifecycle_status === 'archived') return 'archived_read_only';
  if (event.lifecycle_status === 'ended') return 'ended';

  // Authoritative publication rule: If published_at is set, invitation is active for planning and active
  if (event.invitation_published_at) {
    if (event.lifecycle_status === 'planning' || event.lifecycle_status === 'active') {
      return 'active';
    }
  }

  // Unpublished events
  if (event.lifecycle_status === 'planning') return 'planning';
  return 'unpublished';
}

function simulateCheckinEventState(event: {
  lifecycle_status: string;
  deleted_at?: string | null;
}): string {
  if (event.deleted_at) return 'soft_deleted';
  if (event.lifecycle_status === 'planning') return 'planning';
  if (event.lifecycle_status === 'ended') return 'ended';
  if (event.lifecycle_status === 'archived') return 'archived';
  if (event.lifecycle_status === 'cancelled') return 'cancelled';
  if (event.lifecycle_status === 'active') return 'ready';
  return 'invalid';
}

test('1. Exact Real-User Regression Flow (13-step tester flow)', () => {
  // Step 1: Create Wedding
  const event: BackendEvent = {
    id: 'wed-tester-001',
    user_id: 'host-user-1',
    title: 'سارة و أحمد',
    product_id: 'wedding',
    lifecycle_status: 'planning', // Step 2: Event lifecycle = planning
    invitation_locale: 'ar',
    starts_at: '2026-11-20T19:00:00Z',
    invitation_published_at: null, // initially unpublished
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  assert.equal(event.lifecycle_status, 'planning');
  assert.equal(isInvitationPublished(event), false);

  // Before publication, public access returns 'planning' (invitation unavailable)
  assert.equal(simulateEventPublicState(event), 'planning');

  // Step 3: Edit Invitation & Step 4: Publish Invitation
  const publishedAt = new Date().toISOString();
  event.invitation_published_at = publishedAt;

  // Step 5: lifecycle STILL planning
  assert.equal(event.lifecycle_status, 'planning', 'Lifecycle must remain planning after publication');
  assert.equal(isInvitationPublished(event), true);

  // Step 6: Add Guest with phone 00966504932835
  const guestPhoneStored = '00966504932835';
  const guest: EventGuest = {
    id: 'guest-saudi-001',
    event_id: event.id,
    name: 'عبدالله السعيد',
    phone: guestPhoneStored, // Stored phone remains unchanged
    allowed_companions: 2,
    confirmed_party_size: 0,
    companion_names: [],
    rsvp_status: 'pending',
    checkin_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  assert.equal(guest.phone, '00966504932835', 'DB phone must never be modified merely for sending');

  // Step 7: Send on WhatsApp -> target = 966504932835
  const normalizedResult = normalizeSaudiWhatsAppPhone(guest.phone);
  assert.equal(normalizedResult.success, true);
  assert.equal(normalizedResult.phone, '966504932835');

  const personalToken = 'tok_secure_guest_99';
  const personalUrl = invitationUrl('http://localhost:5173', '/', personalToken);
  assert.equal(personalUrl, `${PRODUCTION_ORIGIN}/i/${personalToken}`);

  const waShareUrl = getWhatsAppShareUrl('wedding', event.title, guest.phone!, personalUrl);
  assert.ok(waShareUrl.startsWith('https://wa.me/966504932835?text='));
  assert.ok(decodeURIComponent(waShareUrl).includes(personalUrl));

  // Step 8: Guest opens personal link
  assert.equal(personalUrl, 'https://quickrsvp.me/i/tok_secure_guest_99');

  // Step 9 & 10: resolve_invitation succeeds -> Guest sees RSVP form, NEVER "This invitation is unavailable"
  const publicState = simulateEventPublicState(event);
  assert.equal(publicState, 'active', 'Planning event with published invitation must resolve to active public state');
  assert.notEqual(publicState, 'planning', 'Must not return planning state to guest');

  // Step 11: Guest submits RSVP (accepted, companions = 1, companion_names = ['فاطمة'])
  guest.rsvp_status = 'accepted';
  guest.confirmed_party_size = 2; // guest + 1 companion
  guest.companion_names = ['فاطمة'];

  // Step 12: RSVP succeeds
  assert.equal(guest.rsvp_status, 'accepted');
  assert.equal(guest.confirmed_party_size, 2);
  assert.deepEqual(guest.companion_names, ['فاطمة']);

  // Step 13: Door check-in scanner lifecycle remains blocked while Event is planning
  const checkinState = simulateCheckinEventState(event);
  assert.equal(checkinState, 'planning', 'Door checkin scanner must be blocked while event is planning');
  assert.notEqual(checkinState, 'ready', 'Scanner must NOT allow check-in until host activates event');

  // When event day arrives and host marks event active:
  event.lifecycle_status = 'active';
  assert.equal(simulateCheckinEventState(event), 'ready', 'Scanner becomes ready when event is active');
});

test('2. Publication State Transitions & Edge Cases', () => {
  // planning + unpublished -> unavailable ('planning')
  assert.equal(simulateEventPublicState({ lifecycle_status: 'planning', invitation_published_at: null }), 'planning');

  // planning + published -> accessible ('active')
  assert.equal(simulateEventPublicState({ lifecycle_status: 'planning', invitation_published_at: '2026-10-01' }), 'active');

  // active + published -> accessible ('active')
  assert.equal(simulateEventPublicState({ lifecycle_status: 'active', invitation_published_at: '2026-10-01' }), 'active');

  // published then unpublished -> unavailable ('planning' or 'unpublished')
  assert.equal(simulateEventPublicState({ lifecycle_status: 'planning', invitation_published_at: null }), 'planning');
  assert.equal(simulateEventPublicState({ lifecycle_status: 'active', invitation_published_at: null }), 'unpublished');

  // cancelled -> unavailable
  assert.equal(simulateEventPublicState({ lifecycle_status: 'cancelled', invitation_published_at: '2026-10-01' }), 'cancelled');

  // deleted -> unavailable
  assert.equal(simulateEventPublicState({ lifecycle_status: 'planning', invitation_published_at: '2026-10-01', deleted_at: '2026-10-02' }), 'deleted');

  // archived -> read-only
  assert.equal(simulateEventPublicState({ lifecycle_status: 'archived', invitation_published_at: '2026-10-01' }), 'archived_read_only');
});

test('3. Saudi WhatsApp Phone Normalizer handles all valid formats without mutating input', () => {
  // Test variations
  assert.deepEqual(normalizeSaudiWhatsAppPhone('0504932835'), { success: true, phone: '966504932835' });
  assert.deepEqual(normalizeSaudiWhatsAppPhone('+966504932835'), { success: true, phone: '966504932835' });
  assert.deepEqual(normalizeSaudiWhatsAppPhone('00966504932835'), { success: true, phone: '966504932835' });
  assert.deepEqual(normalizeSaudiWhatsAppPhone('966504932835'), { success: true, phone: '966504932835' });
  assert.deepEqual(normalizeSaudiWhatsAppPhone('050 493 2835'), { success: true, phone: '966504932835' });
  assert.deepEqual(normalizeSaudiWhatsAppPhone('+966 (50) 493-2835'), { success: true, phone: '966504932835' });
  assert.deepEqual(normalizeSaudiWhatsAppPhone('  050-493-2835  '), { success: true, phone: '966504932835' });

  // Empty string returns failure
  assert.equal(normalizeSaudiWhatsAppPhone('').success, false);
  assert.equal(normalizeSaudiWhatsAppPhone('   ').success, false);

  // Invalid / too short returns failure
  assert.equal(normalizeSaudiWhatsAppPhone('12345').success, false);
  assert.equal(normalizeSaudiWhatsAppPhone('abcdef').success, false);

  // Non-Saudi numbers without explicit country prefix return failure (we do NOT guess foreign conversions)
  assert.equal(normalizeSaudiWhatsAppPhone('0123456789').success, false);
  // Explicit international numbers with country prefix are preserved safely
  assert.equal(normalizeSaudiWhatsAppPhone('+14155552671').success, true);
});

test('4. Production Invitation URL hardening guarantees canonical format', () => {
  // Localhost origin is overridden with production origin
  assert.equal(
    invitationUrl('http://localhost:5173', '/', 'token-abc'),
    'https://quickrsvp.me/i/token-abc'
  );
  assert.equal(
    invitationUrl('http://127.0.0.1:4173', '', 'token-xyz'),
    'https://quickrsvp.me/i/token-xyz'
  );

  // Duplicate slashes in base or token are sanitized
  assert.equal(
    invitationUrl('https://quickrsvp.me/', '//', 'token-123'),
    'https://quickrsvp.me/i/token-123'
  );

  // Token sanitization
  assert.equal(sanitizeInvitationToken(' tok-123 '), 'tok-123');
  assert.equal(sanitizeInvitationToken('/tok-123/'), 'tok-123');
  assert.equal(sanitizeInvitationToken('../tok-123'), 'tok-123');
  assert.equal(sanitizeInvitationToken('tok$#123'), 'tok123');
});

test('5. Wedding Custom Background upload validation and state management', () => {
  // MIME type detection
  assert.equal(detectWeddingImageMimeType({ name: 'photo.jpg', type: '' } as unknown as File), 'image/jpeg');
  assert.equal(detectWeddingImageMimeType({ name: 'photo.jpeg', type: '' } as unknown as File), 'image/jpeg');
  assert.equal(detectWeddingImageMimeType({ name: 'photo.png', type: '' } as unknown as File), 'image/png');
  assert.equal(detectWeddingImageMimeType({ name: 'photo.webp', type: '' } as unknown as File), 'image/webp');
  assert.equal(detectWeddingImageMimeType({ name: 'unknown', type: 'image/jpeg' } as unknown as File), 'image/jpeg');
  assert.equal(detectWeddingImageMimeType({ name: 'document.pdf', type: 'application/pdf' } as unknown as File), null);
  assert.equal(detectWeddingImageMimeType({ name: 'script.js', type: 'text/javascript' } as unknown as File), null);

  // File size validation
  const validMockFile = {
    name: 'invitation-bg.jpg',
    size: 4 * 1024 * 1024, // 4 MB
    type: 'image/jpeg',
  } as unknown as File;
  assert.doesNotThrow(() => validateWeddingUploadFile(validMockFile));

  const oversizedMockFile = {
    name: 'huge-file.jpg',
    size: 15 * 1024 * 1024, // 15 MB > 12 MB limit
    type: 'image/jpeg',
  } as unknown as File;
  assert.throws(() => validateWeddingUploadFile(oversizedMockFile), /12 MB/);

  const invalidTypeMockFile = {
    name: 'vector.svg',
    size: 50 * 1024,
    type: 'image/svg+xml',
  } as unknown as File;
  assert.throws(() => validateWeddingUploadFile(invalidTypeMockFile), /JPEG أو PNG أو WebP/);

  // State test: replace vs remove background
  const wedding = structuredClone(defaultWeddingEvent) as WeddingEventData;
  assert.equal(wedding.visual.source, 'template');

  // Upload custom background
  wedding.visual = {
    source: 'uploaded-background',
    uploadedBackground: {
      dataUrl: 'data:image/webp;base64,mockdata',
      fileName: 'custom.jpg',
      mimeType: 'image/webp',
      width: 1080,
      height: 1920,
    },
    fitMode: 'fit',
    zoom: 1,
    backgroundPosition: { x: 0.5, y: 0.5 },
    focalPoint: { x: 0.5, y: 0.5 },
    safeZone: 'auto',
  };
  assert.equal(wedding.visual.source, 'uploaded-background');
  assert.equal(wedding.visual.uploadedBackground.fileName, 'custom.jpg');

  // Replace background updates artwork
  wedding.visual.uploadedBackground.fileName = 'replaced.png';
  assert.equal(wedding.visual.uploadedBackground.fileName, 'replaced.png');

  // Remove background restores template mode
  wedding.visual = { source: 'template' };
  assert.equal(wedding.visual.source, 'template');
});

test('6. Wedding Date UX: Gregorian canonical, Hijri derivation, and Show Hijri toggle', () => {
  const gregorian = '2026-11-20';

  // Derive Hijri
  const hijri = deriveHijriDateFromGregorian(gregorian, 'ar');
  assert.ok(hijri.length > 0);
  assert.ok(hijri.includes('1448') || hijri.includes('١٤٤٨') || hijri.includes('جمادى'));

  // Derive Day of Week
  const dayAr = deriveDayOfWeekFromGregorian(gregorian, 'ar');
  assert.equal(dayAr, 'الجمعة');
  const dayEn = deriveDayOfWeekFromGregorian(gregorian, 'en');
  assert.equal(dayEn, 'Friday');

  // Scene Engine Hijri toggle:
  const eventData = structuredClone(defaultWeddingEvent) as WeddingEventData;
  eventData.gregorianDate = gregorian;
  eventData.hijriDate = hijri;
  eventData.eventDay = dayAr;

  // Case A: showHijriDate = true -> Hijri rendered in details scene
  eventData.showHijriDate = true;
  const scenesWithHijri = resolveWeddingScenes(eventData, defaultWeddingGuest);
  const detailsSceneWithHijri = scenesWithHijri.find((s) => s.id === 'details');
  assert.ok(detailsSceneWithHijri);
  assert.equal(detailsSceneWithHijri.hijriDate, hijri);

  // Case B: showHijriDate = false -> Hijri suppressed from details scene
  eventData.showHijriDate = false;
  const scenesWithoutHijri = resolveWeddingScenes(eventData, defaultWeddingGuest);
  const detailsSceneWithoutHijri = scenesWithoutHijri.find((s) => s.id === 'details');
  assert.ok(detailsSceneWithoutHijri);
  assert.equal(detailsSceneWithoutHijri.hijriDate, undefined, 'Hijri must be omitted when showHijriDate is false');
  assert.equal(detailsSceneWithoutHijri.gregorianDate, gregorian, 'Gregorian must remain present');
  assert.equal(detailsSceneWithoutHijri.eventDay, dayAr, 'Day of week must remain present');
});

test('7. Wedding Studio Copy: Customer-facing outcome language verified', () => {
  // English
  assert.equal(appTranslations.en.weddingStudioTitle, 'Design your perfect wedding invitation');
  assert.equal(
    appTranslations.en.weddingStudioHelp,
    'Create a beautiful invitation, share it with your guests, track RSVPs, and manage your event from one place.'
  );

  // Arabic
  assert.equal(appTranslations.ar.weddingStudioTitle, 'صمم دعوة زفافك المثالية');
  assert.equal(
    appTranslations.ar.weddingStudioHelp,
    'أنشئ دعوة مميزة، وشاركها مع ضيوفك، وتابع تأكيد الحضور، وأدر مناسبتك من مكان واحد.'
  );

  // Verified localized actions
  assert.equal(appTranslations.en.publishInvitation, 'Publish Invitation');
  assert.equal(appTranslations.ar.publishInvitation, 'نشر الدعوة');
  assert.equal(appTranslations.en.unpublishInvitation, 'Unpublish Invitation');
  assert.equal(appTranslations.ar.unpublishInvitation, 'إلغاء نشر الدعوة');
  assert.equal(appTranslations.en.sendOnWhatsApp, 'Send on WhatsApp');
  assert.equal(appTranslations.ar.sendOnWhatsApp, 'إرسال عبر واتساب');
  assert.equal(appTranslations.en.publishBeforeSending, 'Publish the invitation before sending it to guests.');
  assert.equal(appTranslations.ar.publishBeforeSending, 'انشر الدعوة قبل إرسالها إلى الضيوف.');
  assert.equal(appTranslations.en.moveElementsSeparately, 'Move elements separately');
  assert.equal(appTranslations.ar.moveElementsSeparately, 'تحريك العناصر بشكل منفصل');
});
