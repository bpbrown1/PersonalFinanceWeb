import { CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { NotificationService } from '../../core/notification.service';

@Component({
  selector: 'app-overview',
  imports: [CurrencyPipe],
  templateUrl: './overview.html',
  styleUrl: './overview.scss',
})
export class Overview {
  private readonly notifications = inject(NotificationService);
  protected readonly summary = [
    { label: 'Net worth', value: 128450, detail: '+5.98% this month', tone: 'default' },
    { label: 'Monthly cash flow', value: 2840, detail: '$540 above last month', tone: 'positive' },
    { label: 'Income', value: 8200, detail: '4 deposits', tone: 'default' },
    { label: 'Spending', value: 5360, detail: '6.3% above last month', tone: 'negative' },
  ];
  protected announceDemo(): void { this.notifications.show('Dashboard data refreshed', 'success'); }
}
