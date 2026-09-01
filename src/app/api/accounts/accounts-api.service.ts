import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.providers';
import {
  AccountStatusFilter,
  CreateFinancialAccountRequest,
  FinancialAccount,
  UpdateFinancialAccountRequest,
} from './account.models';

@Injectable({ providedIn: 'root' })
export class AccountsApiService {
  private readonly http = inject(HttpClient);
  private readonly accountsUrl = inject(API_BASE_URL) + '/accounts';

  list(status: AccountStatusFilter = 'active'): Observable<FinancialAccount[]> {
    return this.http.get<FinancialAccount[]>(this.accountsUrl, { params: { status } });
  }

  get(id: string): Observable<FinancialAccount> {
    return this.http.get<FinancialAccount>(this.accountsUrl + '/' + encodeURIComponent(id));
  }

  listCurrencies(): Observable<string[]> {
    return this.http.get<string[]>(this.accountsUrl + '/currencies');
  }

  create(request: CreateFinancialAccountRequest): Observable<FinancialAccount> {
    return this.http.post<FinancialAccount>(this.accountsUrl, request);
  }

  update(id: string, request: UpdateFinancialAccountRequest): Observable<FinancialAccount> {
    return this.http.patch<FinancialAccount>(this.accountUrl(id), request);
  }

  archive(id: string): Observable<FinancialAccount> {
    return this.http.post<FinancialAccount>(this.accountUrl(id) + '/archive', {});
  }

  restore(id: string): Observable<FinancialAccount> {
    return this.http.post<FinancialAccount>(this.accountUrl(id) + '/restore', {});
  }

  private accountUrl(id: string): string {
    return this.accountsUrl + '/' + encodeURIComponent(id);
  }
}
