import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('publishes and explicitly dismisses a notification', () => {
    const service = new NotificationService();
    service.show('Account saved', 'success');

    expect(service.notifications()).toHaveLength(1);
    expect(service.notifications()[0]).toMatchObject({ message: 'Account saved', tone: 'success' });

    service.dismiss(service.notifications()[0].id);
    expect(service.notifications()).toEqual([]);
  });

  it('automatically dismisses a notification after five seconds', () => {
    const service = new NotificationService();
    service.show('Temporary message');

    vi.advanceTimersByTime(4999);
    expect(service.notifications()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(service.notifications()).toEqual([]);
  });
});
