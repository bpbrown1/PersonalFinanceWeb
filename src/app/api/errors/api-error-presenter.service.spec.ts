import { TestBed } from '@angular/core/testing';
import { NotificationService } from '../../core/notification.service';
import { ApiErrorPresenter } from './api-error-presenter.service';

describe('ApiErrorPresenter', () => {
  it('publishes the normalized actionable message as an error notification', () => {
    const notifications = { show: vi.fn() };
    TestBed.configureTestingModule({
      providers: [ApiErrorPresenter, { provide: NotificationService, useValue: notifications }],
    });

    const result = TestBed.inject(ApiErrorPresenter).present(new Error('internal detail'));

    expect(result.kind).toBe('unexpected');
    expect(notifications.show).toHaveBeenCalledWith(result.userMessage, 'error');
    expect(result.userMessage).not.toContain('internal detail');
  });
});
