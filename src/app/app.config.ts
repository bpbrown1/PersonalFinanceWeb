import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { provideApiBaseUrl } from './api/api.providers';
import { apiErrorInterceptor } from './api/errors/api-error.interceptor';
import { primeUiLicense } from './core/primeui-license';
import { personalFinancePrimeTheme } from './core/primeui-theme';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([apiErrorInterceptor])),
    provideApiBaseUrl(),
    providePrimeNG({
      license: primeUiLicense(),
      ripple: true,
      theme: {
        preset: personalFinancePrimeTheme,
        options: {
          darkModeSelector: "[data-theme='dark']",
          cssLayer: {
            name: 'primeng',
            order: 'primeng, app',
          },
        },
      },
    }),
  ],
};
