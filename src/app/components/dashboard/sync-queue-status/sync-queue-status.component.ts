import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SalesService } from '../../../core/services/sales.service';

@Component({
  selector: 'app-sync-queue-status',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-white rounded-xl shadow-lg p-6 border border-gray-200 hover:shadow-xl transition-shadow">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold text-gray-900">État de Synchronisation</h3>
        <i class="fas fa-sync text-gray-400 text-lg" [class.animate-spin]="syncStatus().syncing > 0"></i>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <!-- Pending -->
        <div class="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <p class="text-sm text-gray-600">En attente</p>
          <p class="text-2xl font-bold text-yellow-600">{{ syncStatus().pending }}</p>
        </div>

        <!-- Syncing -->
        <div class="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p class="text-sm text-gray-600">Synchronisation</p>
          <p class="text-2xl font-bold text-blue-600">{{ syncStatus().syncing }}</p>
        </div>

        <!-- Synced -->
        <div class="p-3 bg-green-50 rounded-lg border border-green-200">
          <p class="text-sm text-gray-600">Synchronisés</p>
          <p class="text-2xl font-bold text-green-600">{{ syncStatus().synced }}</p>
        </div>

        <!-- Failed -->
        <div class="p-3 bg-red-50 rounded-lg border border-red-200" *ngIf="syncStatus().failed > 0">
          <p class="text-sm text-gray-600">Erreurs</p>
          <p class="text-2xl font-bold text-red-600">{{ syncStatus().failed }}</p>
        </div>
      </div>

      <!-- Boutons d'action -->
      <div class="flex gap-2 mt-4">
        <button 
          *ngIf="syncStatus().pending > 0"
          (click)="pushToSync()"
          [disabled]="isSyncing()"
          class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg 
                 font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
          {{ isSyncing() ? 'Synchronisation...' : 'Synchroniser' }}
        </button>

        <button 
          *ngIf="syncStatus().failed > 0"
          (click)="retryFailed()"
          [disabled]="isSyncing()"
          class="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg 
                 font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
          Réessayer
        </button>
      </div>

      <p class="text-xs text-gray-500 mt-3 text-center">
       Dernier contrôle: 
       <!-- {{ formatTime(syncStatus().last_check) }} -->
      </p>
    </div>
  `,
  styles: []
})
export class SyncQueueStatusComponent implements OnInit, OnDestroy {
  private salesService = inject(SalesService);
  
  syncStatus = this.salesService.syncStatus;
  isSyncing = signal(false);

  ngOnInit(): void {
    // Aucun besoin de setup, le service gère l'auto-refresh
  }

  ngOnDestroy(): void {
    // Cleanup si nécessaire
  }

  pushToSync(): void {
    this.isSyncing.set(true);
    this.salesService.syncToCentral().subscribe({
      next: () => {
        this.isSyncing.set(false);
      },
      error: (err) => {
        console.error('Erreur sync:', err);
        this.isSyncing.set(false);
      }
    });
  }

  retryFailed(): void {
    this.isSyncing.set(true);
    this.salesService.retryFailed().subscribe({
      next: () => {
        this.isSyncing.set(false);
      },
      error: (err) => {
        console.error('Erreur retry:', err);
        this.isSyncing.set(false);
      }
    });
  }

  formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
}

// Don't forget to import signal
import { signal } from '@angular/core';
