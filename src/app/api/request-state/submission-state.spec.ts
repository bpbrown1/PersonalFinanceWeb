import { Subject, of, throwError } from 'rxjs';
import { AppHttpError } from '../errors/app-http-error';
import { SubmissionState } from './submission-state';

describe('SubmissionState', () => {
  it('prevents a duplicate request while the first is active', () => {
    const state = new SubmissionState();
    const request = new Subject<string>();
    let calls = 0;
    let duplicateCompleted = false;

    state.run(() => {
      calls += 1;
      return request;
    }).subscribe();
    state.run(() => {
      calls += 1;
      return of('duplicate');
    }).subscribe({ complete: () => duplicateCompleted = true });

    expect(state.busy()).toBe(true);
    expect(calls).toBe(1);
    expect(duplicateCompleted).toBe(true);

    request.complete();
    expect(state.busy()).toBe(false);
  });

  it('retains a normalized error for the workflow to display', () => {
    const state = new SubmissionState();
    state.run(() => throwError(() => new Error('boom'))).subscribe({ error: () => undefined });

    expect(state.busy()).toBe(false);
    expect(state.error()).toBeInstanceOf(AppHttpError);
    expect(state.error()?.kind).toBe('unexpected');
    expect(state.error()?.userMessage).toContain('try again');
  });

  it('passes successful values through and releases the busy state', () => {
    const state = new SubmissionState();
    let value = '';
    state.run(() => of('saved')).subscribe((result) => value = result);

    expect(value).toBe('saved');
    expect(state.busy()).toBe(false);
    expect(state.error()).toBeNull();
  });

  it('clears a previous error when a new request starts', () => {
    const state = new SubmissionState();
    const nextRequest = new Subject<string>();
    state.run(() => throwError(() => new Error('first failure'))).subscribe({ error: () => undefined });
    expect(state.error()).not.toBeNull();

    state.run(() => nextRequest).subscribe();
    expect(state.busy()).toBe(true);
    expect(state.error()).toBeNull();
    nextRequest.complete();
  });
});
