import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthService {

  http   = inject(HttpClient);
  router = inject(Router);

  API         = 'http://127.0.0.1:8000/api';
  currentUser = signal<any>(null);
  /** Liste des clés de permissions effectives de l'utilisateur connecté */
  permissions = signal<string[]>([]);

  constructor() {
    this.loadCurrentUser();
  }

  loadCurrentUser() {
    if (this.isTokenExpired()) {
      this.clearSession();
      return;
    }
    const user = localStorage.getItem('user');
    if (user) {
      try { this.currentUser.set(JSON.parse(user)); } catch { this.clearSession(); return; }
    }
    const perms = localStorage.getItem('permissions');
    if (perms) {
      try { this.permissions.set(JSON.parse(perms)); } catch { /* ignore */ }
    }
  }

  login(data: any) {
    return this.http.post(`${this.API}/login`, data).pipe(
      tap((res: any) => {
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.user));
        if (res.expires_at) localStorage.setItem('token_expires_at', res.expires_at);
        if (res.pharmacy)   localStorage.setItem('pharmacy', JSON.stringify(res.pharmacy));
        const perms: string[] = res.permissions ?? [];
        localStorage.setItem('permissions', JSON.stringify(perms));
        this.currentUser.set(res.user);
        this.permissions.set(perms);
      })
    );
  }

  logout() {
    return this.http.post(`${this.API}/logout`, {}).pipe(
      tap(() => {
        this.clearSession();
        this.router.navigate(['/login']);
      })
    );
  }

  /** Vérifie si l'utilisateur connecté possède une permission */
  hasPermission(key: string): boolean {
    return this.permissions().includes(key);
  }

  isTokenExpired(): boolean {
    const expiresAt = localStorage.getItem('token_expires_at');
    if (!expiresAt) return false;
    return new Date() > new Date(expiresAt);
  }

  clearSession(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('pharmacy');
    localStorage.removeItem('token_expires_at');
    localStorage.removeItem('permissions');
    this.currentUser.set(null);
    this.permissions.set([]);
  }

  getUsers() {
    return this.http.get(`${this.API}/users`);
  }

  getUserById(id: number) {
    return this.http.get(`${this.API}/users/${id}`);
  }

  getSessionInfo() {
    return this.currentUser();
  }
}

  