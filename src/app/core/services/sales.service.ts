import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Client, SpendingInfo, SpendingCheckResult, SpendingWarning } from '../models/client.model';

// Ré-export pour rétrocompatibilité (sale.ts importe Clients depuis ce fichier)
export type { Client as Clients } from '../models/client.model';
export type { SpendingInfo, SpendingCheckResult, SpendingWarning } from '../models/client.model';

export interface Product {
  id: number;
  name: string;
  cip?: string;
  selling_price: number;
  global_stock: number;   // Stock entrepôt (nom réel en DB)
  display_stock?: number; // Stock armoire
  stock?: number;         // Alias legacy (peut être absent)
  form?: string;
  laboratory?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;
  subtotal: number;
  discount_amount: number;
  total: number;
}

export interface SaleItem {
  product_id: number;
  quantity: number;
  unit_price: number;
  subtotal: number;
  discount_percentage?: number;
  discount_amount?: number;
  total: number;
}

export interface Sale {
  id?: number;
  user_id?: number;
  pharmacy_id?: number;
  client_id?: number | null;
  client_name?: string | null;
  total_amount: number;
  discount_total?: number;
  payment_method: 'cash' | 'wave' | 'card' | 'check';
  status?: 'pending' | 'completed' | 'cancelled';
  reference?: string;
  note?: string;
  items?: SaleItem[];
  expires_at?: string | null;
  created_at?: string;
  updated_at?: string;
  user?: { id: number; name: string; email: string; };
  client?: { id: number; first_name: string; last_name: string; };
}

export interface SyncEvent {
  id: number;
  entity_type: string;
  entity_id: number;
  action: 'create' | 'update' | 'delete';
  data: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface SyncStatus {
  pending: number;
  syncing: number;
  synced: number;
  failed: number;
  total: number;
}

export interface SyncStatusResponse  { queue: SyncStatus; last_sync: string | null; }
export interface SyncHistoryResponse { count: number; events: SyncEvent[]; pagination: { current_page: number; total_pages: number; }; }
export interface SyncUsersResponse   { status: string; result: { processed: number; created: number; updated: number; errors: string[]; }; }
export interface SalesResponse       { count: number; sales: Sale[]; pagination: { current_page: number; total_pages: number; }; }
export interface SaleCreateRequest   { client_id?: number | null; client_name?: string | null; items: SaleItem[]; payment_method: 'cash'|'wave'|'card'|'check'; total_amount: number; discount_total?: number; reference?: string; note?: string; }

@Injectable({ providedIn: 'root' })
export class SalesService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8000/api';

  // ── Panier ────────────────────────────────────────────────────────────────
  cart             = signal<CartItem[]>([]);
  selectedClient   = signal<Client | null>(null);
  walkinClientName = signal<string>('');

  // ── États UI ──────────────────────────────────────────────────────────────
  _isLoading       = signal(false);
  _isCreating      = signal(false);
  _isSyncing       = signal(false);
  _isRetrying      = signal(false);
  _isSyncingUsers  = signal(false);
  _isCheckingLimit = signal(false);
  _error           = signal<string | null>(null);
  _createError     = signal<string | null>(null);
  _spendingWarning = signal<SpendingWarning | null>(null);

  // ── Sync ──────────────────────────────────────────────────────────────────
  syncStatus       = signal<SyncStatus>({ pending:0, syncing:0, synced:0, failed:0, total:0 });
  syncHistory      = signal<SyncEvent[]>([]);
  syncHistoryTotal = signal(0);

  // ── Calculs panier ────────────────────────────────────────────────────────
  cartTotal      = computed(() => this.cart().reduce((s, i) => s + i.total, 0));
  cartSubtotal   = computed(() => this.cart().reduce((s, i) => s + i.subtotal, 0));
  cartDiscount   = computed(() => this.cart().reduce((s, i) => s + i.discount_amount, 0));
  cartItemsCount = computed(() => this.cart().reduce((s, i) => s + i.quantity, 0));

  // ── Infos plafond client actuel ───────────────────────────────────────────
  clientSpendingPercent = computed(() => {
    const c = this.selectedClient();
    if (!c?.spending_limit || !c.current_month_spending) return 0;
    return Math.min(100, Math.round((c.current_month_spending / c.spending_limit) * 100));
  });

  clientRemainingBudget = computed(() => {
    const c = this.selectedClient();
    if (!c?.spending_limit) return null;
    return Math.max(0, c.spending_limit - (c.current_month_spending || 0));
  });

