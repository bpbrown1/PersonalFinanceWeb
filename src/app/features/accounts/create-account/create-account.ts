import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { finalize } from 'rxjs';
import { AccountsApiService } from '../../../api/accounts/accounts-api.service';
import {
  AccountType,
  CreateFinancialAccountRequest,
  InterestRateType,
} from '../../../api/accounts/account.models';
import { ApiErrorPresenter } from '../../../api/errors/api-error-presenter.service';
import { AppHttpError } from '../../../api/errors/app-http-error';
import { SubmissionState } from '../../../api/request-state/submission-state';
import { HasPendingChanges } from '../../../core/guards/pending-changes.guard';
import { NotificationService } from '../../../core/notification.service';

@Component({
  selector: 'app-create-account',
  imports: [ReactiveFormsModule, RouterLink, ButtonModule, SelectModule],
  templateUrl: './create-account.html',
  styleUrl: './create-account.scss',
})
export class CreateAccount implements OnInit, HasPendingChanges {
  private readonly formBuilder = inject(FormBuilder);
  private readonly accountsApi = inject(AccountsApiService);
  private readonly errors = inject(ApiErrorPresenter);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly submission = new SubmissionState();
  protected readonly serverFieldErrors = signal<Readonly<Record<string, string>>>({});
  protected readonly currencies = signal<string[]>([]);
  protected readonly currenciesLoading = signal(true);
  protected readonly currenciesError = signal<AppHttpError | null>(null);
  protected readonly currencyCatalogReady = computed(
    () =>
      !this.currenciesLoading() && this.currenciesError() === null && this.currencies().length > 0,
  );
  protected readonly accountTypes: ReadonlyArray<{ value: AccountType; label: string }> = [
    { value: 'checking', label: 'Checking' },
    { value: 'savings', label: 'Savings' },
    { value: 'cash', label: 'Cash' },
    { value: 'credit_card', label: 'Credit card' },
    { value: 'loan', label: 'Loan' },
  ];
  protected readonly form = this.formBuilder.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    type: this.formBuilder.control<AccountType>('checking', {
      nonNullable: true,
      validators: Validators.required,
    }),
    currency: this.formBuilder.nonNullable.control('USD', [
      Validators.required,
      (control) => this.supportedCurrency(control),
    ]),
    openingDate: [this.today(), Validators.required],
    openingBalance: this.formBuilder.control<number | null>(null, [
      Validators.pattern(/^-?\d{1,17}(\.\d{1,2})?$/),
    ]),
    interestRate: this.formBuilder.control<number | null>(null, [
      Validators.min(0),
      Validators.max(999.999999),
      Validators.pattern(/^\d{1,3}(\.\d{1,6})?$/),
    ]),
  });

  ngOnInit(): void {
    let previousRateType = this.interestRateTypeFor(this.form.controls.type.value);
    this.form.controls.type.valueChanges.subscribe((type) => {
      const nextRateType = this.interestRateTypeFor(type);
      if (nextRateType !== previousRateType) this.form.controls.interestRate.setValue(null);
      previousRateType = nextRateType;
      this.serverFieldErrors.set({});
    });
    this.loadCurrencies();
  }

  protected interestRateTypeFor(type: AccountType): InterestRateType | null {
    if (type === 'checking' || type === 'savings') return 'apy';
    if (type === 'credit_card' || type === 'loan') return 'apr';
    return null;
  }

  protected interestRateLabel(type: AccountType): string {
    return this.interestRateTypeFor(type)?.toUpperCase() ?? '';
  }

  protected classificationLabel(type: AccountType): string {
    return type === 'credit_card' || type === 'loan' ? 'Liability' : 'Asset';
  }

  protected loadCurrencies(): void {
    this.currenciesLoading.set(true);
    this.currenciesError.set(null);
    this.accountsApi
      .listCurrencies()
      .pipe(finalize(() => this.currenciesLoading.set(false)))
      .subscribe({
        next: (currencies) => {
          if (currencies.length === 0) {
            this.currencies.set([]);
            this.currenciesError.set(
              new AppHttpError(
                'unexpected',
                'No supported currencies are available. Please try again.',
                null,
                {},
                true,
              ),
            );
            this.form.controls.currency.updateValueAndValidity({ emitEvent: false });
            return;
          }
          this.currencies.set(currencies);
          this.form.controls.currency.updateValueAndValidity({ emitEvent: false });
        },
        error: (error) => {
          this.currencies.set([]);
          this.currenciesError.set(this.errors.present(error));
          this.form.controls.currency.updateValueAndValidity({ emitEvent: false });
        },
      });
  }

  protected submit(): void {
    this.serverFieldErrors.set({});
    if (!this.currencyCatalogReady() || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submission
      .run(() => this.accountsApi.create(this.toRequest()))
      .subscribe({
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
      currency: value.currency,
      openingDate: value.openingDate!,
      ...(value.openingBalance === null ? {} : { openingBalance: value.openingBalance }),
      ...(value.interestRate === null
        ? {}
        : {
            interestRate: value.interestRate,
            interestRateType: this.interestRateTypeFor(value.type)!,
          }),
    };
  }

  private today(): string {
    const local = new Date();
    local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
    return local.toISOString().slice(0, 10);
  }

  private supportedCurrency(control: AbstractControl): { unsupportedCurrency: true } | null {
    return this.currencies().includes(control.value) ? null : { unsupportedCurrency: true };
  }
}
