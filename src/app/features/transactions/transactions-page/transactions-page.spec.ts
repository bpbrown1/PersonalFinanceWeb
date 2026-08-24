import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AccountsApiService } from '../../../api/accounts/accounts-api.service';
import { FinancialAccount } from '../../../api/accounts/account.models';
import { CategoriesApiService } from '../../../api/categories/categories-api.service';
import { TransactionCategory } from '../../../api/categories/category.models';
import { ApiErrorPresenter } from '../../../api/errors/api-error-presenter.service';
import { AppHttpError } from '../../../api/errors/app-http-error';
import {
  FinancialTransaction,
  TransactionSummary,
} from '../../../api/transactions/transaction.models';
import { TransactionsApiService } from '../../../api/transactions/transactions-api.service';
import { FinancialTransfer } from '../../../api/transfers/transfer.models';
import { TransfersApiService } from '../../../api/transfers/transfers-api.service';
import { NotificationService } from '../../../core/notification.service';
import { TransactionsPage } from './transactions-page';

describe('TransactionsPage', () => {
  let transactionsApi: Record<
    'list' | 'summarize' | 'create' | 'update' | 'delete' | 'restore',
    ReturnType<typeof vi.fn>
  >;
  let accountsApi: { list: ReturnType<typeof vi.fn> };
  let transfersApi: Record<
    'list' | 'get' | 'create' | 'update' | 'delete' | 'restore',
    ReturnType<typeof vi.fn>
  >;
  let categoriesApi: { list: ReturnType<typeof vi.fn> };
  let notifications: { show: ReturnType<typeof vi.fn> };
  let presenter: { present: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    transactionsApi = {
      list: vi.fn(() => of([transactionFixture()])),
      summarize: vi.fn(() => of([summaryFixture()])),
      create: vi.fn(() => of(transactionFixture())),
      update: vi.fn(() => of(transactionFixture({ description: 'Updated lunch' }))),
      delete: vi.fn(() =>
        of(transactionFixture({ status: 'deleted', deletedAt: '2026-08-23T18:00:00Z' })),
      ),
      restore: vi.fn(() => of(transactionFixture())),
    };
    accountsApi = { list: vi.fn(() => of([accountFixture()])) };
    transfersApi = {
      list: vi.fn(() => of([])),
      get: vi.fn(() => of(transferFixture())),
      create: vi.fn(() => of(transferFixture())),
      update: vi.fn(() => of(transferFixture({ description: 'Updated transfer' }))),
      delete: vi.fn(() => of(transferFixture({ status: 'deleted' }))),
      restore: vi.fn(() => of(transferFixture())),
    };
    categoriesApi = {
      list: vi.fn(() =>
        of([
          categoryFixture(),
          categoryFixture({ id: 'income-category', name: 'Pay', applicability: 'income' }),
        ]),
      ),
    };
    notifications = { show: vi.fn() };
    presenter = { present: vi.fn((error) => error) };
    await TestBed.configureTestingModule({
      imports: [TransactionsPage],
      providers: [
        { provide: TransactionsApiService, useValue: transactionsApi },
        { provide: TransfersApiService, useValue: transfersApi },
        { provide: AccountsApiService, useValue: accountsApi },
        { provide: CategoriesApiService, useValue: categoriesApi },
        { provide: NotificationService, useValue: notifications },
        { provide: ApiErrorPresenter, useValue: presenter },
      ],
    }).compileComponents();
  });

  afterEach(() => vi.restoreAllMocks());

  it('loads all ledger context and labels expense direction in text', () => {
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    expect(transactionsApi.list).toHaveBeenCalledWith('all');
    expect(transfersApi.list).toHaveBeenCalledWith('all');
    expect(accountsApi.list).toHaveBeenCalledWith('all');
    expect(categoriesApi.list).toHaveBeenCalledWith('all');
    expect(transactionsApi.summarize).toHaveBeenCalledWith(firstDayOfCurrentMonth(), localToday());
    expect(fixture.nativeElement.textContent).toContain('Expense');
    expect(fixture.nativeElement.textContent).toContain('Lunch');
  });

  it('visibly and semantically identifies missing required fields after submission', () => {
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.create();
    fixture.detectChanges();

    const account = fixture.nativeElement.querySelector('#new-account');
    const amount = fixture.nativeElement.querySelector('#new-amount');
    const description = fixture.nativeElement.querySelector('#new-description');
    expect(account.getAttribute('aria-invalid')).toBe('true');
    expect(account.getAttribute('aria-describedby')).toBe('new-account-error');
    expect(amount.getAttribute('aria-invalid')).toBe('true');
    expect(description.getAttribute('aria-invalid')).toBe('true');
    expect(fixture.nativeElement.querySelector('#new-account-error').textContent).toContain(
      'Select an account.',
    );
  });

  it('creates a complete request with normalized optional values and refreshes context', () => {
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.createForm.setValue({
      accountId: 'account-1',
      amount: 12.5,
      transactionDate: '2026-08-23',
      description: '  Lunch  ',
      type: 'expense',
      categoryId: '',
      merchantPayee: '  Cafe ',
      notes: ' ',
      externalReference: '',
    });
    component.create();
    expect(transactionsApi.create).toHaveBeenCalledWith({
      accountId: 'account-1',
      amount: 12.5,
      transactionDate: '2026-08-23',
      description: 'Lunch',
      type: 'expense',
      categoryId: null,
      merchantPayee: 'Cafe',
      notes: null,
      externalReference: null,
    });
    expect(transactionsApi.list).toHaveBeenCalledTimes(2);
    expect(accountsApi.list).toHaveBeenCalledTimes(2);
    expect(transactionsApi.summarize).toHaveBeenCalledTimes(2);
  });

  it('filters categories by transaction type and clears incompatible choices', () => {
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    expect(
      component.categoryOptions('expense').map((item: TransactionCategory) => item.id),
    ).toEqual(['category-1']);
    component.createForm.controls.categoryId.setValue('category-1');
    component.createForm.controls.type.setValue('income');
    component.onTypeChanged('create');
    expect(component.createForm.controls.categoryId.value).toBe('');
  });

  it('keeps an archived current association visible only while editing it', () => {
    accountsApi.list.mockReturnValue(
      of([
        accountFixture({ status: 'archived' }),
        accountFixture({ id: 'active-account', name: 'Active' }),
      ]),
    );
    categoriesApi.list.mockReturnValue(of([categoryFixture({ status: 'archived' })]));
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    expect(component.accountOptions().map((item: FinancialAccount) => item.id)).toEqual([
      'active-account',
    ]);
    expect(
      component.accountOptions('account-1').map((item: FinancialAccount) => item.id),
    ).toContain('account-1');
    expect(component.categoryOptions('expense')).toEqual([]);
    expect(component.categoryOptions('expense', 'category-1')).toHaveLength(1);
  });

  it('sends every field on update because the API uses full replacement', () => {
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    const transaction = transactionFixture();
    component.startEdit(transaction);
    component.editForm.controls.description.setValue('Updated lunch');
    component.saveEdit(transaction);
    expect(transactionsApi.update).toHaveBeenCalledWith(
      'transaction-1',
      expect.objectContaining({
        accountId: 'account-1',
        amount: 12.5,
        description: 'Updated lunch',
        type: 'expense',
        categoryId: 'category-1',
        merchantPayee: 'Cafe',
        notes: null,
        externalReference: null,
      }),
    );
  });

  it('requires confirmation before deletion and refreshes balances afterward', () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    (fixture.componentInstance as any).deleteTransaction(transactionFixture());
    expect(globalThis.confirm).toHaveBeenCalledWith(
      'Delete Lunch? Its balance impact will be reversed, and the transaction can be restored.',
    );
    expect(transactionsApi.delete).toHaveBeenCalledWith('transaction-1');
    expect(accountsApi.list).toHaveBeenCalledTimes(2);
  });

  it('shows deleted entries separately and restores them', () => {
    transactionsApi.list.mockReturnValue(
      of([transactionFixture({ status: 'deleted', deletedAt: '2026-08-23T18:00:00Z' })]),
    );
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.selectFilter('deleted');
    component.restore(transactionFixture({ status: 'deleted' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Balance impact reversed');
    expect(transactionsApi.restore).toHaveBeenCalledWith('transaction-1');
  });

  it('renders server summaries by currency without combining unrelated values', () => {
    transactionsApi.summarize.mockReturnValue(
      of([
        summaryFixture({ currency: 'EUR', income: 100, spending: 0, netImpact: 100 }),
        summaryFixture(),
      ]),
    );
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    expect((fixture.componentInstance as any).summaries()).toEqual([
      { currency: 'EUR', income: 100, spending: 0, netImpact: 100, transactionCount: 1 },
      { currency: 'USD', income: 0, spending: 12.5, netImpact: -12.5, transactionCount: 1 },
    ]);
    expect(fixture.nativeElement.textContent).toContain('€100.00');
    expect(fixture.nativeElement.textContent).toContain('−$12.50');
  });

  it('requests this-month, all-time, and custom summaries from the API', () => {
    transactionsApi.summarize.mockImplementation((from?: string, to?: string) => {
      if (!from && !to) return of([summaryFixture({ spending: 32.5, netImpact: -32.5 })]);
      if (from === '2025-12-01' && to === '2025-12-31') {
        return of([summaryFixture({ spending: 20, netImpact: -20 })]);
      }
      return of([summaryFixture()]);
    });
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;

    expect(component.summaryPeriodLabel()).toBe('This month');
    expect(component.summaries()[0].spending).toBe(12.5);

    component.selectSummaryPeriod('all_time');
    expect(component.summaries()[0].spending).toBe(32.5);
    expect(transactionsApi.summarize).toHaveBeenLastCalledWith(undefined, undefined);

    component.selectSummaryPeriod('custom');
    component.setCustomSummaryFrom('2025-12-01');
    component.setCustomSummaryTo('2025-12-31');
    expect(component.summaries()[0].spending).toBe(20);
    expect(transactionsApi.summarize).toHaveBeenLastCalledWith('2025-12-01', '2025-12-31');
  });

  it('applies the selected date range to the active transaction ledger', () => {
    const current = transactionFixture({
      description: 'Current purchase',
      transactionDate: localToday(),
    });
    const older = transactionFixture({
      id: 'transaction-older',
      description: 'Older purchase',
      transactionDate: '2025-12-15',
    });
    transactionsApi.list.mockReturnValue(of([current, older]));
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Current purchase');
    expect(fixture.nativeElement.textContent).not.toContain('Older purchase');

    (fixture.componentInstance as any).selectSummaryPeriod('all_time');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Current purchase');
    expect(fixture.nativeElement.textContent).toContain('Older purchase');
  });

  it('filters deleted transactions by date and hides active cash-flow totals', () => {
    transactionsApi.list.mockReturnValue(
      of([
        transactionFixture({
          status: 'deleted',
          deletedAt: '2026-08-23T18:00:00Z',
          transactionDate: localToday(),
        }),
        transactionFixture({
          id: 'transaction-older',
          description: 'Old deleted purchase',
          status: 'deleted',
          deletedAt: '2025-12-16T18:00:00Z',
          transactionDate: '2025-12-15',
        }),
      ]),
    );
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.selectFilter('deleted');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Lunch');
    expect(fixture.nativeElement.textContent).not.toContain('Old deleted purchase');
    expect(fixture.nativeElement.textContent).not.toContain('USD activity');

    component.selectSummaryPeriod('all_time');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Old deleted purchase');
  });

  it('keeps the ledger usable when the summary endpoint fails', () => {
    const error = new AppHttpError('server', 'Summary unavailable', 500);
    transactionsApi.summarize.mockReturnValue(throwError(() => error));
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Lunch');
    expect(fixture.nativeElement.textContent).toContain('Summary unavailable');
    expect(fixture.nativeElement.textContent).toContain('Retry summary');
    expect(presenter.present).toHaveBeenCalledWith(error);
  });

  it('mirrors a same-currency transfer amount into both API fields', () => {
    accountsApi.list.mockReturnValue(
      of([accountFixture(), accountFixture({ id: 'savings', name: 'Savings' })]),
    );
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.transferCreateForm.setValue({
      sourceAccountId: 'account-1',
      destinationAccountId: 'savings',
      sourceAmount: 125,
      destinationAmount: null,
      transactionDate: localToday(),
      description: 'Monthly savings',
      notes: '',
      externalReference: '',
    });
    component.createTransfer();

    expect(transfersApi.create).toHaveBeenCalledWith({
      sourceAccountId: 'account-1',
      destinationAccountId: 'savings',
      sourceAmount: 125,
      destinationAmount: 125,
      transactionDate: localToday(),
      description: 'Monthly savings',
      notes: null,
      externalReference: null,
    });
    expect(transfersApi.list).toHaveBeenCalledTimes(2);
    expect(accountsApi.list).toHaveBeenCalledTimes(2);
    expect(transactionsApi.summarize).toHaveBeenCalledTimes(2);
  });

  it('requires an explicit destination amount for a cross-currency transfer', () => {
    accountsApi.list.mockReturnValue(
      of([
        accountFixture(),
        accountFixture({ id: 'euro-account', name: 'Travel cash', currency: 'EUR' }),
      ]),
    );
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.transferCreateForm.setValue({
      sourceAccountId: 'account-1',
      destinationAccountId: 'euro-account',
      sourceAmount: 100,
      destinationAmount: null,
      transactionDate: localToday(),
      description: 'Travel exchange',
      notes: '',
      externalReference: '',
    });
    component.createTransfer();
    fixture.detectChanges();

    expect(transfersApi.create).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Enter the exact amount received');

    component.transferCreateForm.controls.destinationAmount.setValue(92);
    component.createTransfer();
    expect(transfersApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ sourceAmount: 100, destinationAmount: 92 }),
    );
  });

  it('renders one aggregate transfer instead of its two ledger legs', () => {
    transfersApi.list.mockReturnValue(of([transferFixture()]));
    transactionsApi.list.mockReturnValue(
      of([
        transactionFixture({
          id: 'source-leg',
          transferId: 'transfer-1',
          type: 'transfer_out',
          description: 'Monthly savings',
        }),
        transactionFixture({
          id: 'destination-leg',
          accountId: 'savings',
          transferId: 'transfer-1',
          type: 'transfer_in',
          description: 'Monthly savings',
        }),
      ]),
    );
    accountsApi.list.mockReturnValue(
      of([accountFixture(), accountFixture({ id: 'savings', name: 'Savings' })]),
    );
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Transfer');
    expect(fixture.nativeElement.querySelectorAll('.transaction-card')).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('Checking · USD → Savings · USD');
  });

  it('confirms that deleting a transfer reverses both account balances', () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    (fixture.componentInstance as any).deleteTransfer(transferFixture());

    expect(globalThis.confirm).toHaveBeenCalledWith(
      'Delete Monthly savings? The balance changes on both accounts will be reversed, and the transfer can be restored.',
    );
    expect(transfersApi.delete).toHaveBeenCalledWith('transfer-1');
  });

  it('fully replaces and restores a transfer through aggregate endpoints', () => {
    accountsApi.list.mockReturnValue(
      of([accountFixture(), accountFixture({ id: 'savings', name: 'Savings' })]),
    );
    transfersApi.list.mockReturnValue(of([transferFixture()]));
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    const transfer = transferFixture();
    component.startTransferEdit(transfer);
    component.transferEditForm.controls.description.setValue('Updated transfer');
    component.saveTransferEdit(transfer);

    expect(transfersApi.update).toHaveBeenCalledWith(
      'transfer-1',
      expect.objectContaining({
        sourceAccountId: 'account-1',
        destinationAccountId: 'savings',
        sourceAmount: 125,
        destinationAmount: 125,
        description: 'Updated transfer',
      }),
    );

    component.restoreTransfer(transferFixture({ status: 'deleted' }));
    expect(transfersApi.restore).toHaveBeenCalledWith('transfer-1');
  });

  it('renders API field validation beside its field', () => {
    const error = new AppHttpError('validation', 'Validation failed', 400, {
      transactionDate: 'must not be in the future',
    });
    transactionsApi.create.mockReturnValue(throwError(() => error));
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.createForm.setValue({
      accountId: 'account-1',
      amount: 12.5,
      transactionDate: '2026-08-23',
      description: 'Lunch',
      type: 'expense',
      categoryId: '',
      merchantPayee: '',
      notes: '',
      externalReference: '',
    });
    component.create();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('must not be in the future');
  });
});

