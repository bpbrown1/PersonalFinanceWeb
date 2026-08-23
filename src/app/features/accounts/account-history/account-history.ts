import { CurrencyPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { AccountBalancesApiService } from '../../../api/accounts/account-balances-api.service';
import { AccountsApiService } from '../../../api/accounts/accounts-api.service';
import { AccountBalanceAsOf, BalanceSnapshot } from '../../../api/accounts/balance.models';
import { FinancialAccount } from '../../../api/accounts/account.models';
import { ApiErrorPresenter } from '../../../api/errors/api-error-presenter.service';
import { AppHttpError } from '../../../api/errors/app-http-error';
import { PageState } from '../../../shared/page-state/page-state';

type HistoryRange = '30d' | '90d' | '1y' | 'custom';

@Component({
  selector: 'app-account-history',
  imports: [RouterLink, FormsModule, PageState, CurrencyPipe, DatePipe, TitleCasePipe],
  templateUrl: './account-history.html',
  styleUrl: './account-history.scss',
})
export class AccountHistory implements OnInit {
  private readonly accountsApi = inject(AccountsApiService);
  private readonly balancesApi = inject(AccountBalancesApiService);
  private readonly errors = inject(ApiErrorPresenter);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly accountId = this.route.snapshot.paramMap.get('accountId')!;

  protected readonly account = signal<FinancialAccount | null>(null);
  protected readonly snapshots = signal<BalanceSnapshot[]>([]);
  protected readonly range = signal<HistoryRange>('90d');
  protected readonly customFrom = signal('');
  protected readonly customTo = signal('');
  protected readonly loading = signal(true);
  protected readonly loadError = signal<AppHttpError | null>(null);
  protected readonly asOfDate = signal('');
  protected readonly asOfResult = signal<AccountBalanceAsOf | null>(null);
  protected readonly asOfError = signal<AppHttpError | null>(null);
  protected readonly asOfLoading = signal(false);
  protected readonly customRangeValid = computed(() => Boolean(this.customFrom() && this.customTo() && this.customFrom() <= this.customTo()));

  protected readonly filteredSnapshots = computed(() => {
    const { from, to } = this.boundaries();
    return this.snapshots().filter((snapshot) => {
      const instant = Date.parse(snapshot.effectiveAt);
      return instant >= from && instant <= to;
    });
  });
  protected readonly change = computed(() => {
    const values = this.filteredSnapshots();
    return values.length < 2 ? null : values.at(-1)!.balance - values[0].balance;
  });
  protected readonly chartPoints = computed(() => {
    const values = this.filteredSnapshots();
    if (!values.length) return [];
    const width = 800, height = 260, pad = 28;
    const times = values.map((value) => Date.parse(value.effectiveAt));
    const balances = values.map((value) => value.balance);
    const minTime = Math.min(...times), maxTime = Math.max(...times);
    const minBalance = Math.min(...balances), maxBalance = Math.max(...balances);
    return values.map((value, index) => ({
      x: minTime === maxTime ? width / 2 : pad + ((times[index] - minTime) / (maxTime - minTime)) * (width - pad * 2),
      y: minBalance === maxBalance ? height / 2 : height - pad - ((balances[index] - minBalance) / (maxBalance - minBalance)) * (height - pad * 2),
      snapshot: value,
    }));
  });
  protected readonly polyline = computed(() => this.chartPoints().map((point) => `${point.x},${point.y}`).join(' '));

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const range = params.get('range');
      const selectedRange: HistoryRange = range === '30d' || range === '1y' || range === 'custom' ? range : '90d';
      const defaults = this.defaultCustomRange(selectedRange);
      this.range.set(selectedRange);
      this.customFrom.set(params.get('from') ?? defaults.from);
      this.customTo.set(params.get('to') ?? defaults.to);
    });
    this.load();
  }

  protected load(): void {
    this.loading.set(true); this.loadError.set(null);
    forkJoin({ account: this.accountsApi.get(this.accountId), snapshots: this.balancesApi.history(this.accountId) })
      .pipe(finalize(() => this.loading.set(false))).subscribe({
        next: ({ account, snapshots }) => { this.account.set(account); this.snapshots.set(snapshots); },
        error: (error) => this.loadError.set(this.errors.present(error)),
      });
  }

  protected selectRange(range: Exclude<HistoryRange, 'custom'>): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { range, from: null, to: null }, queryParamsHandling: 'merge' });
  }

  protected applyCustomRange(): void {
    if (!this.customRangeValid()) return;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { range: 'custom', from: this.customFrom(), to: this.customTo() }, queryParamsHandling: 'merge' });
  }

  protected findAsOf(): void {
    if (!this.asOfDate()) return;
    this.asOfLoading.set(true); this.asOfResult.set(null); this.asOfError.set(null);
    const instant = new Date(`${this.asOfDate()}T23:59:59.999`).toISOString();
    this.balancesApi.asOf(this.accountId, instant).pipe(finalize(() => this.asOfLoading.set(false))).subscribe({
      next: (result) => this.asOfResult.set(result),
      error: (error) => this.asOfError.set(this.errors.present(error)),
    });
  }

  private boundaries(): { from: number; to: number } {
    if (this.range() === 'custom' && this.customFrom() && this.customTo()) {
      return { from: new Date(`${this.customFrom()}T00:00:00`).getTime(), to: new Date(`${this.customTo()}T23:59:59.999`).getTime() };
    }
    const to = Date.now(); const days = this.range() === '30d' ? 30 : this.range() === '1y' ? 365 : 90;
    return { from: to - days * 86_400_000, to };
  }

  private defaultCustomRange(range: HistoryRange): { from: string; to: string } {
    const days = range === '30d' ? 30 : range === '1y' ? 365 : 90;
    const to = new Date();
    const from = new Date(to.getTime() - days * 86_400_000);
    return { from: this.localDateValue(from), to: this.localDateValue(to) };
  }

  private localDateValue(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }
}
