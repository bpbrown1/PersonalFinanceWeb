import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.providers';
import {
  CategoryStatusFilter,
  CreateCategoryRequest,
  TransactionCategory,
  UpdateCategoryParentRequest,
  UpdateCategoryRequest,
} from './category.models';

@Injectable({ providedIn: 'root' })
export class CategoriesApiService {
  private readonly http = inject(HttpClient);
  private readonly categoriesUrl = inject(API_BASE_URL) + '/categories';

  list(status: CategoryStatusFilter = 'active'): Observable<TransactionCategory[]> {
    return this.http.get<TransactionCategory[]>(this.categoriesUrl, { params: { status } });
  }

  get(id: string): Observable<TransactionCategory> {
    return this.http.get<TransactionCategory>(this.categoryUrl(id));
  }

  create(request: CreateCategoryRequest): Observable<TransactionCategory> {
    return this.http.post<TransactionCategory>(this.categoriesUrl, request);
  }

  update(id: string, request: UpdateCategoryRequest): Observable<TransactionCategory> {
    return this.http.patch<TransactionCategory>(this.categoryUrl(id), request);
  }

  updateParent(id: string, request: UpdateCategoryParentRequest): Observable<TransactionCategory> {
    return this.http.patch<TransactionCategory>(this.categoryUrl(id) + '/parent', request);
  }

  archive(id: string): Observable<TransactionCategory> {
    return this.http.post<TransactionCategory>(this.categoryUrl(id) + '/archive', {});
  }

  restore(id: string): Observable<TransactionCategory> {
    return this.http.post<TransactionCategory>(this.categoryUrl(id) + '/restore', {});
  }

  private categoryUrl(id: string): string {
    return this.categoriesUrl + '/' + encodeURIComponent(id);
  }
}
