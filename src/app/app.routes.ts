import { Routes } from '@angular/router';
import { pendingChangesGuard } from './core/guards/pending-changes.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layout/app-shell/app-shell').then((m) => m.AppShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      {
        path: 'overview',
        title: 'Overview · Personal Finance',
        loadComponent: () => import('./features/overview/overview').then((m) => m.Overview),
      },
      {
        path: 'accounts',
        title: 'Accounts · Personal Finance',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/accounts/accounts-page/accounts-page').then((m) => m.AccountsPage),
          },
          {
            path: 'new',
            title: 'Add account · Personal Finance',
            canDeactivate: [pendingChangesGuard],
            loadComponent: () =>
              import('./features/accounts/create-account/create-account').then(
                (m) => m.CreateAccount,
              ),
          },
          {
            path: ':accountId/history',
            title: 'Balance history · Personal Finance',
            loadComponent: () =>
              import('./features/accounts/account-history/account-history').then(
                (m) => m.AccountHistory,
              ),
          },
          {
            path: ':accountId',
            title: 'Account details · Personal Finance',
            canDeactivate: [pendingChangesGuard],
            loadComponent: () =>
              import('./features/accounts/account-detail/account-detail').then(
                (m) => m.AccountDetail,
              ),
          },
        ],
      },
      {
        path: 'categories',
        title: 'Categories · Personal Finance',
        canDeactivate: [pendingChangesGuard],
        loadComponent: () =>
          import('./features/categories/categories-page/categories-page').then(
            (m) => m.CategoriesPage,
          ),
      },
      {
        path: 'transactions',
        title: 'Transactions · Personal Finance',
        canDeactivate: [pendingChangesGuard],
        loadComponent: () =>
          import('./features/transactions/transactions-page/transactions-page').then(
            (m) => m.TransactionsPage,
          ),
      },
      {
        path: 'budgets',
        title: 'Budgets · Personal Finance',
        canDeactivate: [pendingChangesGuard],
        loadComponent: () =>
          import('./features/budgets/budgets-page/budgets-page').then((m) => m.BudgetsPage),
      },
      ...['imports', 'reports', 'settings'].map((path): Routes[number] => ({
        path,
        title: `${path[0].toUpperCase()}${path.slice(1)} · Personal Finance`,
        loadComponent: () =>
          import('./features/feature-page/feature-page').then((m) => m.FeaturePage),
      })),
    ],
  },
  {
    path: '**',
    title: 'Page not found · Personal Finance',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
  },
];
