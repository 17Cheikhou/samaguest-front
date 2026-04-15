import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SalesService, Sale, Product, Clients, SyncEvent } from '../../../core/services/sales.service';
import { ProductService } from '../../../core/services/product.service';
import { ClientService } from '../../../core/services/client.service';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './sale.html',
  styleUrls: ['./sale.css']
})
export class Sales implements OnInit, OnDestroy {
  private fb            = inject(FormBuilder);
  public  salesService  = inject(SalesService);
  private productService = inject(ProductService);
  private clientService  = inject(ClientService);
  private authService   = inject(AuthService);
  private router        = inject(Router);

  // ── Vues ─────────────────────────────────────────────────────────────────
  activeView = signal<'create' | 'list' | 'logs'>('create');

  // ── Données ───────────────────────────────────────────────────────────────
  products        = signal<Product[]>([]);
  clients         = signal<Clients[]>([]);
  sales           = signal<Sale[]>([]);
  productSearchQuery = signal('');
  clientSearchQuery  = signal('');
  filteredProducts   = signal<Product[]>([]);
  filteredClients    = signal<Clients[]>([]);

  // ── Sélection client ──────────────────────────────────────────────────────
  clientType = signal<'registered' | 'walkin'>('registered');

  // ── Pagination ────────────────────────────────────────────────────────────
  currentPage  = signal(1);
  totalPages   = signal(1);
  totalSales   = signal(0);

  // ── Logs ──────────────────────────────────────────────────────────────────
  logFilterEntityType = '';
  logFilterStatus     = '';

  // ── Signaux du service ────────────────────────────────────────────────────
  cart             = this.salesService.cart;
  selectedClient   = this.salesService.selectedClient;
  walkinClientName = this.salesService.walkinClientName;
  cartTotal        = this.salesService.cartTotal;
  cartSubtotal     = this.salesService.cartSubtotal;
  cartDiscount     = this.salesService.cartDiscount;
  cartItemsCount   = this.salesService.cartItemsCount;
  isLoading        = this.salesService._isLoading;
  isCreating       = this.salesService._isCreating;
  isSyncing        = this.salesService._isSyncing;
  isRetrying       = this.salesService._isRetrying;
  isSyncingUsers   = this.salesService._isSyncingUsers;
  isCheckingLimit  = this.salesService._isCheckingLimit;
  error            = this.salesService._error;
  createError      = this.salesService._createError;
  spendingWarning  = this.salesService._spendingWarning;
  syncStatus       = this.salesService.syncStatus;
  syncHistory      = this.salesService.syncHistory;
  syncHistoryTotal = this.salesService.syncHistoryTotal;
  // Infos plafond calculées
  clientSpendingPercent  = this.salesService.clientSpendingPercent;
  clientRemainingBudget  = this.salesService.clientRemainingBudget;
  cartExceedsLimit       = this.salesService.cartExceedsLimit;

  // ── Formulaire ────────────────────────────────────────────────────────────
  saleForm: FormGroup;

  paymentMethods = [
    { value: 'cash',  label: 'Espèces',         icon: '💵', color: 'emerald' },
    { value: 'wave',  label: 'Wave',             icon: '📱', color: 'blue'    },
    { value: 'card',  label: 'Carte Bancaire',   icon: '💳', color: 'purple'  },
    { value: 'check', label: 'Chèque',           icon: '🏦', color: 'amber'   }
  ];

  private autoRefreshSub?: Subscription;

  constructor() {
    this.saleForm = this.fb.group({
      payment_method: ['cash', Validators.required],
      reference: [''],
      note: ['']
    });
  }

  ngOnInit(): void {
    if (!this.authService.getSessionInfo()) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadInitialData();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.autoRefreshSub?.unsubscribe();
  }

  // ── Chargement ────────────────────────────────────────────────────────────

  loadInitialData(): void {
    this.loadProducts();
    this.loadClients();
    this.loadSales();
    this.salesService.getSyncStatus().subscribe();
    this.salesService.getSyncHistory().subscribe();
  }

  loadProducts(): void {
    this.productService.getProducts().subscribe({
      next: (response: any) => {
        const list = Array.isArray(response) ? response : (response?.data || response?.products || []);
        this.products.set(list.filter((p: Product) => (p.global_stock ?? 0) > 0));
        this.filteredProducts.set(this.products());
      },
      error: () => {}
    });
  }

  loadClients(): void {
    this.clientService.getClients().subscribe({
      next: (clients) => {
        const active = clients.filter(c => c.is_active !== false);
        this.clients.set(active);
        this.filteredClients.set(active);
      },
      error: () => {}
    });
  }

