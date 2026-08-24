import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Budget } from '../../../api/budgets/budget.models';
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
    | 'create'
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

  beforeEach(async () => {
    api = {
      list: vi.fn(() => of([budgetFixture()])),
      get: vi.fn(() => of(budgetFixture())),
      create: vi.fn(() => of(budgetFixture({ name: 'September plan' }))),
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
    await TestBed.configureTestingModule({
      imports: [BudgetsPage],
      providers: [
        { provide: BudgetsApiService, useValue: api },
        { provide: CategoriesApiService, useValue: categoriesApi },
        { provide: NotificationService, useValue: notifications },
        { provide: ApiErrorPresenter, useValue: { present: vi.fn((error) => error) } },
      ],
    }).compileComponents();
  });

  afterEach(() => vi.restoreAllMocks());

  it('loads active budgets with all categories and planned-only messaging', () => {
    const fixture = TestBed.createComponent(BudgetsPage);
    fixture.detectChanges();
    expect(api.list).toHaveBeenCalledWith('active');
    expect(categoriesApi.list).toHaveBeenCalledWith('all');
    expect(fixture.nativeElement.textContent).toContain('September essentials');
    expect(fixture.nativeElement.textContent).toContain(
      'Actual spending progress arrives with US-049',
    );
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

  it('retrieves details and reorders every retained line id', () => {
    const budget = budgetFixture();
    const fixture = TestBed.createComponent(BudgetsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.selectBudget(budget);
    component.moveLine(budget, 0, 1);
    expect(api.get).toHaveBeenCalledWith('budget-1');
    expect(api.reorderLines).toHaveBeenCalledWith('budget-1', {
      lineIds: ['line-2', 'line-1'],
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
