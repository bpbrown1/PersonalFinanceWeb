import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../api.providers';
import { AccountBalancesApiService } from './account-balances-api.service';

describe('AccountBalancesApiService', () => {
  let service: AccountBalancesApiService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [AccountBalancesApiService, provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: 'http://localhost:8080/api/v1' }] });
    service = TestBed.inject(AccountBalancesApiService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('retrieves ordered snapshots using an encoded account identifier', async () => {
    const result = firstValueFrom(service.history('account/with space'));
    const request = http.expectOne('http://localhost:8080/api/v1/accounts/account%2Fwith%20space/balance-snapshots');
    expect(request.request.method).toBe('GET'); request.flush([]); await expect(result).resolves.toEqual([]);
  });

  it('retrieves the balance as of an exact ISO instant', async () => {
    const instant = '2026-08-20T23:59:59.999Z';
    const result = firstValueFrom(service.asOf('account-1', instant));
    const request = http.expectOne((candidate) => candidate.url.endsWith('/accounts/account-1/balance') && candidate.params.get('asOf') === instant);
    expect(request.request.method).toBe('GET'); request.flush({ accountId:'account-1', balance:1200, effectiveAt:'2026-08-20T12:00:00Z', source:'manual' });
    await expect(result).resolves.toMatchObject({ balance:1200, source:'manual' });
  });
});
