import type { Session } from '@supabase/supabase-js';

import { BackendError, toBackendError } from '../backend/errors.ts';

export const accountBootstrapTimeoutMs = 8_000;
export const needsAccountBootstrap = (pathname: string) => !pathname.startsWith('/i/');

type BootstrapLoaders<Client, Entitlements, Events> = {
  client: (signal?: AbortSignal) => Promise<Client>;
  entitlements: (signal?: AbortSignal) => Promise<Entitlements>;
  events: (signal?: AbortSignal) => Promise<Events>;
  admin: (signal?: AbortSignal) => Promise<boolean>;
};

export type OptionalAccountData<Entitlements, Events> = {
  entitlements?: Entitlements;
  events?: Events;
  admin?: boolean;
  errors: ReturnType<typeof toBackendError>[];
};

function withTimeout<T>(load: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new BackendError('server', 'Account service request timed out.'));
    }, timeoutMs);
    const promise = Promise.resolve().then(() => load(controller.signal));
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

export async function startAccountBootstrap<Client, Entitlements, Events>(
  loaders: BootstrapLoaders<Client, Entitlements, Events>,
  timeoutMs = accountBootstrapTimeoutMs,
) {
  const client = await withTimeout(loaders.client, timeoutMs);
  const optional = Promise.allSettled([
    withTimeout(loaders.entitlements, timeoutMs),
    withTimeout(loaders.events, timeoutMs),
    withTimeout(loaders.admin, timeoutMs),
  ]).then(([entitlements, events, admin]): OptionalAccountData<Entitlements, Events> => ({
    entitlements: entitlements.status === 'fulfilled' ? entitlements.value as Entitlements : undefined,
    events: events.status === 'fulfilled' ? events.value as Events : undefined,
    admin: admin.status === 'fulfilled' ? admin.value as boolean : undefined,
    errors: [entitlements, events, admin].flatMap((result) => result.status === 'rejected' ? [toBackendError(result.reason)] : []),
  }));
  return { client, optional };
}

export function accountBootstrapError(error: unknown): BackendError {
  const resolved = toBackendError(error);
  return resolved.code === 'unknown'
    ? new BackendError('account_data_unavailable', resolved.message, { cause: error })
    : resolved;
}

export function createAuthBootstrapScheduler(run: (session: Session | null) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    schedule(session: Session | null) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = undefined; run(session); }, 0);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = undefined;
    },
  };
}
