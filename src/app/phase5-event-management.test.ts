import assert from 'node:assert/strict';
import test from 'node:test';

import { allowedEventTransitions, isTerminalEvent } from './lifecycle.ts';
import {
  buildProjectRoute,
  projectSections,
  resolveProjectSection,
  type ProjectSummary,
} from './projects.ts';
import { checkinStatus, extractScanToken } from '../backend/phase3-model.ts';
import { getWhatsAppShareUrl } from '../wedding/model.ts';
import { invitationUrl } from './operations.ts';

test('Phase 5: guest token isolation guarantees Guest A token is never used for Guest B', () => {
  const origin = 'https://quickrsvp.me';
  const baseUrl = '/';
  const tokenA = 'token-guest-alpha-123';
  const tokenB = 'token-guest-beta-456';

  const guestAUrl = invitationUrl(origin, baseUrl, tokenA);
  const guestBUrl = invitationUrl(origin, baseUrl, tokenB);

  assert.notEqual(guestAUrl, guestBUrl);
  assert.ok(guestAUrl.includes(tokenA));
  assert.ok(guestBUrl.includes(tokenB));
  assert.ok(!guestAUrl.includes(tokenB));
  assert.ok(!guestBUrl.includes(tokenA));

  // WhatsApp share link isolation
  const waA = getWhatsAppShareUrl('wedding', 'Sara & Ahmed Wedding', '+966501234567', guestAUrl);
  const waB = getWhatsAppShareUrl('wedding', 'Sara & Ahmed Wedding', '+966559876543', guestBUrl);

  assert.notEqual(waA, waB);
  assert.ok(waA.includes('966501234567'));
  assert.ok(waA.includes(encodeURIComponent(guestAUrl)));
  assert.ok(waB.includes('966559876543'));
  assert.ok(waB.includes(encodeURIComponent(guestBUrl)));
  assert.ok(!waA.includes(encodeURIComponent(guestBUrl)));
  assert.ok(!waB.includes(encodeURIComponent(guestAUrl)));
});

test('Phase 5: project workspace routes and sections resolve cleanly for Wedding and Party', () => {
  assert.deepEqual(projectSections.wedding, ['overview', 'invitation', 'guests', 'send', 'scanner', 'settings']);
  assert.deepEqual(projectSections.party, ['overview', 'invitation', 'guests', 'send', 'scanner', 'settings']);

  assert.equal(buildProjectRoute('wedding', 'w-100', 'overview'), '/weddings/w-100/overview');
  assert.equal(buildProjectRoute('wedding', 'w-100', 'invitation'), '/weddings/w-100/invitation');
  assert.equal(buildProjectRoute('wedding', 'w-100', 'guests'), '/weddings/w-100/guests');
  assert.equal(buildProjectRoute('wedding', 'w-100', 'send'), '/weddings/w-100/send');
  assert.equal(buildProjectRoute('wedding', 'w-100', 'scanner'), '/weddings/w-100/scanner');
  assert.equal(buildProjectRoute('wedding', 'w-100', 'settings'), '/weddings/w-100/settings');

  assert.equal(buildProjectRoute('party', 'p-200', 'overview'), '/parties/p-200/overview');
  assert.equal(buildProjectRoute('party', 'p-200', 'invitation'), '/parties/p-200/invitation');

  assert.equal(resolveProjectSection('wedding', 'invalid-section'), 'overview');
  assert.equal(resolveProjectSection('party', 'scanner'), 'scanner');
});

test('Phase 5: lifecycle transitions and terminal statuses adhere to canonical backend rules', () => {
  // Planning event can transition to active, ended, archived, cancelled
  assert.deepEqual(allowedEventTransitions('planning'), ['planning', 'active', 'ended', 'archived', 'cancelled']);
  assert.equal(isTerminalEvent('planning'), false);

  // Active event
  assert.deepEqual(allowedEventTransitions('active'), ['planning', 'active', 'ended', 'archived', 'cancelled']);
  assert.equal(isTerminalEvent('active'), false);

  // Ended event can only be archived or cancelled
  assert.deepEqual(allowedEventTransitions('ended'), ['ended', 'archived', 'cancelled']);
  assert.equal(isTerminalEvent('ended'), true);

  // Archived event cannot transition
  assert.deepEqual(allowedEventTransitions('archived'), ['archived']);
  assert.equal(isTerminalEvent('archived'), true);

  // Cancelled event cannot transition
  assert.deepEqual(allowedEventTransitions('cancelled'), ['cancelled']);
  assert.equal(isTerminalEvent('cancelled'), true);
});

test('Phase 5: scanner token resolution and check-in headcounts are bounded and safe', () => {
  assert.equal(extractScanToken('INV-XYZ-789'), 'INV-XYZ-789');
  assert.equal(extractScanToken('https://quickrsvp.me/i/TKN_456'), 'TKN_456');

  // Headcount check-in status
  assert.equal(checkinStatus(0, 5), 'not_arrived');
  assert.equal(checkinStatus(3, 5), 'partial');
  assert.equal(checkinStatus(5, 5), 'complete');
  assert.equal(checkinStatus(6, 5), 'complete'); // Oversize clamped to complete
});
