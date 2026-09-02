import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { AccountsApiService } from '../../../api/accounts/accounts-api.service';
import { Budget, BudgetProgress } from '../../../api/budgets/budget.models';
import { BudgetsApiService } from '../../../api/budgets/budgets-api.service';
import { CategoriesApiService } from '../../../api/categories/categories-api.service';
import { TransactionCategory } from '../../../api/categories/category.models';
import { ApiErrorPresenter } from '../../../api/errors/api-error-presenter.service';
import { NotificationService } from '../../../core/notification.service';
import { BudgetsPage } from './budgets-page';

describe('BudgetsPage', () => {
  let api: Record<
    | 'list'
    | 'get'
    | 'progress'
    | 'create'
    | 'copy'
    | 'update'
    | 'archive'
    | 'restore'
    | 'addLine'
    | 'updateLine'
    | 'reorderLines'
    | 'archiveLine'
    | 'restoreLine',
    ReturnType<typeof vi.fn>
  >;
  let categoriesApi: { list: ReturnType<typeof vi.fn> };
  let notifications: { show: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    api = {
      list: vi.fn(() => of([budgetFixture()])),
      get: vi.fn(() => of(budgetFixture())),
      progress: vi.fn(() => of(progressFixture())),
      create: vi.fn(() => of(budgetFixture({ name: 'September plan' }))),
      copy: vi.fn(() =>
        of(budgetFixture({ id: 'budget-copy', startDate: '2026-10-01', endDate: '2026-10-31' })),
      ),
      update: vi.fn(() => of(budgetFixture({ name: 'Updated plan' }))),
      archive: vi.fn(() => of(budgetFixture({ status: 'archived' }))),
      restore: vi.fn(() => of(budgetFixture())),
      addLine: vi.fn(() => of(budgetFixture())),
      updateLine: vi.fn(() => of(budgetFixture())),
      reorderLines: vi.fn(() => of(budgetFixture())),
      archiveLine: vi.fn(() => of(budgetFixture())),
      restoreLine: vi.fn(() => of(budgetFixture())),
    };
    categoriesApi = {
      list: vi.fn(() =>
        of([categoryFixture(), categoryFixture({ id: 'category-2', name: 'Dining' })]),
      ),
    };
    notifications = { show: vi.fn() };
    router = { navigate: vi.fn(() => Promise.resolve(true)) };
    await TestBed.configureTestingModule({
      imports: [BudgetsPage],
      providers: [
        { provide: BudgetsApiService, useValue: api },
        { provide: AccountsApiService, useValue: { list: vi.fn(() => of([accountFixture()])) } },
        { provide: CategoriesApiService, useValue: categoriesApi },
        { provide: NotificationService, useValue: notifications },
        { provide: ApiErrorPresenter, useValue: { present: vi.fn((error) => error) } },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();
  });

  afterEach(() => vi.restoreAllMocks());

  it('loads active budgets with all categories and live-progress messaging', () => {
    const fixture = TestBed.createComponent(BudgetsPage);
    fixture.detectChanges();
    expect(api.list).toHaveBeenCalledWith('active');
    expect(categoriesApi.list).toHaveBeenCalledWith('all');
    expect(fixture.nativeElement.textContent).toContain('September essentials');
    expect(fixture.nativeElement.textContent).toContain('Your monthly plans');
    expect(fixture.nativeElement.textContent).toContain('New budget');
  });

  it('keeps creation and plan maintenance out of the primary browsing flow', () => {
    const fixture = TestBed.createComponent(BudgetsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;

    expect(fixture.nativeElement.textContent).not.toContain('Create a monthly budget');
    component.openCreate();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Create a monthly budget');
    expect(fixture.nativeElement.textContent).not.toContain('Your monthly plans');

    component.selectBudget(budgetFixture());
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Budget progress');
    expect(fixture.nativeElement.textContent).not.toContain('Ordering is retained');

    component.selectDetailView('plan');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ordering is retained');
    expect(fixture.nativeElement.textContent).not.toContain('Plan versus actual');
  });

  it('creates a monthly budget with normalized currency and ordered initial lines', () => {
    const fixture = TestBed.createComponent(BudgetsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.createForm.patchValue({
      name: ' September plan ',
      currency: 'usd',
      month: '2026-09',
    });
    component.createForm.controls.lines
      .at(0)
      .setValue({ categoryId: 'category-1', plannedAmount: 400 });
    component.addInitialLine();
    component.createForm.controls.lines
      .at(1)
      .setValue({ categoryId: 'category-2', plannedAmount: 125.5 });

    component.create();

    expect(api.create).toHaveBeenCalledWith({
      name: 'September plan',
      currency: 'USD',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      lines: [
        { categoryId: 'category-1', plannedAmount: 400 },
        { categoryId: 'category-2', plannedAmount: 125.5 },
      ],
    });
    expect(notifications.show).toHaveBeenCalledWith('September plan was created.', 'success');
  });

  it('blocks partial and duplicate category targets before calling the API', () => {
    const fixture = TestBed.createComponent(BudgetsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.createForm.patchValue({ name: 'Plan', month: '2026-09' });
    component.createForm.controls.lines.at(0).patchValue({ categoryId: 'category-1' });
    component.create();
    expect(api.create).not.toHaveBeenCalled();

    component.createForm.controls.lines.at(0).patchValue({ plannedAmount: 10 });
    component.addInitialLine();
    component.createForm.controls.lines
      .at(1)
      .setValue({ categoryId: 'category-1', plannedAmount: 20 });
    component.create();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('reviews, adjusts, reorders, and submits an independent budget copy once', () => {
    const fixture = TestBed.createComponent(BudgetsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    const source = budgetFixture();
    component.startCopy(source);
    expect(component.copyForm.controls.targetMonth.value).toBe('2026-10');
    expect(component.copyForm.controls.lines.length).toBe(2);
    component.copyForm.controls.lines.at(0).controls.plannedAmount.setValue(450.25);
    component.removeCopyLine(1);
    component.addCopyLine();
    component.copyForm.controls.lines
      .at(1)
      .setValue({ categoryId: 'category-2', plannedAmount: 99.5 });
    component.moveCopyLine(1, -1);

    component.submitCopy(source);

    expect(api.copy).toHaveBeenCalledWith('budget-1', {
      targetMonth: '2026-10',
      lines: [
        { categoryId: 'category-2', plannedAmount: 99.5 },
        { categoryId: 'category-1', plannedAmount: 450.25 },
      ],
    });
    expect(notifications.show).toHaveBeenCalledWith(
      'September essentials was copied to October 2026.',
      'success',
    );
  });

  it('supports an explicit empty copy and protects an unsaved review draft', () => {
    const confirm = vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    const fixture = TestBed.createComponent(BudgetsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    const source = budgetFixture();
    component.startCopy(source);
    component.removeCopyLine(1);
    component.removeCopyLine(0);
    expect(component.hasPendingChanges()).toBe(true);
    component.cancelCopy();
    expect(confirm).toHaveBeenCalledWith('Discard this budget copy draft?');
    expect(component.copying()).toBe(true);

    component.submitCopy(source);
    expect(api.copy).toHaveBeenCalledWith('budget-1', { targetMonth: '2026-10', lines: [] });
  });

  it('retrieves details and reorders every retained line id', () => {
    const budget = budgetFixture();
    const fixture = TestBed.createComponent(BudgetsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.selectBudget(budget);
    component.moveLine(budget, 0, 1);
    expect(api.get).toHaveBeenCalledWith('budget-1');
    expect(api.progress).toHaveBeenCalledWith('budget-1');
    expect(api.reorderLines).toHaveBeenCalledWith('budget-1', {
      lineIds: ['line-2', 'line-1'],
    });
  });

  it('renders flexible, recurring, and genuinely unplanned progress separately', () => {
    const fixture = TestBed.createComponent(BudgetsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;

    component.selectBudget(budgetFixture());
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Budget progress');
    expect(text).toContain('Actual spending');
    expect(text).toContain('Total budgeted');
    expect(text).toContain('Projected remaining');
    expect(text).toContain('outstanding bills');
    expect(text).toContain('Over budget');
    expect(text).toContain('On track');
    expect(text).toContain('Flexible spending');
    expect(text).toContain('Bill spending');
    expect(text).toContain('Unplanned spending');
    expect(text).toContain('Uncategorized');
    expect(text).toContain('Budget components');
    expect(text).toContain('Recurring bill');
    expect(text).toContain('Annual membership');
    expect(text).toContain('Scheduled commitments');
    expect(text).toContain('Rent');
    expect(text).toContain('Everyday checking');
    expect(text).toContain('count toward total budgeted and projected usage');
    expect(text).toContain('Recurring target only');
    expect(text).not.toContain('After commitments');
    expect(text).not.toContain('discretionary');
    expect(text).toContain('has no flexible target');
  });

  it('shows a satisfied variable bill using the REST target-minus-actual variance', () => {
    const fixture = TestBed.createComponent(BudgetsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.selectBudget(budgetFixture());
    const progress = progressFixture();
    progress.lines[0].scheduledCommitments = [
      commitmentFixture({
        satisfied: true,
        actualAmount: 72,
        variance: 8,
        linkedTransactionId: 'transaction-water',
      }),
    ];
    component.progress.set(progress);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Satisfied');
    expect(text).toContain('Actual $72.00');
    expect(text).toContain('Under target $8.00');
  });

  it('filters and sorts progress lines without changing server totals', () => {
    const fixture = TestBed.createComponent(BudgetsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.selectBudget(budgetFixture());

    component.setProgressStatusFilter('over_budget');
    component.setProgressSort('actual');
    component.progressSortDirection.set('desc');

    expect(component.visibleProgressLines().map((line: { lineId: string }) => line.lineId)).toEqual(
      ['line-2'],
    );
    expect(component.progress().totalActual).toBe(550);
  });

  it('ignores a stale progress response after another budget is selected', () => {
    const first = new Subject<BudgetProgress>();
    const second = new Subject<BudgetProgress>();
    api.progress.mockReturnValueOnce(first).mockReturnValueOnce(second);
    const fixture = TestBed.createComponent(BudgetsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;

    component.selectBudget(budgetFixture({ id: 'budget-1' }));
    component.selectBudget(budgetFixture({ id: 'budget-2' }));
    first.next(progressFixture());
    expect(component.progress()).toBeNull();

    second.next({ ...progressFixture(), budgetId: 'budget-2' });
    expect(component.progress().budgetId).toBe('budget-2');
  });

  it('opens the exact paginated transaction drill-down supplied by the budget API', () => {
    const fixture = TestBed.createComponent(BudgetsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    const drillDown = progressFixture().lines[0].drillDown;

    component.openDrillDown(drillDown);

    expect(router.navigate).toHaveBeenCalledWith(['/transactions'], {
      queryParams: {
        budgetProgressPath: drillDown.transactionsPath,
      },
    });
  });

  it('requires confirmation to archive and protects unsaved changes', () => {
    const confirm = vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    const fixture = TestBed.createComponent(BudgetsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.archiveBudget(budgetFixture());
    expect(api.archive).not.toHaveBeenCalled();

    component.createForm.controls.name.setValue('Draft plan');
    component.createForm.controls.name.markAsDirty();
    component.selectFilter('archived');
    expect(confirm).toHaveBeenCalledWith('Discard your unsaved budget changes?');
    expect(api.list).toHaveBeenCalledTimes(1);
  });

  it('renders archived budgets as retained and immutable until restored', () => {
    const archived = budgetFixture({ status: 'archived', archivedAt: '2026-09-02T12:00:00Z' });
    api.list.mockReturnValue(of([archived]));
    api.get.mockReturnValue(of(archived));
    const fixture = TestBed.createComponent(BudgetsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.filter.set('archived');
    component.selectBudget(archived);
    component.selectDetailView('plan');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Restore it before changing metadata');
    expect(fixture.nativeElement.textContent).toContain('Restore budget');
  });
});

function budgetFixture(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 'budget-1',
    ownerId: 'owner-1',
    name: 'September essentials',
    currency: 'USD',
    periodType: 'monthly',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    totalPlanned: 525.5,
    lines: [
      lineFixture(),
      lineFixture({ id: 'line-2', position: 1, categoryId: 'category-2', plannedAmount: 125.5 }),
    ],
    status: 'active',
    archivedAt: null,
    version: 2,
    createdAt: '2026-08-24T12:00:00Z',
    updatedAt: '2026-08-24T12:00:00Z',
    ...overrides,
  };
}

function progressFixture(): BudgetProgress {
  const drillDown = (
    categoryIds: string[],
    transactionIds: string[],
  ): BudgetProgress['drillDown'] => ({
    from: '2026-09-01',
    to: '2026-09-30',
    accountId: null,
    categoryIds,
    type: 'expense',
    status: 'active',
    transactionIds,
    transactionsPath: '/api/v1/budgets/budget-1/progress/transactions?scope=overall',
  });
  return {
    budgetId: 'budget-1',
    ownerId: 'owner-1',
    currency: 'USD',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    accountId: null,
    categoryId: null,
    planned: 525.5,
    committed: 650,
    scheduledTarget: 650,
    outstandingScheduledTarget: 650,
    totalBudgeted: 1175.5,
    remainingAfterCommitments: -124.5,
    underfunded: true,
    flexibleActual: 500,
    billActual: 89.99,
    budgetedActual: 500,
    unbudgetedActual: 50,
    totalActual: 550,
    remaining: 625.5,
    percentageUsed: 104.66,
    percentSpent: 46.79,
    projectedUsage: 1200,
    projectedRemaining: -24.5,
    projectedPercentage: 102.08,
    lines: [
      {
        lineId: 'line-1',
        categoryId: 'category-1',
        position: 0,
        planned: 400,
        committed: 450,
        scheduledTarget: 450,
        outstandingScheduledTarget: 450,
        totalBudgeted: 850,
        remainingAfterCommitments: -50,
        underfunded: true,
        scheduledCommitments: [commitmentFixture()],
        flexibleActual: 340,
        billActual: 0,
        actual: 340,
        remaining: 510,
        percentageUsed: 85,
        percentSpent: 40,
        projectedUsage: 790,
        projectedRemaining: 60,
        projectedPercentage: 92.94,
        drillDown: drillDown(['category-1', 'category-child'], ['transaction-1']),
      },
      {
        lineId: 'line-2',
        categoryId: 'category-2',
        position: 1,
        planned: 125.5,
        committed: 0,
        scheduledTarget: 0,
        outstandingScheduledTarget: 0,
        totalBudgeted: 125.5,
        remainingAfterCommitments: 125.5,
        underfunded: false,
        scheduledCommitments: [],
        flexibleActual: 160,
        billActual: 0,
        actual: 160,
        remaining: -34.5,
        percentageUsed: 127.49,
        percentSpent: 127.49,
        projectedUsage: 160,
        projectedRemaining: -34.5,
        projectedPercentage: 127.49,
        drillDown: drillDown(['category-2'], ['transaction-2']),
      },
    ],
    components: [
      {
        componentKey: 'line:line-1',
        source: 'flexible',
        lineId: 'line-1',
        occurrenceKey: null,
        recurringExpenseId: null,
        categoryId: 'category-1',
        position: 0,
        name: null,
        dueDate: null,
        target: 400,
        actual: 340,
        remaining: 60,
        percentageUsed: 85,
        projectedUsage: 340,
        projectedRemaining: 60,
        projectedPercentage: 85,
        status: 'outstanding',
        variance: null,
        linkedTransactionId: null,
        drillDown: drillDown(['category-1'], ['transaction-1']),
      },
      {
        componentKey: 'occurrence:bill-2:2026-09-15',
        source: 'recurring',
        lineId: null,
        occurrenceKey: 'bill-2:2026-09-15',
        recurringExpenseId: 'bill-2',
        categoryId: 'category-2',
        position: null,
        name: 'Annual membership',
        dueDate: '2026-09-15',
        target: 200,
        actual: 89.99,
        remaining: 110.01,
        percentageUsed: 45,
        projectedUsage: 89.99,
        projectedRemaining: 110.01,
        projectedPercentage: 45,
        status: 'satisfied',
        variance: 110.01,
        linkedTransactionId: 'transaction-bill-2',
        drillDown: {
          ...drillDown(['category-2'], ['transaction-bill-2']),
          transactionsPath:
            '/api/v1/budgets/budget-1/progress/transactions?scope=component&occurrenceKey=bill-2%3A2026-09-15',
        },
      },
    ],
    unbudgeted: [
      {
        categoryId: null,
        actual: 50,
        drillDown: drillDown([], ['transaction-3']),
      },
    ],
    unbudgetedCommitments: [
      {
        categoryId: 'category-2',
        committed: 200,
        scheduledTarget: 200,
        outstandingScheduledTarget: 200,
        totalBudgeted: 200,
        billActual: 89.99,
        actual: 0,
        remaining: 200,
        percentSpent: 0,
        projectedUsage: 200,
        projectedRemaining: 0,
        projectedPercentage: 100,
        scheduledCommitments: [
          commitmentFixture({
            occurrenceKey: 'bill-2:2026-09-15',
            recurringExpenseId: 'bill-2',
            name: 'Annual membership',
            dueDate: '2026-09-15',
            amount: 200,
            categoryId: 'category-2',
            accountId: null,
          }),
        ],
      },
    ],
    drillDown: drillDown(
      ['category-1', 'category-child', 'category-2'],
      ['transaction-1', 'transaction-2', 'transaction-3'],
    ),
  };
}

function commitmentFixture(
  overrides: Partial<BudgetProgress['lines'][number]['scheduledCommitments'][number]> = {},
): BudgetProgress['lines'][number]['scheduledCommitments'][number] {
  return {
    occurrenceKey: 'bill-1:2026-09-01',
    recurringExpenseId: 'bill-1',
    name: 'Rent',
    dueDate: '2026-09-01',
    amount: 450,
    currency: 'USD',
    categoryId: 'category-1',
    accountId: 'account-1',
    satisfied: false,
    actualAmount: null,
    variance: null,
    linkedTransactionId: null,
    ...overrides,
  };
}

function accountFixture() {
  return {
    id: 'account-1',
    ownerId: 'owner-1',
    name: 'Everyday checking',
    type: 'checking' as const,
    classification: 'asset' as const,
    currency: 'USD',
    openingDate: '2026-01-01',
    openingBalance: 1000,
    currentBalance: 500,
    interestRate: null,
    interestRateType: null,
    status: 'active' as const,
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  };
}

function lineFixture(overrides: Partial<Budget['lines'][number]> = {}): Budget['lines'][number] {
  return {
    id: 'line-1',
    position: 0,
    categoryId: 'category-1',
    plannedAmount: 400,
    status: 'active',
    archivedAt: null,
    createdAt: '2026-08-24T12:00:00Z',
    updatedAt: '2026-08-24T12:00:00Z',
    ...overrides,
  };
}

function categoryFixture(overrides: Partial<TransactionCategory> = {}): TransactionCategory {
  return {
    id: 'category-1',
    ownerId: 'owner-1',
    name: 'Groceries',
    applicability: 'expense',
    parentId: null,
    status: 'active',
    archivedAt: null,
    createdAt: '2026-08-24T12:00:00Z',
    updatedAt: '2026-08-24T12:00:00Z',
    ...overrides,
  };
}
