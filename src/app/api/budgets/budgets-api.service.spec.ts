import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../api.providers';
import { Budget, BudgetProgress, CreateBudgetRequest } from './budget.models';
import { BudgetsApiService } from './budgets-api.service';

describe('BudgetsApiService', () => {
  let service: BudgetsApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api/v1' },
      ],
    });
    service = TestBed.inject(BudgetsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists budgets using the lifecycle filter', () => {
    service.list('archived').subscribe();
    const request = http.expectOne('/api/v1/budgets?status=archived');
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('creates and replaces budget metadata using the documented contracts', () => {
    const create: CreateBudgetRequest = {
      name: 'September plan',
      currency: 'USD',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      lines: [{ categoryId: 'category-1', plannedAmount: 400 }],
    };
    service.create(create).subscribe();
    const createCall = http.expectOne('/api/v1/budgets');
    expect(createCall.request.method).toBe('POST');
    expect(createCall.request.body).toEqual(create);
    createCall.flush(budgetFixture());

    const update = { ...create };
    delete (update as Partial<CreateBudgetRequest>).lines;
    service.update('budget/1', update).subscribe();
    const updateCall = http.expectOne('/api/v1/budgets/budget%2F1');
    expect(updateCall.request.method).toBe('PUT');
    expect(updateCall.request.body).toEqual(update);
    updateCall.flush(budgetFixture());
  });

  it('copies one reviewed ordered draft atomically', () => {
    const body = {
      targetMonth: '2026-10',
      lines: [{ categoryId: 'category-2', plannedAmount: 175.25 }],
    };
    service.copy('budget/1', body).subscribe();
    const request = http.expectOne('/api/v1/budgets/budget%2F1/copy');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    request.flush(budgetFixture());
  });

  it('manages lifecycle and every retained line operation', () => {
    service.get('budget-1').subscribe();
    http.expectOne('/api/v1/budgets/budget-1').flush(budgetFixture());

    for (const action of ['archive', 'restore'] as const) {
      service[action]('budget-1').subscribe();
      const request = http.expectOne(`/api/v1/budgets/budget-1/${action}`);
      expect(request.request.method).toBe('POST');
      request.flush(budgetFixture());
    }

    service.addLine('budget-1', { categoryId: 'category-2', plannedAmount: 75 }).subscribe();
    const add = http.expectOne('/api/v1/budgets/budget-1/lines');
    expect(add.request.method).toBe('POST');
    add.flush(budgetFixture());

    service
      .updateLine('budget-1', 'line/1', { categoryId: 'category-1', plannedAmount: 500 })
      .subscribe();
    const update = http.expectOne('/api/v1/budgets/budget-1/lines/line%2F1');
    expect(update.request.method).toBe('PUT');
    update.flush(budgetFixture());

    service.reorderLines('budget-1', { lineIds: ['line-2', 'line-1'] }).subscribe();
    const reorder = http.expectOne('/api/v1/budgets/budget-1/lines/reorder');
    expect(reorder.request.body).toEqual({ lineIds: ['line-2', 'line-1'] });
    reorder.flush(budgetFixture());

    for (const action of ['archiveLine', 'restoreLine'] as const) {
      service[action]('budget-1', 'line-1').subscribe();
      const suffix = action === 'archiveLine' ? 'archive' : 'restore';
      const request = http.expectOne(`/api/v1/budgets/budget-1/lines/line-1/${suffix}`);
      expect(request.request.method).toBe('POST');
      request.flush(budgetFixture());
    }
  });

  it('loads budget progress with optional server filters', () => {
    service.progress('budget/1', { accountId: 'account-1', categoryId: 'category-1' }).subscribe();

    const request = http.expectOne(
      '/api/v1/budgets/budget%2F1/progress?accountId=account-1&categoryId=category-1',
    );
    expect(request.request.method).toBe('GET');
    request.flush(progressFixture());
  });

  it('pages through the exact transaction path supplied by budget progress', () => {
    service
      .progressTransactions(
        '/api/v1/budgets/budget-1/progress/transactions?scope=line&lineId=line-1',
        {
          page: 1,
          size: 10,
          sort: 'amount',
          direction: 'asc',
        },
      )
      .subscribe();

    const request = http.expectOne(
      '/api/v1/budgets/budget-1/progress/transactions?scope=line&lineId=line-1&page=1&size=10&sort=amount&direction=asc',
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      items: [],
      page: 1,
      size: 10,
      totalElements: 0,
      totalPages: 0,
      sortBy: 'amount',
      sortDirection: 'asc',
    });
  });

  it('rejects a corrupted or external budget progress path without making a request', () => {
    let receivedError: unknown;
    service
      .progressTransactions('https://example.com/private', {
        page: 0,
        size: 25,
        sort: 'date',
        direction: 'desc',
      })
      .subscribe({ error: (error) => (receivedError = error) });

    expect(receivedError).toBeInstanceOf(Error);
    http.expectNone(() => true);
  });
});

function budgetFixture(): Budget {
  return {
    id: 'budget-1',
    ownerId: 'owner-1',
    name: 'September plan',
    currency: 'USD',
    periodType: 'monthly',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    totalPlanned: 400,
    lines: [],
    status: 'active',
    archivedAt: null,
    version: 0,
    createdAt: '2026-08-24T12:00:00Z',
    updatedAt: '2026-08-24T12:00:00Z',
  };
}

function progressFixture(): BudgetProgress {
  const drillDown = {
    from: '2026-09-01',
    to: '2026-09-30',
    accountId: null,
    categoryIds: ['category-1'],
    type: 'expense' as const,
    status: 'active' as const,
    transactionIds: ['transaction-1'],
    transactionsPath: '/api/v1/budgets/budget-1/progress/transactions?scope=overall',
  };
  return {
    budgetId: 'budget-1',
    ownerId: 'owner-1',
    currency: 'USD',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    accountId: null,
    categoryId: null,
    planned: 400,
    budgetedActual: 250,
    unbudgetedActual: 25,
    totalActual: 275,
    remaining: 125,
    percentageUsed: 68.75,
    lines: [],
    unbudgeted: [],
    drillDown,
  };
}
