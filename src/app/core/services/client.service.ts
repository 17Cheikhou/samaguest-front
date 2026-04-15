import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { Client, ClientType, SpendingInfo, FamilyGroup } from '../models/client.model';

// Ré-exports pour rétrocompatibilité des composants existants
export type { Client, ClientType, SpendingInfo, FamilyGroup } from '../models/client.model';

@Injectable({ providedIn: 'root' })
export class ClientService {
  private http = inject(HttpClient);
  private API = 'http://127.0.0.1:8000/api';

  isLoading = signal(false);
  isSaving  = signal(false);
  error     = signal('');

  // ── Clients ───────────────────────────────────────────────────────────────

  getClients(): Observable<Client[]> {
    this.isLoading.set(true);
    this.error.set('');
    return this.http.get<any>(`${this.API}/clients`).pipe(
      tap({
        error: (err) => {
          this.error.set(err?.error?.message || 'Erreur de récupération');
          this.isLoading.set(false);
        }
      }),
      map((response: any) => {
        if (Array.isArray(response)) return response;
        if (response?.clients && Array.isArray(response.clients)) return response.clients;
        if (response?.data && Array.isArray(response.data)) return response.data;
        return [];
      }),
      tap({ next: () => this.isLoading.set(false) })
    );
  }

  getClientById(id: number): Observable<{ client: Client; spending_info: SpendingInfo }> {
    return this.http.get<{ client: Client; spending_info: SpendingInfo }>(`${this.API}/clients/${id}`);
  }

  createClient(client: Omit<Client, 'id'>): Observable<{ message: string; client: Client }> {
    this.isSaving.set(true);
    this.error.set('');
    return this.http.post<{ message: string; client: Client }>(`${this.API}/clients`, client).pipe(
      tap({
        next: () => this.isSaving.set(false),
        error: (err) => { this.error.set(err?.error?.message || 'Erreur lors de la création'); this.isSaving.set(false); }
      })
    );
  }

  updateClient(id: number, client: Partial<Client>): Observable<{ message: string; client: Client }> {
    this.isSaving.set(true);
    this.error.set('');
    return this.http.put<{ message: string; client: Client }>(`${this.API}/clients/${id}`, client).pipe(
      tap({
        next: () => this.isSaving.set(false),
        error: (err) => { this.error.set(err?.error?.message || 'Erreur lors de la mise à jour'); this.isSaving.set(false); }
      })
    );
  }

  deleteClient(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.API}/clients/${id}`).pipe(
      tap({ error: (err) => this.error.set(err?.error?.message || 'Erreur de suppression') })
    );
  }

  // ── Famille & Sous-comptes ────────────────────────────────────────────────

  getClientFamily(id: number): Observable<FamilyGroup> {
    return this.http.get<FamilyGroup>(`${this.API}/clients/${id}/family`);
  }

  // ── Plafond ───────────────────────────────────────────────────────────────

  resetSpending(id: number): Observable<{ message: string; client: Client }> {
    return this.http.post<{ message: string; client: Client }>(`${this.API}/clients/${id}/reset-spending`, {});
  }

  // ── Blocage ───────────────────────────────────────────────────────────────

  blockClient(id: number, reason: string): Observable<{ message: string; client: Client }> {
    return this.http.post<{ message: string; client: Client }>(`${this.API}/clients/${id}/block`, { reason });
  }

  unblockClient(id: number): Observable<{ message: string; client: Client }> {
    return this.http.post<{ message: string; client: Client }>(`${this.API}/clients/${id}/unblock`, {});
  }

  // ── Types ─────────────────────────────────────────────────────────────────

  getClientTypes(): Observable<ClientType[]> {
    return this.http.get<ClientType[]>(`${this.API}/client-types`);
  }

  createClientType(clientType: Omit<ClientType, 'id'>): Observable<ClientType> {
    this.isSaving.set(true);
    this.error.set('');
    return this.http.post<ClientType>(`${this.API}/client-types`, clientType).pipe(
      tap({
        next: () => this.isSaving.set(false),
        error: (err) => { this.error.set(err?.error?.message || 'Erreur de création'); this.isSaving.set(false); }
      })
    );
  }

  updateClientType(id: number, clientType: Partial<ClientType>): Observable<ClientType> {
    this.isSaving.set(true);
    this.error.set('');
    return this.http.put<ClientType>(`${this.API}/client-types/${id}`, clientType).pipe(
      tap({
        next: () => this.isSaving.set(false),
        error: (err) => { this.error.set(err?.error?.message || 'Erreur de mise à jour'); this.isSaving.set(false); }
      })
    );
  }

  deleteClientType(id: number): Observable<any> {
    return this.http.delete(`${this.API}/client-types/${id}`).pipe(
      tap({ error: (err) => this.error.set(err?.error?.message || 'Erreur de suppression') })
    );
  }

  // ── Utilitaires ───────────────────────────────────────────────────────────

  getSpendingPercentage(client: Client): number {
    if (!client.spending_limit || !client.current_month_spending) return 0;
    return Math.min(100, Math.round((client.current_month_spending / client.spending_limit) * 100));
  }

  isSubAccount(client: Client): boolean {
    return !!client.parent_client_id;
  }

  getRelationshipLabel(rel?: string | null): string {
    const map: Record<string, string> = {
      enfant: 'Enfant', conjoint: 'Conjoint(e)', parent: 'Parent',
      'frère': 'Frère', 'sœur': 'Sœur', autre: 'Autre'
    };
    return rel ? (map[rel] ?? rel) : '-';
  }

  getRelationshipIcon(rel?: string | null): string {
    const map: Record<string, string> = {
      enfant: '👶', conjoint: '💑', parent: '👴',
      'frère': '👦', 'sœur': '👧', autre: '👤'
    };
    return rel ? (map[rel] ?? '👤') : '👤';
  }
}