  cartExceedsLimit = computed(() => {
    const remaining = this.clientRemainingBudget();
    if (remaining === null) return false;
    return this.cartTotal() > remaining;
  });

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' });
  }

  // ── Panier : gestion ─────────────────────────────────────────────────────

  addToCart(product: Product, quantity: number = 1): void {
    const existing = this.cart().find(i => i.product.id === product.id);
    if (existing) {
      this.updateCartItemQuantity(product.id, existing.quantity + quantity);
    } else {
      const discount = this.selectedClient()?.discount_percentage || 0;
      const subtotal = product.selling_price * quantity;
      const discountAmount = (subtotal * discount) / 100;
      this.cart.update(items => [...items, {
        product, quantity,
        unit_price: product.selling_price,
        subtotal,
        discount_amount: discountAmount,
        total: subtotal - discountAmount
      }]);
    }
    this._spendingWarning.set(null);
  }

  updateCartItemQuantity(productId: number, quantity: number): void {
    if (quantity <= 0) { this.removeFromCart(productId); return; }
    const discount = this.selectedClient()?.discount_percentage || 0;
    this.cart.update(items => items.map(i => {
      if (i.product.id !== productId) return i;
      const subtotal = i.unit_price * quantity;
      const discountAmount = (subtotal * discount) / 100;
      return { ...i, quantity, subtotal, discount_amount: discountAmount, total: subtotal - discountAmount };
    }));
  }

  removeFromCart(productId: number): void {
    this.cart.update(items => items.filter(i => i.product.id !== productId));
  }

  clearCart(): void {
    this.cart.set([]);
    this.selectedClient.set(null);
    this.walkinClientName.set('');
    this._spendingWarning.set(null);
  }

  recalculateCartWithDiscount(): void {
    const discount = this.selectedClient()?.discount_percentage || 0;
    this.cart.update(items => items.map(i => {
      const subtotal = i.unit_price * i.quantity;
      const discountAmount = (subtotal * discount) / 100;
      return { ...i, subtotal, discount_amount: discountAmount, total: subtotal - discountAmount };
    }));
  }

  selectClient(client: Client | null): void {
    this._spendingWarning.set(null);
    if (client && client.is_active === false) {
      this._spendingWarning.set({
        type: 'blocked',
        message: `Compte bloqué : ${client.blocked_reason || 'Raison non précisée'}`
      });
    }
    this.selectedClient.set(client);
    this.walkinClientName.set('');
    if (this.cart().length > 0) this.recalculateCartWithDiscount();
  }

  setWalkinClientName(name: string): void {
    this.walkinClientName.set(name);
    this.selectedClient.set(null);
    this._spendingWarning.set(null);
  }

  // ── Vérifier le plafond avant vente ──────────────────────────────────────

  checkClientSpending(clientId: number, amount: number): Observable<SpendingCheckResult> {
    this._isCheckingLimit.set(true);
    return this.http.get<SpendingCheckResult>(
      `${this.apiUrl}/clients/${clientId}/spending-check?amount=${amount}`,
      { headers: this.getHeaders() }
    ).pipe(
      tap(() => this._isCheckingLimit.set(false)),
      catchError(err => { this._isCheckingLimit.set(false); return throwError(() => err); })
    );
  }

  // ── APIs Ventes ───────────────────────────────────────────────────────────

  getSales(page: number = 1): Observable<SalesResponse> {
    this._isLoading.set(true);
    return this.http.get<SalesResponse>(`${this.apiUrl}/sales?page=${page}`, { headers: this.getHeaders() }).pipe(
      tap(() => this._isLoading.set(false)),
      catchError(err => { this._isLoading.set(false); this._error.set(this.handleError(err)); return throwError(() => err); })
    );
  }

  createSale(
    paymentMethod: 'cash'|'wave'|'card'|'check',
    reference?: string,
    note?: string
  ): Observable<{ message: string; sale: Sale; client_spending_info?: SpendingInfo }> {
    this._isCreating.set(true);
    this._createError.set(null);

    const items: SaleItem[] = this.cart().map(item => ({
      product_id: item.product.id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.subtotal,
      discount_percentage: this.selectedClient()?.discount_percentage,
      discount_amount: item.discount_amount,
      total: item.total
    }));

    const data: SaleCreateRequest = {
      client_id: this.selectedClient()?.id || null,
      client_name: this.walkinClientName() || null,
      items,
      payment_method: paymentMethod,
      total_amount: this.cartTotal(),
      discount_total: this.cartDiscount(),
      reference,
      note
    };

    return this.http.post<{ message: string; sale: Sale; client_spending_info?: SpendingInfo }>(
      `${this.apiUrl}/sales`, data, { headers: this.getHeaders() }
    ).pipe(
      tap(() => {
        this._isCreating.set(false);
        this.clearCart();
        this.getSyncHistory().subscribe();
      }),
      catchError(err => {
        this._isCreating.set(false);
        if (err.status === 403) {
          const body = err.error;
          if (body?.spending_limit_exceeded) {
            this._spendingWarning.set({
              type: 'exceeded',
              message: body.message || 'Plafond mensuel dépassé',
              spendingInfo: body.spending_info
            });
          } else if (body?.blocked) {
            this._spendingWarning.set({
              type: 'blocked',
              message: body.reason || 'Compte bloqué'
            });
          }
        }
        this._createError.set(this.handleError(err));
        return throwError(() => err);
      })
    );
  }

  deleteSale(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/sales/${id}`, { headers: this.getHeaders() }).pipe(
      tap(() => this.getSyncHistory().subscribe()),
      catchError(err => { this._error.set(this.handleError(err)); return throwError(() => err); })
    );
  }

  // ── Synchronisation ───────────────────────────────────────────────────────

  getSyncStatus(): Observable<SyncStatusResponse> {
    return this.http.get<SyncStatusResponse>(`${this.apiUrl}/sales/sync-status`, { headers: this.getHeaders() }).pipe(
      tap(r => this.syncStatus.set(r.queue)),
      catchError(err => throwError(() => err))
    );
  }

  getSyncHistory(entityType?: string, status?: string, page = 1): Observable<SyncHistoryResponse> {
    let url = `${this.apiUrl}/sync/history?page=${page}`;
    if (entityType) url += `&entity_type=${entityType}`;
    if (status) url += `&status=${status}`;
    return this.http.get<SyncHistoryResponse>(url, { headers: this.getHeaders() }).pipe(
      tap(r => { this.syncHistory.set(r.events); this.syncHistoryTotal.set(r.count); }),
      catchError(err => throwError(() => err))
    );
  }

  syncToCentral(): Observable<any> {
    this._isSyncing.set(true);
    return this.http.post(`${this.apiUrl}/sync/push`, {}, { headers: this.getHeaders() }).pipe(
      tap(() => { this._isSyncing.set(false); this.getSyncStatus().subscribe(); this.getSyncHistory().subscribe(); }),
      catchError(err => { this._isSyncing.set(false); return throwError(() => err); })
    );
  }

  retryFailed(): Observable<any> {
    this._isRetrying.set(true);
    return this.http.post(`${this.apiUrl}/sync/retry-failed`, {}, { headers: this.getHeaders() }).pipe(
      tap(() => { this._isRetrying.set(false); this.getSyncStatus().subscribe(); this.getSyncHistory().subscribe(); }),
      catchError(err => { this._isRetrying.set(false); return throwError(() => err); })
    );
  }

  syncUsers(pharmacyId?: number): Observable<SyncUsersResponse> {
    this._isSyncingUsers.set(true);
    const url = pharmacyId ? `${this.apiUrl}/sync/users?pharmacy_id=${pharmacyId}` : `${this.apiUrl}/sync/users`;
    return this.http.get<SyncUsersResponse>(url, { headers: this.getHeaders() }).pipe(
      tap(() => this._isSyncingUsers.set(false)),
      catchError(err => { this._isSyncingUsers.set(false); return throwError(() => err); })
    );
  }

  // ── Utilitaires logs ──────────────────────────────────────────────────────

  parseSyncEventData(dataString: string): any {
    try { return JSON.parse(dataString); } catch { return null; }
  }

  getActionLabel(action: string): string {
    return ({ create: 'Création', update: 'Modification', delete: 'Suppression' } as any)[action] || action;
  }

  getActionColor(action: string): string {
    return ({ create: 'emerald', update: 'blue', delete: 'red' } as any)[action] || 'slate';
  }

  getStatusLabel(status: string): string {
    return ({ pending: 'En attente', syncing: 'En cours', synced: 'Synchronisé', failed: 'Échoué' } as any)[status] || status;
  }

  getStatusColor(status: string): string {
    return ({ pending: 'amber', syncing: 'blue', synced: 'emerald', failed: 'red' } as any)[status] || 'slate';
  }

  // ── Utilitaires plafond ───────────────────────────────────────────────────

  formatCurrency(amount?: number | null): string {
    if (!amount) return '0 FCFA';
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 }).format(amount) + ' FCFA';
  }

  getSpendingBarColor(pct: number): string {
    if (pct >= 90) return 'bg-red-500';
    if (pct >= 70) return 'bg-amber-500';
    return 'bg-emerald-500';
  }

  isClientBlocked(client: Client | null): boolean {
    return client?.is_active === false;
  }

  private handleError(error: any): string {
    if (error.error?.message) return error.error.message;
    if (error.error?.errors) return Object.values(error.error.errors).flat().join(', ');
    return error.message || 'Une erreur est survenue';
  }
}
