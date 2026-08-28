import assert from 'node:assert/strict';
import test from 'node:test';

import { BackendError, toBackendError } from './errors.ts';

test('backend failures keep semantic UI-safe error codes', () => {
  assert.equal(toBackendError({ status: 403, message: 'denied' }).code, 'unauthorized');
  assert.equal(toBackendError(new TypeError('Failed to fetch')).code, 'network');
  assert.equal(toBackendError({ message: 'Active entitlement required' }).code, 'subscription_unavailable');
  const existing = new BackendError('configuration', 'missing');
  assert.equal(toBackendError(existing), existing);
});
