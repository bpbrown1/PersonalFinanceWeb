import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.providers';
import { CreateFinancialAccountRequest, FinancialAccount } from './account.models';

@Injectable({ providedIn: 'root' })
export class AccountsApiService {
  private readonly http = inject(HttpClient);
  private readonly accountsUrl = inject(API_BASE_URL) + '/accounts';

  list(): Observable<FinancialAccount[]> {
    return this.http.get<FinancialAccount[]>(this.accountsUrl);
  }

  get(id: string): Observable<FinancialAccount> {
    return this.http.get<FinancialAccount>(this.accountsUrl + '/' + encodeURIComponent(id));
  }

  create(request: CreateFinancialAccountRequest): Observable<FinancialAccount> {
    return this.http.post<FinancialAccount>(this.accountsUrl, request);
  }
}
