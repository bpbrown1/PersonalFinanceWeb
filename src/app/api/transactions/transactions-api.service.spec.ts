import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../api.providers';
import { SaveTransactionRequest } from './transaction.models';
import { TransactionsApiService } from './transactions-api.service';

describe('TransactionsApiService', () => {
  let service: TransactionsApiService;
  let http: HttpTestingController;
  const request: SaveTransactionRequest = {
    accountId: 'account-1',
    amount: 12.5,
    transactionDate: '2026-08-23',
    description: 'Lunch',
    type: 'expense',
    categoryId: null,
    splits: [],
    merchantPayee: null,
    notes: null,
    externalReference: null,
    recurringExpenseOccurrence: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api/v1' },
      ],
    });
    service = TestBed.inject(TransactionsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('searches transactions with combined filters, sorting, and pagination', () => {
    service
      .search({
        status: 'all',
        accountId: 'account-1',
        from: '2026-08-01',
        to: '2026-08-23',
        categoryId: 'category-1',
        type: 'expense',
        minAmount: 10,
        maxAmount: 50,
        text: 'lunch',
        page: 2,
        size: 25,
        sort: 'amount',
        direction: 'asc',
      })
      .subscribe();
    const call = http.expectOne((candidate) => candidate.url === '/api/v1/transactions');
    expect(call.request.params.get('status')).toBe('all');
    expect(call.request.params.get('accountId')).toBe('account-1');
    expect(call.request.params.get('from')).toBe('2026-08-01');
    expect(call.request.params.get('to')).toBe('2026-08-23');
    expect(call.request.params.get('categoryId')).toBe('category-1');
    expect(call.request.params.get('type')).toBe('expense');
    expect(call.request.params.get('minAmount')).toBe('10');
    expect(call.request.params.get('maxAmount')).toBe('50');
    expect(call.request.params.get('text')).toBe('lunch');
    expect(call.request.params.get('page')).toBe('2');
    expect(call.request.params.get('size')).toBe('25');
    expect(call.request.params.get('sort')).toBe('amount');
    expect(call.request.params.get('direction')).toBe('asc');
    call.flush({ items: [], page: 2, size: 25, totalElements: 0, totalPages: 0 });
  });

  it('requests inclusive summaries with optional date boundaries', () => {
    service
      .summarize({
        from: '2026-08-01',
        to: '2026-08-23',
        accountId: 'account-1',
        categoryId: 'category-1',
        type: 'expense',
      })
      .subscribe();
    const dated = http.expectOne((candidate) => candidate.url === '/api/v1/transactions/summary');
    expect(dated.request.params.get('from')).toBe('2026-08-01');
    expect(dated.request.params.get('to')).toBe('2026-08-23');
    expect(dated.request.params.get('accountId')).toBe('account-1');
    expect(dated.request.params.get('categoryId')).toBe('category-1');
    expect(dated.request.params.get('type')).toBe('expense');
    dated.flush([]);

    service.summarize().subscribe();
    const allTime = http.expectOne('/api/v1/transactions/summary');
    expect(allTime.request.params.keys()).toEqual([]);
    allTime.flush([]);
  });

  it('creates and fully replaces transactions', () => {
    service.create(request).subscribe();
    const create = http.expectOne('/api/v1/transactions');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(request);
    create.flush({});
    service.update('transaction / 1', request).subscribe();
    const update = http.expectOne('/api/v1/transactions/transaction%20%2F%201');
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual(request);
    update.flush({});
  });

  it('soft deletes and restores using encoded identifiers', () => {
    service.delete('transaction / 1').subscribe();
    const remove = http.expectOne('/api/v1/transactions/transaction%20%2F%201');
    expect(remove.request.method).toBe('DELETE');
    remove.flush({});
    service.restore('transaction / 1').subscribe();
    const restore = http.expectOne('/api/v1/transactions/transaction%20%2F%201/restore');
    expect(restore.request.method).toBe('POST');
    expect(restore.request.body).toEqual({});
    restore.flush({});
  });
});
