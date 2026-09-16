import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.providers';
import {
  AccountReconciliation,
  ConfirmReconciliationRequest,
  ReconciliationPage,
  ReconciliationPreview,
  ReconciliationPreviewRequest,
} from './reconciliation.models';

@Injectable({ providedIn: 'root' })
export class AccountReconciliationsApiService {
  private readonly http = inject(HttpClient);
  private readonly accountsUrl = inject(API_BASE_URL) + '/accounts';

  preview(
    accountId: string,
    request: ReconciliationPreviewRequest,
  ): Observable<ReconciliationPreview> {
    return this.http.post<ReconciliationPreview>(this.url(accountId) + '/preview', request);
  }

  confirm(
    accountId: string,
    request: ConfirmReconciliationRequest,
    idempotencyKey: string,
  ): Observable<AccountReconciliation> {
    return this.http.post<AccountReconciliation>(this.url(accountId), request, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
    });
  }

  history(accountId: string, page = 0, size = 25): Observable<ReconciliationPage> {
    return this.http.get<ReconciliationPage>(this.url(accountId), {
      params: { page, size },
    });
  }

  private url(accountId: string): string {
    return this.accountsUrl + '/' + encodeURIComponent(accountId) + '/reconciliations';
  }
}
