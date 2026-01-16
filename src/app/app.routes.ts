// src/app/app.routes.ts

import { Routes } from '@angular/router';

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
    ],
  },

  // -------------------------------------
  // 404 fallback - A la fin
  // -------------------------------------
  { path: '**', redirectTo: 'login' },
];

