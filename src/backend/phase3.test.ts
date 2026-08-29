import assert from 'node:assert/strict';
import test from 'node:test';

import { checkinStatus, extractScanToken } from './phase3-model.ts';

test('check-in semantics preserve not arrived, partial, and complete headcounts', () => {
  assert.equal(checkinStatus(0, 3), 'not_arrived');
  assert.equal(checkinStatus(2, 3), 'partial');
  assert.equal(checkinStatus(3, 3), 'complete');
});

test('scanner accepts an opaque token or the existing personal invitation URL', () => {
  assert.equal(extractScanToken('abc123'), 'abc123');
  assert.equal(extractScanToken('https://quickrsvp.me/i/abc%20123'), 'abc 123');
  assert.equal(extractScanToken('  '), '');
});
