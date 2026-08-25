import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkInOperationalGuest,
  guestsCsv,
  guestsForProject,
  invitationUrl,
  normalizeOperationalState,
  operationalStats,
  projectKey,
  scanProjectGuest,
  updateOperationalGuest,
} from './operations.ts';
import { defaultWeddingGuest, getWhatsAppShareUrl } from '../wedding/model.ts';

const weddingKey = projectKey('wedding', 'wed-1');
const partyKey = projectKey('party', 'party-demo');

test('legacy Phase 5 guest state normalizes once into the active product without deleting compatibility data', () => {
  const legacy = { mode: 'wedding' as const, rsvp: 'accepted' as const, checkedIn: true, weddingGuest: defaultWeddingGuest, weddingResponse: { guestCount: 2, message: 'See you' } };
  const state = normalizeOperationalState(undefined, legacy, 'wed-1', 'party-demo');
  assert.equal(guestsForProject(state, weddingKey)[0].guestCount, 2);
  assert.equal(guestsForProject(state, weddingKey)[0].checkedIn, true);
  assert.deepEqual(guestsForProject(state, partyKey), []);
  assert.equal(legacy.weddingGuest.token, defaultWeddingGuest.token);
});

test('persisted project guests normalize safely and remain isolated', () => {
  const state = normalizeOperationalState({ version: 1, guestsByProject: {
    [weddingKey]: [{ ...defaultWeddingGuest, id: 'w', rsvp: 'accepted', guestCount: 99, message: '', checkedIn: false }],
    [partyKey]: [{ ...defaultWeddingGuest, id: 'p', token: 'party-token', rsvp: 'pending', guestCount: 4, message: '', checkedIn: true }],
  } }, {}, 'wed-1', 'party-demo');
  assert.equal(guestsForProject(state, weddingKey)[0].guestCount, 3);
  assert.equal(guestsForProject(state, partyKey)[0].guestCount, 0);
  assert.equal(guestsForProject(state, partyKey)[0].checkedIn, true);
});

test('scanner supports valid invalid already-checked-in and repeated project-local use', () => {
  const state = normalizeOperationalState(undefined, { mode: 'wedding', weddingGuest: defaultWeddingGuest }, 'wed-1', 'party-demo');
  assert.deepEqual(scanProjectGuest(state, weddingKey, defaultWeddingGuest.token), { status: 'valid', guestId: defaultWeddingGuest.token });
  assert.equal(scanProjectGuest(state, partyKey, defaultWeddingGuest.token).status, 'invalid');
  assert.equal(scanProjectGuest(state, weddingKey, 'unknown').status, 'invalid');
  const checked = checkInOperationalGuest(state, weddingKey, defaultWeddingGuest.token);
  assert.deepEqual(scanProjectGuest(checked, weddingKey, defaultWeddingGuest.token), { status: 'already-checked-in', guestId: defaultWeddingGuest.token });
  assert.deepEqual(scanProjectGuest(checked, weddingKey, defaultWeddingGuest.token), { status: 'already-checked-in', guestId: defaultWeddingGuest.token });
});

test('RSVP and overview counts honor companion limits', () => {
  const state = normalizeOperationalState(undefined, { mode: 'wedding', weddingGuest: defaultWeddingGuest }, 'wed-1', 'party-demo');
  const updated = updateOperationalGuest(state, weddingKey, defaultWeddingGuest.token, { rsvp: 'accepted', guestCount: 99 });
  const guest = guestsForProject(updated, weddingKey)[0];
  assert.equal(guest.guestCount, 3);
  assert.deepEqual(operationalStats([guest]), { guests: 1, invitedSeats: 3, accepted: 1, declined: 0, pending: 0, checkedIn: 0 });
});

test('Party response changes clamp companions without crossing project boundaries', () => {
  const state = normalizeOperationalState({ version: 1, guestsByProject: {
    [weddingKey]: [{ ...defaultWeddingGuest, id: 'w', rsvp: 'pending', guestCount: 0, message: '', checkedIn: false }],
    [partyKey]: [{ ...defaultWeddingGuest, id: 'p', rsvp: 'pending', guestCount: 0, message: '', checkedIn: false }],
  } }, {}, 'wed-1', 'party-demo');
  const accepted = updateOperationalGuest(state, partyKey, 'p', { rsvp: 'accepted', guestCount: 99 });
  const changed = updateOperationalGuest(accepted, partyKey, 'p', { rsvp: 'declined', guestCount: 0 });
  assert.equal(guestsForProject(accepted, partyKey)[0].guestCount, 3);
  assert.equal(guestsForProject(changed, partyKey)[0].rsvp, 'declined');
  assert.deepEqual(guestsForProject(changed, weddingKey), guestsForProject(state, weddingKey));
});

test('CSV and personal links include only the selected project data', () => {
  const state = normalizeOperationalState({ version: 1, guestsByProject: {
    [weddingKey]: [{ ...defaultWeddingGuest, id: 'w', rsvp: 'pending', guestCount: 0, message: '', checkedIn: false }],
    [partyKey]: [{ ...defaultWeddingGuest, id: 'p', name: 'Party Guest', token: 'party-token', rsvp: 'pending', guestCount: 0, message: '', checkedIn: false }],
  } }, {}, 'wed-1', 'party-demo');
  const csv = guestsCsv(guestsForProject(state, partyKey));
  assert.match(csv, /Party Guest/);
  assert.doesNotMatch(csv, new RegExp(defaultWeddingGuest.name));
  assert.equal(invitationUrl('https://quickrsvp.me', '/', 'party token'), 'https://quickrsvp.me/i/party%20token');
});

test('Send prepares links with a missing-phone fallback and owns no delivery state', () => {
  const state = normalizeOperationalState(undefined, { mode: 'standard', weddingGuest: { ...defaultWeddingGuest, phone: '' } }, 'wed-1', 'party-demo');
  const guest = guestsForProject(state, partyKey)[0];
  const url = invitationUrl('https://quickrsvp.me', '/', guest.token);
  assert.ok(getWhatsAppShareUrl('standard', 'Party', guest.phone, url).startsWith('https://wa.me/?text='));
  assert.equal(Object.hasOwn(guest, 'sent'), false);
  assert.equal(Object.hasOwn(guest, 'delivered'), false);
  assert.equal(Object.hasOwn(guest, 'opened'), false);
});
