import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AccountReconciliationsApiService } from '../../../api/accounts/account-reconciliations-api.service';
import { AccountsApiService } from '../../../api/accounts/accounts-api.service';
import { CategoriesApiService } from '../../../api/categories/categories-api.service';
import { ApiErrorPresenter } from '../../../api/errors/api-error-presenter.service';
import { AppHttpError } from '../../../api/errors/app-http-error';
import { TransactionsApiService } from '../../../api/transactions/transactions-api.service';
import { NotificationService } from '../../../core/notification.service';
import { AccountReconciliationPage } from './account-reconciliation';

describe('AccountReconciliationPage', () => {
  let fixture: ComponentFixture<AccountReconciliationPage>;
  let component: AccountReconciliationPage;
  let reconciliationsApi: {
    preview: ReturnType<typeof vi.fn>;
    confirm: ReturnType<typeof vi.fn>;
    history: ReturnType<typeof vi.fn>;
  };
  let transactionsApi: { search: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    reconciliationsApi = {
      preview: vi.fn(),
      confirm: vi.fn(),
      history: vi
        .fn()
        .mockReturnValue(of({ items: [], page: 0, size: 25, totalElements: 0, totalPages: 0 })),
    };
    transactionsApi = {
      search: vi.fn().mockReturnValue(
        of({
          items: [],
          page: 0,
          size: 100,
          totalElements: 0,
          totalPages: 0,
          sortBy: 'date',
          sortDirection: 'desc',
        }),
      ),
    };
    await TestBed.configureTestingModule({
      imports: [AccountReconciliationPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ accountId: 'account-1' }) } },
        },
        {
          provide: AccountsApiService,
          useValue: { get: vi.fn().mockReturnValue(of(accountFixture())) },
        },
        {
          provide: CategoriesApiService,
          useValue: {
            list: vi.fn().mockReturnValue(
              of([
                {
                  id: 'income-category',
                  ownerId: 'owner-1',
                  name: 'Interest earned',
                  applicability: 'income',
                  parentId: null,
                  status: 'active',
                  archivedAt: null,
                  createdAt: '2026-01-01T00:00:00Z',
                  updatedAt: '2026-01-01T00:00:00Z',
                },
              ]),
            ),
          },
        },
        { provide: AccountReconciliationsApiService, useValue: reconciliationsApi },
        { provide: TransactionsApiService, useValue: transactionsApi },
        {
          provide: ApiErrorPresenter,
          useValue: {
            present: (error: unknown) =>
              error instanceof AppHttpError
                ? error
                : new AppHttpError('unexpected', 'Unexpected error'),
          },
        },
        { provide: NotificationService, useValue: { show: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AccountReconciliationPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('previews the comparison and loads contributing ledger activity', () => {
    reconciliationsApi.preview.mockReturnValue(of(previewFixture()));
    const page = component as any;
    page.statementForm.setValue({ statementDate: '2026-09-15', statementBalance: 110 });

    page.review();

    expect(reconciliationsApi.preview).toHaveBeenCalledWith('account-1', {
      statementDate: '2026-09-15',
      statementBalance: 110,
    });
    expect(transactionsApi.search).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'account-1', to: '2026-09-15', size: 100 }),
    );
    expect(page.preview()?.difference).toBe(10);
  });

  it('requires an explicit category, explanation, and confirmation for a discrepancy', () => {
    const page = component as any;
    page.preview.set(previewFixture());
    page.confirmForm.setValue({
      categoryId: 'income-category',
      explanation: 'Interest posted by the bank',
      confirmed: true,
    });
    reconciliationsApi.confirm.mockReturnValue(of(resultFixture()));

    page.confirm();

    expect(reconciliationsApi.confirm).toHaveBeenCalledWith(
      'account-1',
      expect.objectContaining({
        categoryId: 'income-category',
        explanation: 'Interest posted by the bank',
        ledgerToken: 'ledger-token',
      }),
      expect.any(String),
    );
    expect(page.result()?.transactionId).toBe('transaction-1');
  });

  it('records a zero-difference reconciliation without an adjustment category', () => {
    const page = component as any;
    page.preview.set(previewFixture({ difference: 0, adjustmentType: null }));
    page.confirmForm.setValue({ categoryId: '', explanation: '', confirmed: true });
    reconciliationsApi.confirm.mockReturnValue(
      of(resultFixture({ difference: 0, transactionId: null })),
    );

    page.confirm();

    expect(reconciliationsApi.confirm).toHaveBeenCalledWith(
      'account-1',
      expect.objectContaining({ categoryId: null, explanation: null }),
      expect.any(String),
    );
  });

  it('cancels a reviewed comparison without creating an adjustment', () => {
    const page = component as any;
    page.preview.set(previewFixture());

    page.cancelPreview();

    expect(page.preview()).toBeNull();
    expect(reconciliationsApi.confirm).not.toHaveBeenCalled();
  });

  it('blocks confirmation and offers refresh when the preview is stale', () => {
    const page = component as any;
    page.preview.set(previewFixture());
    page.confirmForm.setValue({
      categoryId: 'income-category',
      explanation: 'Interest posted by the bank',
      confirmed: true,
    });
    reconciliationsApi.confirm.mockReturnValue(
      throwError(() => new AppHttpError('client', 'Preview is stale', 409)),
    );

    page.confirm();

    expect(page.stalePreview()).toBe(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('This comparison is stale.');
  });
});

function accountFixture() {
  return {
    id: 'account-1',
    ownerId: 'owner-1',
    name: 'Everyday checking',
    type: 'checking' as const,
    classification: 'asset' as const,
    currency: 'USD',
    openingDate: '2026-01-01',
    openingBalance: 100,
    currentBalance: 100,
    interestRate: null,
    interestRateType: null,
    institutionName: null,
    accountNumberLastFour: null,
    status: 'active' as const,
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

function previewFixture(overrides = {}) {
  return {
    accountId: 'account-1',
    currency: 'USD',
    statementDate: '2026-09-15',
    statementBalance: 110,
    calculatedBalance: 100,
    difference: 10,
    adjustmentType: 'income' as const,
    transactionCount: 2,
    ledgerToken: 'ledger-token',
    ...overrides,
  };
}

function resultFixture(overrides = {}) {
  return {
    id: 'reconciliation-1',
    accountId: 'account-1',
    statementDate: '2026-09-15',
    statementBalance: 110,
    calculatedBalance: 100,
    difference: 10,
    ledgerToken: 'ledger-token',
    explanation: 'Interest posted by the bank',
    transactionId: 'transaction-1',
    createdAt: '2026-09-16T00:00:00Z',
    ...overrides,
  };
}
