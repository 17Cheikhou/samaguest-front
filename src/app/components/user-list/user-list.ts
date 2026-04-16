import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { catchError, finalize, of } from 'rxjs';
import { UserService } from '../../core/services/user.service';
import { PermissionService, PermissionItem } from '../../core/services/permission.service';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-list.html',
  styleUrls: ['./user-list.css'],
})
export class UserList implements OnInit {
  auth             = inject(AuthService);
  userservice      = inject(UserService);
  router           = inject(Router);
  permissionService = inject(PermissionService);

  // Signaux pour l'état
  loading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  
  // Données
  users = signal<any[]>([]);
  filteredUsers = signal<any[]>([]);
  usersCount = signal(0);
  pharmacies = signal<Map<number, any>>(new Map());
  
  // Filtres et recherche
  searchTerm = signal('');
  itemsPerPage = signal(10);
  currentPage = signal(1);
  sortColumn = signal<string>('created_at');
  sortDirection = signal<'asc' | 'desc'>('desc');
  selectedRole = signal<string>('all');
  
  // Statistiques
  stats = signal({
    total: 0,
    activeToday: 0,
    withPharmacy: 0,
  });

  // ── Panneau permissions ───────────────────────────────────────────────────
  permPanel = signal(false);
  permUser  = signal<{ id: number; name: string; role: string } | null>(null);
  // permissions groupées par catégorie avec les états locaux (pending changes)
  permCategories = signal<Record<string, PermissionItem[]>>({});
  // map des changements en attente: key → true/false/null
  pendingOverrides = signal<Record<string, boolean | null>>({});
  
  // Pagination
  totalPages = computed(() => Math.ceil(this.filteredUsers().length / this.itemsPerPage()));
  paginatedUsers = computed(() => {
    const start = (this.currentPage() - 1) * this.itemsPerPage();
    const end = start + this.itemsPerPage();
    return this.filteredUsers().slice(start, end);
  });
  
  ngOnInit(): void {
    this.getUsers();
  }
  role() {
    return this.userservice.getRole();
  }
  
