import { Component, HostListener, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AccountsApiService } from '../../../api/accounts/accounts-api.service';
import { AccountType, CreateFinancialAccountRequest } from '../../../api/accounts/account.models';
import { ApiErrorPresenter } from '../../../api/errors/api-error-presenter.service';
import { AppHttpError } from '../../../api/errors/app-http-error';
import { SubmissionState } from '../../../api/request-state/submission-state';
import { HasPendingChanges } from '../../../core/guards/pending-changes.guard';
import { NotificationService } from '../../../core/notification.service';

@Component({
  selector: 'app-create-account',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './create-account.html',
  styleUrl: './create-account.scss',
})
export class CreateAccount implements HasPendingChanges {
  private readonly formBuilder = inject(FormBuilder);
  private readonly accountsApi = inject(AccountsApiService);
  private readonly errors = inject(ApiErrorPresenter);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly submission = new SubmissionState();
  protected readonly serverFieldErrors = signal<Readonly<Record<string, string>>>({});
  protected readonly accountTypes: ReadonlyArray<{ value: AccountType; label: string }> = [
    { value: 'checking', label: 'Checking' },
    { value: 'savings', label: 'Savings' },
    { value: 'cash', label: 'Cash' },
    { value: 'credit_card', label: 'Credit card' },
    { value: 'loan', label: 'Loan' },
  ];
  protected readonly form = this.formBuilder.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    type: this.formBuilder.control<AccountType>('checking', { nonNullable: true, validators: Validators.required }),
    currency: ['USD', [Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)]],
    openingDate: [this.today(), Validators.required],
    openingBalance: this.formBuilder.control<number | null>(null, [Validators.pattern(/^-?\d{1,17}(\.\d{1,2})?$/)]),
  });

  protected submit(): void {
    this.serverFieldErrors.set({});
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submission.run(() => this.accountsApi.create(this.toRequest())).subscribe({
      next: (account) => {
        this.form.markAsPristine();
        this.notifications.show(account.name + ' was added successfully.', 'success');
        void this.router.navigate(['/accounts']);
      },
      error: (error: AppHttpError) => {
        this.serverFieldErrors.set(error.fieldErrors);
        this.errors.present(error);
      },
    });
  }

  hasPendingChanges(): boolean {
    return this.form.dirty && !this.form.disabled;
  }

  @HostListener('window:beforeunload', ['$event'])
  protected warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasPendingChanges()) event.preventDefault();
  }

  private toRequest(): CreateFinancialAccountRequest {
    const value = this.form.getRawValue();
    return {
      name: value.name!.trim(),
      type: value.type,
      currency: value.currency!.toUpperCase(),
      openingDate: value.openingDate!,
      ...(value.openingBalance === null ? {} : { openingBalance: value.openingBalance }),
    };
  }

  private today(): string {
    const local = new Date();
    local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
    return local.toISOString().slice(0, 10);
  }
}
