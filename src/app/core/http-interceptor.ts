import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const httpInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = localStorage.getItem('token');

  const cloned = req.clone({
    setHeaders: {
      Authorization: token ? `Bearer ${token}` : '',
    }
  });

  return next(cloned).pipe(
    catchError(err => {
      if (err.status === 401) {
        localStorage.removeItem('token');
        router.navigate(['/login']);
      }
      return throwError(() => err);
    })
  );
};
