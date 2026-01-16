import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { UserService } from '../../../core/services/user.service';
@Component({
  selector: 'app-header',
  templateUrl: './header.html',
  styleUrls: ['./header.css'],
  standalone: true
})
export class Header {
  private userService = inject(UserService);
  private router = inject(Router);
  
  // Exposer l'utilisateur pour le template
  user = this.userService.user;
  
  // État pour le menu mobile
  mobileMenuOpen = signal(false);
  profileMenuOpen = signal(false);
  
  // Heure actuelle
  currentTime = signal('');

  constructor() {
    // Mettre à jour l'heure régulièrement
    this.updateTime();
    setInterval(() => this.updateTime(), 60000); // Mise à jour chaque minute
  }

  private updateTime(): void {
    const now = new Date();
    this.currentTime.set(now.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    }));
  }

toggleMobileMenu(): void {
  this.mobileMenuOpen.update(value => !value);
  
  // Émettre un événement personnalisé
  window.dispatchEvent(new CustomEvent('toggle-sidebar'));
}

  toggleProfileMenu(): void {
    this.profileMenuOpen.update(value => !value);
  }

  navigateToProfile(): void {
    this.router.navigate(['/profile']);
  }

  logout(): void {
    this.userService.logout();
    this.router.navigate(['/login']);
  }
}