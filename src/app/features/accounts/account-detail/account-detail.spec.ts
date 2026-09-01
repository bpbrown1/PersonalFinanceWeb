import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AccountsApiService } from '../../../api/accounts/accounts-api.service';
import { FinancialAccount } from '../../../api/accounts/account.models';
import { ApiErrorPresenter } from '../../../api/errors/api-error-presenter.service';
import { AppHttpError } from '../../../api/errors/app-http-error';
import { NotificationService } from '../../../core/notification.service';
import { AccountDetail } from './account-detail';

describe('AccountDetail', () => {
  const account = accountFixture();
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let notifications: { show: ReturnType<typeof vi.fn> };
  let presenter: { present: ReturnType<typeof vi.fn> };
  let router: Router;
  beforeEach(async () => {
    api = {
      get: vi.fn().mockReturnValue(of(account)),
      listCurrencies: vi.fn().mockReturnValue(of(['EUR', 'USD', 'ZWG'])),
      update: vi.fn().mockReturnValue(of({ ...account, name: 'Primary Checking' })),
      archive: vi.fn().mockReturnValue(of({ ...account, status: 'archived' })),
      restore: vi.fn().mockReturnValue(of(account)),
    };
    notifications = { show: vi.fn() };
    presenter = { present: vi.fn((error) => error) };
    await TestBed.configureTestingModule({
      imports: [AccountDetail],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => account.id } } },
        },
        { provide: AccountsApiService, useValue: api },
        { provide: NotificationService, useValue: notifications },
        { provide: ApiErrorPresenter, useValue: presenter },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  it('loads account detail and populates a pristine form', () => {
    const fixture = TestBed.createComponent(AccountDetail);
    fixture.detectChanges();
    expect(api['get']).toHaveBeenCalledWith(account.id);
    expect(api['listCurrencies']).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Everyday Checking');
    expect(fixture.componentInstance.hasPendingChanges()).toBe(false);
    expect(
      fixture.nativeElement.querySelector('a[href="/accounts/account-1/history"]'),
    ).not.toBeNull();
  });

  it('patches only changed fields and resets dirty state after success', () => {
    const fixture = TestBed.createComponent(AccountDetail);
    fixture.detectChanges();
    const form = (fixture.componentInstance as any).form;
    form.controls.name.setValue('  Primary Checking  ');
    form.controls.name.markAsDirty();
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    expect(api['update']).toHaveBeenCalledWith(account.id, { name: 'Primary Checking' });
    expect(notifications.show).toHaveBeenCalledWith('Primary Checking was updated.', 'success');
    expect(fixture.componentInstance.hasPendingChanges()).toBe(false);
  });

  it('preserves the current supported currency and submits a selected replacement unchanged', () => {
    const fixture = TestBed.createComponent(AccountDetail);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    expect(component.form.controls.currency.value).toBe('USD');
    component.form.controls.currency.setValue('EUR');
    component.form.controls.currency.markAsDirty();
    component.save();
    expect(api['update']).toHaveBeenCalledWith(account.id, { currency: 'EUR' });
  });

  it('keeps account context visible and blocks saving when the currency catalog fails', () => {
    const catalogError = new AppHttpError('server', 'Currency catalog unavailable', 503);
    api['listCurrencies'].mockReturnValueOnce(throwError(() => catalogError));
    const fixture = TestBed.createComponent(AccountDetail);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.form.controls.name.setValue('Changed');
    component.form.controls.name.markAsDirty();
    component.save();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Everyday Checking');
    expect(fixture.nativeElement.textContent).toContain('Current currency: USD');
    expect(fixture.nativeElement.textContent).toContain('Retry currencies');
    expect(api['update']).not.toHaveBeenCalled();
  });

  it('retains server field errors and protects the current route', () => {
    const error = new AppHttpError('validation', 'Validation failed', 400, {
      name: 'Name is invalid',
    });
    api['update'].mockReturnValue(throwError(() => error));
    const fixture = TestBed.createComponent(AccountDetail);
    fixture.detectChanges();
    const form = (fixture.componentInstance as any).form;
    form.controls.name.setValue('Changed');
    form.controls.name.markAsDirty();
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Name is invalid');
    expect(fixture.componentInstance.hasPendingChanges()).toBe(true);
  });

  it('confirms archive and returns to the accounts list', () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    const fixture = TestBed.createComponent(AccountDetail);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.danger-button').click();
    expect(api['archive']).toHaveBeenCalledWith(account.id);
    expect(router.navigate).toHaveBeenCalledWith(['/accounts']);
  });
});

function accountFixture(): FinancialAccount {
  return {
    id: 'account-1',
    ownerId: 'owner-1',
    name: 'Everyday Checking',
    type: 'checking',
    currency: 'USD',
    openingDate: '2026-08-22',
    openingBalance: 1250.75,
    currentBalance: 1250.75,
    status: 'active',
    archivedAt: null,
    createdAt: '2026-08-22T18:30:00Z',
    updatedAt: '2026-08-22T18:30:00Z',
  };
}