  getUsers() {
    this.loading.set(true);
    this.errorMessage.set('');
    
    this.auth.getUsers().pipe(
      catchError(err => {
        this.errorMessage.set(err.error?.message || "Une erreur s'est produite");
        return of(null);
      }),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: (res: any) => {
        if (res) {
          this.users.set(res.users);
          // Charger les infos des pharmacies
          this.loadPharmacyNames(res.users);
          this.updateStats(res.users);
          this.applyFilters();
          this.successMessage.set(`✅ ${res.count} utilisateurs chargés avec succès`);
          setTimeout(() => this.successMessage.set(''), 3000);
        }
      }
    });
  }

  /**
   * Charger les noms des pharmacies pour chaque utilisateur
   */
  loadPharmacyNames(users: any[]) {
    const pharmacyIds = [...new Set(users.map(u => u.pharmacy_id).filter(id => id))];
    const pharmacyMap = new Map<number, any>();

    // Simuler le chargement des pharmacies (à adapter selon votre API)
    // Pour l'instant, on utilise pharmacy_id comme clé et on affiche le nom
    users.forEach(user => {
      if (user.pharmacy && user.pharmacy.id) {
        pharmacyMap.set(user.pharmacy.id, user.pharmacy);
      }
    });

    this.pharmacies.set(pharmacyMap);
  }

  /**
   * Obtenir le nom de la pharmacie
   */
  getPharmacyName(pharmacyId: number): string {
    const pharmacy = this.pharmacies().get(pharmacyId);
    return pharmacy?.name || `Pharmacie #${pharmacyId}`;
  }
  
  updateStats(users: any[]) {
    const today = new Date().toDateString();
    const stats = {
      total: users.length,
      activeToday: users.filter(u => 
        u.last_visit_at && new Date(u.last_visit_at).toDateString() === today
      ).length,
      withPharmacy: users.filter(u => u.pharmacy_id).length,
    };
    this.stats.set(stats);
  }
  
  applyFilters() {
    let filtered = [...this.users()];
    
    // Filtre par recherche
    const search = this.searchTerm().toLowerCase();
    if (search) {
      filtered = filtered.filter(user =>
        user.name.toLowerCase().includes(search) ||
        user.email.toLowerCase().includes(search) ||
        user.id.toString().includes(search)
      );
    }
    
    // Filtre par rôle
    if (this.selectedRole() !== 'all') {
      filtered = filtered.filter(user => user.role === this.selectedRole());
    }
    
    // Tri
    filtered.sort((a, b) => {
      const aVal = a[this.sortColumn()];
      const bVal = b[this.sortColumn()];
      
      if (aVal < bVal) return this.sortDirection() === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.sortDirection() === 'asc' ? 1 : -1;
      return 0;
    });
    
    this.filteredUsers.set(filtered);
    this.usersCount.set(filtered.length);
    this.currentPage.set(1);
  }
  
  onSearchChange(term: string) {
    this.searchTerm.set(term);
    this.applyFilters();
  }
  
  onSort(column: string) {
    if (this.sortColumn() === column) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set('asc');
    }
    this.applyFilters();
  }
  
  changePage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }
  
  onItemsPerPageChange(count: number) {
    this.itemsPerPage.set(count);
    this.currentPage.set(1);
  }
  

  /**
   * Naviguer vers la page profil de l'utilisateur
   */
  viewUserProfile(userId: number) {
    this.router.navigate(['/profile', userId]);
  }

  // ── Gestion des permissions ───────────────────────────────────────────────

  openPermissions(user: any): void {
    this.permPanel.set(true);
    this.permUser.set(null);
    this.permCategories.set({});
    this.pendingOverrides.set({});

    this.permissionService.fetchUserPermissions(user.id).subscribe(res => {
      if (res) {
        this.permUser.set(res.user);
        this.permCategories.set(res.permissions);
      }
    });
  }

  closePermPanel(): void {
    this.permPanel.set(false);
    this.permUser.set(null);
    this.pendingOverrides.set({});
  }

  /** Retourne l'état effectif affiché (pending en priorité, sinon valeur serveur) */
  getEffective(item: PermissionItem): boolean {
    const pending = this.pendingOverrides();
    if (item.key in pending) {
      const v = pending[item.key];
      return v === null ? item.from_role : v;
    }
    return item.effective;
  }

  /** Indique si ce permission a une surcharge (pending ou serveur) */
  hasOverride(item: PermissionItem): boolean {
    const pending = this.pendingOverrides();
    if (item.key in pending) {
      const v = pending[item.key];
      return v !== null;
    }
    return item.override !== null;
  }

  /** Toggle la permission : crée/modifie/supprime l'override */
  togglePermission(item: PermissionItem): void {
    const current = this.getEffective(item);
    const newValue = !current;
    // Si le nouvel état = défaut du rôle → on supprime l'override (null)
    const override: boolean | null = newValue === item.from_role ? null : newValue;

    this.pendingOverrides.update(p => ({ ...p, [item.key]: override }));
  }

  /** Réinitialise une permission à son défaut de rôle */
  resetPermission(item: PermissionItem): void {
    this.pendingOverrides.update(p => ({ ...p, [item.key]: null }));
  }

  get hasPendingChanges(): boolean {
    return Object.keys(this.pendingOverrides()).length > 0;
  }

  savePermissions(): void {
    const userId = this.permUser()?.id;
    if (!userId) return;

    const overrides = Object.entries(this.pendingOverrides()).map(([key, value]) => ({
      key,
      value
    }));

    this.permissionService.updateUserPermissions(userId, overrides).subscribe(res => {
      if (res) {
        // Recharger les permissions depuis le serveur
        this.permissionService.fetchUserPermissions(userId).subscribe(fresh => {
          if (fresh) {
            this.permCategories.set(fresh.permissions);
            this.pendingOverrides.set({});
          }
        });
      }
    });
  }

  /** Indique si une permission spécifique a un changement en attente */
  hasPendingChange(key: string): boolean {
    return key in this.pendingOverrides();
  }

  /** Nombre total de changements en attente */
  get pendingCount(): number {
    return Object.keys(this.pendingOverrides()).length;
  }

  /** Couleur de l'indicateur d'origine d'une permission */
  getOverrideIndicatorClass(item: PermissionItem): string {
    const pending = this.pendingOverrides();
    const pendingValue = pending[item.key];

    if (item.key in pending) {
      if (pendingValue === null) return 'bg-slate-300'; // reset vers défaut
      return pendingValue ? 'bg-emerald-500' : 'bg-red-400';
    }
    if (item.override !== null) {
      return item.override ? 'bg-emerald-500' : 'bg-red-400';
    }
    return 'bg-slate-300'; // défaut du rôle
  }

  permCategList(): string[] {
    return Object.keys(this.permCategories());
  }

  refreshData() {
    this.getUsers();
  }
  
  exportToCSV() {
    const csv = this.convertToCSV(this.filteredUsers());
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `utilisateurs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }
  
  private convertToCSV(data: any[]): string {
    const headers = ['ID', 'Nom', 'Email', 'Pharmacie ID', 'Rôle', 'Créé le', 'Dernière visite'];
    const rows = data.map(user => [
      user.id,
      `"${user.name}"`,
      user.email,
      user.pharmacy_id || 'N/A',
      user.role|| 'N/A',
      new Date(user.created_at).toLocaleDateString('fr-FR'),
      user.last_visit_at ? new Date(user.last_visit_at).toLocaleDateString('fr-FR') : 'Jamais'
    ]);
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }
  
  getSortIcon(column: string): string {
    if (this.sortColumn() !== column) return '↕️';
    return this.sortDirection() === 'asc' ? '↑' : '↓';
  }
  
  formatDate(dateString: string): string {
    if (!dateString) return 'Jamais';
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diff === 0) return "Aujourd'hui";
    if (diff === 1) return 'Hier';
    if (diff < 7) return `Il y a ${diff} jours`;
    
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }
  getPageNumbers(): number[] {
  const total = this.totalPages();
  const current = this.currentPage();
  const delta = 2;
  const range = [];
  const rangeWithDots = [];
  let l;

  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
      range.push(i);
    }
  }

  for (let i of range) {
    if (l) {
      if (i - l === 2) {
        rangeWithDots.push(l + 1);
      } else if (i - l !== 1) {
        rangeWithDots.push(-1); // -1 pour les points de suspension
      }
    }
    rangeWithDots.push(i);
    l = i;
  }

  return rangeWithDots.filter(n => n !== -1).slice(0, 5);
}
}