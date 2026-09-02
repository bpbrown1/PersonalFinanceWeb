import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.providers';
import {
  RecurringExpense,
  RecurringExpenseOccurrence,
  RecurringExpenseStatusFilter,
  SaveRecurringExpenseRequest,
} from './recurring-expense.models';

@Injectable({ providedIn: 'root' })
export class RecurringExpensesApiService {
  private readonly http = inject(HttpClient);
  private readonly recurringExpensesUrl = inject(API_BASE_URL) + '/recurring-expenses';

  list(status: RecurringExpenseStatusFilter = 'active'): Observable<RecurringExpense[]> {
    return this.http.get<RecurringExpense[]>(this.recurringExpensesUrl, { params: { status } });
  }

  get(id: string): Observable<RecurringExpense> {
    return this.http.get<RecurringExpense>(this.recurringExpenseUrl(id));
  }

  create(request: SaveRecurringExpenseRequest): Observable<RecurringExpense> {
    return this.http.post<RecurringExpense>(this.recurringExpensesUrl, request);
  }

  update(id: string, request: SaveRecurringExpenseRequest): Observable<RecurringExpense> {
    return this.http.put<RecurringExpense>(this.recurringExpenseUrl(id), request);
  }

  archive(id: string): Observable<RecurringExpense> {
    return this.postAction(id, 'archive');
  }

  restore(id: string): Observable<RecurringExpense> {
    return this.postAction(id, 'restore');
  }

  occurrences(from: string, to: string): Observable<RecurringExpenseOccurrence[]> {
    return this.http.get<RecurringExpenseOccurrence[]>(this.recurringExpensesUrl + '/occurrences', {
      params: { from, to },
    });
  }

  match(
    recurringExpenseId: string,
    dueDate: string,
    transactionId: string,
  ): Observable<RecurringExpenseOccurrence> {
    return this.http.post<RecurringExpenseOccurrence>(this.matchUrl(recurringExpenseId, dueDate), {
      transactionId,
    });
  }

  replaceMatch(
    recurringExpenseId: string,
    dueDate: string,
    transactionId: string,
  ): Observable<RecurringExpenseOccurrence> {
    return this.http.put<RecurringExpenseOccurrence>(this.matchUrl(recurringExpenseId, dueDate), {
      transactionId,
    });
  }

  unlink(recurringExpenseId: string, dueDate: string): Observable<RecurringExpenseOccurrence> {
    return this.http.delete<RecurringExpenseOccurrence>(this.matchUrl(recurringExpenseId, dueDate));
  }

  private postAction(id: string, action: 'archive' | 'restore'): Observable<RecurringExpense> {
    return this.http.post<RecurringExpense>(this.recurringExpenseUrl(id) + '/' + action, {});
  }

  private recurringExpenseUrl(id: string): string {
    return this.recurringExpensesUrl + '/' + encodeURIComponent(id);
  }

  private matchUrl(id: string, dueDate: string): string {
    return `${this.recurringExpenseUrl(id)}/occurrences/${encodeURIComponent(dueDate)}/match`;
  }
}
