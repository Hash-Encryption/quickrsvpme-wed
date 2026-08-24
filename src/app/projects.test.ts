import assert from 'node:assert/strict';
import test from 'node:test';

import { buildProjectRoute, legacyProjectRoute, resolveProjectSection } from './projects.ts';

test('project routes encode IDs and keep Wedding and Party separate', () => {
  assert.equal(buildProjectRoute('wedding', 'arabic wedding', 'invitation'), '/weddings/arabic%20wedding/invitation');
  assert.equal(buildProjectRoute('party', 'party-demo', 'guests'), '/parties/party-demo/guests');
});

test('invalid project sections fall back without entering another product area', () => {
  assert.equal(resolveProjectSection('wedding', 'send'), 'send');
  assert.equal(resolveProjectSection('party', 'send'), 'overview');
  assert.equal(resolveProjectSection('party', 'unknown'), 'overview');
});

test('legacy studio and scanner routes map to project-aware destinations', () => {
  assert.equal(legacyProjectRoute('/studio/wedding', 'wed-1'), '/weddings/wed-1/invitation');
  assert.equal(legacyProjectRoute('/studio/party', 'wed-1'), '/parties/party-demo/invitation');
  assert.equal(legacyProjectRoute('/scanner', 'wed-1'), '/weddings/wed-1/scanner');
});
