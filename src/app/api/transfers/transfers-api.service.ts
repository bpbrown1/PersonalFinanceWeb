import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.providers';
import { FinancialTransfer, SaveTransferRequest, TransactionStatusFilter } from './transfer.models';

@Injectable({ providedIn: 'root' })
export class TransfersApiService {
  private readonly http = inject(HttpClient);
  private readonly transfersUrl = inject(API_BASE_URL) + '/transfers';

  list(status: TransactionStatusFilter = 'active'): Observable<FinancialTransfer[]> {
    return this.http.get<FinancialTransfer[]>(this.transfersUrl, { params: { status } });
  }

  get(id: string): Observable<FinancialTransfer> {
    return this.http.get<FinancialTransfer>(this.transferUrl(id));
  }

  create(request: SaveTransferRequest): Observable<FinancialTransfer> {
    return this.http.post<FinancialTransfer>(this.transfersUrl, request);
  }

  update(id: string, request: SaveTransferRequest): Observable<FinancialTransfer> {
    return this.http.put<FinancialTransfer>(this.transferUrl(id), request);
  }

  delete(id: string): Observable<FinancialTransfer> {
    return this.http.delete<FinancialTransfer>(this.transferUrl(id));
  }

  restore(id: string): Observable<FinancialTransfer> {
    return this.http.post<FinancialTransfer>(this.transferUrl(id) + '/restore', {});
  }

  private transferUrl(id: string): string {
    return this.transfersUrl + '/' + encodeURIComponent(id);
  }
}
