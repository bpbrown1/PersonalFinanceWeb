import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { AccountBalancesApiService } from '../../../api/accounts/account-balances-api.service';
import { AccountsApiService } from '../../../api/accounts/accounts-api.service';
import { BalanceSnapshot } from '../../../api/accounts/balance.models';
import { FinancialAccount } from '../../../api/accounts/account.models';
import { ApiErrorPresenter } from '../../../api/errors/api-error-presenter.service';
import { AppHttpError } from '../../../api/errors/app-http-error';
import { AccountHistory } from './account-history';

describe('AccountHistory', () => {
  const account = accountFixture();
  const params = new BehaviorSubject(convertToParamMap({ range: '90d' }));
  let balances: { history: ReturnType<typeof vi.fn>; asOf: ReturnType<typeof vi.fn> };
  let accounts: { get: ReturnType<typeof vi.fn> };
  let presenter: { present: ReturnType<typeof vi.fn> };
  let router: Router;

  beforeEach(async () => {
    params.next(convertToParamMap({ range: '90d' }));
    balances = {
      history: vi.fn().mockReturnValue(of(snapshotFixtures())),
      asOf: vi
        .fn()
        .mockReturnValue(
          of({ accountId: account.id, balance: 1400, effectiveAt: daysAgo(20), source: 'manual' }),
        ),
    };
    accounts = { get: vi.fn().mockReturnValue(of(account)) };
    presenter = { present: vi.fn((error) => error) };
    await TestBed.configureTestingModule({
      imports: [AccountHistory],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => account.id } },
            queryParamMap: params.asObservable(),
          },
        },
        { provide: AccountBalancesApiService, useValue: balances },
        { provide: AccountsApiService, useValue: accounts },
        { provide: ApiErrorPresenter, useValue: presenter },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  it('renders only recorded snapshots as an accessible trend and table', () => {
    const fixture = TestBed.createComponent(AccountHistory);
    fixture.detectChanges();
    expect(accounts.get).toHaveBeenCalledWith(account.id);
    expect(balances.history).toHaveBeenCalledWith(account.id);
    expect(fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(fixture.nativeElement.querySelectorAll('svg circle')).toHaveLength(3);
    expect(fixture.nativeElement.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
    expect(fixture.nativeElement.querySelectorAll('th')).toHaveLength(3);
  });

  it('filters presets without fabricating intermediate balances and writes range state to the URL', () => {
    const fixture = TestBed.createComponent(AccountHistory);
    fixture.detectChanges();
    params.next(convertToParamMap({ range: '30d' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(2);
    fixture.nativeElement.querySelector('.presets button').click();
    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { range: '30d', from: null, to: null } }),
    );
  });

  it('initializes custom dates and applies after changing only one boundary', () => {
    const fixture = TestBed.createComponent(AccountHistory);
    fixture.detectChanges();
    const [from, to] = fixture.nativeElement.querySelectorAll('.custom-range input');
    const apply = fixture.nativeElement.querySelector('.custom-range button');
    expect(from.value).not.toBe('');
    expect(to.value).not.toBe('');
    expect(apply.disabled).toBe(false);
    const originalTo = to.value;
    from.value = '2000-01-01';
    from.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(to.value).toBe(originalTo);
    expect(apply.disabled).toBe(false);
    apply.click();
    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { range: 'custom', from: '2000-01-01', to: originalTo },
      }),
    );
  });

  it('looks up an as-of date and presents the exact effective snapshot', () => {
    const fixture = TestBed.createComponent(AccountHistory);
    fixture.detectChanges();
    (fixture.componentInstance as any).asOfDate.set('2026-08-20');
    (fixture.componentInstance as any).findAsOf();
    fixture.detectChanges();
    const expectedInstant = new Date('2026-08-20T23:59:59.999').toISOString();
    expect(balances.asOf).toHaveBeenCalledWith(account.id, expectedInstant);
    expect(fixture.nativeElement.querySelector('.as-of-result').textContent).toContain('$1,400.00');
  });

  it('offers retry after a history load failure', () => {
    const error = new AppHttpError('network', 'History unavailable', 0, {}, true);
    balances.history.mockReturnValue(throwError(() => error));
    const fixture = TestBed.createComponent(AccountHistory);
    fixture.detectChanges();
    expect(presenter.present).toHaveBeenCalledWith(error);
    fixture.nativeElement.querySelector('app-page-state button').click();
    expect(balances.history).toHaveBeenCalledTimes(2);
  });
});

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}
function snapshotFixtures(): BalanceSnapshot[] {
  return [80, 20, 1].map((days, index) => ({
    id: `snapshot-${index}`,
    accountId: 'account-1',
    balance: 1200 + index * 200,
    effectiveAt: daysAgo(days),
    source: index ? 'manual' : 'opening',
    createdAt: daysAgo(days),
  }));
}
function accountFixture(): FinancialAccount {
  return {
    id: 'account-1',
    ownerId: 'owner-1',
    name: 'Everyday Checking',
    type: 'checking',
    classification: 'asset',
    currency: 'USD',
    openingDate: '2026-05-01',
    openingBalance: 1200,
    currentBalance: 1600,
    interestRate: null,
    interestRateType: null,
    status: 'active',
    archivedAt: null,
    createdAt: daysAgo(100),
    updatedAt: daysAgo(1),
  };
}
