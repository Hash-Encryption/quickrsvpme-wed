import assert from 'node:assert/strict';
import test from 'node:test';

import { BackendError } from '../backend/errors.ts';
import { accountBootstrapError, createAuthBootstrapScheduler, needsAccountBootstrap, startAccountBootstrap } from './bootstrap.ts';

const client = { id: 'client-1', display_name: 'Client' };

test('public invitation routes do not load authenticated account data', () => {
  assert.equal(needsAccountBootstrap('/i/public-token'), false);
  assert.equal(needsAccountBootstrap('/'), true);
  assert.equal(needsAccountBootstrap('/weddings/event-1/overview'), true);
});

test('fresh and restored sessions verify the account before starting optional requests', async () => {
  const started: string[] = [];
  const result = await startAccountBootstrap({
    client: async () => { started.push('client'); return client; },
    entitlements: async () => { started.push('entitlements'); return ['wedding']; },
    events: async () => { started.push('events'); return ['event-1']; },
    admin: async () => { started.push('admin'); return false; },
  });
  assert.deepEqual(new Set(started), new Set(['client', 'entitlements', 'events', 'admin']));
  assert.equal(result.client, client);
  assert.deepEqual(await result.optional, { entitlements: ['wedding'], events: ['event-1'], admin: false, errors: [] });
});

test('essential profile failure does not fan out optional database requests', async () => {
  const started: string[] = [];
  await assert.rejects(startAccountBootstrap({
    client: async () => { started.push('client'); throw new Error('profile missing'); },
    entitlements: async () => { started.push('entitlements'); return []; },
    events: async () => { started.push('events'); return []; },
    admin: async () => { started.push('admin'); return false; },
  }));
  assert.deepEqual(started, ['client']);
});

test('Admin plus Client and normal Client bootstraps preserve both authorities', async () => {
  for (const admin of [true, false]) {
    const result = await startAccountBootstrap({
      client: async () => client,
      entitlements: async () => ['wedding', 'party'],
      events: async () => ['event-1'],
      admin: async () => admin,
    });
    assert.equal(result.client.id, 'client-1');
    assert.equal((await result.optional).admin, admin);
  }
});

test('essential profile failures distinguish unavailable data from a server timeout', async () => {
  const loaders = {
    entitlements: async () => [], events: async () => [], admin: async () => false,
  };
  await assert.rejects(startAccountBootstrap({ ...loaders, client: async () => { throw new Error('profile missing'); } }), (error: unknown) => accountBootstrapError(error).code === 'account_data_unavailable');
  await assert.rejects(startAccountBootstrap({ ...loaders, client: () => new Promise(() => undefined) }, 5), (error: unknown) => error instanceof BackendError && error.code === 'server');
});

test('slow or failed optional requests never hold the authenticated shell open', async () => {
  let eventsAborted = false;
  const result = await startAccountBootstrap({
    client: async () => client,
    entitlements: async () => { throw new Error('optional entitlement failure'); },
    events: (signal) => new Promise(() => signal?.addEventListener('abort', () => { eventsAborted = true; })),
    admin: async () => true,
  }, 5);
  assert.equal(result.client, client);
  const optional = await result.optional;
  assert.equal(optional.events, undefined);
  assert.equal(optional.admin, true);
  assert.equal(optional.entitlements, undefined);
  assert.equal(optional.errors.length, 2);
  assert.equal(eventsAborted, true);
});

test('retry starts a clean bootstrap after an essential failure', async () => {
  let attempts = 0;
  const loaders = {
    client: async () => { if (++attempts === 1) throw new Error('temporary'); return client; },
    entitlements: async () => [], events: async () => [], admin: async () => false,
  };
  await assert.rejects(startAccountBootstrap(loaders));
  assert.equal((await startAccountBootstrap(loaders)).client, client);
  assert.equal(attempts, 2);
});

test('auth callback scheduling escapes the callback lock and coalesces request storms', async () => {
  const sessions: Array<string | null> = [];
  const scheduler = createAuthBootstrapScheduler((session) => sessions.push(session?.user.id ?? null));
  scheduler.schedule({ user: { id: 'old' } } as never);
  scheduler.schedule({ user: { id: 'current' } } as never);
  assert.deepEqual(sessions, []);
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.deepEqual(sessions, ['current']);
  scheduler.cancel();
});
