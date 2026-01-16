import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, tap } from 'rxjs';

export interface DashboardSummary {
  pharmacies: number;
  users: number;
  salesToday: number;
  lowStockCount: number;
  weeklySales: { day: string; amount: number }[];
  recentActivities: Activity[];
}

export interface Activity {
  id: number;
  type: string;
  description: string;
  time: string;
  user: string;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private http = inject(HttpClient);
  private API = 'http://127.0.0.1:8000/api';

  // Signals pour les données du dashboard
  summary = signal<DashboardSummary | null>(null);
  loading = signal<boolean>(true);

  fetchDashboardData(): Observable<DashboardSummary> {
    this.loading.set(true);
    
    return this.http.get<DashboardSummary>(`${this.API}/dashboard`).pipe(
      tap(data => {
        this.summary.set(data);
        this.loading.set(false);
      }),
      catchError(error => {
        console.error('Erreur lors du chargement des données:', error);
        this.loading.set(false);
        
        // Retourner des données mockées en cas d'erreur
        const mockData: DashboardSummary = {
          pharmacies: 12,
          users: 45,
          salesToday: 12500,
          lowStockCount: 8,
          weeklySales: [
            { day: 'Lun', amount: 8500 },
            { day: 'Mar', amount: 9200 },
            { day: 'Mer', amount: 7800 },
            { day: 'Jeu', amount: 10500 },
            { day: 'Ven', amount: 12500 },
            { day: 'Sam', amount: 9500 },
            { day: 'Dim', amount: 5200 },
          ],
          recentActivities: [
            { id: 1, type: 'sale', description: 'Commande #00123 reçue', time: 'il y a 1 heure', user: 'Marie Dupont' },
            { id: 2, type: 'stock', description: 'Stock de Paracétamol mis à jour', time: 'il y a 2 heures', user: 'Jean Martin' },
            { id: 3, type: 'user', description: 'Nouvel utilisateur ajouté', time: 'il y a 3 heures', user: 'Admin System' },
            { id: 4, type: 'alert', description: 'Alerte stock bas: Amoxicilline', time: 'il y a 4 heures', user: 'Système' },
          ]
        };
        
        this.summary.set(mockData);
        return of(mockData);
      })
    );
  }

  refresh(): void {
    this.fetchDashboardData().subscribe();
  }
}