import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeService } from '../../core/theme.service';
import { NotificationCenter } from '../../shared/notification-center/notification-center';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, NotificationCenter],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  protected readonly theme = inject(ThemeService);
  protected readonly menuOpen = signal(false);
  protected readonly navItems: NavItem[] = [
    { label: 'Overview', path: '/overview', icon: '⌂' },
    { label: 'Accounts', path: '/accounts', icon: '▤' },
    { label: 'Transactions', path: '/transactions', icon: '↔' },
    { label: 'Budgets', path: '/budgets', icon: '◎' },
    { label: 'Categories', path: '/categories', icon: '◫' },
    { label: 'Imports', path: '/imports', icon: '⇧' },
    { label: 'Reports', path: '/reports', icon: '▥' },
    { label: 'Settings', path: '/settings', icon: '⚙' },
  ];
}
