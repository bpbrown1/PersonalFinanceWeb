import { routes } from './app.routes';

describe('application routes', () => {
  it('redirects the root path to overview', () => {
    const shell = routes.find((route) => route.path === '');
    const redirect = shell?.children?.find((route) => route.path === '');
    expect(redirect).toMatchObject({ pathMatch: 'full', redirectTo: 'overview' });
  });

  it('defines every durable feature route with a title and lazy loader', () => {
    const shell = routes.find((route) => route.path === '');
    const expected = ['overview', 'accounts', 'transactions', 'categories', 'imports', 'reports', 'settings'];

    for (const path of expected) {
      const route = shell?.children?.find((candidate) => candidate.path === path);
      expect(route?.title).toBe(`${path[0].toUpperCase()}${path.slice(1)} · Personal Finance`);
      expect(route?.loadComponent).toBeTypeOf('function');
    }
  });

  it('provides a lazy wildcard route with a not-found title', () => {
    const wildcard = routes.find((route) => route.path === '**');
    expect(wildcard?.title).toBe('Page not found · Personal Finance');
    expect(wildcard?.loadComponent).toBeTypeOf('function');
  });
});
