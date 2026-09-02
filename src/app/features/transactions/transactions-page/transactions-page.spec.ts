import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AccountsApiService } from '../../../api/accounts/accounts-api.service';
import { FinancialAccount } from '../../../api/accounts/account.models';
import { BudgetsApiService } from '../../../api/budgets/budgets-api.service';
import { CategoriesApiService } from '../../../api/categories/categories-api.service';
import { TransactionCategory } from '../../../api/categories/category.models';
import { ApiErrorPresenter } from '../../../api/errors/api-error-presenter.service';
import { AppHttpError } from '../../../api/errors/app-http-error';
import { RecurringExpensesApiService } from '../../../api/recurring-expenses/recurring-expenses-api.service';
import {
  FinancialTransaction,
  TransactionPage,
  TransactionSummary,
} from '../../../api/transactions/transaction.models';
import { TransactionsApiService } from '../../../api/transactions/transactions-api.service';
import { FinancialTransfer } from '../../../api/transfers/transfer.models';
import { TransfersApiService } from '../../../api/transfers/transfers-api.service';
import { NotificationService } from '../../../core/notification.service';
import { TransactionsPage } from './transactions-page';

describe('TransactionsPage', () => {
  let transactionsApi: Record<
    'search' | 'get' | 'summarize' | 'create' | 'update' | 'delete' | 'restore',
    ReturnType<typeof vi.fn>
  >;
  let budgetsApi: { progressTransactions: ReturnType<typeof vi.fn> };
  let accountsApi: { list: ReturnType<typeof vi.fn> };
  let transfersApi: Record<
    'list' | 'get' | 'create' | 'update' | 'delete' | 'restore',
    ReturnType<typeof vi.fn>
  >;
  let categoriesApi: { list: ReturnType<typeof vi.fn> };
  let recurringExpensesApi: { occurrences: ReturnType<typeof vi.fn> };
  let notifications: { show: ReturnType<typeof vi.fn> };
  let presenter: { present: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    transactionsApi = {
      search: vi.fn(() => of(pageFixture([transactionFixture()]))),
      get: vi.fn(() => of(transactionFixture())),
      summarize: vi.fn(() => of([summaryFixture()])),
      create: vi.fn(() => of(transactionFixture())),
      update: vi.fn(() => of(transactionFixture({ description: 'Updated lunch' }))),
      delete: vi.fn(() =>
        of(transactionFixture({ status: 'deleted', deletedAt: '2026-08-23T18:00:00Z' })),
      ),
      restore: vi.fn(() => of(transactionFixture())),
    };
    budgetsApi = {
      progressTransactions: vi.fn(() => of(pageFixture([transactionFixture()]))),
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
    recurringExpensesApi = { occurrences: vi.fn(() => of([])) };
    notifications = { show: vi.fn() };
    presenter = { present: vi.fn((error) => error) };
    await TestBed.configureTestingModule({
      imports: [TransactionsPage],
      providers: [
        { provide: TransactionsApiService, useValue: transactionsApi },
        { provide: BudgetsApiService, useValue: budgetsApi },
        { provide: TransfersApiService, useValue: transfersApi },
        { provide: AccountsApiService, useValue: accountsApi },
        { provide: CategoriesApiService, useValue: categoriesApi },
        { provide: RecurringExpensesApiService, useValue: recurringExpensesApi },
        { provide: NotificationService, useValue: notifications },
        { provide: ApiErrorPresenter, useValue: presenter },
        provideRouter([{ path: 'transactions', component: TransactionsPage }]),
      ],
    }).compileComponents();
  });

  afterEach(() => vi.restoreAllMocks());

  it('loads all ledger context and labels expense direction in text', () => {
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    expect(transactionsApi.search).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'active',
        from: firstDayOfCurrentMonth(),
        to: localToday(),
        page: 0,
        size: 25,
        sort: 'date',
        direction: 'desc',
      }),
    );
    expect(transfersApi.list).toHaveBeenCalledWith('all');
    expect(accountsApi.list).toHaveBeenCalledWith('all');
    expect(categoriesApi.list).toHaveBeenCalledWith('all');
    expect(transactionsApi.summarize).toHaveBeenCalledWith({
      from: firstDayOfCurrentMonth(),
      to: localToday(),
      accountId: undefined,
      categoryId: undefined,
      type: undefined,
    });
    expect(fixture.nativeElement.textContent).toContain('Expense');
    expect(fixture.nativeElement.textContent).toContain('Lunch');
  });

  it('visibly and semantically identifies missing required fields after submission', () => {
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.selectCreateMode('expense');
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
      splitEnabled: false,
      splits: [],
      merchantPayee: '  Cafe ',
      notes: ' ',
      externalReference: '',
      recurringOccurrenceKey: '',
    });
    component.create();
    expect(transactionsApi.create).toHaveBeenCalledWith({
      accountId: 'account-1',
      amount: 12.5,
      transactionDate: '2026-08-23',
      description: 'Lunch',
      type: 'expense',
      categoryId: null,
      splits: [],
      merchantPayee: 'Cafe',
      notes: null,
      externalReference: null,
      recurringExpenseOccurrence: null,
    });
    expect(transactionsApi.search).toHaveBeenCalledTimes(2);
    expect(accountsApi.list).toHaveBeenCalledTimes(2);
    expect(transactionsApi.summarize).toHaveBeenCalledTimes(2);
  });

  it('explicitly matches a compatible outstanding bill when recording an expense', () => {
    recurringExpensesApi.occurrences.mockReturnValue(
      of([
        {
          occurrenceKey: 'bill-1:2026-09-15',
          recurringExpenseId: 'bill-1',
          name: 'Water bill',
          dueDate: '2026-09-15',
          amount: 80,
          targetAmount: 80,
          actualAmount: null,
          variance: null,
          status: 'outstanding',
          linkedTransaction: null,
          currency: 'USD',
          categoryId: 'category-1',
          accountId: 'account-1',
        },
      ]),
    );
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.selectCreateMode('expense');
    component.createForm.patchValue({
      accountId: 'account-1',
      amount: 72,
      transactionDate: '2026-09-15',
      description: 'Water utility',
      categoryId: 'category-1',
      recurringOccurrenceKey: 'bill-1:2026-09-15',
    });
    component.onTransactionContextChanged('create');
    fixture.detectChanges();

    expect(recurringExpensesApi.occurrences).toHaveBeenLastCalledWith('2026-09-01', '2026-09-30');
    expect(fixture.nativeElement.textContent).toContain('Water bill');
    component.create();
    expect(transactionsApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 72,
        recurringExpenseOccurrence: {
          recurringExpenseId: 'bill-1',
          dueDate: '2026-09-15',
        },
      }),
    );
  });

  it('creates an exact split allocation without a parent category', () => {
    categoriesApi.list.mockReturnValue(
      of([categoryFixture(), categoryFixture({ id: 'category-2', name: 'Household' })]),
    );
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.selectCreateMode('expense');
    component.createForm.patchValue({
      accountId: 'account-1',
      amount: 12.5,
      transactionDate: '2026-08-23',
      description: 'Mixed purchase',
      type: 'expense',
      categoryId: 'category-1',
    });
    component.toggleSplits('create', true);
    component.createForm.controls.splits.at(0).patchValue({
      categoryId: 'category-1',
      amount: 7.25,
    });
    component.createForm.controls.splits.at(1).patchValue({
      categoryId: 'category-2',
      amount: 5.25,
    });

    component.create();

    expect(transactionsApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: null,
        splits: [
          { categoryId: 'category-1', amount: 7.25 },
          { categoryId: 'category-2', amount: 5.25 },
        ],
      }),
    );
  });

  it('blocks a split whose cent totals do not exactly match the transaction', () => {
    categoriesApi.list.mockReturnValue(
      of([categoryFixture(), categoryFixture({ id: 'category-2', name: 'Household' })]),
    );
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.selectCreateMode('expense');
    component.createForm.patchValue({
      accountId: 'account-1',
      amount: 10,
      description: 'Mixed purchase',
    });
    component.toggleSplits('create', true);
    component.createForm.controls.splits.at(0).patchValue({ categoryId: 'category-1', amount: 5 });
    component.createForm.controls.splits
      .at(1)
      .patchValue({ categoryId: 'category-2', amount: 4.99 });

    component.create();
    fixture.detectChanges();

    expect(transactionsApi.create).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      'Split amounts must exactly match the transaction amount.',
    );
  });

  it('retains existing split ids on full-replacement edits and maps indexed errors', () => {
    const splitTransaction = transactionFixture({
      categoryId: null,
      amount: 12.5,
      splits: [
        { id: 'split-1', position: 0, categoryId: 'category-1', amount: 7.25 },
        { id: 'split-2', position: 1, categoryId: 'category-2', amount: 5.25 },
      ],
    });
    categoriesApi.list.mockReturnValue(
      of([categoryFixture(), categoryFixture({ id: 'category-2', name: 'Household' })]),
    );
    transactionsApi.update.mockReturnValue(
      throwError(
        () =>
          new AppHttpError('validation', 'Validation failed', 400, {
            'splits[1].amount': 'must be greater than zero',
          }),
      ),
    );
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.selectedTransaction.set(splitTransaction);
    component.startEdit(splitTransaction);
    component.editForm.controls.description.setValue('Updated split');
    component.saveEdit(splitTransaction);
    fixture.detectChanges();

    expect(transactionsApi.update).toHaveBeenCalledWith(
      'transaction-1',
      expect.objectContaining({
        categoryId: null,
        splits: [
          { id: 'split-1', categoryId: 'category-1', amount: 7.25 },
          { id: 'split-2', categoryId: 'category-2', amount: 5.25 },
        ],
      }),
    );
    expect(fixture.nativeElement.textContent).toContain('must be greater than zero');
  });

  it('identifies split search results and shows ordered category details', () => {
    const splitTransaction = transactionFixture({
      categoryId: null,
      splits: [
        { id: 'split-1', position: 0, categoryId: 'category-1', amount: 7.25 },
        { id: 'split-2', position: 1, categoryId: 'category-2', amount: 5.25 },
      ],
    });
    transactionsApi.search.mockReturnValue(of(pageFixture([splitTransaction])));
    transactionsApi.get.mockReturnValue(of(splitTransaction));
    categoriesApi.list.mockReturnValue(
      of([categoryFixture(), categoryFixture({ id: 'category-2', name: 'Household' })]),
    );
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Split across 2 categories');

    (fixture.componentInstance as any).openDetails(splitTransaction);
    fixture.detectChanges();

    const details = fixture.nativeElement.querySelector('.split-details');
    expect(details.textContent).toContain('Dining');
    expect(details.textContent).toContain('Household');
    expect(details.querySelectorAll('li')).toHaveLength(2);
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
    transactionsApi.search.mockImplementation((criteria) =>
      of(
        pageFixture(
          criteria.status === 'deleted'
            ? [transactionFixture({ status: 'deleted', deletedAt: '2026-08-23T18:00:00Z' })]
            : [],
        ),
      ),
    );
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.selectFilter('deleted');
    component.restore(transactionFixture({ status: 'deleted' }));
    fixture.detectChanges();
    expect(transactionsApi.restore).toHaveBeenCalledWith('transaction-1');
    expect(notifications.show).toHaveBeenCalledWith('Lunch was restored.', 'success');
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
    transactionsApi.summarize.mockImplementation((criteria) => {
      if (!criteria.from && !criteria.to) {
        return of([summaryFixture({ spending: 32.5, netImpact: -32.5 })]);
      }
      if (criteria.from === '2025-12-01' && criteria.to === '2025-12-31') {
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
    expect(transactionsApi.summarize).toHaveBeenLastCalledWith({
      from: undefined,
      to: undefined,
      accountId: undefined,
      categoryId: undefined,
      type: undefined,
    });

    component.selectSummaryPeriod('custom');
    component.setCustomSummaryFrom('2025-12-01');
    component.setCustomSummaryTo('2025-12-31');
    expect(component.summaries()[0].spending).toBe(20);
    expect(transactionsApi.summarize).toHaveBeenLastCalledWith({
      from: '2025-12-01',
      to: '2025-12-31',
      accountId: undefined,
      categoryId: undefined,
      type: undefined,
    });
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
    transactionsApi.search.mockImplementation((criteria) =>
      of(pageFixture(criteria.from ? [current] : [current, older])),
    );
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
    transactionsApi.search.mockImplementation((criteria) =>
      of(
        pageFixture(
          [
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
          ].filter((transaction) => !criteria.from || transaction.transactionDate >= criteria.from),
        ),
      ),
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
    component.selectCreateMode('transfer');
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
    component.selectCreateMode('transfer');
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

  it('keeps the activity composer collapsed until a mode is selected and toggles it closed', () => {
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;

    expect(component.createMode()).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Record an expense');
    expect(fixture.nativeElement.textContent).not.toContain('Move money between accounts');

    component.selectCreateMode('expense');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Record an expense');

    component.selectCreateMode('expense');
    fixture.detectChanges();
    expect(component.createMode()).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Record an expense');

    component.selectCreateMode('income');
    fixture.detectChanges();
    expect(component.createForm.controls.type.value).toBe('income');
    expect(fixture.nativeElement.textContent).toContain('Record income');

    component.selectCreateMode('transfer');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Move money between accounts');
    expect(fixture.nativeElement.textContent).not.toContain('Record an expense');
  });

  it('uses a compact ledger toolbar for status and period controls', () => {
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    const toolbar = fixture.nativeElement.querySelector('.ledger-toolbar');

    expect(fixture.nativeElement.querySelector('.summary-panel')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Ledger filter');
    expect(toolbar.querySelector('nav[aria-label="Transaction status"]')).not.toBeNull();
    expect(toolbar.querySelector('#summary-period')).not.toBeNull();
  });

  it('shows a custom period restored from drill-down query parameters', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl(
      '/transactions?period=custom&from=2026-08-01&to=2026-08-31&type=expense',
    );
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();

    expect((fixture.componentInstance as any).summaryPeriod()).toBe('custom');
    expect(transactionsApi.search).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '2026-08-01',
        to: '2026-08-31',
        type: 'expense',
      }),
    );
  });

  it('loads exact budget contributors and preserves paging and sorting', async () => {
    const path = '/api/v1/budgets/budget-1/progress/transactions?scope=line&lineId=line-1';
    const router = TestBed.inject(Router);
    await router.navigate(['/transactions'], { queryParams: { budgetProgressPath: path } });
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;

    expect(budgetsApi.progressTransactions).toHaveBeenCalledWith(path, {
      page: 0,
      size: 25,
      sort: 'date',
      direction: 'desc',
    });
    expect(transactionsApi.search).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Exact contributing transactions');
    expect(fixture.nativeElement.querySelector('.search-workspace')).toBeNull();

    component.selectSort('amount');
    expect(budgetsApi.progressTransactions).toHaveBeenLastCalledWith(path, {
      page: 0,
      size: 25,
      sort: 'amount',
      direction: 'desc',
    });
  });

  it('combines advanced filters, resets paging, and reflects state in the URL', async () => {
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;

    component.searchPage.set(2);
    component.setSearchAccount('account-1');
    component.setSearchCategory('category-1');
    component.setSearchType('expense');
    component.setSearchMinAmount('10');
    component.setSearchMaxAmount('50');
    await fixture.whenStable();

    expect(transactionsApi.search).toHaveBeenLastCalledWith(
      expect.objectContaining({
        accountId: 'account-1',
        categoryId: 'category-1',
        type: 'expense',
        minAmount: 10,
        maxAmount: 50,
        page: 0,
      }),
    );
    expect(TestBed.inject(Router).url).toContain('accountId=account-1');
    expect(TestBed.inject(Router).url).toContain('categoryId=category-1');
  });

  it('uses server pagination metadata and sorts date and amount columns', () => {
    transactionsApi.search.mockReturnValue(
      of(pageFixture([transactionFixture()], { totalElements: 60, totalPages: 3 })),
    );
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;

    component.onPageChange({ page: 1, first: 25, rows: 25, pageCount: 3 });
    expect(transactionsApi.search).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));

    component.selectSort('amount');
    expect(transactionsApi.search).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 0, sort: 'amount', direction: 'desc' }),
    );
    component.selectSort('amount');
    expect(transactionsApi.search).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: 'amount', direction: 'asc' }),
    );
  });

  it('opens owner-scoped transaction details from a result', () => {
    transactionsApi.get.mockReturnValue(
      of(transactionFixture({ notes: 'Client meeting', externalReference: 'receipt-42' })),
    );
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;

    component.openDetails(transactionFixture());
    fixture.detectChanges();

    expect(transactionsApi.get).toHaveBeenCalledWith('transaction-1');
    expect(fixture.nativeElement.textContent).toContain('Transaction details');
    expect(fixture.nativeElement.textContent).toContain('Client meeting');
    expect(fixture.nativeElement.textContent).toContain('receipt-42');
  });

  it('renders one aggregate transfer instead of its two ledger legs', () => {
    transfersApi.list.mockReturnValue(of([transferFixture()]));
    transactionsApi.search.mockReturnValue(
      of(
        pageFixture([
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
      ),
    );
    accountsApi.list.mockReturnValue(
      of([accountFixture(), accountFixture({ id: 'savings', name: 'Savings' })]),
    );
    const fixture = TestBed.createComponent(TransactionsPage);
    fixture.detectChanges();

    transactionsApi.get.mockReturnValue(
      of(
        transactionFixture({
          id: 'source-leg',
          transferId: 'transfer-1',
          type: 'transfer_out',
          description: 'Monthly savings',
        }),
      ),
    );
    (fixture.componentInstance as any).openDetails(
      transactionFixture({
        id: 'source-leg',
        transferId: 'transfer-1',
        type: 'transfer_out',
        description: 'Monthly savings',
      }),
    );
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
    component.selectCreateMode('expense');
    component.createForm.setValue({
      accountId: 'account-1',
      amount: 12.5,
      transactionDate: '2026-08-23',
      description: 'Lunch',
      type: 'expense',
      categoryId: '',
      splitEnabled: false,
      splits: [],
      merchantPayee: '',
      notes: '',
      externalReference: '',
      recurringOccurrenceKey: '',
    });
    component.create();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('must not be in the future');
  });
});

function pageFixture(
  items: FinancialTransaction[],
  overrides: Partial<TransactionPage> = {},
): TransactionPage {
  return {
    items,
    page: 0,
    size: 25,
    totalElements: items.length,
    totalPages: items.length ? 1 : 0,
    sortBy: 'date',
    sortDirection: 'desc',
    ...overrides,
  };
}

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
    splits: [],
    description: 'Lunch',
    merchantPayee: 'Cafe',
    notes: null,
    externalReference: null,
    recurringExpenseOccurrence: null,
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
