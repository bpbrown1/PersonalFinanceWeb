import { HttpErrorResponse } from '@angular/common/http';
import { AppHttpError, normalizeHttpError } from './app-http-error';

describe('normalizeHttpError', () => {
  it('retains an existing budget id from a conflict response', () => {
    const normalized = normalizeHttpError(
      new HttpErrorResponse({
        status: 409,
        error: {
          timestamp: '2026-08-31T12:00:00Z',
          status: 409,
          error: 'Target occupied',
          fieldErrors: {},
          existingBudgetId: 'budget-2',
        },
      }),
    );
    expect(normalized.existingBudgetId).toBe('budget-2');
  });
  it('classifies an unreachable API as a retryable network failure', () => {
    const result = normalizeHttpError(
      new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' }),
    );
    expect(result).toMatchObject({ kind: 'network', status: 0, retryable: true });
    expect(result.userMessage).toContain('API is running');
  });

  it('classifies a missing resource as not found', () => {
    const result = normalizeHttpError(apiError(404, 'Financial account not found'));
    expect(result).toMatchObject({ kind: 'not-found', status: 404, retryable: false });
  });

  it('classifies a server response as retryable without exposing its body', () => {
    const result = normalizeHttpError(
      new HttpErrorResponse({ status: 503, error: 'database details', statusText: 'Unavailable' }),
    );
    expect(result).toMatchObject({ kind: 'server', status: 503, retryable: true });
    expect(result.userMessage).not.toContain('database details');
  });

  it('classifies another 4xx response as a client failure', () => {
    const result = normalizeHttpError(apiError(409, 'Account already exists'));
    expect(result).toMatchObject({
      kind: 'client',
      status: 409,
      userMessage: 'Account already exists',
    });
  });

  it('classifies non-HTTP exceptions as unexpected', () => {
    const result = normalizeHttpError(new TypeError('bad mapping'));
    expect(result).toMatchObject({ kind: 'unexpected', status: null, retryable: false });
  });

  it('does not wrap an error that is already normalized', () => {
    const existing = new AppHttpError('server', 'Try later', 500, {}, true);
    expect(normalizeHttpError(existing)).toBe(existing);
  });
});

function apiError(status: number, message: string): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    statusText: 'Request failed',
    error: { timestamp: '2026-08-22T18:30:00Z', status, error: message, fieldErrors: {} },
  });
}
