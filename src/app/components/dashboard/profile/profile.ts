import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { last } from 'rxjs';
@Component({
  selector: 'app-profile',
  templateUrl: './profile.html',
  styleUrls: ['./profile.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule]
})
export class Profile implements OnInit {
  private userService = inject(UserService);
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  
  user = this.userService.user;
  loading = signal(true);
  saving = signal(false);
  successMessage = signal('');
  errorMessage = signal('');
  
  profileForm!: FormGroup;
  passwordForm!: FormGroup;
  
  showPasswordForm = signal(false);
  showDeleteConfirm = signal(false);
  userId = signal<number | null>(null);
  canChangePassword = signal(true);

  ngOnInit(): void {
    this.initForms();
    
    // Vérifier si c'est un profil d'utilisateur spécifique
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.userId.set(params['id']);
        this.loadUserById(params['id']);
      } else {
        this.loadUserData();
      }
    });
  }

  private initForms(): void {
    this.profileForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
    });

    this.passwordForm = this.fb.group({
      current_password: ['', [Validators.required, Validators.minLength(6)]],
      new_password: ['', [Validators.required, Validators.minLength(8)]],
      confirm_password: ['', [Validators.required]]
    }, { validator: this.passwordMatchValidator });
    
  }

  private passwordMatchValidator(g: FormGroup) {
    return g.get('new_password')?.value === g.get('confirm_password')?.value
      ? null : { mismatch: true };
  }

  private loadUserData(): void {
    const currentUser = this.user();
    if (currentUser) {
      this.profileForm.patchValue({
        name: currentUser.name,
        email: currentUser.email,
        last_login: currentUser.last_visit_at || ''
      });
    }
    // Lors de la consultation de votre propre profil, autorisez la modification du mot de passe
    this.canChangePassword.set(true);
    this.loading.set(false);
  }

  /**
   * Charger les données d'un utilisateur spécifique par ID
   */
  private loadUserById(userId: number): void {
    this.authService.getUserById(userId).subscribe({
      next: (response: any) => {
        const userData = response?.user ?? response;
        if (!userData) {
          console.error('Response user not found:', response);
          this.errorMessage.set('Utilisateur introuvable');
          this.loading.set(false);
          return;
        }
        this.user.set(userData);
        this.profileForm.patchValue({
          name: userData.name ?? '',
          email: userData.email ?? '',
          last_login: userData.last_visit_at || ''
        });
        // Désactiver la modification du mot de passe lors de la consultation du profil d'un autre utilisateur
        const current = this.authService.getSessionInfo();
        if (current && current.id && current.id === userData.id) {
          this.canChangePassword.set(true);
        } else {
          this.canChangePassword.set(false);
        }

        this.loading.set(false);
      },
      error: (err) => {
        console.error('Erreur chargement utilisateur:', err);
        this.errorMessage.set('Impossible de charger le profil utilisateur');
        this.loading.set(false);
      }
    });
  }

  updateProfile(): void {
    if (this.profileForm.invalid) {
      this.markFormGroupTouched(this.profileForm);
      return;
    }

    this.saving.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');

    // Simulation d'appel API
    setTimeout(() => {
      const updatedUser = {
        ...this.user(),
        ...this.profileForm.value,
        updated_at: new Date().toISOString()
      };

      this.userService.updateUser(updatedUser);
      this.successMessage.set('Profil mis à jour avec succès !');
      this.saving.set(false);

      // Effacer le message après 5 secondes
      setTimeout(() => this.successMessage.set(''), 5000);
    }, 1000);
  }

  updatePassword(): void {
    if (this.passwordForm.invalid) {
      this.markFormGroupTouched(this.passwordForm);
      return;
    }

    this.saving.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');

    // Simulation d'appel API
    setTimeout(() => {
      this.successMessage.set('Mot de passe modifié avec succès !');
      this.saving.set(false);
      this.showPasswordForm.set(false);
      this.passwordForm.reset();

      // Effacer le message après 5 secondes
      setTimeout(() => this.successMessage.set(''), 5000);
    }, 1000);
  }

  deleteAccount(): void {
    this.saving.set(true);
    
    // Simulation d'appel API
    setTimeout(() => {
      this.userService.logout();
      window.location.href = '/login';
    }, 1500);
  }

  getRoleBadgeClass(): string {
    const role = this.user()?.role;
    switch(role) {
      case 'superadmin':
        return 'bg-gradient-to-r from-purple-600 to-purple-700 text-white';
      case 'admin':
        return 'bg-gradient-to-r from-red-600 to-red-700 text-white';
      case 'pharmacist':
        return 'bg-gradient-to-r from-blue-600 to-blue-700 text-white';
      case 'manager':
        return 'bg-gradient-to-r from-green-600 to-green-700 text-white';
      case 'cashier':
        return 'bg-gradient-to-r from-yellow-600 to-yellow-700 text-white';
      default:
        return 'bg-gradient-to-r from-gray-600 to-gray-700 text-white';
    }
  }

  getRoleDisplayName(): string {
    const role = this.user()?.role;
    switch(role) {
      case 'superadmin': return 'Super Administrateur';
      case 'admin': return 'Administrateur Pharmacie';
      case 'pharmacist': return 'Pharmacien Diplômé';
      case 'manager': return 'Manager de Pharmacie';
      case 'cashier': return 'Caissier/Préparateur';
      default: return 'Utilisateur';
    }
  }

  getRoleIcon(): string {
    const role = this.user()?.role;
    switch(role) {
      case 'superadmin': return 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z';
      case 'admin': return 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z';
      case 'pharmacist': return 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z';
      case 'manager': return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';
      case 'cashier': return 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
      default: return 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z';
    }
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }
}