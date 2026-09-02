import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AccountsApiService } from '../../../api/accounts/accounts-api.service';
import { FinancialAccount } from '../../../api/accounts/account.models';
import { ApiErrorPresenter } from '../../../api/errors/api-error-presenter.service';
import { AppHttpError } from '../../../api/errors/app-http-error';
import { NotificationService } from '../../../core/notification.service';
import { AccountsPage } from './accounts-page';

describe('AccountsPage', () => {
  const account = accountFixture();
  let api: {
    list: ReturnType<typeof vi.fn>;
    archive: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
  };
  let notifications: { show: ReturnType<typeof vi.fn> };
  let presenter: { present: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    api = {
      list: vi.fn().mockReturnValue(of([account])),
      archive: vi.fn().mockReturnValue(of({ ...account, status: 'archived' })),
      restore: vi.fn().mockReturnValue(of(account)),
    };
    notifications = { show: vi.fn() };
    presenter = { present: vi.fn((error) => error) };
    await TestBed.configureTestingModule({
      imports: [AccountsPage],
      providers: [
        provideRouter([]),
        { provide: AccountsApiService, useValue: api },
        { provide: NotificationService, useValue: notifications },
        { provide: ApiErrorPresenter, useValue: presenter },
      ],
    }).compileComponents();
  });

  it('loads active accounts and renders durable account facts', () => {
    const fixture = TestBed.createComponent(AccountsPage);
    fixture.detectChanges();
    expect(api.list).toHaveBeenCalledWith('active');
    expect(fixture.nativeElement.textContent).toContain('Everyday Checking');
    expect(fixture.nativeElement.textContent).toContain('$1,250.75');
    expect(fixture.nativeElement.textContent).toContain('Asset · Checking');
    expect(fixture.nativeElement.textContent).toContain('4.25% APY');
    expect(fixture.nativeElement.querySelector('a[href="/accounts/account-1"]')).not.toBeNull();
  });

  it('makes each account card selectable through a descriptive details link', () => {
    const fixture = TestBed.createComponent(AccountsPage);
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('.account-card .card-link');
    expect(link.getAttribute('href')).toBe('/accounts/account-1');
    expect(link.getAttribute('aria-label')).toBe('View and edit Everyday Checking');
  });

  it('loads archived accounts when the filter changes', () => {
    const fixture = TestBed.createComponent(AccountsPage);
    fixture.detectChanges();
    fixture.nativeElement.querySelectorAll('.filters button')[1].click();
    fixture.detectChanges();
    expect(api.list).toHaveBeenLastCalledWith('archived');
  });

  it('requires confirmation before archive and refreshes after success', () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    const fixture = TestBed.createComponent(AccountsPage);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button.secondary').click();
    fixture.detectChanges();
    expect(api.archive).toHaveBeenCalledWith(account.id);
    expect(notifications.show).toHaveBeenCalledWith('Everyday Checking was archived.', 'success');
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it('offers retry when loading fails', () => {
    const error = new AppHttpError('network', 'API unavailable', 0, {}, true);
    api.list.mockReturnValue(throwError(() => error));
    const fixture = TestBed.createComponent(AccountsPage);
    fixture.detectChanges();
    expect(presenter.present).toHaveBeenCalledWith(error);
    fixture.nativeElement.querySelector('app-page-state button').click();
    expect(api.list).toHaveBeenCalledTimes(2);
  });
});

function accountFixture(): FinancialAccount {
  return {
    id: 'account-1',
    ownerId: 'owner-1',
    name: 'Everyday Checking',
    type: 'checking',
    classification: 'asset',
    currency: 'USD',
    openingDate: '2026-08-22',
    openingBalance: 1250.75,
    currentBalance: 1250.75,
    interestRate: 4.25,
    interestRateType: 'apy',
    status: 'active',
    archivedAt: null,
    createdAt: '2026-08-22T18:30:00Z',
    updatedAt: '2026-08-22T18:30:00Z',
  };
}
