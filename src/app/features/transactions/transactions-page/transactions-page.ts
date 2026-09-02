import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, finalize, forkJoin, Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { SelectModule } from 'primeng/select';
import { AccountsApiService } from '../../../api/accounts/accounts-api.service';
import { FinancialAccount } from '../../../api/accounts/account.models';
import { BudgetsApiService } from '../../../api/budgets/budgets-api.service';
import { CategoriesApiService } from '../../../api/categories/categories-api.service';
import { TransactionCategory } from '../../../api/categories/category.models';
import { ApiErrorPresenter } from '../../../api/errors/api-error-presenter.service';
import { AppHttpError } from '../../../api/errors/app-http-error';
import { SubmissionState } from '../../../api/request-state/submission-state';
import { RecurringExpenseOccurrence } from '../../../api/recurring-expenses/recurring-expense.models';
import { RecurringExpensesApiService } from '../../../api/recurring-expenses/recurring-expenses-api.service';
import {
  CashFlowTransactionType,
  FinancialTransaction,
  SaveTransactionSplitRequest,
  SaveTransactionRequest,
  SortDirection,
  TransactionPage,
  TransactionSearchCriteria,
  TransactionSortField,
  TransactionStatus,
  TransactionSummary,
  TransactionType,
} from '../../../api/transactions/transaction.models';
import { TransactionsApiService } from '../../../api/transactions/transactions-api.service';
import { FinancialTransfer, SaveTransferRequest } from '../../../api/transfers/transfer.models';
import { TransfersApiService } from '../../../api/transfers/transfers-api.service';
import { HasPendingChanges } from '../../../core/guards/pending-changes.guard';
import { NotificationService } from '../../../core/notification.service';
import { PageState } from '../../../shared/page-state/page-state';

type SummaryPeriod = 'this_month' | 'last_month' | 'year_to_date' | 'custom' | 'all_time';
type CreateMode = CashFlowTransactionType | 'transfer';

