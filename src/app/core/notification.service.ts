import { Injectable, signal } from '@angular/core';

export interface AppNotification {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private nextId = 0;
  readonly notifications = signal<AppNotification[]>([]);

  show(message: string, tone: AppNotification['tone'] = 'info'): void {
    const notification = { id: ++this.nextId, message, tone };
    this.notifications.update((items) => [...items, notification]);
    globalThis.setTimeout(() => this.dismiss(notification.id), 5000);
  }

  dismiss(id: number): void {
    this.notifications.update((items) => items.filter((item) => item.id !== id));
  }
}
