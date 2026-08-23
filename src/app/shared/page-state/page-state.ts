import { Component, input, output } from '@angular/core';

export type PageStateKind = 'loading' | 'empty' | 'error';

@Component({
  selector: 'app-page-state',
  template: `
    <section class="state" [attr.aria-busy]="kind() === 'loading'" [attr.role]="kind() === 'error' ? 'alert' : 'status'">
      <span class="state-icon" aria-hidden="true">{{ icon }}</span>
      <h2>{{ title() }}</h2>
      <p>{{ message() }}</p>
      @if (actionLabel()) { <button type="button" (click)="action.emit()">{{ actionLabel() }}</button> }
    </section>
  `,
  styles: `
    .state { min-height: 18rem; display: grid; place-items: center; align-content: center; gap: .55rem; padding: 2rem; text-align: center; color: var(--color-muted); background: var(--color-surface); border: 1px dashed var(--color-border-strong); border-radius: 1rem; }
    .state-icon { display: grid; place-items: center; width: 3rem; height: 3rem; color: var(--color-primary); background: var(--color-primary-soft); border-radius: 50%; font-size: 1.35rem; }
    h2, p { margin: 0; } h2 { color: var(--color-text); font-size: 1.1rem; } p { max-width: 32rem; }
    button { margin-top: .5rem; padding: .7rem 1rem; border: 0; border-radius: .6rem; color: white; background: var(--color-primary); font: inherit; font-weight: 700; cursor: pointer; }
  `,
})
export class PageState {
  readonly kind = input.required<PageStateKind>();
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly actionLabel = input<string>();
  readonly action = output<void>();
  get icon(): string { return { loading: '◌', empty: '○', error: '!' }[this.kind()]; }
}
