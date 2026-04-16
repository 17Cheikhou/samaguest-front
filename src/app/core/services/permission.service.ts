import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of, tap } from 'rxjs';

export interface PermissionItem {
  key: string;
  label: string;
  category: string;
  from_role: boolean;
  override: boolean | null;   // null = pas d'override
  effective: boolean;
}

export interface UserPermissionsResponse {
  user: { id: number; name: string; role: string };
  permissions: Record<string, PermissionItem[]>; // clé = catégorie
}

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private http = inject(HttpClient);
  private API  = 'http://127.0.0.1:8000/api';

  loading = signal(false);
  saving  = signal(false);
  error   = signal<string | null>(null);

  fetchUserPermissions(userId: number) {
    this.loading.set(true);
    this.error.set(null);
    return this.http.get<UserPermissionsResponse>(`${this.API}/users/${userId}/permissions`).pipe(
      tap(() => this.loading.set(false)),
      catchError(err => {
        this.loading.set(false);
        this.error.set(err?.error?.message || `Erreur ${err?.status}`);
        return of(null);
      })
    );
  }

  updateUserPermissions(userId: number, overrides: { key: string; value: boolean | null }[]) {
    this.saving.set(true);
    this.error.set(null);
    return this.http.put<{ message: string }>(
      `${this.API}/users/${userId}/permissions`,
      { overrides }
    ).pipe(
      tap(() => this.saving.set(false)),
      catchError(err => {
        this.saving.set(false);
        this.error.set(err?.error?.message || `Erreur ${err?.status}`);
        return of(null);
      })
    );
  }
}
