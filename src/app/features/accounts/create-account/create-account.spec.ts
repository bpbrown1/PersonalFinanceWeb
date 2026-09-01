import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AccountsApiService } from '../../../api/accounts/accounts-api.service';
import { FinancialAccount } from '../../../api/accounts/account.models';
import { ApiErrorPresenter } from '../../../api/errors/api-error-presenter.service';
import { AppHttpError } from '../../../api/errors/app-http-error';
import { NotificationService } from '../../../core/notification.service';
import { CreateAccount } from './create-account';

describe('CreateAccount', () => {
  const account = accountFixture();
  let api: { create: ReturnType<typeof vi.fn>; listCurrencies: ReturnType<typeof vi.fn> };
  let notifications: { show: ReturnType<typeof vi.fn> };
  let presenter: { present: ReturnType<typeof vi.fn> };
  let router: Router;

  beforeEach(async () => {
    api = {
      create: vi.fn().mockReturnValue(of(account)),
      listCurrencies: vi.fn().mockReturnValue(of(['EUR', 'USD', 'ZWG'])),
    };
    notifications = { show: vi.fn() };
    presenter = { present: vi.fn((error) => error) };
    await TestBed.configureTestingModule({
      imports: [CreateAccount],
      providers: [
        provideRouter([]),
        { provide: AccountsApiService, useValue: api },
        { provide: NotificationService, useValue: notifications },
        { provide: ApiErrorPresenter, useValue: presenter },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  it('blocks submission and shows durable client validation errors', async () => {
    const fixture = TestBed.createComponent(CreateAccount);
    fixture.detectChanges();
    const form = componentForm(fixture.componentInstance);
    form.patchValue({ name: '', currency: 'US', openingDate: '', openingBalance: 1.234 });
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(api.create).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Enter an account name.');
    expect(fixture.nativeElement.textContent).toContain('Select a supported currency.');
    expect(fixture.nativeElement.textContent).toContain('Choose an opening date.');
    expect(fixture.nativeElement.textContent).toContain('two decimal places');
  });

  it('maps normalized form values to the API and completes the success flow', () => {
    const fixture = TestBed.createComponent(CreateAccount);
    fixture.detectChanges();
    componentForm(fixture.componentInstance).setValue({
      name: '  Everyday Checking  ',
      type: 'checking',
      currency: 'USD',
      openingDate: '2026-08-22',
      openingBalance: 1250.75,
    });
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));

    expect(api.create).toHaveBeenCalledWith({
      name: 'Everyday Checking',
      type: 'checking',
      currency: 'USD',
      openingDate: '2026-08-22',
      openingBalance: 1250.75,
    });
    expect(notifications.show).toHaveBeenCalledWith(
      'Everyday Checking was added successfully.',
      'success',
    );
    expect(router.navigate).toHaveBeenCalledWith(['/accounts']);
    expect(fixture.componentInstance.hasPendingChanges()).toBe(false);
  });

  it('omits an empty optional balance from the API request', () => {
    const fixture = TestBed.createComponent(CreateAccount);
    fixture.detectChanges();
    componentForm(fixture.componentInstance).setValue({
      name: 'Cash',
      type: 'cash',
      currency: 'USD',
      openingDate: '2026-08-22',
      openingBalance: null,
    });
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    expect(api.create).toHaveBeenCalledWith({
      name: 'Cash',
      type: 'cash',
      currency: 'USD',
      openingDate: '2026-08-22',
    });
  });

  it('renders server field errors beside the corresponding input', () => {
    const error = new AppHttpError('validation', 'Validation failed', 400, {
      currency: 'Currency is not supported',
    });
    api.create.mockReturnValue(throwError(() => error));
    const fixture = TestBed.createComponent(CreateAccount);
    fixture.detectChanges();
    componentForm(fixture.componentInstance).setValue({
      name: 'Checking',
      type: 'checking',
      currency: 'USD',
      openingDate: '2026-08-22',
      openingBalance: null,
    });
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Currency is not supported');
    expect(presenter.present).toHaveBeenCalledWith(error);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('blocks submission while the REST currency catalog is unavailable and supports retry', () => {
    const catalogError = new AppHttpError('server', 'Currency catalog unavailable', 503);
    api.listCurrencies.mockReturnValueOnce(throwError(() => catalogError));
    const fixture = TestBed.createComponent(CreateAccount);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.form.patchValue({ name: 'Checking' });

    component.submit();
    fixture.detectChanges();

    expect(api.create).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Currency catalog unavailable');
    expect(fixture.nativeElement.textContent).toContain('Retry currencies');

    api.listCurrencies.mockReturnValueOnce(of(['EUR', 'USD']));
    component.loadCurrencies();
    fixture.detectChanges();
    expect(component.currencyCatalogReady()).toBe(true);
    expect(component.form.controls.currency.value).toBe('USD');
  });

  it('treats an empty currency catalog as unavailable instead of allowing free text', () => {
    api.listCurrencies.mockReturnValueOnce(of([]));
    const fixture = TestBed.createComponent(CreateAccount);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;

    expect(component.currencyCatalogReady()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('No supported currencies are available');
    expect(fixture.nativeElement.textContent).toContain('Retry currencies');
    expect(fixture.nativeElement.querySelector('p-select')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('input#currency')).toBeNull();
  });

  it('tracks whether the form has unsaved changes', () => {
    const fixture = TestBed.createComponent(CreateAccount);
    const form = componentForm(fixture.componentInstance);
    expect(fixture.componentInstance.hasPendingChanges()).toBe(false);
    form.controls.name.setValue('Savings');
    form.controls.name.markAsDirty();
    expect(fixture.componentInstance.hasPendingChanges()).toBe(true);
  });
});

function componentForm(component: CreateAccount): any {
  return (component as any).form;
}

function accountFixture(): FinancialAccount {
  return {
    id: '0dfae49e-6765-4f9f-b485-53d17338a106',
    ownerId: '00000000-0000-0000-0000-000000000001',
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
