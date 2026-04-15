import { Component, inject, OnInit, OnDestroy, signal, HostListener } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { UserService } from '../../../core/services/user.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css'],
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive]
})
export class Sidebar implements OnInit, OnDestroy {
  private userService = inject(UserService);
  
  // Exposer le rôle et les informations utilisateur
  role = signal<string>('');
  user = this.userService.user;
  
  // Navigation items basés sur les rôles
  navItems = signal<any[]>([]);
  
  // Sections du menu
  menuSections = signal<any[]>([]);

  // État pour le menu mobile
  mobileMenuOpen = signal(false);

  private toggleSidebarHandler = () => {
    this.mobileMenuOpen.update(v => !v);
    this.expandedSections.set({ gestion: false, operations: false });
  };

  // États des sous-menus déroulants
  expandedSections = signal<{[key: string]: boolean}>({
    gestion: false,
    operations: false
  });

  @HostListener('document:toggle-sidebar')
  onToggleSidebar() {
    this.mobileMenuOpen.update(value => !value);
    // Fermer tous les sous-menus quand on ouvre/ferme le menu mobile
    this.expandedSections.set({ gestion: false, operations: false });
  }


  ngOnInit(): void {
    // Initialiser le rôle
    this.role.set(this.userService.getRole());
    
    // Configurer les éléments de navigation selon le rôle
    this.setupNavigation();
    
    // Charger les données de l'utilisateur si nécessaire
    if (!this.user()) {
      this.userService.fetchProfile().subscribe();
    }
    window.addEventListener('toggle-sidebar', this.toggleSidebarHandler);
  }

  ngOnDestroy(): void {
    window.removeEventListener('toggle-sidebar', this.toggleSidebarHandler);
  }
  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  toggleSubMenu(section: string): void {
    this.expandedSections.update(state => ({
      ...state,
      [section]: !state[section]
    }));
  }

  private setupNavigation(): void {
    const currentRole = this.role();
    
    // Sections communes
    const commonSections = [
      {
        id: 'dashboard',
        title: 'Tableau de bord',
        icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
        path: '/',
        roles: ['superadmin', 'admin', 'pharmacist', 'manager', 'cashier']
      },
      {
        id: 'users',
        title: 'Utilisateurs',
        icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2',
        path: '/users',
        roles: ['superadmin', 'admin']
      },
      {
        id: 'gestion',
        title: 'Gestion',
        icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
        hasChildren: true,
        roles: ['admin', 'pharmacist', 'manager']
      },
      {
        id: 'operations',
        title: 'Opérations',
        icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
        hasChildren: true,
        roles: ['cashier', 'admin', 'pharmacist', 'manager']
      }
    ];

    // Sous-menus
    const subMenus = {
      gestion: [
        {
          path: '/tenant/produits',
          icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
          label: 'Gestion des produits',
          description: 'Médicaments et fournitures',
          roles: ['admin', 'pharmacist', 'manager']
        },
        {
          path: '/tenant/stocks',
          icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
          label: 'Gestion des stocks',
          description: 'Niveaux et alertes',
          roles: ['admin', 'pharmacist', 'manager']
        },
        {
          path: '/tenant/commandes',
          icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
          label: 'Commandes fournisseurs',
          description: 'Approvisionnement',
          roles: ['admin', 'pharmacist']
        }
      ],
      operations: [
        {
          path: '/sales',
          icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
          label: 'Gestion des Ventes',
          description: 'Ventes et synchronisation',
          roles: ['cashier', 'admin', 'pharmacist']
        },
        {
          path: '/tenant/sales',
          icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
          label: 'Vente au comptoir',
          description: 'Transactions clients',
          roles: ['cashier', 'admin', 'pharmacist']
        },
        {
          path: '/tenant/ordonnances',
          icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
          label: 'Ordonnances',
          description: 'Validation et archivage',
          roles: ['pharmacist', 'admin']
        },
        {
          path: '/clients',
          icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
          label: 'Gestion des Clients',
          description: 'Clients et types',
          roles: ['admin', 'pharmacist', 'cashier']
        },
        {
          path: '/tenant/customers',
          icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
          label: 'Fichier clients',
          description: 'Patients et historiques',
          roles: ['admin', 'pharmacist', 'cashier']
        }
      ]
    };

    // Items spéciaux pour superadmin
    const superAdminItems = [
      {
        id: 'superadmin',
        title: 'Super Admin',
        icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
        hasChildren: false,
        path: '/superadmin/pharmacies',
        roles: ['superadmin']
      }
    ];

    // Profil
    const profileItem = {
      id: 'profile',
      title: 'Mon Profil',
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
      path: '/profile',
      roles: ['superadmin', 'admin', 'pharmacist', 'manager', 'cashier']
    };

    // Filtrer les sections selon le rôle
    let filteredSections = [
      ...commonSections.filter(section => section.roles.includes(currentRole)),
      ...(currentRole === 'superadmin' ? superAdminItems : []),
      profileItem
    ];

    // Organiser les sections
    this.menuSections.set(filteredSections);
    this.navItems.set(Object.values(subMenus).flat().filter(item => 
      item.roles.includes(currentRole)
    ));
  }

  logout(): void {
    this.userService.logout();
    window.location.href = '/login';
  }

  getRoleColor(role: string): string {
    switch(role) {
      case 'superadmin': return 'bg-gradient-to-r from-purple-600 to-purple-700';
      case 'admin': return 'bg-gradient-to-r from-red-600 to-red-700';
      case 'pharmacist': return 'bg-gradient-to-r from-blue-600 to-blue-700';
      case 'manager': return 'bg-gradient-to-r from-green-600 to-green-700';
      case 'cashier': return 'bg-gradient-to-r from-yellow-600 to-yellow-700';
      default: return 'bg-gradient-to-r from-gray-600 to-gray-700';
    }
  }

  getRoleText(role: string): string {
    switch(role) {
      case 'superadmin': return 'Super Admin';
      case 'admin': return 'Administrateur';
      case 'pharmacist': return 'Pharmacien';
      case 'manager': return 'Manager';
      case 'cashier': return 'Caissier';
      default: return 'Utilisateur';
    }
  }
}