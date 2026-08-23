import { CurrencyPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AccountsApiService } from '../../../api/accounts/accounts-api.service';
import { AccountStatusFilter, FinancialAccount } from '../../../api/accounts/account.models';
import { ApiErrorPresenter } from '../../../api/errors/api-error-presenter.service';
import { AppHttpError } from '../../../api/errors/app-http-error';
import { NotificationService } from '../../../core/notification.service';
import { PageState } from '../../../shared/page-state/page-state';

@Component({
  selector: 'app-accounts-page',
  imports: [RouterLink, PageState, CurrencyPipe, DatePipe, TitleCasePipe],
  templateUrl: './accounts-page.html',
  styleUrl: './accounts-page.scss',
})
export class AccountsPage implements OnInit {
  private readonly api = inject(AccountsApiService);
  private readonly errors = inject(ApiErrorPresenter);
  private readonly notifications = inject(NotificationService);
  protected readonly accounts = signal<FinancialAccount[]>([]);
  protected readonly filter = signal<AccountStatusFilter>('active');
  protected readonly loading = signal(true);
  protected readonly error = signal<AppHttpError | null>(null);
  protected readonly changingId = signal<string | null>(null);

  ngOnInit(): void { this.load(); }
  protected selectFilter(filter: AccountStatusFilter): void { if (filter !== this.filter()) { this.filter.set(filter); this.load(); } }
  protected load(): void {
    this.loading.set(true); this.error.set(null);
    this.api.list(this.filter()).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (accounts) => this.accounts.set(accounts),
      error: (error) => this.error.set(this.errors.present(error)),
    });
  }
  protected archive(account: FinancialAccount): void {
    if (globalThis.confirm(`Archive ${account.name}? Its history will be retained.`)) this.changeStatus(account, 'archive');
  }
  protected restore(account: FinancialAccount): void { this.changeStatus(account, 'restore'); }
  private changeStatus(account: FinancialAccount, action: 'archive' | 'restore'): void {
    if (this.changingId()) return;
    this.changingId.set(account.id);
    this.api[action](account.id).pipe(finalize(() => this.changingId.set(null))).subscribe({
      next: () => { this.notifications.show(`${account.name} was ${action === 'archive' ? 'archived' : 'restored'}.`, 'success'); this.load(); },
      error: (error) => this.errors.present(error),
    });
  }
}
