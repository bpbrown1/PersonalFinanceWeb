import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../api.providers';
import { AccountReconciliationsApiService } from './account-reconciliations-api.service';

describe('AccountReconciliationsApiService', () => {
  let service: AccountReconciliationsApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api/v1' },
      ],
    });
    service = TestBed.inject(AccountReconciliationsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('previews a statement comparison for an encoded account id', () => {
    const request = { statementDate: '2026-09-15', statementBalance: 125.5 };
    service.preview('account / 1', request).subscribe();
    const call = http.expectOne('/api/v1/accounts/account%20%2F%201/reconciliations/preview');
    expect(call.request.method).toBe('POST');
    expect(call.request.body).toEqual(request);
    call.flush({});
  });

  it('confirms with the idempotency key and typed request', () => {
    const request = {
      statementDate: '2026-09-15',
      statementBalance: 125.5,
      ledgerToken: 'token-1',
      categoryId: 'category-1',
      explanation: 'Statement fee',
    };
    service.confirm('account-1', request, 'attempt-1').subscribe();
    const call = http.expectOne('/api/v1/accounts/account-1/reconciliations');
    expect(call.request.method).toBe('POST');
    expect(call.request.headers.get('Idempotency-Key')).toBe('attempt-1');
    expect(call.request.body).toEqual(request);
    call.flush({});
  });

  it('loads paginated reconciliation history', () => {
    service.history('account-1', 2, 50).subscribe();
    const call = http.expectOne(
      (candidate) => candidate.url === '/api/v1/accounts/account-1/reconciliations',
    );
    expect(call.request.method).toBe('GET');
    expect(call.request.params.get('page')).toBe('2');
    expect(call.request.params.get('size')).toBe('50');
    call.flush({ items: [], page: 2, size: 50, totalElements: 0, totalPages: 0 });
  });
});
