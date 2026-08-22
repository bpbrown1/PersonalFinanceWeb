import { Routes } from '@angular/router';

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
      ...['accounts', 'transactions', 'categories', 'imports', 'reports', 'settings'].map(
        (path): Routes[number] => ({
          path,
          title: `${path[0].toUpperCase()}${path.slice(1)} · Personal Finance`,
          loadComponent: () => import('./features/feature-page/feature-page').then((m) => m.FeaturePage),
        }),
      ),
    ],
  },
  {
    path: '**',
    title: 'Page not found · Personal Finance',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
  },
];
