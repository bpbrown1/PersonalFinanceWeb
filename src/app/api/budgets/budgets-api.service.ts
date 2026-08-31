import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { API_BASE_URL } from '../api.providers';
import { TransactionPage } from '../transactions/transaction.models';
import {
  Budget,
  BudgetProgress,
  BudgetProgressFilters,
  BudgetProgressTransactionPageCriteria,
  BudgetStatusFilter,
  CreateBudgetRequest,
  CopyBudgetRequest,
  ReorderBudgetLinesRequest,
  SaveBudgetLineRequest,
  UpdateBudgetRequest,
} from './budget.models';

@Injectable({ providedIn: 'root' })
export class BudgetsApiService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private readonly budgetsUrl = this.apiBaseUrl + '/budgets';

  list(status: BudgetStatusFilter = 'active'): Observable<Budget[]> {
    return this.http.get<Budget[]>(this.budgetsUrl, { params: { status } });
  }

  get(id: string): Observable<Budget> {
    return this.http.get<Budget>(this.budgetUrl(id));
  }

  progress(id: string, filters: BudgetProgressFilters = {}): Observable<BudgetProgress> {
    const params: Record<string, string> = {};
    if (filters.accountId) params['accountId'] = filters.accountId;
    if (filters.categoryId) params['categoryId'] = filters.categoryId;
    return this.http.get<BudgetProgress>(this.budgetUrl(id) + '/progress', { params });
  }

  progressTransactions(
    transactionsPath: string,
    criteria: BudgetProgressTransactionPageCriteria,
  ): Observable<TransactionPage> {
    let url: string;
    try {
      url = this.progressTransactionsUrl(transactionsPath);
    } catch (error) {
      return throwError(() => error);
    }
    return this.http.get<TransactionPage>(url, {
      params: {
        page: String(criteria.page),
        size: String(criteria.size),
        sort: criteria.sort,
        direction: criteria.direction,
      },
    });
  }

  create(request: CreateBudgetRequest): Observable<Budget> {
    return this.http.post<Budget>(this.budgetsUrl, request);
  }

  copy(id: string, request: CopyBudgetRequest): Observable<Budget> {
    return this.http.post<Budget>(this.budgetUrl(id) + '/copy', request);
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

  private progressTransactionsUrl(path: string): string {
    const localOrigin = 'http://personal-finance.local';
    const parsedPath = new URL(path, localOrigin);
    const parsedBase = new URL(this.apiBaseUrl, localOrigin);
    const expectedPrefix = parsedBase.pathname.replace(/\/$/, '') + '/budgets/';
    if (
      parsedPath.origin !== localOrigin ||
      !parsedPath.pathname.startsWith(expectedPrefix) ||
      !parsedPath.pathname.endsWith('/progress/transactions')
    ) {
      throw new Error('Invalid budget progress transaction path.');
    }
    return parsedBase.origin === localOrigin
      ? parsedPath.pathname + parsedPath.search
      : parsedBase.origin + parsedPath.pathname + parsedPath.search;
  }

  private linesUrl(id: string): string {
    return this.budgetUrl(id) + '/lines';
  }

  private lineUrl(id: string, lineId: string): string {
    return this.linesUrl(id) + '/' + encodeURIComponent(lineId);
  }
}
