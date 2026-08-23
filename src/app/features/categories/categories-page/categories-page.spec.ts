import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CategoriesApiService } from '../../../api/categories/categories-api.service';
import { TransactionCategory } from '../../../api/categories/category.models';
import { ApiErrorPresenter } from '../../../api/errors/api-error-presenter.service';
import { AppHttpError } from '../../../api/errors/app-http-error';
import { NotificationService } from '../../../core/notification.service';
import { CategoriesPage } from './categories-page';

describe('CategoriesPage', () => {
  let api: Record<
    'list' | 'create' | 'update' | 'updateParent' | 'archive' | 'restore',
    ReturnType<typeof vi.fn>
  >;
  let notifications: { show: ReturnType<typeof vi.fn> };
  let presenter: { present: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    api = {
      list: vi.fn(() =>
        of([
          categoryFixture(),
          categoryFixture({
            id: 'category-2',
            name: 'Old category',
            status: 'archived',
            archivedAt: '2026-08-23T12:00:00Z',
          }),
        ]),
      ),
      create: vi.fn().mockReturnValue(of(categoryFixture())),
      update: vi.fn().mockReturnValue(of(categoryFixture({ name: 'Food' }))),
      updateParent: vi.fn().mockReturnValue(of(categoryFixture())),
      archive: vi.fn().mockReturnValue(of(categoryFixture({ status: 'archived' }))),
      restore: vi.fn().mockReturnValue(of(categoryFixture())),
    };
    notifications = { show: vi.fn() };
    presenter = { present: vi.fn((error) => error) };
    await TestBed.configureTestingModule({
      imports: [CategoriesPage],
      providers: [
        { provide: CategoriesApiService, useValue: api },
        { provide: NotificationService, useValue: notifications },
        { provide: ApiErrorPresenter, useValue: presenter },
      ],
    }).compileComponents();
  });

  afterEach(() => vi.restoreAllMocks());

  it('loads active categories and explains applicability without relying on icons', () => {
    const fixture = TestBed.createComponent(CategoriesPage);
    fixture.detectChanges();
    expect(api.list).toHaveBeenCalledWith('all');
    expect(fixture.nativeElement.textContent).toContain('Groceries');
    expect(fixture.nativeElement.textContent).toContain('Expense');
    expect(fixture.nativeElement.textContent).toContain('Available for new transaction activity.');
  });

  it('loads archived categories and explains that history is retained', () => {
    const fixture = TestBed.createComponent(CategoriesPage);
    fixture.detectChanges();
    fixture.nativeElement.querySelectorAll('.filters button')[1].click();
    fixture.detectChanges();
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Old category');
    expect(fixture.nativeElement.textContent).toContain(
      'Retained for existing transaction history.',
    );
  });

  it('creates a valid category with an optional parent and refreshes the list', () => {
    const fixture = TestBed.createComponent(CategoriesPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.createForm.setValue({
      name: '  Dining  ',
      applicability: 'expense',
      parentId: 'category-1',
    });
    component.create();
    fixture.detectChanges();
    expect(api.create).toHaveBeenCalledWith({
      name: 'Dining',
      applicability: 'expense',
      parentId: 'category-1',
    });
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(notifications.show).toHaveBeenCalledWith('Groceries was added.', 'success');
  });

  it('updates only changed category fields from the inline editor', () => {
    const fixture = TestBed.createComponent(CategoriesPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.startEdit(categoryFixture());
    component.editForm.controls.name.setValue('Food');
    component.saveEdit(categoryFixture());
    fixture.detectChanges();
    expect(api.update).toHaveBeenCalledWith('category-1', { name: 'Food' });
    expect(component.editingId()).toBeNull();
  });

  it('renders categories in hierarchy order with explicit relationship text', () => {
    api.list.mockReturnValue(
      of([
        categoryFixture({ id: 'child', name: 'Dining', parentId: 'parent' }),
        categoryFixture({ id: 'parent', name: 'Food' }),
        categoryFixture({ id: 'grandchild', name: 'Restaurants', parentId: 'child' }),
      ]),
    );
    const fixture = TestBed.createComponent(CategoriesPage);
    fixture.detectChanges();
    const cards = [...fixture.nativeElement.querySelectorAll('.category-card')] as HTMLElement[];
    expect(cards.map((card) => card.getAttribute('aria-label'))).toEqual([
      'Food',
      'Food › Dining',
      'Food › Dining › Restaurants',
    ]);
    expect(cards[1].textContent).toContain('Child of Food (active)');
  });

  it('reparents a category through the dedicated endpoint after saving regular changes', () => {
    const category = categoryFixture({ id: 'child', name: 'Dining', parentId: 'category-1' });
    api.list.mockReturnValue(
      of([categoryFixture(), category, categoryFixture({ id: 'parent-2', name: 'Lifestyle' })]),
    );
    const fixture = TestBed.createComponent(CategoriesPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.startEdit(category);
    component.editForm.controls.name.setValue('Restaurants');
    component.editForm.controls.parentId.setValue('parent-2');
    component.saveEdit(category);
    expect(api.update).toHaveBeenCalledWith('child', { name: 'Restaurants' });
    expect(api.updateParent).toHaveBeenCalledWith('child', { parentId: 'parent-2' });
  });

  it('moves a category to the root without sending an unrelated category update', () => {
    const category = categoryFixture({ id: 'child', name: 'Dining', parentId: 'category-1' });
    api.list.mockReturnValue(of([categoryFixture(), category]));
    const fixture = TestBed.createComponent(CategoriesPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.startEdit(category);
    component.editForm.controls.parentId.setValue('');
    component.saveEdit(category);
    expect(api.update).not.toHaveBeenCalled();
    expect(api.updateParent).toHaveBeenCalledWith('child', { parentId: null });
  });

  it('excludes the current category, descendants, and archived categories from parent choices', () => {
    const root = categoryFixture({ id: 'root', name: 'Root' });
    const child = categoryFixture({ id: 'child', name: 'Child', parentId: 'root' });
    const grandchild = categoryFixture({ id: 'grandchild', name: 'Grandchild', parentId: 'child' });
    const other = categoryFixture({ id: 'other', name: 'Other' });
    const archived = categoryFixture({ id: 'archived', name: 'Archived', status: 'archived' });
    api.list.mockReturnValue(of([root, child, grandchild, other, archived]));
    const fixture = TestBed.createComponent(CategoriesPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    expect(
      component.parentOptions(root).map((category: TransactionCategory) => category.id),
    ).toEqual(['other']);
  });

  it('confirms archive with retained-history language', () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    const fixture = TestBed.createComponent(CategoriesPage);
    fixture.detectChanges();
    (fixture.componentInstance as any).archive(categoryFixture());
    expect(globalThis.confirm).toHaveBeenCalledWith(
      'Archive Groceries? Existing transaction history will keep this category.',
    );
    expect(api.archive).toHaveBeenCalledWith('category-1');
  });

  it('shows duplicate-name conflicts inline for create and restore', () => {
    const conflict = new AppHttpError(
      'client',
      'An active transaction category already uses the name: Groceries',
      409,
    );
    api.create.mockReturnValue(throwError(() => conflict));
    api.restore.mockReturnValue(throwError(() => conflict));
    const fixture = TestBed.createComponent(CategoriesPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.createForm.setValue({ name: 'Groceries', applicability: 'expense', parentId: '' });
    component.create();
    component.restore(categoryFixture({ status: 'archived' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(conflict.userMessage);
    expect(presenter.present).toHaveBeenCalledWith(conflict);
  });

  it('shows server field validation beside the category name', () => {
    const validation = new AppHttpError('validation', 'Validation failed', 400, {
      name: 'must not be blank',
    });
    api.create.mockReturnValue(throwError(() => validation));
    const fixture = TestBed.createComponent(CategoriesPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.createForm.setValue({
      name: 'valid before normalization',
      applicability: 'expense',
      parentId: '',
    });
    component.create();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#new-category-name-error').textContent).toContain(
      'must not be blank',
    );
  });

  it('turns hierarchy and lifecycle conflicts into actionable guidance', () => {
    const cycle = new AppHttpError(
      'client',
      'Category parent assignment would create a circular relationship',
      409,
    );
    const children = new AppHttpError(
      'client',
      'A category with active children cannot be archived',
      409,
    );
    api.updateParent.mockReturnValue(throwError(() => cycle));
    api.archive.mockReturnValue(throwError(() => children));
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    const fixture = TestBed.createComponent(CategoriesPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    const category = categoryFixture();
    component.startEdit(category);
    component.editForm.controls.parentId.setValue('category-2');
    component.saveEdit(category);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Choose a parent outside this category’s branch.',
    );
    component.cancelEdit();
    component.archive(category);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Move or archive this category’s active children before archiving it.',
    );
  });
});

function categoryFixture(overrides: Partial<TransactionCategory> = {}): TransactionCategory {
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
    ...overrides,
  };
}
