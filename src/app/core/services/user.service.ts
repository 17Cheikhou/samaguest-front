import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

export interface User {
  id: number;
  name: string;
  email: string;
  role: string ;
  avatar?: string;
  pharmacy_id?: number;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  http = inject(HttpClient);
  API = 'http://127.0.0.1:8000/api';
  user = signal<any>(null);

  constructor() {
    this.loadFromStorage();
  }

  loadFromStorage() {
    const raw = localStorage.getItem('user');
    if (raw) {
      try {
        const userData = JSON.parse(raw);
        this.user.set(userData);
      } catch (error) {
        console.error('Erreur lors du chargement des données utilisateur:', error);
        localStorage.removeItem('user');
      }
    }
  }

  fetchProfile(): Observable<any> {
    return this.http.get<any>(`${this.API}/profile`).pipe(
      tap(res => {
        this.user.set(res.user);
        localStorage.setItem('user', JSON.stringify(res.user));
      })
    );
  }

  updateUser(updates: Partial<User>): void {
    const currentUser = this.user();
    if (currentUser) {
      const updatedUser = { ...currentUser, ...updates };
      this.user.set(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  }

 logout(): void {
  this.http.post(`${this.API}/logout`, {}).subscribe({
    next: () => {
      // Nettoyer le frontend seulement si le backend a bien déconnecté
      this.user.set(null);
      localStorage.removeItem('user');
    },
    error: (err) => {
      console.error('Erreur lors du logout', err);
      this.user.set(null);
      localStorage.removeItem('user');
    }
  });
}


  getRole(): string {
    return this.user()?.role.name || '';
  }

  isAllowed(roles: string[]): boolean {
    const userRole = this.getRole();
    return roles.includes(userRole);
  }
}
