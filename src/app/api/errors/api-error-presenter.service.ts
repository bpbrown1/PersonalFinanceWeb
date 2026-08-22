import { Injectable, inject } from '@angular/core';
import { NotificationService } from '../../core/notification.service';
import { AppHttpError, normalizeHttpError } from './app-http-error';

@Injectable({ providedIn: 'root' })
export class ApiErrorPresenter {
  private readonly notifications = inject(NotificationService);

  present(error: unknown): AppHttpError {
    const normalized = normalizeHttpError(error);
    this.notifications.show(normalized.userMessage, 'error');
    return normalized;
  }
}
