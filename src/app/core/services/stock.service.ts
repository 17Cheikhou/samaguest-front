import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { tap, catchError, of } from 'rxjs';

export interface StockMovement {
  id: number;
  product_id: number;
  user_id: number;
  type: 'inbound' | 'outbound' | 'adjustment';
  movement_date: string;
  qty: number;
  note: string;
  product?: { id: number; name: string; form?: string };
  user?: { id: number; name: string };
}

export interface StockAlert {
  id: string;
  type: 'low_stock' | 'out_of_stock' | 'expiring';
  severity: 'critical' | 'warning';
  product_id: number;
  product_name: string;
  current_stock: number;
  minimum_stock?: number;
  expiry_date?: string;
  days_left?: number;
  message: string;
  action: string;
}

export interface MovementsResponse {
  count: number;
  movements: StockMovement[];
  pagination: { current_page: number; total_pages: number };
}

export interface AdjustPayload {
  product_id: number;
  type: 'inbound' | 'outbound' | 'adjustment';
  qty: number;
  note: string;
}

@Injectable({ providedIn: 'root' })
export class StockService {
  private http = inject(HttpClient);
  private API = 'http://127.0.0.1:8000/api';

  movements     = signal<StockMovement[]>([]);
  alerts        = signal<StockAlert[]>([]);
  loadingList   = signal(false);
  loadingAlerts = signal(false);
  saving        = signal(false);
  error         = signal<string | null>(null);
  totalMovements = signal(0);
  currentPage   = signal(1);
  totalPages    = signal(1);

  fetchMovements(filters: {
    product_id?: number;
    type?: string;
    from_date?: string;
    to_date?: string;
    page?: number;
    per_page?: number;
  } = {}) {
    this.loadingList.set(true);
    this.error.set(null);

    let params = new HttpParams();
    if (filters.product_id) params = params.set('product_id', filters.product_id);
    if (filters.type)       params = params.set('type', filters.type);
    if (filters.from_date)  params = params.set('from_date', filters.from_date);
    if (filters.to_date)    params = params.set('to_date', filters.to_date);
    if (filters.page)       params = params.set('page', filters.page);
    if (filters.per_page)   params = params.set('per_page', filters.per_page ?? 30);

    return this.http.get<MovementsResponse>(`${this.API}/stock/movements`, { params }).pipe(
      tap(res => {
        this.movements.set(res.movements);
        this.totalMovements.set(res.count);
        this.currentPage.set(res.pagination.current_page);
        this.totalPages.set(res.pagination.total_pages);
        this.loadingList.set(false);
      }),
      catchError(err => {
        this.loadingList.set(false);
        this.error.set(err?.error?.message || `Erreur ${err?.status}`);
        return of(null);
      })
    );
  }

  fetchAlerts() {
    this.loadingAlerts.set(true);
    return this.http.get<{ count: number; alerts: StockAlert[] }>(`${this.API}/stock/alerts`).pipe(
      tap(res => {
        this.alerts.set(res.alerts);
        this.loadingAlerts.set(false);
      }),
      catchError(err => {
        this.loadingAlerts.set(false);
        return of(null);
      })
    );
  }

  adjust(payload: AdjustPayload) {
    this.saving.set(true);
    this.error.set(null);
    return this.http.post<any>(`${this.API}/stock/adjust`, payload).pipe(
      tap(() => this.saving.set(false)),
      catchError(err => {
        this.saving.set(false);
        const msg = err?.error?.message || `Erreur ${err?.status}`;
        this.error.set(msg);
        return of(null);
      })
    );
  }
}
