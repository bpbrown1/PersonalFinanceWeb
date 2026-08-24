import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.providers';
import {
  Budget,
  BudgetStatusFilter,
  CreateBudgetRequest,
  ReorderBudgetLinesRequest,
  SaveBudgetLineRequest,
  UpdateBudgetRequest,
} from './budget.models';

@Injectable({ providedIn: 'root' })
export class BudgetsApiService {
  private readonly http = inject(HttpClient);
  private readonly budgetsUrl = inject(API_BASE_URL) + '/budgets';

  list(status: BudgetStatusFilter = 'active'): Observable<Budget[]> {
    return this.http.get<Budget[]>(this.budgetsUrl, { params: { status } });
  }

  get(id: string): Observable<Budget> {
    return this.http.get<Budget>(this.budgetUrl(id));
  }

  create(request: CreateBudgetRequest): Observable<Budget> {
    return this.http.post<Budget>(this.budgetsUrl, request);
  }

  update(id: string, request: UpdateBudgetRequest): Observable<Budget> {
    return this.http.put<Budget>(this.budgetUrl(id), request);
  }

  archive(id: string): Observable<Budget> {
    return this.postAction(id, 'archive');
  }

  restore(id: string): Observable<Budget> {
    return this.postAction(id, 'restore');
  }

  addLine(id: string, request: SaveBudgetLineRequest): Observable<Budget> {
    return this.http.post<Budget>(this.linesUrl(id), request);
  }

  updateLine(id: string, lineId: string, request: SaveBudgetLineRequest): Observable<Budget> {
    return this.http.put<Budget>(this.lineUrl(id, lineId), request);
  }

  reorderLines(id: string, request: ReorderBudgetLinesRequest): Observable<Budget> {
    return this.http.put<Budget>(this.linesUrl(id) + '/reorder', request);
  }

  archiveLine(id: string, lineId: string): Observable<Budget> {
    return this.postLineAction(id, lineId, 'archive');
  }

  restoreLine(id: string, lineId: string): Observable<Budget> {
    return this.postLineAction(id, lineId, 'restore');
  }

  private postAction(id: string, action: 'archive' | 'restore'): Observable<Budget> {
    return this.http.post<Budget>(this.budgetUrl(id) + '/' + action, {});
  }

  private postLineAction(
    id: string,
    lineId: string,
    action: 'archive' | 'restore',
  ): Observable<Budget> {
    return this.http.post<Budget>(this.lineUrl(id, lineId) + '/' + action, {});
  }

  private budgetUrl(id: string): string {
    return this.budgetsUrl + '/' + encodeURIComponent(id);
  }

  private linesUrl(id: string): string {
    return this.budgetUrl(id) + '/lines';
  }

  private lineUrl(id: string, lineId: string): string {
    return this.linesUrl(id) + '/' + encodeURIComponent(lineId);
  }
}
