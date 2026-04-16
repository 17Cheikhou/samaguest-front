import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockService } from '../../../core/services/stock.service';
import { ProductService, Product } from '../../../core/services/product.service';

type Tab = 'movements' | 'adjust' | 'alerts';

@Component({
  selector: 'app-stock',
  templateUrl: './stock.html',
  styleUrls: ['./stock.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class Stock implements OnInit {
  stockService   = inject(StockService);
  productService = inject(ProductService);

  activeTab = signal<Tab>('movements');

  // ── Filtres historique ────────────────────────────────────────────────────
  filterType      = '';
  filterProductId = '';
  filterFromDate  = '';
  filterToDate    = '';

  // ── Formulaire ajustement ─────────────────────────────────────────────────
  formProductId = signal<number | ''>('');
  formType      = signal<'inbound' | 'outbound' | 'adjustment'>('inbound');
  formQty       = 1;
  formNote      = '';
  adjustSuccess: string | null = null;
  adjustError:   string | null = null;

  // ── Produits (pour le select) ─────────────────────────────────────────────
  products = signal<Product[]>([]);

  // ── Produit sélectionné (aperçu stock) ───────────────────────────────────
  selectedProduct = computed(() =>
    this.products().find(p => p.id === Number(this.formProductId())) ?? null
  );

  ngOnInit(): void {
    this.loadMovements();
    this.stockService.fetchAlerts().subscribe();
    this.productService.getProducts().subscribe((res: any) => {
      this.products.set(Array.isArray(res) ? res : (res.data ?? []));
    });
  }

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
    if (tab === 'movements') this.loadMovements();
  }

  loadMovements(): void {
    const filters: any = {};
    if (this.filterType)      filters.type       = this.filterType;
    if (this.filterProductId) filters.product_id = +this.filterProductId;
    if (this.filterFromDate)  filters.from_date  = this.filterFromDate;
    if (this.filterToDate)    filters.to_date    = this.filterToDate;
    this.stockService.fetchMovements(filters).subscribe();
  }

  resetFilters(): void {
    this.filterType = '';
    this.filterProductId = '';
    this.filterFromDate  = '';
    this.filterToDate    = '';
    this.loadMovements();
  }

  submitAdjust(): void {
    this.adjustSuccess = null;
    this.adjustError   = null;
    const pid = this.formProductId();
    if (!pid || !this.formQty || this.formQty < 1 || !this.formNote.trim()) {
      this.adjustError = 'Veuillez remplir tous les champs obligatoires.';
      return;
    }
    this.stockService.adjust({
      product_id: +pid,
      type:       this.formType(),
      qty:        this.formQty,
      note:       this.formNote.trim()
    }).subscribe(res => {
      if (res) {
        this.adjustSuccess = `Stock mis à jour : ${res.product.previous_stock} → ${res.product.current_stock} unités`;
        this.formProductId.set('');
        this.formType.set('inbound');
        this.formQty  = 1;
        this.formNote = '';
        this.loadMovements();
        this.stockService.fetchAlerts().subscribe();
      } else {
        this.adjustError = this.stockService.error() ?? 'Erreur inconnue';
      }
    });
  }

  setType(v: string): void {
    this.formType.set(v as 'inbound' | 'outbound' | 'adjustment');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  typeLabel(type: string): string {
    return ({ inbound: 'Entrée', outbound: 'Sortie', adjustment: 'Ajustement' } as any)[type] ?? type;
  }

  typeBadgeClass(type: string): string {
    return ({
      inbound:    'bg-emerald-100 text-emerald-700',
      outbound:   'bg-red-100 text-red-700',
      adjustment: 'bg-amber-100 text-amber-700'
    } as any)[type] ?? 'bg-slate-100 text-slate-600';
  }

  severityClass(severity: string): string {
    return severity === 'critical'
      ? 'bg-red-50 border-red-200 text-red-700'
      : 'bg-amber-50 border-amber-200 text-amber-700';
  }

  alertIcon(type: string): string {
    if (type === 'out_of_stock') return 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636';
    if (type === 'expiring')     return 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z';
    return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z';
  }
}
