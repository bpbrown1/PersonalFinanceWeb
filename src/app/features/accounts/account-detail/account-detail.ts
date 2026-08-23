import { CurrencyPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AccountsApiService } from '../../../api/accounts/accounts-api.service';
import { AccountType, FinancialAccount, UpdateFinancialAccountRequest } from '../../../api/accounts/account.models';
import { ApiErrorPresenter } from '../../../api/errors/api-error-presenter.service';
import { AppHttpError } from '../../../api/errors/app-http-error';
import { SubmissionState } from '../../../api/request-state/submission-state';
import { HasPendingChanges } from '../../../core/guards/pending-changes.guard';
import { NotificationService } from '../../../core/notification.service';
import { PageState } from '../../../shared/page-state/page-state';

@Component({
  selector: 'app-account-detail',
  imports: [ReactiveFormsModule, RouterLink, PageState, CurrencyPipe, DatePipe, TitleCasePipe],
  templateUrl: './account-detail.html',
  styleUrls: ['../create-account/create-account.scss', './account-detail.scss'],
})
export class AccountDetail implements OnInit, HasPendingChanges {
  private readonly api = inject(AccountsApiService);
  private readonly errors = inject(ApiErrorPresenter);
  private readonly notifications = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly accountId = this.route.snapshot.paramMap.get('accountId')!;

  protected readonly account = signal<FinancialAccount | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<AppHttpError | null>(null);
  protected readonly serverFieldErrors = signal<Readonly<Record<string, string>>>({});
  protected readonly lifecycleBusy = signal(false);
  protected readonly submission = new SubmissionState();
  protected readonly accountTypes: ReadonlyArray<{ value: AccountType; label: string }> = [
    { value: 'checking', label: 'Checking' }, { value: 'savings', label: 'Savings' },
    { value: 'cash', label: 'Cash' }, { value: 'credit_card', label: 'Credit card' }, { value: 'loan', label: 'Loan' },
  ];
  protected readonly form = this.formBuilder.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    type: this.formBuilder.control<AccountType>('checking', { nonNullable: true, validators: Validators.required }),
    currency: ['USD', [Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)]],
    openingDate: ['', Validators.required],
    openingBalance: this.formBuilder.control<number | null>(null, [Validators.pattern(/^-?\d{1,17}(\.\d{1,2})?$/)]),
  });

  ngOnInit(): void { this.load(); }
  protected load(): void {
    this.loading.set(true); this.loadError.set(null);
    this.api.get(this.accountId).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (account) => { this.account.set(account); this.form.reset(this.formValue(account)); },
      error: (error) => this.loadError.set(this.errors.present(error)),
    });
  }
  protected save(): void {
    this.serverFieldErrors.set({});
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const request = this.changedFields();
    if (Object.keys(request).length === 0) return;
    this.submission.run(() => this.api.update(this.accountId, request)).subscribe({
      next: (account) => { this.account.set(account); this.form.reset(this.formValue(account)); this.notifications.show(`${account.name} was updated.`, 'success'); },
      error: (error: AppHttpError) => { this.serverFieldErrors.set(error.fieldErrors); this.errors.present(error); },
    });
  }
  protected archive(): void {
    const account = this.account();
    if (account && globalThis.confirm(`Archive ${account.name}? Its history will be retained.`)) this.changeLifecycle('archive');
  }
  protected restore(): void { this.changeLifecycle('restore'); }
  hasPendingChanges(): boolean { return this.form.dirty && !this.form.disabled; }
  @HostListener('window:beforeunload', ['$event']) protected warnBeforeUnload(event: BeforeUnloadEvent): void { if (this.hasPendingChanges()) event.preventDefault(); }

  private changeLifecycle(action: 'archive' | 'restore'): void {
    const account = this.account(); if (!account || this.lifecycleBusy()) return;
    this.lifecycleBusy.set(true);
    this.api[action](account.id).pipe(finalize(() => this.lifecycleBusy.set(false))).subscribe({
      next: (updated) => { this.account.set(updated); this.notifications.show(`${updated.name} was ${action === 'archive' ? 'archived' : 'restored'}.`, 'success'); void this.router.navigate(['/accounts']); },
      error: (error) => this.errors.present(error),
    });
  }
  private formValue(account: FinancialAccount) { return { name: account.name, type: account.type, currency: account.currency, openingDate: account.openingDate, openingBalance: account.openingBalance }; }
  private changedFields(): UpdateFinancialAccountRequest {
    const account = this.account()!; const value = this.form.getRawValue(); const request: UpdateFinancialAccountRequest = {};
    const name = value.name!.trim(); const currency = value.currency!.toUpperCase();
    if (name !== account.name) request.name = name;
    if (value.type !== account.type) request.type = value.type;
    if (currency !== account.currency) request.currency = currency;
    if (value.openingDate !== account.openingDate) request.openingDate = value.openingDate!;
    if (value.openingBalance !== null && value.openingBalance !== account.openingBalance) request.openingBalance = value.openingBalance;
    return request;
  }
}
