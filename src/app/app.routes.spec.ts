import { routes } from './app.routes';

describe('application routes', () => {
  it('redirects the root path to overview', () => {
    const shell = routes.find((route) => route.path === '');
    const redirect = shell?.children?.find((route) => route.path === '');
    expect(redirect).toMatchObject({ pathMatch: 'full', redirectTo: 'overview' });
  });

  it('defines every durable feature route with a title and lazy loader', () => {
    const shell = routes.find((route) => route.path === '');
    const expected = ['overview', 'transactions', 'categories', 'imports', 'reports', 'settings'];

    for (const path of expected) {
      const route = shell?.children?.find((candidate) => candidate.path === path);
      expect(route?.title).toBe(`${path[0].toUpperCase()}${path.slice(1)} · Personal Finance`);
      expect(route?.loadComponent).toBeTypeOf('function');
    }
  });

  it('defines lazy account entry, creation, and protected detail routes', () => {
    const shell = routes.find((route) => route.path === '');
    const accounts = shell?.children?.find((route) => route.path === 'accounts');
    const landing = accounts?.children?.find((route) => route.path === '');
    const create = accounts?.children?.find((route) => route.path === 'new');
    const detail = accounts?.children?.find((route) => route.path === ':accountId');
    const history = accounts?.children?.find((route) => route.path === ':accountId/history');

    expect(accounts?.title).toBe('Accounts · Personal Finance');
    expect(landing?.loadComponent).toBeTypeOf('function');
    expect(create?.title).toBe('Add account · Personal Finance');
    expect(create?.loadComponent).toBeTypeOf('function');
    expect(create?.canDeactivate).toHaveLength(1);
    expect(detail?.title).toBe('Account details · Personal Finance');
    expect(detail?.loadComponent).toBeTypeOf('function');
    expect(detail?.canDeactivate).toHaveLength(1);
    expect(history?.title).toBe('Balance history · Personal Finance');
    expect(history?.loadComponent).toBeTypeOf('function');
  });

  it('protects the lazy category management route from losing unsaved changes', () => {
    const shell = routes.find((route) => route.path === '');
    const categories = shell?.children?.find((route) => route.path === 'categories');
    expect(categories?.title).toBe('Categories · Personal Finance');
    expect(categories?.loadComponent).toBeTypeOf('function');
    expect(categories?.canDeactivate).toHaveLength(1);
  });

  it('protects the lazy transaction workspace from losing unsaved changes', () => {
    const shell = routes.find((route) => route.path === '');
    const transactions = shell?.children?.find((route) => route.path === 'transactions');
    expect(transactions?.title).toBe('Transactions · Personal Finance');
    expect(transactions?.loadComponent).toBeTypeOf('function');
    expect(transactions?.canDeactivate).toHaveLength(1);
  });

  it('provides a lazy wildcard route with a not-found title', () => {
    const wildcard = routes.find((route) => route.path === '**');
    expect(wildcard?.title).toBe('Page not found · Personal Finance');
    expect(wildcard?.loadComponent).toBeTypeOf('function');
  });
});
