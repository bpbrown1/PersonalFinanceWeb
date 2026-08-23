import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../api.providers';
import { apiErrorInterceptor } from '../errors/api-error.interceptor';
import { AccountsApiService } from './accounts-api.service';
import { CreateFinancialAccountRequest, FinancialAccount } from './account.models';

describe('AccountsApiService', () => {
  let service: AccountsApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AccountsApiService,
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:8080/api/v1' },
      ],
    });
    service = TestBed.inject(AccountsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('retrieves typed accounts from the versioned endpoint', async () => {
    const account = accountFixture();
    const result = firstValueFrom(service.list());
    const request = http.expectOne('http://localhost:8080/api/v1/accounts?status=active');
    expect(request.request.method).toBe('GET');
    request.flush([account]);
    await expect(result).resolves.toEqual([account]);
  });

  it('retrieves one account with a safely encoded identifier', async () => {
    const account = accountFixture();
    const result = firstValueFrom(service.get('account/with space'));
    const request = http.expectOne('http://localhost:8080/api/v1/accounts/account%2Fwith%20space');
    expect(request.request.method).toBe('GET');
    request.flush(account);
    await expect(result).resolves.toEqual(account);
  });

  it('creates an account using the documented request contract', async () => {
    const body: CreateFinancialAccountRequest = {
      name: 'Everyday Checking',
      type: 'checking',
      currency: 'USD',
      openingDate: '2026-08-22',
      openingBalance: 1250.75,
    };
    const result = firstValueFrom(service.create(body));
    const request = http.expectOne('http://localhost:8080/api/v1/accounts');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    request.flush(accountFixture());
    await expect(result).resolves.toEqual(accountFixture());
  });

  it('filters lists and supports update, archive, and restore', async () => {
    const account = accountFixture();
    const listResult = firstValueFrom(service.list('archived'));
    http.expectOne('http://localhost:8080/api/v1/accounts?status=archived').flush([account]);
    await expect(listResult).resolves.toEqual([account]);

    const updateResult = firstValueFrom(service.update(account.id, { name: 'Primary Checking' }));
    const updateRequest = http.expectOne(`http://localhost:8080/api/v1/accounts/${account.id}`);
    expect(updateRequest.request.method).toBe('PATCH');
    expect(updateRequest.request.body).toEqual({ name: 'Primary Checking' });
    updateRequest.flush({ ...account, name: 'Primary Checking' });
    await updateResult;

    for (const action of ['archive', 'restore'] as const) {
      const result = firstValueFrom(service[action](account.id));
      const request = http.expectOne(`http://localhost:8080/api/v1/accounts/${account.id}/${action}`);
      expect(request.request.method).toBe('POST');
      request.flush(account);
      await result;
    }
  });

  it('normalizes validation responses and retains field errors', async () => {
    const result = firstValueFrom(service.create({
      name: '',
      type: 'checking',
      currency: 'US',
      openingDate: '2026-08-22',
    }));
    const request = http.expectOne('http://localhost:8080/api/v1/accounts');
    request.flush(
      {
        timestamp: '2026-08-22T18:30:00Z',
        status: 400,
        error: 'Validation failed',
        fieldErrors: { currency: 'must be a three-letter currency code' },
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await expect(result).rejects.toMatchObject({
      kind: 'validation',
      status: 400,
      fieldErrors: { currency: 'must be a three-letter currency code' },
    });
  });
});

function accountFixture(): FinancialAccount {
  return {
    id: '0dfae49e-6765-4f9f-b485-53d17338a106',
    ownerId: '00000000-0000-0000-0000-000000000001',
    name: 'Everyday Checking',
    type: 'checking',
    currency: 'USD',
    openingDate: '2026-08-22',
    openingBalance: 1250.75,
    currentBalance: 1250.75,
    status: 'active',
    archivedAt: null,
    createdAt: '2026-08-22T18:30:00Z',
    updatedAt: '2026-08-22T18:30:00Z',
  };
}
