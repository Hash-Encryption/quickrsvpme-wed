export type BackendErrorCode = 'configuration' | 'network' | 'unauthorized' | 'subscription_unavailable' | 'unknown';

export class BackendError extends Error {
  readonly code: BackendErrorCode;

  constructor(code: BackendErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
    this.name = 'BackendError';
  }
}

export function toBackendError(error: unknown): BackendError {
  if (error instanceof BackendError) return error;
  const value = error as { message?: unknown; status?: unknown; code?: unknown } | null;
  const message = typeof value?.message === 'string' ? value.message : 'Backend request failed.';
  if (value?.status === 401 || value?.status === 403 || value?.code === '42501') return new BackendError('unauthorized', message, { cause: error });
  if (/fetch|network|offline/i.test(message)) return new BackendError('network', message, { cause: error });
  if (/entitlement|required product/i.test(message)) return new BackendError('subscription_unavailable', message, { cause: error });
  return new BackendError('unknown', message, { cause: error });
}
