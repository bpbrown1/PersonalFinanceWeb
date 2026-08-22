import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { normalizeHttpError } from './app-http-error';

export const apiErrorInterceptor: HttpInterceptorFn = (request, next) =>
  next(request).pipe(catchError((error: unknown) => throwError(() => normalizeHttpError(error))));
