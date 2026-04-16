import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { AuthService } from './auth.service';

export interface User {
  id: number;
  name: string;
  email: string;
  role: any;
  avatar?: string;
  pharmacy_id?: number;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private http        = inject(HttpClient);
  private authService = inject(AuthService);
  private API         = 'http://127.0.0.1:8000/api';

  // Source unique : le signal d'AuthService
  user = this.authService.currentUser;

  fetchProfile(): Observable<any> {
    return this.http.get<any>(`${this.API}/profile`).pipe(
      tap(res => {
        this.authService.currentUser.set(res.user);
        localStorage.setItem('user', JSON.stringify(res.user));
        if (res.permissions) {
          this.authService.permissions.set(res.permissions);
          localStorage.setItem('permissions', JSON.stringify(res.permissions));
        }
      })
    );
  }

  updateUser(updates: Partial<User>): void {
    const current = this.user();
    if (current) {
      const updated = { ...current, ...updates };
      this.authService.currentUser.set(updated);
      localStorage.setItem('user', JSON.stringify(updated));
    }
  }

  logout(): void {
    this.authService.logout().subscribe();
  }

  getRole(): string {
    return this.user()?.role?.name || this.user()?.role || '';
  }

  /** Vérifie une permission effective (inclut les surcharges admin) */
  hasPermission(key: string): boolean {
    return this.authService.hasPermission(key);
  }

  isAllowed(roles: string[]): boolean {
    return roles.includes(this.getRole());
  }
}
