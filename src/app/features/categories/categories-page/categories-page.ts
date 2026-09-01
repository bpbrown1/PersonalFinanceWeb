import { DatePipe } from '@angular/common';
import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TagModule } from 'primeng/tag';
import { Observable, finalize, of, switchMap } from 'rxjs';
import { CategoriesApiService } from '../../../api/categories/categories-api.service';
import {
  CategoryApplicability,
  CategoryStatusFilter,
  TransactionCategory,
  UpdateCategoryRequest,
} from '../../../api/categories/category.models';
import { ApiErrorPresenter } from '../../../api/errors/api-error-presenter.service';
import { AppHttpError } from '../../../api/errors/app-http-error';
import { SubmissionState } from '../../../api/request-state/submission-state';
import { HasPendingChanges } from '../../../core/guards/pending-changes.guard';
import { NotificationService } from '../../../core/notification.service';
import { PageState } from '../../../shared/page-state/page-state';

@Component({
  selector: 'app-categories-page',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    DatePipe,
    ButtonModule,
    InputTextModule,
    SelectModule,
    SelectButtonModule,
    TagModule,
    PageState,
  ],
  templateUrl: './categories-page.html',
  styleUrl: './categories-page.scss',
})
export class CategoriesPage implements OnInit, HasPendingChanges {
  private readonly api = inject(CategoriesApiService);
  private readonly errors = inject(ApiErrorPresenter);
  private readonly notifications = inject(NotificationService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly categories = signal<TransactionCategory[]>([]);
  protected readonly filter = signal<CategoryStatusFilter>('active');
  protected readonly loading = signal(true);
  protected readonly loadError = signal<AppHttpError | null>(null);
  protected readonly createError = signal<AppHttpError | null>(null);
  protected readonly editError = signal<AppHttpError | null>(null);
  protected readonly lifecycleError = signal<{ id: string; error: AppHttpError } | null>(null);
  protected readonly editingId = signal<string | null>(null);
  protected readonly changingId = signal<string | null>(null);
  protected readonly createSubmission = new SubmissionState();
  protected readonly editSubmission = new SubmissionState();
  protected readonly mutationBusy = computed(
    () => this.createSubmission.busy() || this.editSubmission.busy() || this.changingId() !== null,
  );
  protected readonly visibleCategories = computed(() =>
    this.hierarchyOrder(this.categories()).filter((category) => category.status === this.filter()),
  );
  protected readonly activeParentOptions = computed(() =>
    this.hierarchyOrder(this.categories()).filter((category) => category.status === 'active'),
  );
  protected readonly createParentSelectOptions = computed(() => [
    { value: '', label: 'No parent (root)' },
    ...this.activeParentOptions().map((category) => ({
      value: category.id,
      label: this.parentPath(category),
    })),
  ]);
  protected readonly statusFilterOptions: Array<{
    value: CategoryStatusFilter;
    label: string;
  }> = [
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
  ];
  protected readonly applicabilityOptions: Array<{
    value: CategoryApplicability;
    label: string;
  }> = [
    { value: 'expense', label: 'Expense' },
    { value: 'income', label: 'Income' },
    { value: 'both', label: 'Income & expense' },
  ];
  protected readonly createForm = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(100),
    ]),
    applicability: this.formBuilder.nonNullable.control<CategoryApplicability>(
      'expense',
      Validators.required,
    ),
    parentId: this.formBuilder.nonNullable.control(''),
  });
  protected readonly editForm = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(100),
    ]),
    applicability: this.formBuilder.nonNullable.control<CategoryApplicability>(
      'expense',
      Validators.required,
    ),
    parentId: this.formBuilder.nonNullable.control(''),
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.lifecycleError.set(null);
    this.api
      .list('all')
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (categories) => this.categories.set(categories),
        error: (error) => this.loadError.set(this.errors.present(error)),
      });
  }

  protected selectFilter(filter: CategoryStatusFilter): void {
    if (filter === this.filter() || !this.discardEditIfNeeded()) return;
    this.filter.set(filter);
    this.cancelEdit();
    this.lifecycleError.set(null);
  }

  protected create(): void {
    this.createError.set(null);
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    const value = this.createForm.getRawValue();
    this.createSubmission
      .run(() =>
        this.api.create({
          name: value.name.trim(),
          applicability: value.applicability,
          parentId: value.parentId || null,
        }),
      )
      .subscribe({
        next: (category) => {
          this.createForm.reset({ name: '', applicability: 'expense', parentId: '' });
          this.notifications.show(`${category.name} was added.`, 'success');
          this.load();
        },
        error: (error: AppHttpError) => {
          this.createError.set(error);
          this.errors.present(error);
        },
      });
  }

  protected startEdit(category: TransactionCategory): void {
    if (category.id === this.editingId() || !this.discardEditIfNeeded()) return;
    this.editingId.set(category.id);
    this.editError.set(null);
    this.editForm.reset({
      name: category.name,
      applicability: category.applicability,
      parentId: category.parentId ?? '',
    });
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.editError.set(null);
    this.editForm.reset({ name: '', applicability: 'expense', parentId: '' });
  }

  protected saveEdit(category: TransactionCategory): void {
    this.editError.set(null);
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    const value = this.editForm.getRawValue();
    const name = value.name.trim();
    const parentId = value.parentId || null;
    const request: UpdateCategoryRequest = {};
    if (name !== category.name) request.name = name;
    if (value.applicability !== category.applicability) request.applicability = value.applicability;
    const parentChanged = parentId !== category.parentId;
    if (!Object.keys(request).length && !parentChanged) {
      this.cancelEdit();
      return;
    }

    this.editSubmission
      .run(() => {
        let operation: Observable<TransactionCategory> = Object.keys(request).length
          ? this.api.update(category.id, request)
          : of(category);
        if (parentChanged) {
          operation = operation.pipe(
            switchMap(() => this.api.updateParent(category.id, { parentId })),
          );
        }
        return operation;
      })
      .subscribe({
        next: (updated) => {
          this.notifications.show(`${updated.name} was updated.`, 'success');
          this.cancelEdit();
          this.load();
        },
        error: (error: AppHttpError) => {
          this.editError.set(error);
          this.errors.present(error);
        },
      });
  }

  protected archive(category: TransactionCategory): void {
    if (
      globalThis.confirm(
        `Archive ${category.name}? Existing transaction history will keep this category.`,
      )
    ) {
      this.changeLifecycle(category, 'archive');
    }
  }

  protected restore(category: TransactionCategory): void {
    this.changeLifecycle(category, 'restore');
  }

  protected applicabilityLabel(value: CategoryApplicability): string {
    return this.applicabilityOptions.find((option) => option.value === value)!.label;
  }

  protected parentOptions(category: TransactionCategory): TransactionCategory[] {
    const excludedIds = this.descendantIds(category.id);
    excludedIds.add(category.id);
    return this.activeParentOptions().filter((candidate) => !excludedIds.has(candidate.id));
  }

  protected editParentSelectOptions(category: TransactionCategory): Array<{
    value: string;
    label: string;
    disabled?: boolean;
  }> {
    const currentParent = this.parentCategory(category);
    return [
      { value: '', label: 'No parent (root)' },
      ...(currentParent?.status === 'archived'
        ? [
            {
              value: currentParent.id,
              label: `${currentParent.name} (archived current parent)`,
              disabled: true,
            },
          ]
        : []),
      ...this.parentOptions(category).map((candidate) => ({
        value: candidate.id,
        label: this.parentPath(candidate),
      })),
    ];
  }

  protected parentPath(category: TransactionCategory): string {
    const names: string[] = [];
    const byId = this.categoryMap();
    const visited = new Set<string>();
    let current: TransactionCategory | undefined = category;
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      names.unshift(current.name);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return names.join(' › ');
  }

  protected hierarchyDepth(category: TransactionCategory): number {
    const byId = this.categoryMap();
    const visited = new Set<string>([category.id]);
    let depth = 0;
    let parentId = category.parentId;
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      depth += 1;
      parentId = byId.get(parentId)?.parentId ?? null;
    }
    return depth;
  }

  protected parentCategory(category: TransactionCategory): TransactionCategory | null {
    return category.parentId ? (this.categoryMap().get(category.parentId) ?? null) : null;
  }

  protected nameError(error: AppHttpError | null): string | null {
    if (!error) return null;
    return (
      error.fieldErrors['name'] ??
      (error.userMessage.toLowerCase().includes('uses the name') ? error.userMessage : null)
    );
  }

  protected parentError(error: AppHttpError | null): string | null {
    if (!error) return null;
    const fieldError = error.fieldErrors['parentId'];
    if (fieldError) return fieldError;
    return error.status === 404 || (error.status === 409 && !this.nameError(error))
      ? this.actionableHierarchyError(error)
      : null;
  }

  protected formError(error: AppHttpError | null): string | null {
    return error && !this.nameError(error) && !this.parentError(error) ? error.userMessage : null;
  }

  protected lifecycleErrorMessage(error: AppHttpError): string {
    return this.actionableHierarchyError(error);
  }

  hasPendingChanges(): boolean {
    return this.createForm.dirty || (this.editingId() !== null && this.editForm.dirty);
  }

  @HostListener('window:beforeunload', ['$event'])
  protected warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasPendingChanges()) event.preventDefault();
  }

  private changeLifecycle(category: TransactionCategory, action: 'archive' | 'restore'): void {
    if (this.mutationBusy()) return;
    this.changingId.set(category.id);
    this.lifecycleError.set(null);
    this.api[action](category.id)
      .pipe(finalize(() => this.changingId.set(null)))
      .subscribe({
        next: (updated) => {
          this.notifications.show(
            `${updated.name} was ${action === 'archive' ? 'archived' : 'restored'}.`,
            'success',
          );
          this.load();
        },
        error: (error: AppHttpError) => {
          this.lifecycleError.set({ id: category.id, error });
          this.errors.present(error);
        },
      });
  }

  private hierarchyOrder(categories: TransactionCategory[]): TransactionCategory[] {
    const byId = new Map(categories.map((category) => [category.id, category]));
    const children = new Map<string, TransactionCategory[]>();
    for (const category of categories) {
      if (category.parentId && byId.has(category.parentId)) {
        const siblings = children.get(category.parentId) ?? [];
        siblings.push(category);
        children.set(category.parentId, siblings);
      }
    }
    const byName = (left: TransactionCategory, right: TransactionCategory) =>
      left.name.localeCompare(right.name);
    for (const siblings of children.values()) siblings.sort(byName);
    const roots = categories
      .filter((category) => !category.parentId || !byId.has(category.parentId))
      .sort(byName);
    const ordered: TransactionCategory[] = [];
    const visited = new Set<string>();
    const visit = (category: TransactionCategory) => {
      if (visited.has(category.id)) return;
      visited.add(category.id);
      ordered.push(category);
      for (const child of children.get(category.id) ?? []) visit(child);
    };
    for (const root of roots) visit(root);
    for (const category of [...categories].sort(byName)) visit(category);
    return ordered;
  }

  private descendantIds(categoryId: string): Set<string> {
    const descendants = new Set<string>();
    const pending = [categoryId];
    while (pending.length) {
      const parentId = pending.pop()!;
      for (const category of this.categories()) {
        if (category.parentId === parentId && !descendants.has(category.id)) {
          descendants.add(category.id);
          pending.push(category.id);
        }
      }
    }
    return descendants;
  }

  private categoryMap(): Map<string, TransactionCategory> {
    return new Map(this.categories().map((category) => [category.id, category]));
  }

  private actionableHierarchyError(error: AppHttpError): string {
    const message = error.userMessage.toLowerCase();
    if (message.includes('active children')) {
      return 'Move or archive this category’s active children before archiving it.';
    }
    if (
      message.includes('parent is archived') ||
      message.includes('while its parent is archived')
    ) {
      return 'Restore this category’s parent first, or edit this category and move it to an active parent or the root.';
    }
    if (message.includes('circular') || message.includes('own parent')) {
      return 'Choose a parent outside this category’s branch.';
    }
    if (message.includes('archived category') && message.includes('parent')) {
      return 'Choose an active parent or move the category to the root.';
    }
    if (error.status === 404) {
      return 'That category or parent is no longer available. Refresh the list and choose another parent.';
    }
    return error.userMessage;
  }

  private discardEditIfNeeded(): boolean {
    return (
      !this.editingId() ||
      !this.editForm.dirty ||
      globalThis.confirm('Discard unsaved category changes?')
    );
  }
}
