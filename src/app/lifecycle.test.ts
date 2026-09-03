import assert from 'node:assert/strict';
import test from 'node:test';

import { allowedEventTransitions, isTerminalEvent } from './lifecycle.ts';

test('terminal Events stay read-only and ended Events may only close further', () => {
  assert.equal(isTerminalEvent('ended'), true);
  assert.equal(isTerminalEvent('active'), false);
  assert.deepEqual(allowedEventTransitions('ended'), ['ended', 'archived', 'cancelled']);
  assert.deepEqual(allowedEventTransitions('archived'), ['archived']);
  assert.deepEqual(allowedEventTransitions('cancelled'), ['cancelled']);
});

test('planning and active Events retain the complete lifecycle controls', () => {
  assert.deepEqual(allowedEventTransitions('planning'), ['planning', 'active', 'ended', 'archived', 'cancelled']);
  assert.deepEqual(allowedEventTransitions('active'), allowedEventTransitions('planning'));
});
