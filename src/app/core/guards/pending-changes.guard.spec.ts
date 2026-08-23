import { pendingChangesGuard } from './pending-changes.guard';

describe('pendingChangesGuard', () => {
  afterEach(() => vi.restoreAllMocks());

  it('allows navigation when the workflow has no unsaved changes', () => {
    const confirm = vi.spyOn(globalThis, 'confirm');
    const result = pendingChangesGuard({ hasPendingChanges: () => false }, {} as never, {} as never, {} as never);
    expect(result).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('asks before discarding unsaved changes', () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    const result = pendingChangesGuard({ hasPendingChanges: () => true }, {} as never, {} as never, {} as never);
    expect(result).toBe(false);
    expect(globalThis.confirm).toHaveBeenCalledWith('You have unsaved changes. Leave this page?');
  });
});
