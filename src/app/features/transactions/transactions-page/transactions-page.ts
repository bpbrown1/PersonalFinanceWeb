import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { AccountsApiService } from '../../../api/accounts/accounts-api.service';
import { FinancialAccount } from '../../../api/accounts/account.models';
import { CategoriesApiService } from '../../../api/categories/categories-api.service';
import { TransactionCategory } from '../../../api/categories/category.models';
import { ApiErrorPresenter } from '../../../api/errors/api-error-presenter.service';
import { AppHttpError } from '../../../api/errors/app-http-error';
import { SubmissionState } from '../../../api/request-state/submission-state';
import {
  FinancialTransaction,
  SaveTransactionRequest,
  TransactionStatus,
  TransactionSummary,
  TransactionType,
} from '../../../api/transactions/transaction.models';
import { TransactionsApiService } from '../../../api/transactions/transactions-api.service';
import { HasPendingChanges } from '../../../core/guards/pending-changes.guard';
import { NotificationService } from '../../../core/notification.service';
import { PageState } from '../../../shared/page-state/page-state';

type SummaryPeriod = 'this_month' | 'last_month' | 'year_to_date' | 'custom' | 'all_time';

@Component({
  selector: 'app-transactions-page',
  imports: [ReactiveFormsModule, CurrencyPipe, DatePipe, PageState],
  templateUrl: './transactions-page.html',
  styleUrl: './transactions-page.scss',
})
export class TransactionsPage implements OnInit, HasPendingChanges {
  private readonly transactionsApi = inject(TransactionsApiService);
  private readonly accountsApi = inject(AccountsApiService);
  private readonly categoriesApi = inject(CategoriesApiService);
  private readonly errors = inject(ApiErrorPresenter);
  private readonly notifications = inject(NotificationService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly transactions = signal<FinancialTransaction[]>([]);
  protected readonly accounts = signal<FinancialAccount[]>([]);
  protected readonly categories = signal<TransactionCategory[]>([]);
  protected readonly filter = signal<TransactionStatus>('active');
  protected readonly loading = signal(true);
  protected readonly loadError = signal<AppHttpError | null>(null);
  protected readonly summaries = signal<TransactionSummary[]>([]);
  protected readonly summaryLoading = signal(true);
  protected readonly summaryError = signal<AppHttpError | null>(null);
  protected readonly createError = signal<AppHttpError | null>(null);
  protected readonly editError = signal<AppHttpError | null>(null);
  protected readonly lifecycleError = signal<{ id: string; error: AppHttpError } | null>(null);
  protected readonly editingId = signal<string | null>(null);
  protected readonly changingId = signal<string | null>(null);
  protected readonly createSubmission = new SubmissionState();
  protected readonly editSubmission = new SubmissionState();
  protected readonly today = this.localToday();
  protected readonly summaryPeriod = signal<SummaryPeriod>('this_month');
  protected readonly customSummaryFrom = signal(this.firstDayOfMonth(new Date()));
  protected readonly customSummaryTo = signal(this.today);
  protected readonly summaryPeriodOptions: ReadonlyArray<{
    value: SummaryPeriod;
    label: string;
  }> = [
    { value: 'this_month', label: 'This month' },
    { value: 'last_month', label: 'Last month' },
    { value: 'year_to_date', label: 'Year to date' },
    { value: 'custom', label: 'Custom range' },
    { value: 'all_time', label: 'All time' },
  ];
  protected readonly typeOptions: ReadonlyArray<{ value: TransactionType; label: string }> = [
    { value: 'expense', label: 'Expense' },
    { value: 'income', label: 'Income' },
  ];
  protected readonly createForm = this.buildForm();
  protected readonly editForm = this.buildForm();
  protected readonly mutationBusy = computed(
    () => this.createSubmission.busy() || this.editSubmission.busy() || this.changingId() !== null,
  );
  protected readonly visibleTransactions = computed(() => {
    const range = this.summaryRange();
    return this.transactions().filter(
      (transaction) =>
        transaction.status === this.filter() &&
        (range === null ||
          (transaction.transactionDate >= range.from && transaction.transactionDate <= range.to)),
    );
  });
  protected readonly activeAccounts = computed(() =>
    this.accounts().filter((account) => account.status === 'active'),
  );
  protected readonly summaryRange = computed(() => this.rangeFor(this.summaryPeriod()));
  protected readonly summaryRangeValid = computed(() => {
    const range = this.summaryRange();
    return range === null || range.from <= range.to;
  });
  protected readonly summaryPeriodLabel = computed(
    () => this.summaryPeriodOptions.find((option) => option.value === this.summaryPeriod())!.label,
  );
  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loadSummary();
    this.loading.set(true);
    this.loadError.set(null);
    this.lifecycleError.set(null);
    forkJoin({
      transactions: this.transactionsApi.list('all'),
      accounts: this.accountsApi.list('all'),
      categories: this.categoriesApi.list('all'),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ transactions, accounts, categories }) => {
          this.transactions.set(transactions);
          this.accounts.set(accounts);
          this.categories.set(categories);
        },
        error: (error) => this.loadError.set(this.errors.present(error)),
      });
  }

  protected create(): void {
    this.createError.set(null);
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    this.createSubmission
      .run(() => this.transactionsApi.create(this.toRequest(this.createForm)))
      .subscribe({
        next: (transaction) => {
          this.createForm.reset(this.emptyFormValue());
          this.createForm.markAsPristine();
          this.notifications.show(`${transaction.description} was recorded.`, 'success');
          this.load();
        },
        error: (error: AppHttpError) => {
          this.createError.set(error);
          this.errors.present(error);
        },
      });
  }

  protected startEdit(transaction: FinancialTransaction): void {
    if (transaction.id === this.editingId() || !this.discardEditIfNeeded()) return;
    this.editingId.set(transaction.id);
    this.editError.set(null);
    this.editForm.reset({
      accountId: transaction.accountId,
      amount: transaction.amount,
      transactionDate: transaction.transactionDate,
      description: transaction.description,
      type: transaction.type,
      categoryId: transaction.categoryId ?? '',
      merchantPayee: transaction.merchantPayee ?? '',
      notes: transaction.notes ?? '',
      externalReference: transaction.externalReference ?? '',
    });
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.editError.set(null);
    this.editForm.reset(this.emptyFormValue());
  }

  protected saveEdit(transaction: FinancialTransaction): void {
    this.editError.set(null);
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    this.editSubmission
      .run(() => this.transactionsApi.update(transaction.id, this.toRequest(this.editForm)))
      .subscribe({
        next: (updated) => {
          this.notifications.show(`${updated.description} was updated.`, 'success');
          this.cancelEdit();
          this.load();
        },
        error: (error: AppHttpError) => {
          this.editError.set(error);
          this.errors.present(error);
        },
      });
  }

  protected deleteTransaction(transaction: FinancialTransaction): void {
    if (
      globalThis.confirm(
        `Delete ${transaction.description}? Its balance impact will be reversed, and the transaction can be restored.`,
      )
    ) {
      this.changeLifecycle(transaction, 'delete');
    }
  }

  protected restore(transaction: FinancialTransaction): void {
    this.changeLifecycle(transaction, 'restore');
  }

  protected selectFilter(filter: TransactionStatus): void {
    if (filter === this.filter() || !this.discardEditIfNeeded()) return;
    this.filter.set(filter);
    this.cancelEdit();
  }

  protected selectSummaryPeriod(period: string): void {
    const option = this.summaryPeriodOptions.find((candidate) => candidate.value === period);
    if (!option) return;
    this.summaryPeriod.set(option.value);
    this.loadSummary();
  }

  protected setCustomSummaryFrom(value: string): void {
    this.customSummaryFrom.set(value);
    this.reloadValidSummaryRange();
  }

  protected setCustomSummaryTo(value: string): void {
    this.customSummaryTo.set(value);
    this.reloadValidSummaryRange();
  }

  protected loadSummary(): void {
    if (!this.summaryRangeValid()) {
      this.summaries.set([]);
      this.summaryError.set(null);
      return;
    }
    const range = this.summaryRange();
    this.summaryLoading.set(true);
    this.summaryError.set(null);
    this.transactionsApi
      .summarize(range?.from, range?.to)
      .pipe(finalize(() => this.summaryLoading.set(false)))
      .subscribe({
        next: (summaries) => this.summaries.set(summaries),
        error: (error) => this.summaryError.set(this.errors.present(error)),
      });
  }

  protected onTypeChanged(which: 'create' | 'edit'): void {
    const form = which === 'create' ? this.createForm : this.editForm;
    const selected = this.category(form.controls.categoryId.value);
    if (selected && !this.categoryMatches(selected, form.controls.type.value))
      form.controls.categoryId.setValue('');
  }

  protected categoryOptions(type: TransactionType, currentId = ''): TransactionCategory[] {
    return this.categories().filter(
      (category) =>
        this.categoryMatches(category, type) &&
        (category.status === 'active' || category.id === currentId),
    );
  }

  protected accountOptions(currentId = ''): FinancialAccount[] {
    return this.accounts().filter(
      (account) => account.status === 'active' || account.id === currentId,
    );
  }

  protected account(id: string): FinancialAccount | undefined {
    return this.accounts().find((account) => account.id === id);
  }
  protected category(id: string | null): TransactionCategory | undefined {
    return id ? this.categories().find((category) => category.id === id) : undefined;
  }
  protected accountLabel(id: string): string {
    const account = this.account(id);
    return account ? `${account.name} · ${account.currency}` : 'Unavailable account';
  }
  protected currency(transaction: FinancialTransaction): string {
    return this.account(transaction.accountId)?.currency ?? 'USD';
  }
  protected minDate(accountId: string): string | null {
    return this.account(accountId)?.openingDate ?? null;
  }
  protected fieldError(error: AppHttpError | null, field: string): string | null {
    return error?.fieldErrors[field] ?? null;
  }
  protected formError(error: AppHttpError | null): string | null {
    return error && Object.keys(error.fieldErrors).length === 0 ? error.userMessage : null;
  }

  hasPendingChanges(): boolean {
    return this.createForm.dirty || (this.editingId() !== null && this.editForm.dirty);
  }

  @HostListener('window:beforeunload', ['$event'])
  protected warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasPendingChanges()) event.preventDefault();
  }

  private buildForm() {
    return this.formBuilder.group({
      accountId: this.formBuilder.nonNullable.control('', Validators.required),
      amount: this.formBuilder.control<number | null>(null, [
        Validators.required,
        Validators.min(0.01),
        Validators.pattern(/^\d{1,17}(\.\d{1,2})?$/),
      ]),
      transactionDate: this.formBuilder.nonNullable.control(this.today, Validators.required),
      description: this.formBuilder.nonNullable.control('', [
        Validators.required,
        Validators.maxLength(255),
      ]),
      type: this.formBuilder.nonNullable.control<TransactionType>('expense', Validators.required),
      categoryId: this.formBuilder.nonNullable.control(''),
      merchantPayee: this.formBuilder.nonNullable.control('', Validators.maxLength(255)),
      notes: this.formBuilder.nonNullable.control('', Validators.maxLength(2000)),
      externalReference: this.formBuilder.nonNullable.control('', Validators.maxLength(255)),
    });
  }

  private toRequest(form: ReturnType<TransactionsPage['buildForm']>): SaveTransactionRequest {
    const value = form.getRawValue();
    return {
      accountId: value.accountId,
      amount: Number(value.amount),
      transactionDate: value.transactionDate,
      description: value.description.trim(),
      type: value.type,
      categoryId: value.categoryId || null,
      merchantPayee: value.merchantPayee.trim() || null,
      notes: value.notes.trim() || null,
      externalReference: value.externalReference.trim() || null,
    };
  }

  private emptyFormValue() {
    return {
      accountId: '',
      amount: null,
      transactionDate: this.today,
      description: '',
      type: 'expense' as TransactionType,
      categoryId: '',
      merchantPayee: '',
      notes: '',
      externalReference: '',
    };
  }

  private categoryMatches(category: TransactionCategory, type: TransactionType): boolean {
    return category.applicability === 'both' || category.applicability === type;
  }
  private discardEditIfNeeded(): boolean {
    return (
      this.editingId() === null ||
      !this.editForm.dirty ||
      globalThis.confirm('Discard your unsaved transaction changes?')
    );
  }

  private changeLifecycle(transaction: FinancialTransaction, action: 'delete' | 'restore'): void {
    if (this.mutationBusy()) return;
    this.changingId.set(transaction.id);
    this.lifecycleError.set(null);
    this.transactionsApi[action](transaction.id)
      .pipe(finalize(() => this.changingId.set(null)))
      .subscribe({
        next: (updated) => {
          this.notifications.show(
            `${updated.description} was ${action === 'delete' ? 'deleted' : 'restored'}.`,
            'success',
          );
          this.load();
        },
        error: (error) => {
          const presented = this.errors.present(error);
          this.lifecycleError.set({ id: transaction.id, error: presented });
        },
      });
  }

  private localToday(): string {
    const local = new Date();
    local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
    return local.toISOString().slice(0, 10);
  }

  private rangeFor(period: SummaryPeriod): { from: string; to: string } | null {
    const now = new Date();
    if (period === 'all_time') return null;
    if (period === 'custom') {
      return { from: this.customSummaryFrom(), to: this.customSummaryTo() };
    }
    if (period === 'year_to_date') {
      return { from: `${now.getFullYear()}-01-01`, to: this.today };
    }
    if (period === 'last_month') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: this.formatLocalDate(first), to: this.formatLocalDate(last) };
    }
    return { from: this.firstDayOfMonth(now), to: this.today };
  }

  private firstDayOfMonth(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
  }

  private formatLocalDate(date: Date): string {
    const local = new Date(date);
    local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
    return local.toISOString().slice(0, 10);
  }

  private reloadValidSummaryRange(): void {
    if (this.summaryRangeValid()) this.loadSummary();
    else {
      this.summaries.set([]);
      this.summaryError.set(null);
    }
  }
}
