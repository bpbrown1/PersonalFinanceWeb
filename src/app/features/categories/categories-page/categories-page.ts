import { DatePipe } from '@angular/common';
import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { CategoriesApiService } from '../../../api/categories/categories-api.service';
import { CategoryApplicability, CategoryStatusFilter, TransactionCategory, UpdateCategoryRequest } from '../../../api/categories/category.models';
import { ApiErrorPresenter } from '../../../api/errors/api-error-presenter.service';
import { AppHttpError } from '../../../api/errors/app-http-error';
import { SubmissionState } from '../../../api/request-state/submission-state';
import { HasPendingChanges } from '../../../core/guards/pending-changes.guard';
import { NotificationService } from '../../../core/notification.service';
import { PageState } from '../../../shared/page-state/page-state';

@Component({
  selector: 'app-categories-page',
  imports: [ReactiveFormsModule, DatePipe, PageState],
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
  protected readonly applicabilityOptions: ReadonlyArray<{ value: CategoryApplicability; label: string }> = [
    { value: 'expense', label: 'Expense' },
    { value: 'income', label: 'Income' },
    { value: 'both', label: 'Income & expense' },
  ];
  protected readonly createForm = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [Validators.required, Validators.maxLength(100)]),
    applicability: this.formBuilder.nonNullable.control<CategoryApplicability>('expense', Validators.required),
  });
  protected readonly editForm = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [Validators.required, Validators.maxLength(100)]),
    applicability: this.formBuilder.nonNullable.control<CategoryApplicability>('expense', Validators.required),
  });

  ngOnInit(): void { this.load(); }

  protected load(): void {
    this.loading.set(true); this.loadError.set(null); this.lifecycleError.set(null);
    this.api.list(this.filter()).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (categories) => this.categories.set(categories),
      error: (error) => this.loadError.set(this.errors.present(error)),
    });
  }

  protected selectFilter(filter: CategoryStatusFilter): void {
    if (filter === this.filter() || !this.discardEditIfNeeded()) return;
    this.filter.set(filter); this.cancelEdit(); this.load();
  }

  protected create(): void {
    this.createError.set(null);
    if (this.createForm.invalid) { this.createForm.markAllAsTouched(); return; }
    const value = this.createForm.getRawValue();
    this.createSubmission.run(() => this.api.create({ name: value.name.trim(), applicability: value.applicability })).subscribe({
      next: (category) => {
        this.createForm.reset({ name: '', applicability: 'expense' });
        this.notifications.show(`${category.name} was added.`, 'success'); this.load();
      },
      error: (error: AppHttpError) => { this.createError.set(error); this.errors.present(error); },
    });
  }

  protected startEdit(category: TransactionCategory): void {
    if (category.id === this.editingId() || !this.discardEditIfNeeded()) return;
    this.editingId.set(category.id); this.editError.set(null);
    this.editForm.reset({ name: category.name, applicability: category.applicability });
  }

  protected cancelEdit(): void {
    this.editingId.set(null); this.editError.set(null);
    this.editForm.reset({ name: '', applicability: 'expense' });
  }

  protected saveEdit(category: TransactionCategory): void {
    this.editError.set(null);
    if (this.editForm.invalid) { this.editForm.markAllAsTouched(); return; }
    const value = this.editForm.getRawValue(); const name = value.name.trim();
    const request: UpdateCategoryRequest = {};
    if (name !== category.name) request.name = name;
    if (value.applicability !== category.applicability) request.applicability = value.applicability;
    if (!Object.keys(request).length) { this.cancelEdit(); return; }
    this.editSubmission.run(() => this.api.update(category.id, request)).subscribe({
      next: (updated) => { this.notifications.show(`${updated.name} was updated.`, 'success'); this.cancelEdit(); this.load(); },
      error: (error: AppHttpError) => { this.editError.set(error); this.errors.present(error); },
    });
  }

  protected archive(category: TransactionCategory): void {
    if (globalThis.confirm(`Archive ${category.name}? Existing transaction history will keep this category.`)) this.changeLifecycle(category, 'archive');
  }

  protected restore(category: TransactionCategory): void { this.changeLifecycle(category, 'restore'); }

  protected applicabilityLabel(value: CategoryApplicability): string {
    return this.applicabilityOptions.find((option) => option.value === value)!.label;
  }

  protected nameError(error: AppHttpError | null): string | null {
    return error?.fieldErrors['name'] ?? error?.userMessage ?? null;
  }

  hasPendingChanges(): boolean {
    return this.createForm.dirty || (this.editingId() !== null && this.editForm.dirty);
  }

  @HostListener('window:beforeunload', ['$event'])
  protected warnBeforeUnload(event: BeforeUnloadEvent): void { if (this.hasPendingChanges()) event.preventDefault(); }

  private changeLifecycle(category: TransactionCategory, action: 'archive' | 'restore'): void {
    if (this.changingId()) return;
    this.changingId.set(category.id); this.lifecycleError.set(null);
    this.api[action](category.id).pipe(finalize(() => this.changingId.set(null))).subscribe({
      next: (updated) => { this.notifications.show(`${updated.name} was ${action === 'archive' ? 'archived' : 'restored'}.`, 'success'); this.load(); },
      error: (error: AppHttpError) => { this.lifecycleError.set({ id: category.id, error }); this.errors.present(error); },
    });
  }

  private discardEditIfNeeded(): boolean {
    return !this.editingId() || !this.editForm.dirty || globalThis.confirm('Discard unsaved category changes?');
  }
}
