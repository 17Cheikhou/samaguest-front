import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {

  http = inject(HttpClient);

  API = 'http://127.0.0.1:8000/api';

  login(data: any) {
    return this.http.post(`${this.API}/login`, data).pipe(
      tap((res: any) => {
        console.log(res);
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.user));
        if (res.pharmacy) {
          localStorage.setItem('pharmacy', JSON.stringify(res.pharmacy));
        }
      })
    );
  }
}
