import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { finalize, forkJoin } from 'rxjs';
import { FinancialAccount } from '../../../api/accounts/account.models';
import { AccountsApiService } from '../../../api/accounts/accounts-api.service';
import { CategoriesApiService } from '../../../api/categories/categories-api.service';
import { TransactionCategory } from '../../../api/categories/category.models';
import { ApiErrorPresenter } from '../../../api/errors/api-error-presenter.service';
import { AppHttpError } from '../../../api/errors/app-http-error';
import {
  RecurringExpense,
  RecurringExpenseOccurrence,
  RecurringExpenseStatus,
  SaveRecurringExpenseRequest,
} from '../../../api/recurring-expenses/recurring-expense.models';
import { RecurringExpensesApiService } from '../../../api/recurring-expenses/recurring-expenses-api.service';
import { SubmissionState } from '../../../api/request-state/submission-state';
import { HasPendingChanges } from '../../../core/guards/pending-changes.guard';
import { NotificationService } from '../../../core/notification.service';
import { PageState } from '../../../shared/page-state/page-state';

@Component({
  selector: 'app-recurring-expenses-page',
  imports: [
    ReactiveFormsModule,
    CurrencyPipe,
    DatePipe,
    ButtonModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    PageState,
  ],
  templateUrl: './recurring-expenses-page.html',
  styleUrl: './recurring-expenses-page.scss',
})
export class RecurringExpensesPage implements OnInit, HasPendingChanges {
  private readonly api = inject(RecurringExpensesApiService);
  private readonly accountsApi = inject(AccountsApiService);
  private readonly categoriesApi = inject(CategoriesApiService);
  private readonly errors = inject(ApiErrorPresenter);
  private readonly notifications = inject(NotificationService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly definitions = signal<RecurringExpense[]>([]);
  protected readonly occurrences = signal<RecurringExpenseOccurrence[]>([]);
  protected readonly categories = signal<TransactionCategory[]>([]);
  protected readonly accounts = signal<FinancialAccount[]>([]);
  protected readonly currencies = signal<string[]>([]);
  protected readonly filter = signal<RecurringExpenseStatus>('active');
  protected readonly editingId = signal<string | 'new' | null>(null);
  protected readonly loading = signal(true);
  protected readonly previewLoading = signal(false);
  protected readonly changing = signal(false);
  protected readonly loadError = signal<AppHttpError | null>(null);
  protected readonly previewError = signal<AppHttpError | null>(null);
  protected readonly saveError = signal<AppHttpError | null>(null);
  protected readonly lifecycleError = signal<AppHttpError | null>(null);
  protected readonly submission = new SubmissionState();
  protected readonly recurrenceOptions = [
    { label: 'Monthly', value: 1 },
    { label: 'Quarterly', value: 3 },
    { label: 'Every 6 months', value: 6 },
    { label: 'Yearly', value: 12 },
  ];
  protected readonly expenseCategoryOptions = computed(() =>
    this.categories()
      .filter((category) => category.status === 'active' && category.applicability !== 'income')
      .map((category) => ({ label: this.categoryLabel(category), value: category.id })),
  );
  protected readonly currencyOptions = computed(() =>
    this.currencies().map((currency) => ({ label: currency, value: currency })),
  );
  protected readonly accountOptions = computed(() => {
    const currency = this.form.controls.currency.value;
    return [
      { label: 'No linked account', value: '' },
      ...this.accounts()
        .filter((account) => account.status === 'active' && account.currency === currency)
        .map((account) => ({ label: `${account.name} · ${account.currency}`, value: account.id })),
    ];
  });
  protected readonly form = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(100),
    ]),
    amount: this.formBuilder.control<number | null>(null, [
      Validators.required,
      Validators.min(0),
      Validators.pattern(/^\d{1,17}(\.\d{1,2})?$/),
    ]),
    currency: this.formBuilder.nonNullable.control('USD', Validators.required),
    categoryId: this.formBuilder.nonNullable.control('', Validators.required),
    accountId: this.formBuilder.nonNullable.control(''),
    anchorDate: this.formBuilder.nonNullable.control('', Validators.required),
    endDate: this.formBuilder.nonNullable.control(''),
    intervalMonths: this.formBuilder.control<number | null>(1, [
      Validators.required,
      Validators.min(1),
      Validators.pattern(/^\d+$/),
    ]),
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      definitions: this.api.list(this.filter()),
      categories: this.categoriesApi.list('all'),
      accounts: this.accountsApi.list('all'),
      currencies: this.accountsApi.listCurrencies(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ definitions, categories, accounts, currencies }) => {
          this.definitions.set(definitions);
          this.categories.set(categories);
          this.accounts.set(accounts);
          this.currencies.set(currencies);
          if (!currencies.includes(this.form.controls.currency.value)) {
            this.form.controls.currency.setValue(currencies[0] ?? '');
          }
          this.loadOccurrences();
        },
        error: (error) => this.loadError.set(this.errors.present(error)),
      });
  }

  protected selectFilter(filter: RecurringExpenseStatus): void {
    if (filter === this.filter() || !this.discardPendingChanges()) return;
    this.filter.set(filter);
    this.editingId.set(null);
    this.load();
  }

  protected openCreate(): void {
    if (!this.discardPendingChanges()) return;
    if (this.filter() !== 'active') this.filter.set('active');
    this.resetForm();
    this.editingId.set('new');
  }

  protected startEdit(definition: RecurringExpense): void {
    if (!this.discardPendingChanges()) return;
    this.editingId.set(definition.id);
    this.saveError.set(null);
    this.form.reset({
      name: definition.name,
      amount: definition.amount,
      currency: definition.currency,
      categoryId: definition.categoryId,
      accountId: definition.accountId ?? '',
      anchorDate: definition.anchorDate,
      endDate: definition.endDate ?? '',
      intervalMonths: definition.intervalMonths,
    });
    this.form.markAsPristine();
  }

  protected cancelEdit(confirmDiscard = true): void {
    if (
      confirmDiscard &&
      this.form.dirty &&
      !globalThis.confirm('Discard your recurring bill changes?')
    )
      return;
    this.editingId.set(null);
    this.saveError.set(null);
    this.resetForm();
  }

  protected save(): void {
    this.saveError.set(null);
    if (this.form.invalid || this.endDateBeforeAnchor() || this.currencies().length === 0) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const request: SaveRecurringExpenseRequest = {
      name: value.name.trim(),
      amount: Number(value.amount),
      currency: value.currency,
      categoryId: value.categoryId,
      accountId: value.accountId || null,
      anchorDate: value.anchorDate,
      endDate: value.endDate || null,
      intervalMonths: Number(value.intervalMonths),
    };
    const editingId = this.editingId();
    const operation =
      editingId === 'new' ? this.api.create(request) : this.api.update(editingId!, request);
    this.submission
      .run(() => operation)
      .subscribe({
        next: (saved) => {
          this.notifications.show(
            editingId === 'new' ? `${saved.name} was scheduled.` : `${saved.name} was updated.`,
            'success',
          );
          this.cancelEdit(false);
          this.load();
        },
        error: (error: AppHttpError) => {
          this.saveError.set(error);
          this.errors.present(error);
        },
      });
  }

  protected archive(definition: RecurringExpense): void {
    if (!globalThis.confirm(`Archive ${definition.name}? Its forecasts will stop appearing.`))
      return;
    this.applyLifecycle(this.api.archive(definition.id), `${definition.name} was archived.`);
  }

  protected restore(definition: RecurringExpense): void {
    this.applyLifecycle(this.api.restore(definition.id), `${definition.name} was restored.`);
  }

  protected onCurrencyChange(): void {
    const selected = this.accounts().find(
      (account) => account.id === this.form.controls.accountId.value,
    );
    if (selected && selected.currency !== this.form.controls.currency.value) {
      this.form.controls.accountId.setValue('');
      this.form.controls.accountId.markAsDirty();
    }
  }

  protected previewFor(definition: RecurringExpense): RecurringExpenseOccurrence[] {
    return this.occurrences()
      .filter((occurrence) => occurrence.recurringExpenseId === definition.id)
      .slice(0, 3);
  }

  protected cadenceLabel(months: number): string {
    return (
      this.recurrenceOptions.find((option) => option.value === months)?.label ??
      `Every ${months} months`
    );
  }

  protected categoryName(id: string): string {
    return this.categories().find((category) => category.id === id)?.name ?? 'Unavailable category';
  }

  protected accountName(id: string | null): string {
    if (!id) return 'No linked account';
    return this.accounts().find((account) => account.id === id)?.name ?? 'Unavailable account';
  }

  protected endDateBeforeAnchor(): boolean {
    const { anchorDate, endDate } = this.form.getRawValue();
    return !!endDate && !!anchorDate && endDate < anchorDate;
  }

  protected fieldError(field: string): string | null {
    return this.saveError()?.fieldErrors[field] ?? null;
  }

  protected formError(): string | null {
    const error = this.saveError();
    return error && Object.keys(error.fieldErrors).length === 0 ? error.userMessage : null;
  }

  hasPendingChanges(): boolean {
    return this.editingId() !== null && this.form.dirty;
  }

  @HostListener('window:beforeunload', ['$event'])
  protected warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasPendingChanges()) event.preventDefault();
  }

  private loadOccurrences(): void {
    if (this.filter() !== 'active') {
      this.occurrences.set([]);
      return;
    }
    const { from, to } = this.previewRange();
    this.previewLoading.set(true);
    this.previewError.set(null);
    this.api
      .occurrences(from, to)
      .pipe(finalize(() => this.previewLoading.set(false)))
      .subscribe({
        next: (occurrences) => this.occurrences.set(occurrences),
        error: (error) => this.previewError.set(this.errors.present(error)),
      });
  }

  private applyLifecycle(
    operation: ReturnType<RecurringExpensesApiService['archive']>,
    message: string,
  ): void {
    this.changing.set(true);
    this.lifecycleError.set(null);
    operation.pipe(finalize(() => this.changing.set(false))).subscribe({
      next: () => {
        this.notifications.show(message, 'success');
        this.load();
      },
      error: (error) => this.lifecycleError.set(this.errors.present(error)),
    });
  }

  private resetForm(): void {
    this.form.reset({
      name: '',
      amount: null,
      currency: this.currencies().includes('USD') ? 'USD' : (this.currencies()[0] ?? ''),
      categoryId: '',
      accountId: '',
      anchorDate: this.localDate(new Date()),
      endDate: '',
      intervalMonths: 1,
    });
    this.form.markAsPristine();
  }

  private previewRange(): { from: string; to: string } {
    const now = new Date();
    const end = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    return { from: this.localDate(now), to: this.localDate(end) };
  }

  private localDate(value: Date): string {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }

  private categoryLabel(category: TransactionCategory): string {
    const parent = this.categories().find((candidate) => candidate.id === category.parentId);
    return parent ? `${parent.name} › ${category.name}` : category.name;
  }

  private discardPendingChanges(): boolean {
    if (!this.hasPendingChanges()) return true;
    if (!globalThis.confirm('Discard your recurring bill changes?')) return false;
    this.cancelEdit(false);
    return true;
  }
}
