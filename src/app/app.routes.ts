// src/app/app.routes.ts

import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [

  // -------------------------------------
  // AUTHENTIFICATION
  // -------------------------------------

  { path: 'login', loadComponent: () => import('./auth/login/login').then(m => m.Login) },
  
  // -------------------------------------
  // DASHBOARD (Page principale après login)
  // -------------------------------------

  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./components/dashboard/dashboard/dashboard').then(m => m.Dashboard),
    children: [
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
      {
        path: 'home',
        loadComponent: () => import('./components/dashboard/home/home').then(m => m.Home),
      },
      {
        path: 'profile',
        loadComponent: () => import('./components/dashboard/profile/profile').then(m => m.Profile)
      },
      {
        path: 'profile/:id',
        loadComponent: () => import('./components/dashboard/profile/profile').then(m => m.Profile)
      },
      {
        path: 'users',
        loadComponent: () => import('./components/user-list/user-list').then(m => m.UserList),
        
      },
      {
        path: 'sales',
        loadComponent: () => import('./components/dashboard/sale/sale').then(m => m.Sales),
      },
      {
        path: 'produits',
        loadComponent: () => import('./components/dashboard/product/product').then(m => m.Products),
      },
      {
        path: 'customers',
        loadComponent: () => import('./components/dashboard/customer/customer').then(m => m.Customer),
      },
    ],
  },

  // -------------------------------------
  // 404 fallback - A la fin
  // -------------------------------------
  { path: '**', redirectTo: 'login' },
];

