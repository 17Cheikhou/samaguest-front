import { Component, inject, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService } from '../../../core/services/dashboard.service';
import { UserService } from '../../../core/services/user.service';
import {
  Chart, CategoryScale, LinearScale, PointElement, LineElement,
  LineController, Filler, Tooltip, Legend
} from 'chart.js';

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, LineController, Filler, Tooltip, Legend);

@Component({
  selector: 'app-home',
  templateUrl: './home.html',
  styleUrls: ['./home.css'],
  standalone: true,
  imports: [CommonModule]
})
export class Home implements OnInit, AfterViewInit, OnDestroy {
  public  dashboardService = inject(DashboardService);
  private userService      = inject(UserService);
  private cdr              = inject(ChangeDetectorRef);

  data    = this.dashboardService.data;
  loading = this.dashboardService.loading;
  error   = this.dashboardService.error;
  user    = this.userService.user;

  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;
  private chartInstance: Chart | null = null;
  private weeklyData: { day: string; total: number }[] = [];
  private viewReady = false;

  ngOnInit(): void {
    this.dashboardService.fetch().subscribe(d => {
      if (d) {
        this.weeklyData = d.weekly_sales;
        if (this.viewReady) {
          this.cdr.detectChanges(); // force le DOM à rendre le canvas avant de dessiner
          this.renderChart();
        }
      }
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    if (this.weeklyData.length) this.renderChart();
  }

  ngOnDestroy(): void {
    this.chartInstance?.destroy();
  }

  private renderChart(): void {
    if (!this.chartCanvas) return;
    this.chartInstance?.destroy();
    this.chartInstance = new Chart(this.chartCanvas.nativeElement, {
      type: 'line',
      data: {
        labels: this.weeklyData.map(w => w.day),
        datasets: [{
          label: 'Ventes',
          data: this.weeklyData.map(w => w.total),
          backgroundColor: 'rgba(59,130,246,0.1)',
          borderColor: '#3b82f6',
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#fff',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: ctx => `  ${new Intl.NumberFormat('fr-FR').format(ctx.parsed.y ?? 0)} FCFA`
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#6b7280' } },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: {
              color: '#6b7280',
              callback: v => `${new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(+v)}`
            }
          }
        }
      }
    });
  }

  getPaymentIcon(method: string): string {
    return ({ cash: '💵', wave: '📱', card: '💳', check: '🏦' } as any)[method] ?? '💰';
  }

  getPaymentLabel(method: string): string {
    return ({ cash: 'Espèces', wave: 'Wave', card: 'Carte', check: 'Chèque' } as any)[method] ?? method;
  }

  getClientName(sale: any): string {
    if (sale.client) return `${sale.client.first_name} ${sale.client.last_name}`;
    return sale.client_name || 'Client passager';
  }

  getStockClass(item: any): string {
    if (item.global_stock === 0) return 'text-red-600 bg-red-50';
    return 'text-amber-600 bg-amber-50';
  }

  formatCurrency(v: number): string {
    return this.dashboardService.formatCurrency(v);
  }
}
