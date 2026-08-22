import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorResponse } from '../accounts/account.models';

export type AppHttpErrorKind = 'network' | 'validation' | 'not-found' | 'client' | 'server' | 'unexpected';

export class AppHttpError extends Error {
  constructor(
    readonly kind: AppHttpErrorKind,
    readonly userMessage: string,
    readonly status: number | null = null,
    readonly fieldErrors: Readonly<Record<string, string>> = {},
    readonly retryable = false,
    options?: ErrorOptions,
  ) {
    super(userMessage, options);
    this.name = 'AppHttpError';
  }
}

export function normalizeHttpError(error: unknown): AppHttpError {
  if (error instanceof AppHttpError) return error;
  if (!(error instanceof HttpErrorResponse)) {
    return new AppHttpError('unexpected', 'Something unexpected happened. Please try again.', null, {}, false, { cause: error });
  }
  if (error.status === 0) {
    return new AppHttpError('network', 'Unable to reach the Personal Finance service. Check that the API is running and try again.', 0, {}, true, { cause: error });
  }
  const body = isApiErrorResponse(error.error) ? error.error : null;
  const fieldErrors = body?.fieldErrors ?? {};
  if (error.status === 400 && Object.keys(fieldErrors).length > 0) {
    return new AppHttpError('validation', body?.error ?? 'Please correct the highlighted fields.', 400, fieldErrors, false, { cause: error });
  }
  if (error.status === 404) {
    return new AppHttpError('not-found', body?.error ?? 'The requested record could not be found.', 404, {}, false, { cause: error });
  }
  if (error.status >= 500) {
    return new AppHttpError('server', 'The service could not complete the request. Please try again.', error.status, {}, true, { cause: error });
  }
  if (error.status >= 400) {
    return new AppHttpError('client', body?.error ?? 'The request could not be completed.', error.status, fieldErrors, false, { cause: error });
  }
  return new AppHttpError('unexpected', 'Something unexpected happened. Please try again.', error.status || null, {}, false, { cause: error });
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ApiErrorResponse>;
  return typeof candidate.status === 'number' && typeof candidate.error === 'string' && !!candidate.fieldErrors && typeof candidate.fieldErrors === 'object';
}
