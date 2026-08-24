import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.providers';
import {
  FinancialTransaction,
  SaveTransactionRequest,
  TransactionPage,
  TransactionSearchCriteria,
  TransactionSummaryCriteria,
  TransactionSummary,
} from './transaction.models';

@Injectable({ providedIn: 'root' })
export class TransactionsApiService {
  private readonly http = inject(HttpClient);
  private readonly transactionsUrl = inject(API_BASE_URL) + '/transactions';

  search(criteria: TransactionSearchCriteria = {}): Observable<TransactionPage> {
    return this.http.get<TransactionPage>(this.transactionsUrl, {
      params: this.params(criteria),
    });
  }

  summarize(criteria: TransactionSummaryCriteria = {}): Observable<TransactionSummary[]> {
    return this.http.get<TransactionSummary[]>(this.transactionsUrl + '/summary', {
      params: this.params(criteria),
    });
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

  private params(criteria: object): Record<string, string> {
    return Object.fromEntries(
      Object.entries(criteria)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => [key, String(value)]),
    );
  }
}
