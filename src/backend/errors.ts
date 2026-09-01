export type BackendErrorCode = 'configuration' | 'invalid_credentials' | 'session_expired' | 'network' | 'server' | 'unauthorized' | 'subscription_unavailable' | 'account_data_unavailable' | 'unknown';

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
  const status = Number(value?.status);
  if (/invalid login credentials|invalid credentials/i.test(message)) return new BackendError('invalid_credentials', message, { cause: error });
  if (status === 401 || /jwt.*expired|session.*expired|refresh token.*(invalid|expired|not found)/i.test(message)) return new BackendError('session_expired', message, { cause: error });
  if (status === 403 || value?.code === '42501') return new BackendError('unauthorized', message, { cause: error });
  if (/fetch|network|offline/i.test(message)) return new BackendError('network', message, { cause: error });
  if (status >= 500) return new BackendError('server', message, { cause: error });
  if (/entitlement|required product/i.test(message)) return new BackendError('subscription_unavailable', message, { cause: error });
  return new BackendError('unknown', message, { cause: error });
}

export function authErrorMessageKey(code: BackendErrorCode) {
  if (code === 'invalid_credentials') return 'invalidCredentials' as const;
  if (code === 'session_expired') return 'sessionExpired' as const;
  if (code === 'unauthorized') return 'unauthorizedAccount' as const;
  if (code === 'network') return 'networkError' as const;
  if (code === 'server') return 'serverError' as const;
  if (code === 'subscription_unavailable') return 'subscription_unavailable' as const;
  return 'accountDataUnavailable' as const;
}
