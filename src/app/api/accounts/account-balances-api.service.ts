import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.providers';
import { AccountBalanceAsOf, BalanceSnapshot } from './balance.models';

@Injectable({ providedIn: 'root' })
export class AccountBalancesApiService {
  private readonly http = inject(HttpClient);
  private readonly accountsUrl = inject(API_BASE_URL) + '/accounts';

  history(accountId: string): Observable<BalanceSnapshot[]> {
    return this.http.get<BalanceSnapshot[]>(this.accountUrl(accountId) + '/balance-snapshots');
  }

  asOf(accountId: string, instant: string): Observable<AccountBalanceAsOf> {
    return this.http.get<AccountBalanceAsOf>(this.accountUrl(accountId) + '/balance', { params: { asOf: instant } });
  }

  private accountUrl(accountId: string): string {
    return this.accountsUrl + '/' + encodeURIComponent(accountId);
  }
}