  loadSales(page = 1): void {
    this.salesService.getSales(page).subscribe({
      next: (r) => {
        this.sales.set(r.sales);
        this.currentPage.set(r.pagination.current_page);
        this.totalPages.set(r.pagination.total_pages);
        this.totalSales.set(r.count);
      },
      error: (err) => console.error('Erreur ventes:', err)
    });
  }

  loadLogs(): void {
    this.salesService.getSyncHistory(
      this.logFilterEntityType || undefined,
      this.logFilterStatus || undefined
    ).subscribe({ error: (err) => console.error('Erreur logs:', err) });
  }

  private startAutoRefresh(): void {
    this.autoRefreshSub = interval(30000).subscribe(() => {
      if (this.activeView() === 'list') this.loadSales(this.currentPage());
      if (this.activeView() === 'logs') this.loadLogs();
      this.salesService.getSyncStatus().subscribe();
    });
  }

  // ── Recherche ─────────────────────────────────────────────────────────────

  searchProducts(query: string): void {
    this.productSearchQuery.set(query);
    const q = query.toLowerCase();
    this.filteredProducts.set(!q ? this.products() :
      this.products().filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.cip?.toLowerCase().includes(q) ||
        p.laboratory?.toLowerCase().includes(q)
      )
    );
  }

  searchClients(query: string): void {
    this.clientSearchQuery.set(query);
    const q = query.toLowerCase();
    this.filteredClients.set(!q ? this.clients() :
      this.clients().filter(c =>
        c.first_name.toLowerCase().includes(q) ||
        c.last_name.toLowerCase().includes(q)
      )
    );
  }

  // ── Client ────────────────────────────────────────────────────────────────

  selectClientType(type: 'registered' | 'walkin'): void {
    this.clientType.set(type);
    if (type === 'walkin') {
      this.salesService.selectClient(null);
    } else {
      this.salesService.setWalkinClientName('');
    }
  }

  selectClient(client: Clients): void {
    this.salesService.selectClient(client);
    this.clientSearchQuery.set('');
    this.filteredClients.set(this.clients());
  }

  unselectClient(): void {
    this.salesService.selectClient(null);
  }

  setWalkinName(name: string): void {
    this.salesService.setWalkinClientName(name);
  }

  // ── Panier ────────────────────────────────────────────────────────────────

  addProductToCart(product: Product): void {
    const available = product.global_stock ?? 0;
    if (available <= 0) { alert('Produit en rupture de stock'); return; }

    const currentItem = this.cart().find(i => i.product.id === product.id);
    if ((currentItem?.quantity || 0) + 1 > available) {
      alert(`Stock insuffisant. Disponible: ${available}`);
      return;
    }

    this.salesService.addToCart(product, 1);
  }

  updateQuantity(productId: number, quantity: number): void {
    const product = this.cart().find(i => i.product.id === productId)?.product;
    if (!product) return;
    const available = product.global_stock ?? 0;
    if (quantity > available) { alert(`Stock insuffisant. Disponible: ${available}`); return; }
    this.salesService.updateCartItemQuantity(productId, quantity);
  }

  removeFromCart(productId: number): void {
    if (confirm('Retirer ce produit du panier ?')) {
      this.salesService.removeFromCart(productId);
    }
  }

  clearCart(): void {
    if (confirm('Vider tout le panier ?')) {
      this.salesService.clearCart();
      this.saleForm.reset({ payment_method: 'cash' });
      this.clientType.set('registered');
    }
  }

  // ── Création vente ────────────────────────────────────────────────────────

  createSale(): void {
    if (this.cart().length === 0) {
      alert('Le panier est vide. Ajoutez des produits avant de créer une vente.');
      return;
    }
    if (this.clientType() === 'registered' && !this.selectedClient()) {
      alert('Veuillez sélectionner un client');
      return;
    }
    // Nom passager facultatif — le backend met "Client passager" si vide

    // Bloquer si compte inactif
    if (this.salesService.isClientBlocked(this.selectedClient())) {
      return; // L'alerte est déjà affichée dans le template
    }

    // Vérification douce du plafond avant soumission
    const client = this.selectedClient();
    if (client?.id && this.cartExceedsLimit()) {
      if (!confirm(
        `⚠️ Ce panier (${this.formatCurrency(this.cartTotal())}) dépasse le budget restant du client (${this.formatCurrency(this.clientRemainingBudget())}).\n\nVoulez-vous continuer quand même ?`
      )) return;
    }

    const f = this.saleForm.value;
    this.salesService.createSale(f.payment_method, f.reference?.trim() || undefined, f.note?.trim() || undefined).subscribe({
      next: (response) => {
        this.saleForm.reset({ payment_method: 'cash' });
        this.clientType.set('registered');
        this.switchView('list');
        this.loadSales();
      },
      error: (err) => console.error('Erreur création vente:', err)
    });
  }

  deleteSale(sale: Sale): void {
    if (confirm(`⚠️ Supprimer la vente ${sale.reference} ?\n\nMontant: ${this.formatCurrency(sale.total_amount)}\n\nCette action est irréversible.`)) {
      this.salesService.deleteSale(sale.id!).subscribe({
        next: () => this.loadSales(this.currentPage()),
        error: (err) => console.error('Erreur suppression:', err)
      });
    }
  }

  // ── Synchronisation ───────────────────────────────────────────────────────

  syncToCentral(): void {
    this.salesService.syncToCentral().subscribe({
      next: (r) => { alert(`✅ ${r.message || 'Synchronisation réussie'}`); this.loadSales(this.currentPage()); },
      error: (err) => console.error('Erreur sync:', err)
    });
  }

  retryFailed(): void {
    this.salesService.retryFailed().subscribe({
      next: (r) => alert(`✅ ${r.message || 'Nouvel essai lancé'}`),
      error: (err) => console.error('Erreur retry:', err)
    });
  }

  syncUsers(): void {
    this.salesService.syncUsers().subscribe({
      next: (r) => {
        const { processed, created, updated, errors } = r.result;
        alert(`✅ Utilisateurs synchronisés\nTraités: ${processed} | Créés: ${created} | Mis à jour: ${updated} | Erreurs: ${errors.length}`);
      },
      error: () => alert('❌ Erreur lors de la synchronisation des utilisateurs')
    });
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  switchView(view: 'create' | 'list' | 'logs'): void {
    this.activeView.set(view);
    if (view === 'list') this.loadSales();
    if (view === 'logs') this.loadLogs();
  }

  applyLogFilters(): void { this.loadLogs(); }

  clearLogFilters(): void {
    this.logFilterEntityType = '';
    this.logFilterStatus     = '';
    this.loadLogs();
  }

  nextPage(): void     { if (this.currentPage() < this.totalPages()) this.loadSales(this.currentPage() + 1); }
  previousPage(): void { if (this.currentPage() > 1) this.loadSales(this.currentPage() - 1); }

  // ── Utilitaires ──────────────────────────────────────────────────────────

  formatCurrency(amount?: number | null): string {
    if (!amount) return '0 FCFA';
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 }).format(amount) + ' FCFA';
  }

  getClientDisplay(sale: Sale): string {
    if (sale.client) return `${sale.client.first_name} ${sale.client.last_name}`;
    return sale.client_name || 'Client comptoir';
  }

  getPaymentMethodLabel(method: string): string { return this.paymentMethods.find(m => m.value === method)?.label || method; }
  getPaymentMethodIcon(method: string):  string { return this.paymentMethods.find(m => m.value === method)?.icon  || '💰'; }
  getPaymentMethodColor(method: string): string { return this.paymentMethods.find(m => m.value === method)?.color || 'slate'; }

  parseSyncEventData(d: string): any      { return this.salesService.parseSyncEventData(d); }
  getActionLabel(a: string): string       { return this.salesService.getActionLabel(a); }
  getActionColor(a: string): string       { return this.salesService.getActionColor(a); }
  getStatusLabel(s: string): string       { return this.salesService.getStatusLabel(s); }
  getStatusColor(s: string): string       { return this.salesService.getStatusColor(s); }

  getSpendingBarColor(pct: number): string { return this.salesService.getSpendingBarColor(pct); }

  isSubAccount(c: Clients): boolean {
    return !!c.parent_client_id;
  }

  getRelationshipLabel(rel?: string | null): string {
    const map: Record<string, string> = {
      enfant: 'Enfant', conjoint: 'Conjoint(e)', parent: 'Parent',
      'frère': 'Frère', 'sœur': 'Sœur', autre: 'Autre'
    };
    return rel ? (map[rel] ?? rel) : '';
  }

  get todaySalesCount(): number {
    const today = new Date().toDateString();
    return this.sales().filter(s => new Date(s.created_at!).toDateString() === today).length;
  }

  get todaySalesTotal(): number {
    const today = new Date().toDateString();
    return this.sales().filter(s => new Date(s.created_at!).toDateString() === today).reduce((sum, s) => sum + s.total_amount, 0);
  }

  trackBySaleId(_i: number, s: Sale): number        { return s.id || _i; }
  trackByProductId(_i: number, p: Product): number  { return p.id; }
  trackByClientId(_i: number, c: Clients): number   { return c.id || _i; }
  trackByEventId(_i: number, e: SyncEvent): number  { return e.id; }
}