import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'personal-finance-theme';
  readonly mode = signal<ThemeMode>(this.initialMode());

  constructor() {
    this.apply(this.mode());
  }

  toggle(): void {
    const next = this.mode() === 'light' ? 'dark' : 'light';
    this.mode.set(next);
    this.apply(next);
    globalThis.localStorage?.setItem(this.storageKey, next);
  }

  private initialMode(): ThemeMode {
    const saved = globalThis.localStorage?.getItem(this.storageKey);
    if (saved === 'light' || saved === 'dark') return saved;
    return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private apply(mode: ThemeMode): void {
    this.document.documentElement.dataset['theme'] = mode;
    this.document.documentElement.style.colorScheme = mode;
  }
}