function transactionFixture(overrides: Partial<FinancialTransaction> = {}): FinancialTransaction {
  return {
    id: 'transaction-1',
    ownerId: 'owner-1',
    accountId: 'account-1',
    categoryId: 'category-1',
    transferId: null,
    amount: 12.5,
    balanceImpact: -12.5,
    type: 'expense',
    transactionDate: '2026-08-23',
    description: 'Lunch',
    merchantPayee: 'Cafe',
    notes: null,
    externalReference: null,
    status: 'active',
    deletedAt: null,
    createdAt: '2026-08-23T12:00:00Z',
    updatedAt: '2026-08-23T12:00:00Z',
    ...overrides,
  };
}

function transferFixture(overrides: Partial<FinancialTransfer> = {}): FinancialTransfer {
  return {
    id: 'transfer-1',
    ownerId: 'owner-1',
    sourceTransactionId: 'source-leg',
    destinationTransactionId: 'destination-leg',
    sourceAccountId: 'account-1',
    destinationAccountId: 'savings',
    sourceAmount: 125,
    destinationAmount: 125,
    transactionDate: localToday(),
    description: 'Monthly savings',
    notes: null,
    externalReference: null,
    status: 'active',
    deletedAt: null,
    createdAt: '2026-08-23T12:00:00Z',
    updatedAt: '2026-08-23T12:00:00Z',
    ...overrides,
  };
}

