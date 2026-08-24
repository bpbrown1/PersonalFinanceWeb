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
    merchantPayee: null,
    notes: null,
    externalReference: null,
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

  it('lists transactions with an explicit status', () => {
    service.list('all').subscribe();
    const call = http.expectOne((candidate) => candidate.url === '/api/v1/transactions');
    expect(call.request.params.get('status')).toBe('all');
    call.flush([]);
  });

  it('requests inclusive summaries with optional date boundaries', () => {
    service.summarize('2026-08-01', '2026-08-23').subscribe();
    const dated = http.expectOne((candidate) => candidate.url === '/api/v1/transactions/summary');
    expect(dated.request.params.get('from')).toBe('2026-08-01');
    expect(dated.request.params.get('to')).toBe('2026-08-23');
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
