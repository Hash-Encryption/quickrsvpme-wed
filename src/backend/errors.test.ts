import assert from 'node:assert/strict';
import test from 'node:test';

import { authErrorMessageKey, BackendError, toBackendError } from './errors.ts';

test('backend failures keep semantic UI-safe error codes', () => {
  assert.equal(toBackendError({ status: 403, message: 'denied' }).code, 'unauthorized');
  assert.equal(toBackendError({ status: 400, message: 'Invalid login credentials' }).code, 'invalid_credentials');
  assert.equal(toBackendError({ status: 401, message: 'JWT expired' }).code, 'session_expired');
  assert.equal(toBackendError(new TypeError('Failed to fetch')).code, 'network');
  assert.equal(toBackendError({ status: 503, message: 'unavailable' }).code, 'server');
  assert.equal(toBackendError({ message: 'Active entitlement required' }).code, 'subscription_unavailable');
  const existing = new BackendError('configuration', 'missing');
  assert.equal(toBackendError(existing), existing);
});

test('authentication failures select precise localized message keys', () => {
  assert.equal(authErrorMessageKey('invalid_credentials'), 'invalidCredentials');
  assert.equal(authErrorMessageKey('session_expired'), 'sessionExpired');
  assert.equal(authErrorMessageKey('unauthorized'), 'unauthorizedAccount');
  assert.equal(authErrorMessageKey('network'), 'networkError');
  assert.equal(authErrorMessageKey('server'), 'serverError');
  assert.equal(authErrorMessageKey('account_data_unavailable'), 'accountDataUnavailable');
});
