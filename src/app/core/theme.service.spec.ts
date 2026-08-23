import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset['theme'];
    TestBed.resetTestingModule();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('restores and applies a saved theme', () => {
    localStorage.setItem('personal-finance-theme', 'dark');
    const service = TestBed.inject(ThemeService);

    expect(service.mode()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('uses the operating-system preference when no theme is saved', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    const service = TestBed.inject(ThemeService);
    expect(service.mode()).toBe('dark');
  });

  it('toggles the document theme and persists the selection', () => {
    localStorage.setItem('personal-finance-theme', 'light');
    const service = TestBed.inject(ThemeService);
    service.toggle();

    expect(service.mode()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(localStorage.getItem('personal-finance-theme')).toBe('dark');
  });
});
