import { Component, inject, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService } from '../../../core/services/dashboard.service';
import { UserService } from '../../../core/services/user.service';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartDataset, ChartType } from 'chart.js';

@Component({
  selector: 'app-home',
  templateUrl: './home.html',
  styleUrls: ['./home.css'],
  standalone: true,
  imports: [CommonModule, BaseChartDirective]
})
export class Home implements OnInit {
  private dashboardService = inject(DashboardService);
  private userService = inject(UserService);
  
  // Signals exposés au template
  summary = this.dashboardService.summary;
  loading = this.dashboardService.loading;
  user = this.userService.user;
  
  // Référence au chart
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  // Configuration du graphique
  public lineChartData: ChartConfiguration['data'] = {
    datasets: [
      {
        data: [],
        label: 'Ventes (€)',
        backgroundColor: 'rgba(10, 92, 140, 0.1)',
        borderColor: '#0a5c8c',
        pointBackgroundColor: '#0a5c8c',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#0a5c8c',
        fill: 'origin',
        tension: 0.4
      }
    ],
    labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
  };

  public lineChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#0a5c8c',
        bodyColor: '#666',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        padding: 12,
        boxPadding: 6
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: '#666'
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          color: '#666',
          callback: (value) => `${value}€`
        }
      }
    }
  };

  public lineChartType: ChartType = 'line';

  ngOnInit(): void {
    // Charger les données du dashboard
    this.dashboardService.fetchDashboardData().subscribe(data => {
      this.updateChartData(data.weeklySales);
    });
  }

  private updateChartData(weeklySales: { day: string; amount: number }[]): void {
    if (weeklySales && weeklySales.length > 0) {
      this.lineChartData.datasets[0].data = weeklySales.map(sale => sale.amount);
      this.chart?.update();
    }
  }

  refreshData(): void {
    this.dashboardService.refresh();
  }

  // Méthode pour obtenir les classes CSS selon le rôle
  getUserRoleClass(): string {
    const role = this.user()?.role;
    switch(role) {
      case 'superadmin':
        return 'bg-purple-100 text-purple-800';
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'pharmacist':
        return 'bg-blue-100 text-blue-800';
      case 'manager':
        return 'bg-green-100 text-green-800';
      case 'cashier':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }
}
