import { Component, inject } from '@angular/core';
import { NotificationService } from '../../core/notification.service';

@Component({
  selector: 'app-notification-center',
  template: `
    <div class="notifications" aria-live="polite" aria-label="Notifications">
      @for (notice of service.notifications(); track notice.id) {
        <div [class]="'notification ' + notice.tone" role="status">
          <span>{{ notice.message }}</span>
          <button type="button" (click)="service.dismiss(notice.id)" aria-label="Dismiss notification">×</button>
        </div>
      }
    </div>
  `,
  styles: `
    .notifications { position: fixed; z-index: 50; right: 1rem; bottom: 1rem; display: grid; gap: .75rem; width: min(24rem, calc(100vw - 2rem)); }
    .notification { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .9rem 1rem; color: var(--color-text); background: var(--color-surface); border: 1px solid var(--color-border); border-left: 4px solid var(--color-primary); border-radius: .75rem; box-shadow: var(--shadow-raised); }
    .notification.success { border-left-color: var(--color-positive); } .notification.error { border-left-color: var(--color-negative); }
    button { border: 0; color: inherit; background: transparent; font-size: 1.25rem; cursor: pointer; }
  `,
})
export class NotificationCenter { protected readonly service = inject(NotificationService); }
