import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FinancialAccount } from '../../../api/accounts/account.models';
import { AccountsApiService } from '../../../api/accounts/accounts-api.service';
import { CategoriesApiService } from '../../../api/categories/categories-api.service';
import { TransactionCategory } from '../../../api/categories/category.models';
import { ApiErrorPresenter } from '../../../api/errors/api-error-presenter.service';
import { RecurringExpense } from '../../../api/recurring-expenses/recurring-expense.models';
import { RecurringExpensesApiService } from '../../../api/recurring-expenses/recurring-expenses-api.service';
import { NotificationService } from '../../../core/notification.service';
import { RecurringExpensesPage } from './recurring-expenses-page';

describe('RecurringExpensesPage', () => {
  let api: Record<
    'list' | 'create' | 'update' | 'archive' | 'restore' | 'occurrences',
    ReturnType<typeof vi.fn>
  >;
  let accountsApi: { list: ReturnType<typeof vi.fn>; listCurrencies: ReturnType<typeof vi.fn> };
  let notifications: { show: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    api = {
      list: vi.fn(() => of([recurringExpenseFixture()])),
      create: vi.fn(() => of(recurringExpenseFixture())),
      update: vi.fn(() => of(recurringExpenseFixture({ name: 'Updated internet' }))),
      archive: vi.fn(() => of(recurringExpenseFixture({ status: 'archived' }))),
      restore: vi.fn(() => of(recurringExpenseFixture())),
      occurrences: vi.fn(() =>
        of([
          {
            occurrenceKey: 'bill-1:2026-09-30',
            recurringExpenseId: 'bill-1',
            name: 'Internet',
            dueDate: '2026-09-30',
            amount: 79.99,
            currency: 'USD',
            categoryId: 'category-1',
            accountId: 'account-1',
          },
        ]),
      ),
    };
    accountsApi = {
      list: vi.fn(() => of([accountFixture()])),
      listCurrencies: vi.fn(() => of(['USD', 'EUR'])),
    };
    notifications = { show: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [RecurringExpensesPage],
      providers: [
        { provide: RecurringExpensesApiService, useValue: api },
        { provide: AccountsApiService, useValue: accountsApi },
        { provide: CategoriesApiService, useValue: { list: vi.fn(() => of([categoryFixture()])) } },
        { provide: NotificationService, useValue: notifications },
        { provide: ApiErrorPresenter, useValue: { present: vi.fn((error) => error) } },
      ],
    }).compileComponents();
  });

  afterEach(() => vi.restoreAllMocks());

  it('loads active schedules and server-projected upcoming due dates', () => {
    const fixture = TestBed.createComponent(RecurringExpensesPage);
    fixture.detectChanges();

    expect(api.list).toHaveBeenCalledWith('active');
    expect(accountsApi.list).toHaveBeenCalledWith('all');
    expect(accountsApi.listCurrencies).toHaveBeenCalled();
    expect(api.occurrences).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Internet');
    expect(fixture.nativeElement.textContent).toContain('Upcoming due dates');
    expect(fixture.nativeElement.textContent).toContain('Month-end dates clamp');
    expect(fixture.nativeElement.textContent).toContain('never create a transaction');
  });

  it('creates a schedule with trimmed values and the exact month interval contract', () => {
    const fixture = TestBed.createComponent(RecurringExpensesPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.openCreate();
    component.form.setValue({
      name: ' Internet ',
      amount: 79.99,
      currency: 'USD',
      categoryId: 'category-1',
      accountId: 'account-1',
      anchorDate: '2026-09-30',
      endDate: '',
      intervalMonths: 3,
    });

    component.save();

    expect(api.create).toHaveBeenCalledWith({
      name: 'Internet',
      amount: 79.99,
      currency: 'USD',
      categoryId: 'category-1',
      accountId: 'account-1',
      anchorDate: '2026-09-30',
      endDate: null,
      intervalMonths: 3,
    });
    expect(notifications.show).toHaveBeenCalledWith('Internet was scheduled.', 'success');
  });

  it('preserves a nonstandard positive interval while editing', () => {
    const fixture = TestBed.createComponent(RecurringExpensesPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    const everyFiveMonths = recurringExpenseFixture({ intervalMonths: 5 });
    component.startEdit(everyFiveMonths);
    component.form.controls.name.setValue('Updated internet');
    component.save();

    expect(api.update).toHaveBeenCalledWith(
      'bill-1',
      expect.objectContaining({ intervalMonths: 5 }),
    );
    expect(component.cadenceLabel(5)).toBe('Every 5 months');
  });

  it('blocks an end date before the first due date', () => {
    const fixture = TestBed.createComponent(RecurringExpensesPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.openCreate();
    component.form.patchValue({
      name: 'Internet',
      amount: 79.99,
      categoryId: 'category-1',
      anchorDate: '2026-09-30',
      endDate: '2026-09-01',
    });
    component.save();
    fixture.detectChanges();

    expect(api.create).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('cannot be before the first due date');
  });

  it('requires confirmation before archiving and protects editor changes', () => {
    const confirm = vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    const fixture = TestBed.createComponent(RecurringExpensesPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.archive(recurringExpenseFixture());
    expect(api.archive).not.toHaveBeenCalled();

    component.openCreate();
    component.form.controls.name.setValue('Draft');
    component.form.controls.name.markAsDirty();
    component.selectFilter('archived');
    expect(component.filter()).toBe('active');
    expect(confirm).toHaveBeenCalled();
  });
});

function recurringExpenseFixture(overrides: Partial<RecurringExpense> = {}): RecurringExpense {
  return {
    id: 'bill-1',
    ownerId: 'owner-1',
    name: 'Internet',
    amount: 79.99,
    currency: 'USD',
    categoryId: 'category-1',
    accountId: 'account-1',
    anchorDate: '2026-09-30',
    endDate: null,
    intervalMonths: 1,
    status: 'active',
    archivedAt: null,
    version: 0,
    createdAt: '2026-09-01T12:00:00Z',
    updatedAt: '2026-09-01T12:00:00Z',
    ...overrides,
  };
}

function categoryFixture(): TransactionCategory {
  return {
    id: 'category-1',
    ownerId: 'owner-1',
    name: 'Utilities',
    applicability: 'expense',
    parentId: null,
    status: 'active',
    archivedAt: null,
    createdAt: '2026-09-01T12:00:00Z',
    updatedAt: '2026-09-01T12:00:00Z',
  };
}

function accountFixture(): FinancialAccount {
  return {
    id: 'account-1',
    ownerId: 'owner-1',
    name: 'Everyday checking',
    type: 'checking',
    classification: 'asset',
    currency: 'USD',
    openingDate: '2026-01-01',
    openingBalance: 1000,
    currentBalance: 900,
    interestRate: null,
    interestRateType: null,
    status: 'active',
    archivedAt: null,
    createdAt: '2026-01-01T12:00:00Z',
    updatedAt: '2026-09-01T12:00:00Z',
  };
}
