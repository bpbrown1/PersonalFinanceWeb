import { Signal, signal } from '@angular/core';
import { EMPTY, Observable, catchError, finalize, throwError } from 'rxjs';
import { AppHttpError, normalizeHttpError } from '../errors/app-http-error';

export class SubmissionState {
  private readonly busyState = signal(false);
  private readonly errorState = signal<AppHttpError | null>(null);
  readonly busy: Signal<boolean> = this.busyState.asReadonly();
  readonly error: Signal<AppHttpError | null> = this.errorState.asReadonly();

  run<T>(request: () => Observable<T>): Observable<T> {
    if (this.busyState()) return EMPTY;
    this.busyState.set(true);
    this.errorState.set(null);
    return request().pipe(
      catchError((error: unknown) => {
        const normalized = normalizeHttpError(error);
        this.errorState.set(normalized);
        return throwError(() => normalized);
      }),
      finalize(() => this.busyState.set(false)),
    );
  }
}
