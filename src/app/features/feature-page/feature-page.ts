import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PageState } from '../../shared/page-state/page-state';

@Component({
  selector: 'app-feature-page',
  imports: [PageState],
  template: `
    <header class="page-header"><p>Personal Finance</p><h1>{{ title() }}</h1></header>
    <app-page-state kind="empty" [title]="title() + ' is ready for its next story'" [message]="message()" />
  `,
  styles: `
    .page-header { margin-bottom: 1.5rem; } p { margin: 0; color: var(--color-primary); font-size: .78rem; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; } h1 { margin: .25rem 0 0; font-size: clamp(2rem, 4vw, 2.7rem); letter-spacing: -.04em; }
  `,
})
export class FeaturePage {
  private readonly route = inject(ActivatedRoute);
  protected readonly title = computed(() => this.toTitle(this.route.snapshot.routeConfig?.path ?? 'Feature'));
  protected readonly message = computed(() => `The ${this.title().toLowerCase()} workspace and navigation are in place. Feature behavior will arrive in its dedicated user story.`);
  private toTitle(value: string): string { return value.charAt(0).toUpperCase() + value.slice(1); }
}
