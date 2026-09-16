import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { finalize, forkJoin } from 'rxjs';
import { AccountReconciliationsApiService } from '../../../api/accounts/account-reconciliations-api.service';
import { AccountsApiService } from '../../../api/accounts/accounts-api.service';
import { FinancialAccount } from '../../../api/accounts/account.models';
import {
  AccountReconciliation,
  ReconciliationPreview,
} from '../../../api/accounts/reconciliation.models';
import { CategoriesApiService } from '../../../api/categories/categories-api.service';
import { TransactionCategory } from '../../../api/categories/category.models';
import { ApiErrorPresenter } from '../../../api/errors/api-error-presenter.service';
import { AppHttpError } from '../../../api/errors/app-http-error';
import { TransactionsApiService } from '../../../api/transactions/transactions-api.service';
import { FinancialTransaction } from '../../../api/transactions/transaction.models';
import { NotificationService } from '../../../core/notification.service';
import { accountLabel } from '../../../shared/accounts/account-label';
import { PageState } from '../../../shared/page-state/page-state';

@Component({
  selector: 'app-account-reconciliation',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    CurrencyPipe,
    DatePipe,
    ButtonModule,
    PageState,
  ],
  templateUrl: './account-reconciliation.html',
  styleUrl: './account-reconciliation.scss',
})
export class AccountReconciliationPage implements OnInit {
  private readonly reconciliationsApi = inject(AccountReconciliationsApiService);
  private readonly accountsApi = inject(AccountsApiService);
  private readonly categoriesApi = inject(CategoriesApiService);
  private readonly transactionsApi = inject(TransactionsApiService);
  private readonly errors = inject(ApiErrorPresenter);
  private readonly notifications = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);
  private readonly accountId = this.route.snapshot.paramMap.get('accountId')!;
  private idempotencyKey = '';

  protected readonly account = signal<FinancialAccount | null>(null);
  protected readonly categories = signal<TransactionCategory[]>([]);
  protected readonly history = signal<AccountReconciliation[]>([]);
  protected readonly preview = signal<ReconciliationPreview | null>(null);
  protected readonly contributingTransactions = signal<FinancialTransaction[]>([]);
  protected readonly contributingTotal = signal(0);
  protected readonly result = signal<AccountReconciliation | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<AppHttpError | null>(null);
  protected readonly previewing = signal(false);
  protected readonly previewError = signal<AppHttpError | null>(null);
  protected readonly confirming = signal(false);
  protected readonly confirmError = signal<AppHttpError | null>(null);
  protected readonly stalePreview = signal(false);
  protected readonly today = this.localToday();
  protected readonly accountDisplayLabel = accountLabel;

  protected readonly statementForm = this.formBuilder.nonNullable.group({
    statementDate: ['', Validators.required],
    statementBalance: this.formBuilder.control<number | null>(null, [
      Validators.required,
      Validators.pattern(/^-?\d{1,17}(\.\d{1,2})?$/),
    ]),
  });
  protected readonly confirmForm = this.formBuilder.nonNullable.group({
    categoryId: [''],
    explanation: ['', Validators.maxLength(2000)],
    confirmed: [false],
  });
  protected readonly compatibleCategories = computed(() => {
    const type = this.preview()?.adjustmentType;
    if (!type) return [];
    return this.categories().filter(
      (category) =>
        category.status === 'active' &&
        (category.applicability === 'both' || category.applicability === type),
    );
  });

  ngOnInit(): void {
    this.statementForm.valueChanges.subscribe(() => this.clearPreview());
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      account: this.accountsApi.get(this.accountId),
      categories: this.categoriesApi.list('all'),
      history: this.reconciliationsApi.history(this.accountId),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ account, categories, history }) => {
          this.account.set(account);
          this.categories.set(categories);
          this.history.set(history.items);
          if (!this.statementForm.controls.statementDate.value) {
            this.statementForm.controls.statementDate.setValue(this.today);
          }
        },
        error: (error) => this.loadError.set(this.errors.present(error)),
      });
  }

  protected review(): void {
    this.previewError.set(null);
    this.result.set(null);
    if (this.statementForm.invalid) {
      this.statementForm.markAllAsTouched();
      return;
    }
    const request = {
      statementDate: this.statementForm.controls.statementDate.value,
      statementBalance: this.statementForm.controls.statementBalance.value!,
    };
    this.previewing.set(true);
    forkJoin({
      preview: this.reconciliationsApi.preview(this.accountId, request),
      activity: this.transactionsApi.search({
        status: 'active',
        accountId: this.accountId,
        to: request.statementDate,
        page: 0,
        size: 100,
        sort: 'date',
        direction: 'desc',
      }),
    })
      .pipe(finalize(() => this.previewing.set(false)))
      .subscribe({
        next: ({ preview, activity }) => {
          this.preview.set(preview);
          this.contributingTransactions.set(activity.items);
          this.contributingTotal.set(activity.totalElements);
          this.stalePreview.set(false);
          this.idempotencyKey = this.newIdempotencyKey();
          this.confirmForm.reset({ categoryId: '', explanation: '', confirmed: false });
        },
        error: (error) => this.previewError.set(this.errors.present(error)),
      });
  }

  protected confirm(): void {
    const preview = this.preview();
    if (!preview || this.stalePreview()) return;
    const requiresAdjustment = preview.difference !== 0;
    const value = this.confirmForm.getRawValue();
    if (
      !value.confirmed ||
      (requiresAdjustment && (!value.categoryId || !value.explanation.trim()))
    ) {
      this.confirmForm.markAllAsTouched();
      return;
    }
    this.confirming.set(true);
    this.confirmError.set(null);
    this.reconciliationsApi
      .confirm(
        this.accountId,
        {
          statementDate: preview.statementDate,
          statementBalance: preview.statementBalance,
          ledgerToken: preview.ledgerToken,
          categoryId: requiresAdjustment ? value.categoryId : null,
          explanation: requiresAdjustment ? value.explanation.trim() : null,
        },
        this.idempotencyKey,
      )
      .pipe(finalize(() => this.confirming.set(false)))
      .subscribe({
        next: (result) => {
          this.result.set(result);
          this.history.update((items) => [result, ...items]);
          this.preview.set(null);
          this.notifications.show('Account reconciliation was recorded.', 'success');
        },
        error: (error) => {
          const presented = this.errors.present(error);
          this.confirmError.set(presented);
          if (presented.status === 409) this.stalePreview.set(true);
        },
      });
  }

  protected cancelPreview(): void {
    this.clearPreview();
    this.confirmForm.reset({ categoryId: '', explanation: '', confirmed: false });
  }

  protected categoryName(categoryId: string | null): string {
    return (
      this.categories().find((category) => category.id === categoryId)?.name ?? 'Uncategorized'
    );
  }

  private clearPreview(): void {
    this.preview.set(null);
    this.previewError.set(null);
    this.confirmError.set(null);
    this.stalePreview.set(false);
    this.contributingTransactions.set([]);
    this.contributingTotal.set(0);
  }

  private newIdempotencyKey(): string {
    return globalThis.crypto?.randomUUID?.() ?? `reconciliation-${Date.now()}`;
  }

  private localToday(): string {
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }
}
