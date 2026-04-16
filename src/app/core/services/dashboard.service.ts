import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, tap } from 'rxjs';

export interface LowStockItem {
  id: number;
  name: string;
  global_stock: number;
  reorder_level: number;
  form?: string;
}

export interface RecentSale {
  id: number;
  reference: string;
  total_amount: number;
  payment_method: string;
  status: string;
  client_name: string | null;
  client?: { first_name: string; last_name: string };
  created_at: string;
}

export interface PaymentBreakdown {
  payment_method: string;
  count: number;
  total: number;
}

export interface WeeklyDay {
  day: string;
  date: string;
  total: number;
  count: number;
}

export interface DashboardData {
  today: { sales_count: number; sales_total: number };
  weekly_sales: WeeklyDay[];
  stock: { total: number; low_stock: number; out_of_stock: number; low_stock_items: LowStockItem[] };
  clients: { total: number; new_this_week: number };
  recent_sales: RecentSale[];
  payment_breakdown: PaymentBreakdown[];
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private API  = 'http://127.0.0.1:8000/api';

  data    = signal<DashboardData | null>(null);
  loading = signal(true);
  error   = signal<string | null>(null);

  // Compat alias pour home.ts existant
  get summary() { return this.data; }

  fetch(): Observable<DashboardData> {
    this.loading.set(true);
    this.error.set(null);
    return this.http.get<DashboardData>(`${this.API}/dashboard`).pipe(
      tap(d => { this.data.set(d); this.loading.set(false); }),
      catchError(err => {
        this.loading.set(false);
        const msg = err?.error?.message || err?.message || `Erreur ${err?.status}`;
        this.error.set(`Impossible de charger les données : ${msg}`);
        console.error('[Dashboard] Erreur API:', err);
        return of(null as any);
      })
    );
  }

  refresh(): void { this.fetch().subscribe(); }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 }).format(amount) + ' FCFA';
  }
}
