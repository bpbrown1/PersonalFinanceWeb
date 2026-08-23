import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../api.providers';
import { apiErrorInterceptor } from '../errors/api-error.interceptor';
import { CategoriesApiService } from './categories-api.service';
import { CreateCategoryRequest, TransactionCategory } from './category.models';

describe('CategoriesApiService', () => {
  let service: CategoriesApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CategoriesApiService,
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:8080/api/v1' },
      ],
    });
    service = TestBed.inject(CategoriesApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('retrieves categories using the requested lifecycle filter', async () => {
    const result = firstValueFrom(service.list('archived'));
    const request = http.expectOne('http://localhost:8080/api/v1/categories?status=archived');
    expect(request.request.method).toBe('GET');
    request.flush([categoryFixture()]);
    await expect(result).resolves.toEqual([categoryFixture()]);
  });

  it('creates a category using the documented contract', async () => {
    const body: CreateCategoryRequest = {
      name: 'Dining',
      applicability: 'expense',
      parentId: 'category-1',
    };
    const result = firstValueFrom(service.create(body));
    const request = http.expectOne('http://localhost:8080/api/v1/categories');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    request.flush(categoryFixture());
    await expect(result).resolves.toEqual(categoryFixture());
  });

  it('retrieves and updates safely encoded category identifiers', async () => {
    const result = firstValueFrom(service.get('category/with space'));
    http
      .expectOne('http://localhost:8080/api/v1/categories/category%2Fwith%20space')
      .flush(categoryFixture());
    await result;
    const updated = firstValueFrom(
      service.update('category/with space', { name: 'Food', applicability: 'both' }),
    );
    const request = http.expectOne(
      'http://localhost:8080/api/v1/categories/category%2Fwith%20space',
    );
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ name: 'Food', applicability: 'both' });
    request.flush({ ...categoryFixture(), name: 'Food', applicability: 'both' });
    await updated;
  });

  it('assigns a parent or moves a category to the root through the hierarchy endpoint', async () => {
    for (const parentId of ['parent-1', null]) {
      const result = firstValueFrom(service.updateParent('category/with space', { parentId }));
      const request = http.expectOne(
        'http://localhost:8080/api/v1/categories/category%2Fwith%20space/parent',
      );
      expect(request.request.method).toBe('PATCH');
      expect(request.request.body).toEqual({ parentId });
      request.flush({ ...categoryFixture(), parentId });
      await expect(result).resolves.toEqual({ ...categoryFixture(), parentId });
    }
  });

  it('archives and restores without exposing deletion', async () => {
    for (const action of ['archive', 'restore'] as const) {
      const result = firstValueFrom(service[action]('category-1'));
      const request = http.expectOne(
        `http://localhost:8080/api/v1/categories/category-1/${action}`,
      );
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({});
      request.flush(categoryFixture());
      await result;
    }
  });
});

function categoryFixture(): TransactionCategory {
  return {
    id: 'category-1',
    ownerId: 'owner-1',
    name: 'Groceries',
    applicability: 'expense',
    parentId: null,
    status: 'active',
    archivedAt: null,
    createdAt: '2026-08-23T12:00:00Z',
    updatedAt: '2026-08-23T12:00:00Z',
  };
}