function accountFixture(overrides: Partial<FinancialAccount> = {}): FinancialAccount {
  return {
    id: 'account-1',
    ownerId: 'owner-1',
    name: 'Checking',
    type: 'checking',
    currency: 'USD',
    openingDate: '2026-01-01',
    openingBalance: 0,
    currentBalance: 100,
    status: 'active',
    archivedAt: null,
    createdAt: '2026-01-01T12:00:00Z',
    updatedAt: '2026-08-23T12:00:00Z',
    ...overrides,
  };
}

function categoryFixture(overrides: Partial<TransactionCategory> = {}): TransactionCategory {
  return {
    id: 'category-1',
    ownerId: 'owner-1',
    name: 'Dining',
    applicability: 'expense',
    parentId: null,
    status: 'active',
    archivedAt: null,
    createdAt: '2026-01-01T12:00:00Z',
    updatedAt: '2026-08-23T12:00:00Z',
    ...overrides,
  };
}

function localToday(): string {
  const local = new Date();
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 10);
}

function firstDayOfCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function summaryFixture(overrides: Partial<TransactionSummary> = {}): TransactionSummary {
  return {
    currency: 'USD',
    income: 0,
    spending: 12.5,
    netImpact: -12.5,
    transactionCount: 1,
    ...overrides,
  };
}
