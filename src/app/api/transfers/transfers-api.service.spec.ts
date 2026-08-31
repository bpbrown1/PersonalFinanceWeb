import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../api.providers';
import { SaveTransferRequest } from './transfer.models';
import { TransfersApiService } from './transfers-api.service';

describe('TransfersApiService', () => {
  let service: TransfersApiService;
  let http: HttpTestingController;
  const request: SaveTransferRequest = {
    sourceAccountId: 'checking',
    destinationAccountId: 'savings',
    sourceAmount: 100,
    destinationAmount: 92,
    transactionDate: '2026-08-23',
    description: 'Travel cash exchange',
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
    service = TestBed.inject(TransfersApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists and retrieves transfer aggregates', () => {
    service.list('all').subscribe();
    const list = http.expectOne((candidate) => candidate.url === '/api/v1/transfers');
    expect(list.request.params.get('status')).toBe('all');
    list.flush([]);

    service.get('transfer / 1').subscribe();
    http.expectOne('/api/v1/transfers/transfer%20%2F%201').flush({});
  });

  it('creates and fully replaces transfers', () => {
    service.create(request).subscribe();
    const create = http.expectOne('/api/v1/transfers');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(request);
    create.flush({});

    service.update('transfer-1', request).subscribe();
    const update = http.expectOne('/api/v1/transfers/transfer-1');
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual(request);
    update.flush({});
  });

  it('soft deletes and restores both transfer legs', () => {
    service.delete('transfer-1').subscribe();
    const remove = http.expectOne('/api/v1/transfers/transfer-1');
    expect(remove.request.method).toBe('DELETE');
    remove.flush({});

    service.restore('transfer-1').subscribe();
    const restore = http.expectOne('/api/v1/transfers/transfer-1/restore');
    expect(restore.request.method).toBe('POST');
    expect(restore.request.body).toEqual({});
    restore.flush({});
  });
});
