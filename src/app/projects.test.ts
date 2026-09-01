import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAdminRoute, buildProjectRoute, findAuthenticatedProjectEvent, isPublicInvitationRoute, legacyProjectRoute, projectSections, resolveAdminSection, resolveProjectSection } from './projects.ts';

test('project routes encode IDs and keep Wedding and Party separate', () => {
  assert.equal(buildProjectRoute('wedding', 'arabic wedding', 'invitation'), '/weddings/arabic%20wedding/invitation');
  assert.equal(buildProjectRoute('party', 'party-demo', 'invitation'), '/parties/party-demo/invitation');
  assert.equal(isPublicInvitationRoute('/weddings/event-1/invitation'), false);
  assert.equal(isPublicInvitationRoute('/parties/event-2/invitation'), false);
  assert.equal(isPublicInvitationRoute('/i/private-token'), true);
});

test('an Admin plus Client account resolves its owned Wedding and Party Events without public tokens', () => {
  const account = {
    admin: true,
    events: [
      { id: 'wed-1', product_id: 'wedding' as const, deleted_at: null },
      { id: 'party-1', product_id: 'party' as const, deleted_at: null },
    ],
  };
  assert.equal(account.admin, true);
  assert.equal(findAuthenticatedProjectEvent(account.events, 'wedding', 'wed-1')?.product_id, 'wedding');
  assert.equal(findAuthenticatedProjectEvent(account.events, 'party', 'party-1')?.product_id, 'party');
  assert.equal(findAuthenticatedProjectEvent(account.events, 'party', 'wed-1'), undefined);
});

test('invalid project sections fall back without entering another product area', () => {
  assert.equal(resolveProjectSection('wedding', 'send'), 'send');
  assert.equal(resolveProjectSection('party', 'send'), 'send');
  assert.equal(resolveProjectSection('party', 'unknown'), 'overview');
});

test('legacy studio and scanner routes map to project-aware destinations', () => {
  assert.equal(legacyProjectRoute('/studio/wedding', 'wed-1'), '/weddings/wed-1/invitation');
  assert.equal(legacyProjectRoute('/studio/party', 'wed-1'), '/parties/party-demo/invitation');
  assert.equal(legacyProjectRoute('/scanner', 'wed-1'), '/weddings/wed-1/scanner');
});

test('Wedding and Party expose the same six CRM destinations including Send', () => {
  assert.deepEqual(projectSections.wedding, ['overview', 'invitation', 'guests', 'send', 'scanner', 'settings']);
  assert.deepEqual(projectSections.party, projectSections.wedding);
  assert.equal(buildProjectRoute('party', 'party-demo', 'send'), '/parties/party-demo/send');
});

test('admin destinations stay in the existing application router', () => {
  assert.equal(buildAdminRoute('templates'), '/admin/templates');
  assert.equal(resolveAdminSection('support'), 'support');
  assert.equal(resolveAdminSection('unknown'), 'customers');
});
