import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../api.providers';
import { Budget, CreateBudgetRequest } from './budget.models';
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
