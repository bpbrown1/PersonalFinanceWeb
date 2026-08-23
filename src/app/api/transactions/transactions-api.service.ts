import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.providers';
import {
  FinancialTransaction,
  SaveTransactionRequest,
  TransactionStatusFilter,
  TransactionSummary,
} from './transaction.models';

@Injectable({ providedIn: 'root' })
export class TransactionsApiService {
  private readonly http = inject(HttpClient);
  private readonly transactionsUrl = inject(API_BASE_URL) + '/transactions';

  list(status: TransactionStatusFilter = 'active'): Observable<FinancialTransaction[]> {
    return this.http.get<FinancialTransaction[]>(this.transactionsUrl, { params: { status } });
  }

  summarize(from?: string, to?: string): Observable<TransactionSummary[]> {
    const params: Record<string, string> = {};
    if (from) params['from'] = from;
    if (to) params['to'] = to;
    return this.http.get<TransactionSummary[]>(this.transactionsUrl + '/summary', { params });
  }

  get(id: string): Observable<FinancialTransaction> {
    return this.http.get<FinancialTransaction>(this.transactionUrl(id));
  }

  create(request: SaveTransactionRequest): Observable<FinancialTransaction> {
    return this.http.post<FinancialTransaction>(this.transactionsUrl, request);
  }

  update(id: string, request: SaveTransactionRequest): Observable<FinancialTransaction> {
    return this.http.put<FinancialTransaction>(this.transactionUrl(id), request);
  }

  delete(id: string): Observable<FinancialTransaction> {
    return this.http.delete<FinancialTransaction>(this.transactionUrl(id));
  }

  restore(id: string): Observable<FinancialTransaction> {
    return this.http.post<FinancialTransaction>(this.transactionUrl(id) + '/restore', {});
  }

  private transactionUrl(id: string): string {
    return this.transactionsUrl + '/' + encodeURIComponent(id);
  }
}
