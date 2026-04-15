import { Component, inject, signal, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { UserService } from '../../../core/services/user.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.html',
  styleUrls: ['./header.css'],
  standalone: true,
  imports: [CommonModule]
})
export class Header {
  private userService = inject(UserService);
  private router = inject(Router);
  
  user = this.userService.user;
  
  mobileMenuOpen = signal(false);
  profileMenuOpen = signal(false);
  currentTime = signal('');

  constructor() {
    this.updateTime();
    setInterval(() => this.updateTime(), 60000);
  }

  // Fermer le menu profil si on clique en dehors
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.profile-menu-container') && this.profileMenuOpen()) {
      this.profileMenuOpen.set(false);
    }
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
    window.dispatchEvent(new CustomEvent('toggle-sidebar'));
  }

  toggleProfileMenu(event?: MouseEvent): void {
    event?.stopPropagation();
    this.profileMenuOpen.update(value => !value);
  }

  navigateToProfile(): void {
    this.profileMenuOpen.set(false);
    this.router.navigate(['/profile']);
  }

  logout(): void {
    this.profileMenuOpen.set(false);
    this.userService.logout();
    this.router.navigate(['/login']);
  }

  getUserInitials(): string {
    return this.user()?.name?.charAt(0)?.toUpperCase() || 'U';
  }
}