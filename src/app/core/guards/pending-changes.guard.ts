import { CanDeactivateFn } from '@angular/router';

export interface HasPendingChanges {
  hasPendingChanges(): boolean;
}

export const pendingChangesGuard: CanDeactivateFn<HasPendingChanges> = (component) =>
  !component.hasPendingChanges() ||
  globalThis.confirm('You have unsaved account changes. Leave this page?');
