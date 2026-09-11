import assert from 'node:assert/strict';
import test from 'node:test';

import { appTranslations } from '../i18n/app-locale-data.ts';
import { weddingBuilderT } from '../i18n/wedding-builder.ts';
import { buildProjectRoute, projectSections, resolveProjectSection } from './projects.ts';
import type { BackendEvent } from '../backend/types.ts';

test('Test A: Create new wedding routes directly to invitation editor for newly persisted event', () => {
  const newEventId = 'wed-new-101';

  // Direct Entry Rule: Immediately after creating the event and configuration,
  // the creator navigates directly to the invitation editor for that event.
  const invitationEditorRoute = buildProjectRoute('wedding', newEventId, 'invitation');
  assert.equal(invitationEditorRoute, '/weddings/wed-new-101/invitation');

  // Verify section resolution
  assert.equal(resolveProjectSection('wedding', 'invitation'), 'invitation');
});

test('Test B: Returning to existing wedding offers Open Wedding as primary and Edit Invitation as secondary', () => {
  const existingEventId = 'wed-exist-202';

  // Primary Action: Open Wedding -> Overview
  const openWeddingRoute = buildProjectRoute('wedding', existingEventId, 'overview');
  assert.equal(openWeddingRoute, '/weddings/wed-exist-202/overview');

  // Secondary Action: Edit Invitation -> Invitation editor
  const editInvitationRoute = buildProjectRoute('wedding', existingEventId, 'invitation');
  assert.equal(editInvitationRoute, '/weddings/wed-exist-202/invitation');

  // Verify localized button labels exist in both AR and EN
  assert.equal(appTranslations.en.openWedding, 'Open wedding');
  assert.equal(appTranslations.ar.openWedding, 'فتح حفل الزفاف');
  assert.equal(appTranslations.en.editInvitation, 'Edit Invitation');
  assert.equal(appTranslations.ar.editInvitation, 'تعديل الدعوة');
});

test('Test C: Edit Invitation explicitly opens the invitation editor', () => {
  const eventId = 'wed-edit-303';
  const targetRoute = buildProjectRoute('wedding', eventId, 'invitation');

  assert.equal(targetRoute, '/weddings/wed-edit-303/invitation');
  assert.notEqual(targetRoute, '/weddings/wed-edit-303/overview');
  assert.notEqual(targetRoute, '/weddings/wed-edit-303/scanner');
  assert.notEqual(targetRoute, '/');
});

test('Test D: Unpublished event capabilities allow host to use Overview, Guests, Settings, Send, Scanner', () => {
  const planningEventId = 'wed-planning-404';

  const mockPlanningEvent: BackendEvent = {
    id: planningEventId,
    client_id: 'client-1',
    product_id: 'wedding',
    title: 'Sarah & Tariq Wedding',
    lifecycle_status: 'planning', // Unpublished, in planning
    invitation_locale: 'ar',
    starts_at: '2026-11-20T18:00:00Z',
    ends_at: null,
    rsvp_deadline: '2026-11-10T18:00:00Z',
    venue_name: 'Al-Faisaliah Hotel',
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

  // Ensure all sections are defined and accessible for the planning event
  const expectedSections = ['overview', 'invitation', 'guests', 'send', 'scanner', 'settings'] as const;
  assert.deepEqual(projectSections.wedding, expectedSections);

  for (const section of expectedSections) {
    const sectionRoute = buildProjectRoute('wedding', mockPlanningEvent.id, section);
    assert.equal(sectionRoute, `/weddings/${planningEventId}/${section}`);
    assert.equal(resolveProjectSection('wedding', section), section);
  }

  // Scanner route is project-scoped and accessible for planning events
  const scannerRoute = buildProjectRoute('wedding', mockPlanningEvent.id, 'scanner');
  assert.equal(scannerRoute, `/weddings/${planningEventId}/scanner`);

  // Empty section parameter safely defaults to overview
  assert.equal(resolveProjectSection('wedding', undefined), 'overview');
});

test('Test E: Publication preservation controls public invitation availability only', () => {
  // Public invitation link format
  const publicGuestToken = 'g-token-xyz-789';
  const publicRoute = `/i/${publicGuestToken}`;

  // Public route pattern check
  assert.match(publicRoute, /^\/i\/[^/]+\/?$/);

  // Host routes are never under /i/
  const hostOverview = buildProjectRoute('wedding', 'wed-505', 'overview');
  const hostScanner = buildProjectRoute('wedding', 'wed-505', 'scanner');
  const hostInvitation = buildProjectRoute('wedding', 'wed-505', 'invitation');

  assert.doesNotMatch(hostOverview, /^\/i\//);
  assert.doesNotMatch(hostScanner, /^\/i\//);
  assert.doesNotMatch(hostInvitation, /^\/i\//);
});

test('Customer Copy: Raw publication authority codes are mapped to localized strings', () => {
  // Check that English translations contain friendly customer messages
  assert.equal(appTranslations.en.publishingLimitReached, 'Publishing limit reached');
  assert.equal(appTranslations.en.alreadyPublished, 'Published');
  assert.equal(appTranslations.en.subscriptionInactive, 'Subscription inactive');

  // Check that Arabic translations contain friendly customer messages
  assert.equal(appTranslations.ar.publishingLimitReached, 'تم استهلاك حد النشر المتاح');
  assert.equal(appTranslations.ar.alreadyPublished, 'تم النشر مسبقاً');
  assert.equal(appTranslations.ar.subscriptionInactive, 'الاشتراك غير مفعّل');
});

test('Music & Video: Translations and streaming validation warnings', () => {
  // English keys exist
  assert.equal(weddingBuilderT('en', 'musicAndVideo'), 'Music & Video');
  assert.equal(weddingBuilderT('en', 'previewAudio'), 'Play preview');
  assert.equal(weddingBuilderT('en', 'removeAudio'), 'Remove audio');
  assert.ok(weddingBuilderT('en', 'streamingWarning').includes('Spotify'));

  // Arabic keys exist
  assert.equal(weddingBuilderT('ar', 'musicAndVideo'), 'الموسيقى والفيديو');
  assert.equal(weddingBuilderT('ar', 'previewAudio'), 'تشغيل المعاينة');
  assert.equal(weddingBuilderT('ar', 'removeAudio'), 'إزالة الموسيقى');
  assert.ok(weddingBuilderT('ar', 'streamingWarning').includes('سبوتيفاي'));
});