@Component({
  selector: 'app-transactions-page',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    CurrencyPipe,
    DatePipe,
    RouterLink,
    ButtonModule,
    InputNumberModule,
    InputTextModule,
    PaginatorModule,
    SelectModule,
    PageState,
  ],
  templateUrl: './transactions-page.html',
  styleUrl: './transactions-page.scss',
})
export class TransactionsPage implements OnInit, HasPendingChanges {
  private readonly transactionsApi = inject(TransactionsApiService);
  private readonly budgetsApi = inject(BudgetsApiService);
  private readonly transfersApi = inject(TransfersApiService);
  private readonly accountsApi = inject(AccountsApiService);
  private readonly categoriesApi = inject(CategoriesApiService);
  private readonly recurringExpensesApi = inject(RecurringExpensesApiService);
  private readonly errors = inject(ApiErrorPresenter);
  private readonly notifications = inject(NotificationService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchTextChanges = new Subject<string>();
  private occurrenceRequestKey: string | null = null;

  protected readonly transactionPage = signal<TransactionPage>(emptyTransactionPage());
  protected readonly budgetProgressPath = signal<string | null>(null);
  protected readonly transactions = computed(() => this.transactionPage().items);
  protected readonly transfers = signal<FinancialTransfer[]>([]);
  protected readonly accounts = signal<FinancialAccount[]>([]);
  protected readonly categories = signal<TransactionCategory[]>([]);
  protected readonly recurringOccurrences = signal<RecurringExpenseOccurrence[]>([]);
  protected readonly occurrencesLoading = signal(false);
  protected readonly occurrencesError = signal<AppHttpError | null>(null);
  protected readonly filter = signal<TransactionStatus>('active');
  protected readonly searchAccountId = signal('');
  protected readonly searchCategoryId = signal('');
  protected readonly searchType = signal<TransactionType | ''>('');
  protected readonly searchMinAmount = signal('');
  protected readonly searchMaxAmount = signal('');
  protected readonly searchTextInput = signal('');
  protected readonly searchText = signal('');
  protected readonly searchPage = signal(0);
  protected readonly searchSize = signal(25);
  protected readonly searchSort = signal<TransactionSortField>('date');
  protected readonly searchDirection = signal<SortDirection>('desc');
  protected readonly filtersExpanded = signal(false);
  protected readonly selectedTransaction = signal<FinancialTransaction | null>(null);
  protected readonly detailLoading = signal(false);
  protected readonly detailError = signal<AppHttpError | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<AppHttpError | null>(null);
  protected readonly summaries = signal<TransactionSummary[]>([]);
  protected readonly summaryLoading = signal(true);
  protected readonly summaryError = signal<AppHttpError | null>(null);
  protected readonly createError = signal<AppHttpError | null>(null);
  protected readonly transferCreateError = signal<AppHttpError | null>(null);
  protected readonly editError = signal<AppHttpError | null>(null);
  protected readonly transferEditError = signal<AppHttpError | null>(null);
  protected readonly lifecycleError = signal<{ id: string; error: AppHttpError } | null>(null);
  protected readonly editingId = signal<string | null>(null);
  protected readonly editingTransferId = signal<string | null>(null);
  protected readonly changingId = signal<string | null>(null);
  protected readonly createSubmission = new SubmissionState();
  protected readonly transferCreateSubmission = new SubmissionState();
  protected readonly editSubmission = new SubmissionState();
  protected readonly transferEditSubmission = new SubmissionState();
  protected readonly today = this.localToday();
  protected readonly createMode = signal<CreateMode | null>(null);
  protected readonly summaryPeriod = signal<SummaryPeriod>('this_month');
  protected readonly customSummaryFrom = signal(this.firstDayOfMonth(new Date()));
  protected readonly customSummaryTo = signal(this.today);
  protected readonly summaryPeriodOptions: Array<{
    value: SummaryPeriod;
    label: string;
  }> = [
    { value: 'this_month', label: 'This month' },
    { value: 'last_month', label: 'Last month' },
    { value: 'year_to_date', label: 'Year to date' },
    { value: 'custom', label: 'Custom range' },
    { value: 'all_time', label: 'All time' },
  ];
  protected readonly typeOptions: ReadonlyArray<{
    value: CashFlowTransactionType;
    label: string;
  }> = [
    { value: 'expense', label: 'Expense' },
    { value: 'income', label: 'Income' },
  ];
  protected readonly searchTypeOptions: Array<{ value: TransactionType | ''; label: string }> = [
    { value: '', label: 'All types' },
    { value: 'income', label: 'Income' },
    { value: 'expense', label: 'Expense' },
    { value: 'transfer_out', label: 'Transfer out' },
    { value: 'transfer_in', label: 'Transfer in' },
  ];
  protected readonly pageSizeOptions = [10, 25, 50, 100];
  protected readonly createForm = this.buildForm();
  protected readonly editForm = this.buildForm();
  protected readonly transferCreateForm = this.buildTransferForm();
  protected readonly transferEditForm = this.buildTransferForm();
  protected readonly mutationBusy = computed(
    () =>
      this.createSubmission.busy() ||
      this.transferCreateSubmission.busy() ||
      this.editSubmission.busy() ||
      this.transferEditSubmission.busy() ||
      this.changingId() !== null,
  );
  protected readonly searchResults = computed(() => this.transactions());
  protected readonly visibleTransactions = computed(() => {
    const selected = this.selectedTransaction();
    return selected && selected.transferId === null ? [selected] : [];
  });
  protected readonly visibleTransfers = computed(() => {
    const selected = this.selectedTransaction();
    const transfer = selected ? this.transferFor(selected) : undefined;
    return transfer ? [transfer] : [];
  });
  protected readonly activeAccounts = computed(() =>
    this.accounts().filter((account) => account.status === 'active'),
  );
  protected readonly searchAccountOptions = computed(() => [
    { value: '', label: 'All accounts' },
    ...this.accounts().map((account) => ({
      value: account.id,
      label:
        account.name +
        ' · ' +
        account.currency +
        (account.status === 'archived' ? ' (archived)' : ''),
    })),
  ]);
  protected readonly searchCategoryOptions = computed(() => [
    { value: '', label: 'All categories' },
    ...this.categories().map((category) => ({
      value: category.id,
      label: category.name + (category.status === 'archived' ? ' (archived)' : ''),
    })),
  ]);
  protected readonly summaryRange = computed(() => this.rangeFor(this.summaryPeriod()));
  protected readonly summaryRangeValid = computed(() => {
    const range = this.summaryRange();
    return range === null || range.from <= range.to;
  });
  protected readonly summaryPeriodLabel = computed(
    () => this.summaryPeriodOptions.find((option) => option.value === this.summaryPeriod())!.label,
  );
  protected readonly activeSearchFilterCount = computed(
    () =>
      [
        this.searchAccountId(),
        this.searchCategoryId(),
        this.searchType(),
        this.searchMinAmount(),
        this.searchMaxAmount(),
        this.searchText(),
      ].filter(Boolean).length,
  );
  ngOnInit(): void {
    this.restoreSearchStateFromUrl();
    this.searchTextChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.searchText.set(value.trim());
        this.refreshSearch();
      });
    this.load();
  }

  protected load(): void {
    this.loadSummary();
    this.loading.set(true);
    this.loadError.set(null);
    this.lifecycleError.set(null);
    forkJoin({
      transactions: this.transactionPageRequest(),
      transfers: this.transfersApi.list('all'),
      accounts: this.accountsApi.list('all'),
      categories: this.categoriesApi.list('all'),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ transactions, transfers, accounts, categories }) => {
          this.transactionPage.set(transactions);
          this.transfers.set(transfers);
          this.accounts.set(accounts);
          this.categories.set(categories);
        },
        error: (error) => this.loadError.set(this.errors.present(error)),
      });
  }

  protected createTransfer(): void {
    this.transferCreateError.set(null);
    if (!this.transferFormValid(this.transferCreateForm)) return;
    this.transferCreateSubmission
      .run(() => this.transfersApi.create(this.toTransferRequest(this.transferCreateForm)))
      .subscribe({
        next: (transfer) => {
          this.transferCreateForm.reset(this.emptyTransferFormValue());
          this.transferCreateForm.markAsPristine();
          this.notifications.show(`${transfer.description} was transferred.`, 'success');
          this.load();
        },
        error: (error: AppHttpError) => {
          this.transferCreateError.set(error);
          this.errors.present(error);
        },
      });
  }

  protected create(): void {
    this.createError.set(null);
    if (!this.transactionFormValid(this.createForm)) return;
    this.createSubmission
      .run(() => this.transactionsApi.create(this.toRequest(this.createForm)))
      .subscribe({
        next: (transaction) => {
          this.resetTransactionForm(this.createForm);
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

  protected selectCreateMode(mode: CreateMode): void {
    const nextMode = this.createMode() === mode ? null : mode;
    this.createMode.set(nextMode);
    if (nextMode !== null && nextMode !== 'transfer') {
      this.createForm.controls.type.setValue(nextMode);
      this.onTypeChanged('create');
    }
  }

  protected startEdit(transaction: FinancialTransaction): void {
    if (transaction.id === this.editingId() || !this.discardEditIfNeeded()) return;
    this.cancelTransferEdit();
    this.editingId.set(transaction.id);
    this.editError.set(null);
    this.editForm.controls.splits.clear();
    transaction.splits.forEach((split) =>
      this.editForm.controls.splits.push(
        this.buildSplitRow(split.id, split.categoryId, split.amount),
      ),
    );
    this.editForm.reset({
      accountId: transaction.accountId,
      amount: transaction.amount,
      transactionDate: transaction.transactionDate,
      description: transaction.description,
      type: this.cashFlowType(transaction.type),
      categoryId: transaction.categoryId ?? '',
      splitEnabled: transaction.splits.length > 0,
      splits: transaction.splits.map((split) => ({
        id: split.id,
        categoryId: split.categoryId,
        amount: split.amount,
      })),
      merchantPayee: transaction.merchantPayee ?? '',
      notes: transaction.notes ?? '',
      externalReference: transaction.externalReference ?? '',
      recurringOccurrenceKey: transaction.recurringExpenseOccurrence?.occurrenceKey ?? '',
    });
    if (transaction.type === 'expense') this.loadOccurrencesFor(this.editForm);
  }

  protected startTransferEdit(transfer: FinancialTransfer): void {
    if (transfer.id === this.editingTransferId() || !this.discardEditIfNeeded()) return;
    this.cancelEdit();
    this.editingTransferId.set(transfer.id);
    this.transferEditError.set(null);
    this.transferEditForm.reset({
      sourceAccountId: transfer.sourceAccountId,
      destinationAccountId: transfer.destinationAccountId,
      sourceAmount: transfer.sourceAmount,
      destinationAmount: transfer.destinationAmount,
      transactionDate: transfer.transactionDate,
      description: transfer.description,
      notes: transfer.notes ?? '',
      externalReference: transfer.externalReference ?? '',
    });
  }

  protected cancelTransferEdit(): void {
    this.editingTransferId.set(null);
    this.transferEditError.set(null);
    this.transferEditForm.reset(this.emptyTransferFormValue());
  }

  protected saveTransferEdit(transfer: FinancialTransfer): void {
    this.transferEditError.set(null);
    if (!this.transferFormValid(this.transferEditForm)) return;
    this.transferEditSubmission
      .run(() =>
        this.transfersApi.update(transfer.id, this.toTransferRequest(this.transferEditForm)),
      )
      .subscribe({
        next: (updated) => {
          this.notifications.show(
            `${updated.description} was updated on both accounts.`,
            'success',
          );
          this.cancelTransferEdit();
          this.load();
        },
        error: (error: AppHttpError) => {
          this.transferEditError.set(error);
          this.errors.present(error);
        },
      });
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.editError.set(null);
    this.resetTransactionForm(this.editForm);
  }

  protected saveEdit(transaction: FinancialTransaction): void {
    this.editError.set(null);
    if (!this.transactionFormValid(this.editForm)) return;
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

  protected deleteTransfer(transfer: FinancialTransfer): void {
    if (
      globalThis.confirm(
        `Delete ${transfer.description}? The balance changes on both accounts will be reversed, and the transfer can be restored.`,
      )
    ) {
      this.changeTransferLifecycle(transfer, 'delete');
    }
  }

  protected restoreTransfer(transfer: FinancialTransfer): void {
    this.changeTransferLifecycle(transfer, 'restore');
  }

  protected selectFilter(filter: TransactionStatus): void {
    if (filter === this.filter() || !this.discardEditIfNeeded()) return;
    this.filter.set(filter);
    this.cancelEdit();
    this.cancelTransferEdit();
    this.closeDetails();
    this.refreshSearch();
  }

  protected selectSummaryPeriod(period: string): void {
    const option = this.summaryPeriodOptions.find((candidate) => candidate.value === period);
    if (!option) return;
    this.summaryPeriod.set(option.value);
    this.loadSummary();
    this.refreshSearch();
  }

  protected setCustomSummaryFrom(value: string): void {
    this.customSummaryFrom.set(value);
    this.reloadValidSummaryRange();
  }

  protected setCustomSummaryTo(value: string): void {
    this.customSummaryTo.set(value);
    this.reloadValidSummaryRange();
  }

  protected setSearchAccount(value: string): void {
    this.searchAccountId.set(value);
    this.loadSummary();
    this.refreshSearch();
  }

  protected setSearchCategory(value: string): void {
    this.searchCategoryId.set(value);
    this.loadSummary();
    this.refreshSearch();
  }

  protected setSearchType(value: string): void {
    if (!['', 'income', 'expense', 'transfer_out', 'transfer_in'].includes(value)) return;
    this.searchType.set(value as TransactionType | '');
    this.loadSummary();
    this.refreshSearch();
  }

  protected setSearchMinAmount(value: string): void {
    this.searchMinAmount.set(value);
    this.refreshSearch();
  }

  protected setSearchMaxAmount(value: string): void {
    this.searchMaxAmount.set(value);
    this.refreshSearch();
  }

  protected setSearchText(value: string): void {
    this.searchTextInput.set(value);
    this.searchTextChanges.next(value);
  }

  protected clearSearchFilters(): void {
    this.searchAccountId.set('');
    this.searchCategoryId.set('');
    this.searchType.set('');
    this.searchMinAmount.set('');
    this.searchMaxAmount.set('');
    this.searchTextInput.set('');
    this.searchText.set('');
    this.searchTextChanges.next('');
    this.loadSummary();
    this.refreshSearch();
  }

  protected selectSort(field: TransactionSortField): void {
    if (this.searchSort() === field) {
      this.searchDirection.update((direction) => (direction === 'desc' ? 'asc' : 'desc'));
    } else {
      this.searchSort.set(field);
      this.searchDirection.set('desc');
    }
    this.refreshSearch();
  }

  protected onPageChange(event: PaginatorState): void {
    const size = event.rows ?? this.searchSize();
    const page = event.page ?? 0;
    if (![10, 25, 50, 100].includes(size)) return;
    if (size === this.searchSize() && page === this.searchPage()) return;
    this.searchSize.set(size);
    this.searchPage.set(page);
    this.closeDetails();
    this.loadTransactions();
    this.syncUrl();
  }

  protected openDetails(transaction: FinancialTransaction): void {
    this.detailLoading.set(true);
    this.detailError.set(null);
    this.cancelEdit();
    this.cancelTransferEdit();
    this.transactionsApi
      .get(transaction.id)
      .pipe(finalize(() => this.detailLoading.set(false)))
      .subscribe({
        next: (detail) => this.selectedTransaction.set(detail),
        error: (error) => this.detailError.set(this.errors.present(error)),
      });
  }

  protected closeDetails(): void {
    this.selectedTransaction.set(null);
    this.detailError.set(null);
    this.cancelEdit();
    this.cancelTransferEdit();
  }

  protected transferFor(transaction: FinancialTransaction): FinancialTransfer | undefined {
    return transaction.transferId
      ? this.transfers().find((transfer) => transfer.id === transaction.transferId)
      : undefined;
  }

  protected transactionTypeLabel(type: TransactionType): string {
    return {
      income: 'Income',
      expense: 'Expense',
      transfer_out: 'Transfer out',
      transfer_in: 'Transfer in',
    }[type];
  }

  protected loadSummary(): void {
    if (this.budgetProgressPath()) {
      this.summaries.set([]);
      this.summaryError.set(null);
      this.summaryLoading.set(false);
      return;
    }
    if (!this.summaryRangeValid()) {
      this.summaries.set([]);
      this.summaryError.set(null);
      return;
    }
    const range = this.summaryRange();
    this.summaryLoading.set(true);
    this.summaryError.set(null);
    this.transactionsApi
      .summarize({
        from: range?.from,
        to: range?.to,
        accountId: this.searchAccountId() || undefined,
        categoryId: this.searchCategoryId() || undefined,
        type: this.searchType() || undefined,
      })
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
    form.controls.splits.controls.forEach((row) => {
      const splitCategory = this.category(row.controls.categoryId.value);
      if (splitCategory && !this.categoryMatches(splitCategory, form.controls.type.value)) {
        row.controls.categoryId.setValue('');
      }
    });
    if (form.controls.type.value !== 'expense') {
      form.controls.recurringOccurrenceKey.setValue('');
      this.recurringOccurrences.set([]);
    } else {
      this.loadOccurrencesFor(form);
    }
  }

  protected toggleSplits(which: 'create' | 'edit', enabled: boolean): void {
    const form = which === 'create' ? this.createForm : this.editForm;
    if (form.controls.splitEnabled.value === enabled) return;
    if (
      !enabled &&
      this.splitRowsHaveValues(form) &&
      !globalThis.confirm('Use one category instead? The current split allocation will be removed.')
    )
      return;

    form.controls.splitEnabled.setValue(enabled);
    form.controls.categoryId.setValue('');
    form.controls.splits.clear();
    form.controls.recurringOccurrenceKey.setValue('');
    if (enabled) {
      form.controls.splits.push(this.buildSplitRow());
      form.controls.splits.push(this.buildSplitRow());
    }
    form.markAsDirty();
  }

  protected addSplitRow(which: 'create' | 'edit'): void {
    const form = which === 'create' ? this.createForm : this.editForm;
    form.controls.splits.push(this.buildSplitRow());
    form.markAsDirty();
  }

  protected removeSplitRow(which: 'create' | 'edit', index: number): void {
    const form = which === 'create' ? this.createForm : this.editForm;
    if (form.controls.splits.length <= 2) return;
    form.controls.splits.removeAt(index);
    form.markAsDirty();
  }

  protected splitAllocated(form: ReturnType<TransactionsPage['buildForm']>): number {
    return this.splitAllocatedMinor(form) / 100;
  }

  protected splitRemaining(form: ReturnType<TransactionsPage['buildForm']>): number {
    return (this.amountMinor(form) - this.splitAllocatedMinor(form)) / 100;
  }

  protected splitTotalMatches(form: ReturnType<TransactionsPage['buildForm']>): boolean {
    return this.amountMinor(form) > 0 && this.splitRemaining(form) === 0;
  }

  protected splitCategoryDuplicate(
    form: ReturnType<TransactionsPage['buildForm']>,
    index: number,
  ): boolean {
    const selected = form.controls.splits.at(index).controls.categoryId.value;
    if (!selected) return false;
    return form.controls.splits.controls.some(
      (row, rowIndex) => rowIndex !== index && row.controls.categoryId.value === selected,
    );
  }

  protected splitCategoryOptions(
    form: ReturnType<TransactionsPage['buildForm']>,
    index: number,
  ): TransactionCategory[] {
    const currentId = form.controls.splits.at(index).controls.categoryId.value;
    const selectedElsewhere = new Set(
      form.controls.splits.controls
        .filter((_, rowIndex) => rowIndex !== index)
        .map((row) => row.controls.categoryId.value)
        .filter(Boolean),
    );
    return this.categoryOptions(form.controls.type.value, currentId).filter(
      (category) => !selectedElsewhere.has(category.id) || category.id === currentId,
    );
  }

  protected splitFieldError(
    error: AppHttpError | null,
    index: number,
    field: 'categoryId' | 'amount' | 'id',
  ): string | null {
    return this.fieldError(error, `splits[${index}].${field}`);
  }

  protected transactionCurrency(form: ReturnType<TransactionsPage['buildForm']>): string {
    return this.account(form.controls.accountId.value)?.currency ?? 'USD';
  }

  protected onTransactionContextChanged(which: 'create' | 'edit'): void {
    const form = which === 'create' ? this.createForm : this.editForm;
    const selected = this.selectedOccurrence(form);
    if (selected && !this.occurrenceCompatible(selected, form)) {
      form.controls.recurringOccurrenceKey.setValue('');
    }
    this.loadOccurrencesFor(form);
  }

  protected recurringOccurrenceOptions(
    form: ReturnType<TransactionsPage['buildForm']>,
  ): Array<{ value: string; label: string }> {
    const current = form.controls.recurringOccurrenceKey.value;
    return this.recurringOccurrences()
      .filter(
        (occurrence) =>
          this.occurrenceCompatible(occurrence, form) &&
          (occurrence.status === 'outstanding' || occurrence.occurrenceKey === current),
      )
      .map((occurrence) => ({
        value: occurrence.occurrenceKey,
        label: this.occurrenceLabel(occurrence),
      }));
  }

  protected categoryOptions(type: CashFlowTransactionType, currentId = ''): TransactionCategory[] {
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

  protected transferAccountOptions(excludedId: string, currentId = ''): FinancialAccount[] {
    return this.accountOptions(currentId).filter((account) => account.id !== excludedId);
  }

  protected onTransferAccountChanged(which: 'create' | 'edit'): void {
    const form = which === 'create' ? this.transferCreateForm : this.transferEditForm;
    if (
      form.controls.sourceAccountId.value &&
      form.controls.sourceAccountId.value === form.controls.destinationAccountId.value
    ) {
      form.controls.destinationAccountId.setValue('');
    }
    form.controls.destinationAmount.updateValueAndValidity();
  }

  protected transferCurrenciesMatch(
    form: ReturnType<TransactionsPage['buildTransferForm']>,
  ): boolean {
    const source = this.account(form.controls.sourceAccountId.value);
    const destination = this.account(form.controls.destinationAccountId.value);
    return !!source && !!destination && source.currency === destination.currency;
  }

  protected transferCurrency(accountId: string): string {
    return this.account(accountId)?.currency ?? '—';
  }

  protected transferMinDate(
    form: ReturnType<TransactionsPage['buildTransferForm']>,
  ): string | null {
    const source = this.minDate(form.controls.sourceAccountId.value);
    const destination = this.minDate(form.controls.destinationAccountId.value);
    if (!source) return destination;
    if (!destination) return source;
    return source > destination ? source : destination;
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
    return (
      this.createForm.dirty ||
      this.transferCreateForm.dirty ||
      (this.editingId() !== null && this.editForm.dirty) ||
      (this.editingTransferId() !== null && this.transferEditForm.dirty)
    );
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
      type: this.formBuilder.nonNullable.control<CashFlowTransactionType>(
        'expense',
        Validators.required,
      ),
      categoryId: this.formBuilder.nonNullable.control(''),
      splitEnabled: this.formBuilder.nonNullable.control(false),
      splits: this.formBuilder.array<ReturnType<TransactionsPage['buildSplitRow']>>([]),
      merchantPayee: this.formBuilder.nonNullable.control('', Validators.maxLength(255)),
      notes: this.formBuilder.nonNullable.control('', Validators.maxLength(2000)),
      externalReference: this.formBuilder.nonNullable.control('', Validators.maxLength(255)),
      recurringOccurrenceKey: this.formBuilder.nonNullable.control(''),
    });
  }

  private buildTransferForm() {
    const amountValidators = [Validators.min(0.01), Validators.pattern(/^\d{1,17}(\.\d{1,2})?$/)];
    return this.formBuilder.group({
      sourceAccountId: this.formBuilder.nonNullable.control('', Validators.required),
      destinationAccountId: this.formBuilder.nonNullable.control('', Validators.required),
      sourceAmount: this.formBuilder.control<number | null>(null, [
        Validators.required,
        ...amountValidators,
      ]),
      destinationAmount: this.formBuilder.control<number | null>(null, [
        Validators.required,
        ...amountValidators,
      ]),
      transactionDate: this.formBuilder.nonNullable.control(this.today, Validators.required),
      description: this.formBuilder.nonNullable.control('', [
        Validators.required,
        Validators.maxLength(255),
      ]),
      notes: this.formBuilder.nonNullable.control('', Validators.maxLength(2000)),
      externalReference: this.formBuilder.nonNullable.control('', Validators.maxLength(255)),
    });
  }

  private toRequest(form: ReturnType<TransactionsPage['buildForm']>): SaveTransactionRequest {
    const value = form.getRawValue();
    const splits: SaveTransactionSplitRequest[] = value.splitEnabled
      ? value.splits.map((split) => ({
          ...(split.id ? { id: split.id } : {}),
          categoryId: split.categoryId,
          amount: Number(split.amount),
        }))
      : [];
    return {
      accountId: value.accountId,
      amount: Number(value.amount),
      transactionDate: value.transactionDate,
      description: value.description.trim(),
      type: value.type,
      categoryId: value.splitEnabled ? null : value.categoryId || null,
      splits,
      merchantPayee: value.merchantPayee.trim() || null,
      notes: value.notes.trim() || null,
      externalReference: value.externalReference.trim() || null,
      recurringExpenseOccurrence: this.occurrenceSelection(form),
    };
  }

  private emptyFormValue() {
    return {
      accountId: '',
      amount: null,
      transactionDate: this.today,
      description: '',
      type: 'expense' as CashFlowTransactionType,
      categoryId: '',
      splitEnabled: false,
      splits: [],
      merchantPayee: '',
      notes: '',
      externalReference: '',
      recurringOccurrenceKey: '',
    };
  }

  private buildSplitRow(id = '', categoryId = '', amount: number | null = null) {
    return this.formBuilder.group({
      id: this.formBuilder.nonNullable.control(id),
      categoryId: this.formBuilder.nonNullable.control(categoryId, Validators.required),
      amount: this.formBuilder.control<number | null>(amount, [
        Validators.required,
        Validators.min(0.01),
        Validators.pattern(/^\d{1,17}(\.\d{1,2})?$/),
      ]),
    });
  }

  private resetTransactionForm(form: ReturnType<TransactionsPage['buildForm']>): void {
    form.controls.splits.clear();
    form.reset(this.emptyFormValue());
  }

  private transactionFormValid(form: ReturnType<TransactionsPage['buildForm']>): boolean {
    if (form.invalid) {
      form.markAllAsTouched();
      return false;
    }
    if (!form.controls.splitEnabled.value) return true;
    const invalidAllocation =
      form.controls.splits.length < 2 ||
      form.controls.splits.controls.some((_, index) => this.splitCategoryDuplicate(form, index)) ||
      !this.splitTotalMatches(form);
    if (invalidAllocation) {
      form.controls.splits.markAllAsTouched();
      return false;
    }
    return true;
  }

  private splitRowsHaveValues(form: ReturnType<TransactionsPage['buildForm']>): boolean {
    return form.controls.splits.controls.some(
      (row) => !!row.controls.categoryId.value || row.controls.amount.value !== null,
    );
  }

  private amountMinor(form: ReturnType<TransactionsPage['buildForm']>): number {
    return Math.round(Number(form.controls.amount.value ?? 0) * 100);
  }

  private splitAllocatedMinor(form: ReturnType<TransactionsPage['buildForm']>): number {
    return form.controls.splits.controls.reduce(
      (total, row) => total + Math.round(Number(row.controls.amount.value ?? 0) * 100),
      0,
    );
  }

  private emptyTransferFormValue() {
    return {
      sourceAccountId: '',
      destinationAccountId: '',
      sourceAmount: null,
      destinationAmount: null,
      transactionDate: this.today,
      description: '',
      notes: '',
      externalReference: '',
    };
  }

  private transferFormValid(form: ReturnType<TransactionsPage['buildTransferForm']>): boolean {
    const destinationAmount = form.controls.destinationAmount;
    if (this.transferCurrenciesMatch(form)) {
      destinationAmount.setValue(form.controls.sourceAmount.value);
    }
    if (form.controls.sourceAccountId.value === form.controls.destinationAccountId.value) {
      form.controls.destinationAccountId.setErrors({ sameAccount: true });
    }
    if (form.invalid) {
      form.markAllAsTouched();
      return false;
    }
    return true;
  }

  private toTransferRequest(
    form: ReturnType<TransactionsPage['buildTransferForm']>,
  ): SaveTransferRequest {
    const value = form.getRawValue();
    const sourceAmount = Number(value.sourceAmount);
    return {
      sourceAccountId: value.sourceAccountId,
      destinationAccountId: value.destinationAccountId,
      sourceAmount,
      destinationAmount: this.transferCurrenciesMatch(form)
        ? sourceAmount
        : Number(value.destinationAmount),
      transactionDate: value.transactionDate,
      description: value.description.trim(),
      notes: value.notes.trim() || null,
      externalReference: value.externalReference.trim() || null,
    };
  }

  private categoryMatches(category: TransactionCategory, type: CashFlowTransactionType): boolean {
    return category.applicability === 'both' || category.applicability === type;
  }

  private loadOccurrencesFor(form: ReturnType<TransactionsPage['buildForm']>): void {
    if (form.controls.type.value !== 'expense' || form.controls.splitEnabled.value) return;
    const date = form.controls.transactionDate.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const from = date.slice(0, 7) + '-01';
    const to = this.lastDayOfMonth(date);
    const requestKey = `${from}:${to}`;
    this.occurrenceRequestKey = requestKey;
    this.occurrencesLoading.set(true);
    this.occurrencesError.set(null);
    this.recurringExpensesApi
      .occurrences(from, to)
      .pipe(
        finalize(() => {
          if (this.occurrenceRequestKey === requestKey) this.occurrencesLoading.set(false);
        }),
      )
      .subscribe({
        next: (occurrences) => {
          if (this.occurrenceRequestKey === requestKey) this.recurringOccurrences.set(occurrences);
        },
        error: (error) => {
          if (this.occurrenceRequestKey !== requestKey) return;
          this.recurringOccurrences.set([]);
          this.occurrencesError.set(this.errors.present(error));
        },
      });
  }

  private selectedOccurrence(
    form: ReturnType<TransactionsPage['buildForm']>,
  ): RecurringExpenseOccurrence | undefined {
    const key = form.controls.recurringOccurrenceKey.value;
    return this.recurringOccurrences().find((occurrence) => occurrence.occurrenceKey === key);
  }

  private occurrenceSelection(
    form: ReturnType<TransactionsPage['buildForm']>,
  ): { recurringExpenseId: string; dueDate: string } | null {
    const occurrence = this.selectedOccurrence(form);
    if (occurrence) {
      return {
        recurringExpenseId: occurrence.recurringExpenseId,
        dueDate: occurrence.dueDate,
      };
    }
    const key = form.controls.recurringOccurrenceKey.value;
    const separator = key.lastIndexOf(':');
    if (separator < 1) return null;
    return { recurringExpenseId: key.slice(0, separator), dueDate: key.slice(separator + 1) };
  }

  private occurrenceCompatible(
    occurrence: RecurringExpenseOccurrence,
    form: ReturnType<TransactionsPage['buildForm']>,
  ): boolean {
    const account = this.account(form.controls.accountId.value);
    return (
      form.controls.type.value === 'expense' &&
      !form.controls.splitEnabled.value &&
      !!account &&
      !!form.controls.categoryId.value &&
      occurrence.currency === account.currency &&
      occurrence.categoryId === form.controls.categoryId.value &&
      (occurrence.accountId === null || occurrence.accountId === account.id)
    );
  }

  private occurrenceLabel(occurrence: RecurringExpenseOccurrence): string {
    const due = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(occurrence.dueDate + 'T00:00:00Z'));
    const amount = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: occurrence.currency,
    }).format(occurrence.targetAmount);
    return `${occurrence.name} · due ${due} · target ${amount}${occurrence.status === 'satisfied' ? ' · matched' : ''}`;
  }

  private lastDayOfMonth(date: string): string {
    const [year, month] = date.split('-').map(Number);
    const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  private discardEditIfNeeded(): boolean {
    return (
      ((this.editingId() === null || !this.editForm.dirty) &&
        (this.editingTransferId() === null || !this.transferEditForm.dirty)) ||
      globalThis.confirm('Discard your unsaved transaction changes?')
    );
  }

  private cashFlowType(type: TransactionType): CashFlowTransactionType {
    return type === 'income' ? 'income' : 'expense';
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

  private changeTransferLifecycle(transfer: FinancialTransfer, action: 'delete' | 'restore'): void {
    if (this.mutationBusy()) return;
    this.changingId.set(transfer.id);
    this.lifecycleError.set(null);
    this.transfersApi[action](transfer.id)
      .pipe(finalize(() => this.changingId.set(null)))
      .subscribe({
        next: (updated) => {
          this.notifications.show(
            `${updated.description} was ${action === 'delete' ? 'deleted from' : 'restored to'} both accounts.`,
            'success',
          );
          this.load();
        },
        error: (error) => {
          this.lifecycleError.set({ id: transfer.id, error: this.errors.present(error) });
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
    if (this.summaryRangeValid()) {
      this.loadSummary();
      this.refreshSearch();
    } else {
      this.summaries.set([]);
      this.summaryError.set(null);
    }
  }

  private refreshSearch(resetPage = true): void {
    if (!this.summaryRangeValid()) return;
    if (resetPage) this.searchPage.set(0);
    this.closeDetails();
    this.loadTransactions();
    this.syncUrl();
  }

  private loadTransactions(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.transactionPageRequest()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (page) => this.transactionPage.set(page),
        error: (error) => this.loadError.set(this.errors.present(error)),
      });
  }

  private searchCriteria(): TransactionSearchCriteria {
    const range = this.summaryRange();
    return {
      status: this.filter(),
      accountId: this.searchAccountId() || undefined,
      from: range?.from,
      to: range?.to,
      categoryId: this.searchCategoryId() || undefined,
      type: this.searchType() || undefined,
      minAmount: this.optionalPositiveNumber(this.searchMinAmount()),
      maxAmount: this.optionalPositiveNumber(this.searchMaxAmount()),
      text: this.searchText() || undefined,
      page: this.searchPage(),
      size: this.searchSize(),
      sort: this.searchSort(),
      direction: this.searchDirection(),
    };
  }

  private transactionPageRequest() {
    const path = this.budgetProgressPath();
    return path
      ? this.budgetsApi.progressTransactions(path, {
          page: this.searchPage(),
          size: this.searchSize(),
          sort: this.searchSort(),
          direction: this.searchDirection(),
        })
      : this.transactionsApi.search(this.searchCriteria());
  }

  private optionalPositiveNumber(value: string): number | undefined {
    if (!value) return undefined;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : undefined;
  }

  private restoreSearchStateFromUrl(): void {
    const params = this.route.snapshot.queryParamMap;
    this.budgetProgressPath.set(params.get('budgetProgressPath'));
    const status = params.get('status');
    if (status === 'active' || status === 'deleted') this.filter.set(status);
    const period = params.get('period');
    if (this.summaryPeriodOptions.some((option) => option.value === period)) {
      this.summaryPeriod.set(period as SummaryPeriod);
    }
    if (this.summaryPeriod() === 'custom') {
      this.customSummaryFrom.set(params.get('from') ?? this.customSummaryFrom());
      this.customSummaryTo.set(params.get('to') ?? this.customSummaryTo());
    }
    this.searchAccountId.set(params.get('accountId') ?? '');
    this.searchCategoryId.set(params.get('categoryId') ?? '');
    const type = params.get('type');
    if (type && ['income', 'expense', 'transfer_out', 'transfer_in'].includes(type)) {
      this.searchType.set(type as TransactionType);
    }
    this.searchMinAmount.set(params.get('minAmount') ?? '');
    this.searchMaxAmount.set(params.get('maxAmount') ?? '');
    const text = params.get('text') ?? '';
    this.searchTextInput.set(text);
    this.searchText.set(text);
    this.searchPage.set(Math.max(0, Number(params.get('page')) || 0));
    const size = Number(params.get('size'));
    if ([10, 25, 50, 100].includes(size)) this.searchSize.set(size);
    const sort = params.get('sort');
    if (sort === 'date' || sort === 'amount') this.searchSort.set(sort);
    const direction = params.get('direction');
    if (direction === 'asc' || direction === 'desc') this.searchDirection.set(direction);
    this.filtersExpanded.set(this.activeSearchFilterCount() > 0);
  }

  private syncUrl(): void {
    const params: Record<string, string | number | null> = {
      status: this.filter() === 'active' ? null : this.filter(),
      period: this.summaryPeriod() === 'this_month' ? null : this.summaryPeriod(),
      from: this.summaryPeriod() === 'custom' ? this.customSummaryFrom() : null,
      to: this.summaryPeriod() === 'custom' ? this.customSummaryTo() : null,
      accountId: this.searchAccountId() || null,
      categoryId: this.searchCategoryId() || null,
      type: this.searchType() || null,
      minAmount: this.searchMinAmount() || null,
      maxAmount: this.searchMaxAmount() || null,
      text: this.searchText() || null,
      page: this.searchPage() || null,
      size: this.searchSize() === 25 ? null : this.searchSize(),
      sort: this.searchSort() === 'date' ? null : this.searchSort(),
      direction: this.searchDirection() === 'desc' ? null : this.searchDirection(),
      budgetProgressPath: this.budgetProgressPath(),
    };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}

function emptyTransactionPage(): TransactionPage {
  return {
    items: [],
    page: 0,
    size: 25,
    totalElements: 0,
    totalPages: 0,
    sortBy: 'date',
    sortDirection: 'desc',
  };
}
