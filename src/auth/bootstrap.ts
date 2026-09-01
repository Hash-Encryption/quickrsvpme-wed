import type { Session } from '@supabase/supabase-js';

import { BackendError, toBackendError } from '../backend/errors.ts';

export const accountBootstrapTimeoutMs = 8_000;

type BootstrapLoaders<Client, Entitlements, Events> = {
  client: () => Promise<Client>;
  entitlements: () => Promise<Entitlements>;
  events: () => Promise<Events>;
  admin: () => Promise<boolean>;
};

export type OptionalAccountData<Entitlements, Events> = {
  entitlements?: Entitlements;
  events?: Events;
  admin?: boolean;
  errors: ReturnType<typeof toBackendError>[];
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new BackendError('account_data_unavailable', 'Account data request timed out.')), timeoutMs);
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
  const optional = Promise.allSettled([
    withTimeout(loaders.entitlements(), timeoutMs),
    withTimeout(loaders.events(), timeoutMs),
    withTimeout(loaders.admin(), timeoutMs),
  ]).then(([entitlements, events, admin]): OptionalAccountData<Entitlements, Events> => ({
    entitlements: entitlements.status === 'fulfilled' ? entitlements.value as Entitlements : undefined,
    events: events.status === 'fulfilled' ? events.value as Events : undefined,
    admin: admin.status === 'fulfilled' ? admin.value as boolean : undefined,
    errors: [entitlements, events, admin].flatMap((result) => result.status === 'rejected' ? [toBackendError(result.reason)] : []),
  }));
  return { client: await withTimeout(loaders.client(), timeoutMs), optional };
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
