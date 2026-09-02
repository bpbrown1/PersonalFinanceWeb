import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../api.providers';
import { SaveRecurringExpenseRequest } from './recurring-expense.models';
import { RecurringExpensesApiService } from './recurring-expenses-api.service';

describe('RecurringExpensesApiService', () => {
  let service: RecurringExpensesApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api/v1' },
      ],
    });
    service = TestBed.inject(RecurringExpensesApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists definitions using the lifecycle filter and retrieves one encoded id', () => {
    service.list('archived').subscribe();
    const list = http.expectOne('/api/v1/recurring-expenses?status=archived');
    expect(list.request.method).toBe('GET');
    list.flush([]);

    service.get('bill/1').subscribe();
    const detail = http.expectOne('/api/v1/recurring-expenses/bill%2F1');
    expect(detail.request.method).toBe('GET');
    detail.flush({});
  });

  it('creates and replaces a recurring expense with the REST interval contract', () => {
    const request = recurringExpenseRequest();
    service.create(request).subscribe();
    const create = http.expectOne('/api/v1/recurring-expenses');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(request);
    create.flush({});

    service.update('bill-1', request).subscribe();
    const update = http.expectOne('/api/v1/recurring-expenses/bill-1');
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual(request);
    update.flush({});
  });

  it('archives, restores, and loads inclusive server-projected occurrences', () => {
    for (const action of ['archive', 'restore'] as const) {
      service[action]('bill-1').subscribe();
      const request = http.expectOne(`/api/v1/recurring-expenses/bill-1/${action}`);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({});
      request.flush({});
    }

    service.occurrences('2026-09-01', '2027-08-31').subscribe();
    const occurrences = http.expectOne(
      '/api/v1/recurring-expenses/occurrences?from=2026-09-01&to=2027-08-31',
    );
    expect(occurrences.request.method).toBe('GET');
    occurrences.flush([]);
  });

  it('links, explicitly replaces, and unlinks an occurrence match', () => {
    service.match('bill/1', '2026-09-15', 'transaction-1').subscribe();
    const link = http.expectOne('/api/v1/recurring-expenses/bill%2F1/occurrences/2026-09-15/match');
    expect(link.request.method).toBe('POST');
    expect(link.request.body).toEqual({ transactionId: 'transaction-1' });
    link.flush({});

    service.replaceMatch('bill/1', '2026-09-15', 'transaction-2').subscribe();
    const replace = http.expectOne(
      '/api/v1/recurring-expenses/bill%2F1/occurrences/2026-09-15/match',
    );
    expect(replace.request.method).toBe('PUT');
    expect(replace.request.body).toEqual({ transactionId: 'transaction-2' });
    replace.flush({});

    service.unlink('bill/1', '2026-09-15').subscribe();
    const unlink = http.expectOne(
      '/api/v1/recurring-expenses/bill%2F1/occurrences/2026-09-15/match',
    );
    expect(unlink.request.method).toBe('DELETE');
    unlink.flush({});
  });
});

function recurringExpenseRequest(): SaveRecurringExpenseRequest {
  return {
    name: 'Internet',
    amount: 79.99,
    currency: 'USD',
    categoryId: 'category-1',
    accountId: 'account-1',
    anchorDate: '2026-09-30',
    endDate: null,
    intervalMonths: 1,
  };
}
