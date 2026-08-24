import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, finalize, forkJoin } from 'rxjs';
import {
  Budget,
  BudgetLine,
  BudgetStatus,
  SaveBudgetLineRequest,
} from '../../../api/budgets/budget.models';
import { BudgetsApiService } from '../../../api/budgets/budgets-api.service';
import { CategoriesApiService } from '../../../api/categories/categories-api.service';
import { TransactionCategory } from '../../../api/categories/category.models';
import { ApiErrorPresenter } from '../../../api/errors/api-error-presenter.service';
import { AppHttpError } from '../../../api/errors/app-http-error';
import { SubmissionState } from '../../../api/request-state/submission-state';
import { HasPendingChanges } from '../../../core/guards/pending-changes.guard';
import { NotificationService } from '../../../core/notification.service';
import { PageState } from '../../../shared/page-state/page-state';

@Component({
  selector: 'app-budgets-page',
  imports: [ReactiveFormsModule, CurrencyPipe, DatePipe, PageState],
  templateUrl: './budgets-page.html',
  styleUrl: './budgets-page.scss',
})
export class BudgetsPage implements OnInit, HasPendingChanges {
  private readonly api = inject(BudgetsApiService);
  private readonly categoriesApi = inject(CategoriesApiService);
  private readonly errors = inject(ApiErrorPresenter);
  private readonly notifications = inject(NotificationService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly budgets = signal<Budget[]>([]);
  protected readonly categories = signal<TransactionCategory[]>([]);
  protected readonly filter = signal<BudgetStatus>('active');
  protected readonly selectedBudget = signal<Budget | null>(null);
  protected readonly loading = signal(true);
  protected readonly detailLoading = signal(false);
  protected readonly loadError = signal<AppHttpError | null>(null);
  protected readonly detailError = signal<AppHttpError | null>(null);
  protected readonly createError = signal<AppHttpError | null>(null);
  protected readonly editError = signal<AppHttpError | null>(null);
  protected readonly lineError = signal<AppHttpError | null>(null);
  protected readonly lifecycleError = signal<AppHttpError | null>(null);
  protected readonly editingBudget = signal(false);
  protected readonly editingLineId = signal<string | null>(null);
  protected readonly changing = signal(false);
  protected readonly createSubmission = new SubmissionState();
  protected readonly editSubmission = new SubmissionState();
  protected readonly lineSubmission = new SubmissionState();
  protected readonly mutationBusy = computed(
    () =>
      this.createSubmission.busy() ||
      this.editSubmission.busy() ||
      this.lineSubmission.busy() ||
      this.changing(),
  );
  protected readonly expenseCategories = computed(() =>
    this.categories().filter(
      (category) => category.status === 'active' && category.applicability !== 'income',
    ),
  );
  protected readonly createForm = this.buildCreateForm();
  protected readonly editForm = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(100),
    ]),
    currency: this.formBuilder.nonNullable.control('USD', [
      Validators.required,
      Validators.pattern(/^[A-Za-z]{3}$/),
    ]),
    month: this.formBuilder.nonNullable.control(this.currentMonth(), Validators.required),
  });
  protected readonly lineForm = this.buildLineForm();

  ngOnInit(): void {
    this.addInitialLine();
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({ budgets: this.api.list(this.filter()), categories: this.categoriesApi.list('all') })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ budgets, categories }) => {
          this.budgets.set(budgets);
          this.categories.set(categories);
          const selectedId = this.selectedBudget()?.id;
          if (selectedId)
            this.selectedBudget.set(budgets.find((item) => item.id === selectedId) ?? null);
        },
        error: (error) => this.loadError.set(this.errors.present(error)),
      });
  }

  protected selectFilter(filter: BudgetStatus): void {
    if (filter === this.filter() || !this.discardPendingChanges()) return;
    this.filter.set(filter);
    this.closeDetails();
    this.load();
  }

  protected selectBudget(budget: Budget): void {
    if (!this.discardPendingChanges()) return;
    this.detailLoading.set(true);
    this.detailError.set(null);
    this.api
      .get(budget.id)
      .pipe(finalize(() => this.detailLoading.set(false)))
      .subscribe({
        next: (detail) => this.selectedBudget.set(detail),
        error: (error) => this.detailError.set(this.errors.present(error)),
      });
  }

  protected closeDetails(): void {
    this.selectedBudget.set(null);
    this.cancelBudgetEdit();
    this.cancelLineEdit();
    this.detailError.set(null);
  }

  protected addInitialLine(): void {
    this.createForm.controls.lines.push(this.buildLineForm());
    if (this.createForm.controls.lines.length > 1) this.createForm.markAsDirty();
  }

  protected removeInitialLine(index: number): void {
    this.createForm.controls.lines.removeAt(index);
    this.createForm.markAsDirty();
  }

  protected initialCategoryOptions(index: number): TransactionCategory[] {
    const current = this.createForm.controls.lines.at(index).controls.categoryId.value;
    const selectedElsewhere = new Set(
      this.createForm.controls.lines.controls
        .filter((_, rowIndex) => rowIndex !== index)
        .map((line) => line.controls.categoryId.value)
        .filter(Boolean),
    );
    return this.expenseCategories().filter(
      (category) => category.id === current || !selectedElsewhere.has(category.id),
    );
  }

  protected initialLineIncomplete(index: number): boolean {
    const value = this.createForm.controls.lines.at(index).getRawValue();
    return !!value.categoryId !== (value.plannedAmount !== null);
  }

  protected initialLineDuplicate(index: number): boolean {
    const value = this.createForm.controls.lines.at(index).controls.categoryId.value;
    return (
      !!value &&
      this.createForm.controls.lines.controls.some(
        (line, rowIndex) => rowIndex !== index && line.controls.categoryId.value === value,
      )
    );
  }

  protected initialPlannedTotal(): number {
    return (
      this.createForm.controls.lines.controls.reduce(
        (total, line) => total + Math.round(Number(line.controls.plannedAmount.value ?? 0) * 100),
        0,
      ) / 100
    );
  }

  protected create(): void {
    this.createError.set(null);
    if (!this.createFormValid()) return;
    const value = this.createForm.getRawValue();
    this.createSubmission
      .run(() =>
        this.api.create({
          name: value.name.trim(),
          currency: value.currency.toUpperCase(),
          ...this.monthRange(value.month),
          lines: value.lines
            .filter((line) => line.categoryId && line.plannedAmount !== null)
            .map((line) => ({
              categoryId: line.categoryId,
              plannedAmount: Number(line.plannedAmount),
            })),
        }),
      )
      .subscribe({
        next: (budget) => {
          this.resetCreateForm();
          this.notifications.show(`${budget.name} was created.`, 'success');
          this.selectedBudget.set(budget);
          this.load();
        },
        error: (error: AppHttpError) => {
          this.createError.set(error);
          this.errors.present(error);
        },
      });
  }

  protected startBudgetEdit(budget: Budget): void {
    this.cancelLineEdit();
    this.editingBudget.set(true);
    this.editError.set(null);
    this.editForm.reset({
      name: budget.name,
      currency: budget.currency,
      month: budget.startDate.slice(0, 7),
    });
  }

  protected cancelBudgetEdit(): void {
    this.editingBudget.set(false);
    this.editError.set(null);
    this.editForm.reset({ name: '', currency: 'USD', month: this.currentMonth() });
  }

  protected saveBudget(budget: Budget): void {
    this.editError.set(null);
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    const value = this.editForm.getRawValue();
    this.editSubmission
      .run(() =>
        this.api.update(budget.id, {
          name: value.name.trim(),
          currency: value.currency.toUpperCase(),
          ...this.monthRange(value.month),
        }),
      )
      .subscribe({
        next: (updated) => {
          this.notifications.show(`${updated.name} was updated.`, 'success');
          this.selectedBudget.set(updated);
          this.cancelBudgetEdit();
          this.load();
        },
        error: (error: AppHttpError) => {
          this.editError.set(error);
          this.errors.present(error);
        },
      });
  }

  protected availableLineCategories(budget: Budget, currentLineId = ''): TransactionCategory[] {
    const used = new Set(
      budget.lines.filter((line) => line.id !== currentLineId).map((line) => line.categoryId),
    );
    const currentCategory = budget.lines.find((line) => line.id === currentLineId)?.categoryId;
    return this.categories().filter(
      (category) =>
        category.applicability !== 'income' &&
        ((category.status === 'active' && !used.has(category.id)) ||
          category.id === currentCategory),
    );
  }

  protected startLineEdit(line: BudgetLine): void {
    this.editingBudget.set(false);
    this.editingLineId.set(line.id);
    this.lineError.set(null);
    this.lineForm.reset({ categoryId: line.categoryId, plannedAmount: line.plannedAmount });
  }

  protected startAddLine(): void {
    this.editingBudget.set(false);
    this.editingLineId.set('new');
    this.lineError.set(null);
    this.lineForm.reset({ categoryId: '', plannedAmount: null });
  }

  protected cancelLineEdit(): void {
    this.editingLineId.set(null);
    this.lineError.set(null);
    this.lineForm.reset({ categoryId: '', plannedAmount: null });
  }

  protected saveLine(budget: Budget): void {
    this.lineError.set(null);
    if (this.lineForm.invalid) {
      this.lineForm.markAllAsTouched();
      return;
    }
    const request = this.lineForm.getRawValue() as SaveBudgetLineRequest;
    const lineId = this.editingLineId();
    const operation =
      lineId === 'new'
        ? this.api.addLine(budget.id, request)
        : this.api.updateLine(budget.id, lineId!, request);
    this.lineSubmission
      .run(() => operation)
      .subscribe({
        next: (updated) => {
          this.notifications.show(
            lineId === 'new' ? 'Budget line added.' : 'Budget line updated.',
            'success',
          );
          this.selectedBudget.set(updated);
          this.cancelLineEdit();
          this.load();
        },
        error: (error: AppHttpError) => {
          this.lineError.set(error);
          this.errors.present(error);
        },
      });
  }

  protected moveLine(budget: Budget, index: number, direction: -1 | 1): void {
    const destination = index + direction;
    if (destination < 0 || destination >= budget.lines.length) return;
    const ids = budget.lines.map((line) => line.id);
    [ids[index], ids[destination]] = [ids[destination], ids[index]];
    this.applyMutation(
      this.api.reorderLines(budget.id, { lineIds: ids }),
      'Budget line order updated.',
    );
  }

  protected archiveBudget(budget: Budget): void {
    if (globalThis.confirm(`Archive ${budget.name}? Restore it before making more changes.`))
      this.applyMutation(this.api.archive(budget.id), `${budget.name} was archived.`, true);
  }

  protected restoreBudget(budget: Budget): void {
    this.applyMutation(this.api.restore(budget.id), `${budget.name} was restored.`, true);
  }

  protected archiveLine(budget: Budget, line: BudgetLine): void {
    if (globalThis.confirm(`Archive the ${this.categoryName(line.categoryId)} budget line?`))
      this.applyMutation(this.api.archiveLine(budget.id, line.id), 'Budget line archived.');
  }

  protected restoreLine(budget: Budget, line: BudgetLine): void {
    this.applyMutation(this.api.restoreLine(budget.id, line.id), 'Budget line restored.');
  }

  protected categoryName(id: string): string {
    return this.categories().find((category) => category.id === id)?.name ?? 'Unavailable category';
  }

  protected periodLabel(budget: Budget): string {
    const [year, month] = budget.startDate.split('-').map(Number);
    return new Intl.DateTimeFormat(undefined, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, 1)));
  }

  protected fieldError(error: AppHttpError | null, field: string): string | null {
    return error?.fieldErrors[field] ?? null;
  }

  protected formError(error: AppHttpError | null): string | null {
    return error && Object.keys(error.fieldErrors).length === 0 ? error.userMessage : null;
  }

  hasPendingChanges(): boolean {
    return (
      this.createForm.dirty ||
      (this.editingBudget() && this.editForm.dirty) ||
      (this.editingLineId() !== null && this.lineForm.dirty)
    );
  }

  @HostListener('window:beforeunload', ['$event'])
  protected warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasPendingChanges()) event.preventDefault();
  }

  private buildCreateForm() {
    return this.formBuilder.group({
      name: this.formBuilder.nonNullable.control('', [
        Validators.required,
        Validators.maxLength(100),
      ]),
      currency: this.formBuilder.nonNullable.control('USD', [
        Validators.required,
        Validators.pattern(/^[A-Za-z]{3}$/),
      ]),
      month: this.formBuilder.nonNullable.control(this.currentMonth(), Validators.required),
      lines: this.formBuilder.array<ReturnType<BudgetsPage['buildLineForm']>>([]),
    });
  }

  private buildLineForm() {
    return this.formBuilder.group({
      categoryId: this.formBuilder.nonNullable.control('', Validators.required),
      plannedAmount: this.formBuilder.control<number | null>(null, [
        Validators.required,
        Validators.min(0),
        Validators.pattern(/^\d{1,17}(\.\d{1,2})?$/),
      ]),
    });
  }

  private createFormValid(): boolean {
    const lines = this.createForm.controls.lines.controls;
    const invalidLines = lines.some(
      (_, index) => this.initialLineIncomplete(index) || this.initialLineDuplicate(index),
    );
    const completeLinesInvalid = lines.some((line) => {
      const value = line.getRawValue();
      return (!!value.categoryId || value.plannedAmount !== null) && line.invalid;
    });
    if (
      this.createForm.controls.name.invalid ||
      this.createForm.controls.currency.invalid ||
      this.createForm.controls.month.invalid ||
      invalidLines ||
      completeLinesInvalid
    ) {
      this.createForm.markAllAsTouched();
      return false;
    }
    return true;
  }

  private resetCreateForm(): void {
    this.createForm.controls.lines.clear();
    this.createForm.reset({ name: '', currency: 'USD', month: this.currentMonth(), lines: [] });
    this.addInitialLine();
    this.createForm.markAsPristine();
  }

  private monthRange(month: string): { startDate: string; endDate: string } {
    const [year, monthNumber] = month.split('-').map(Number);
    const endDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    return { startDate: `${month}-01`, endDate: `${month}-${String(endDay).padStart(2, '0')}` };
  }

  private currentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private applyMutation(
    operation: Observable<Budget>,
    message: string,
    closesDetail = false,
  ): void {
    this.changing.set(true);
    this.lifecycleError.set(null);
    operation.pipe(finalize(() => this.changing.set(false))).subscribe({
      next: (updated) => {
        this.notifications.show(message, 'success');
        this.selectedBudget.set(closesDetail ? null : updated);
        this.load();
      },
      error: (error) => this.lifecycleError.set(this.errors.present(error)),
    });
  }

  private discardPendingChanges(): boolean {
    if (!this.hasPendingChanges()) return true;
    if (!globalThis.confirm('Discard your unsaved budget changes?')) return false;
    this.resetCreateForm();
    this.cancelBudgetEdit();
    this.cancelLineEdit();
    return true;
  }
}
