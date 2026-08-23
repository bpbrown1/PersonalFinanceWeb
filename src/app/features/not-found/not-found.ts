import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `<main><span>404</span><h1>That page is off the books.</h1><p>We could not find the page you requested.</p><a routerLink="/overview">Return to overview</a></main>`,
  styles: `
    :host { display: grid; min-height: 100dvh; place-items: center; padding: 1.5rem; background: var(--color-canvas); } main { text-align: center; } span { color: var(--color-primary); font-size: .85rem; font-weight: 900; letter-spacing: .1em; } h1 { margin: .5rem 0; font-size: clamp(2rem, 6vw, 4rem); letter-spacing: -.05em; } p { margin: 0 0 1.5rem; color: var(--color-muted); } a { display: inline-block; padding: .8rem 1.1rem; border-radius: .65rem; color: #fff; background: var(--color-primary); text-decoration: none; font-weight: 800; }
  `,
})
export class NotFound {}
