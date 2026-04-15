import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ClientService, Client, ClientType, FamilyGroup } from '../../../core/services/client.service';

@Component({
  selector: 'app-customer',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './customer.html',
  styleUrl: './customer.css',
})
export class Customer implements OnInit {
  private fb = inject(FormBuilder);
  public clientService = inject(ClientService);
  private router = inject(Router);

  // ── Onglets ───────────────────────────────────────────────────────────────
  activeTab: 'clients' | 'types' = 'clients';

  // ── Formulaires principaux ────────────────────────────────────────────────
  showClientForm = false;
  showTypeForm   = false;
  editingClientId: number | null = null;
  editingTypeId:   number | null = null;

  // ── Modals ────────────────────────────────────────────────────────────────
  showFamilyModal    = signal(false);
  showSubAccountForm = signal(false);
  showBlockModal     = signal(false);

  // ── Données ───────────────────────────────────────────────────────────────
  clientsList: Client[]    = [];
  typesList:   ClientType[] = [];
  searchQuery  = '';

  selectedFamily             = signal<FamilyGroup | null>(null);
  selectedClientForAction    = signal<Client | null>(null);

  // ── Référentiels ─────────────────────────────────────────────────────────
  bloodTypes = [
    { value: '',    label: 'Non spécifié' },
    { value: 'O+',  label: 'O+',  color: 'bg-red-500'     },
    { value: 'O-',  label: 'O-',  color: 'bg-pink-500'    },
    { value: 'A+',  label: 'A+',  color: 'bg-purple-500'  },
    { value: 'A-',  label: 'A-',  color: 'bg-indigo-500'  },
    { value: 'B+',  label: 'B+',  color: 'bg-blue-500'    },
    { value: 'B-',  label: 'B-',  color: 'bg-cyan-500'    },
    { value: 'AB+', label: 'AB+', color: 'bg-teal-500'    },
    { value: 'AB-', label: 'AB-', color: 'bg-emerald-500' },
  ];

  genders = [
    { value: '',  label: 'Non spécifié' },
    { value: 'M', label: 'Masculin'     },
    { value: 'F', label: 'Féminin'      },
  ];

  relationships = [
    { value: 'enfant',   label: 'Enfant',      icon: '👶' },
    { value: 'conjoint', label: 'Conjoint(e)',  icon: '💑' },
    { value: 'parent',   label: 'Parent',       icon: '👴' },
    { value: 'frère',    label: 'Frère',        icon: '👦' },
    { value: 'sœur',     label: 'Sœur',         icon: '👧' },
    { value: 'autre',    label: 'Autre',        icon: '👤' },
  ];

  // ── Formulaires réactifs ──────────────────────────────────────────────────
  clientForm:     FormGroup;
  typeForm:       FormGroup;
  subAccountForm: FormGroup;
  blockForm:      FormGroup;

  constructor() {
    this.clientForm = this.fb.group({
      first_name:          ['', [Validators.required, Validators.minLength(2)]],
      last_name:           ['', [Validators.required, Validators.minLength(2)]],
      birth_date:          [''],
      email:               ['', [Validators.email]],
      phone_number:        [''],
      address:             [''],
      client_type_id:      ['', Validators.required],
      blood_type:          [''],
      insurance_company:   [''],
      gender:              [''],
      chronic_disease:     [''],
      discount_percentage: [0,  [Validators.min(0), Validators.max(100)]],
      spending_limit:      [null, [Validators.min(0)]],
    });

    this.subAccountForm = this.fb.group({
      first_name:          ['', [Validators.required, Validators.minLength(2)]],
      last_name:           ['', [Validators.required, Validators.minLength(2)]],
      birth_date:          [''],
      gender:              [''],
      relationship:        ['enfant', Validators.required],
      client_type_id:      ['', Validators.required],
      spending_limit:      [null, [Validators.min(0)]],
      discount_percentage: [null],
    });

    this.typeForm = this.fb.group({
      name:        ['', [Validators.required, Validators.minLength(2)]],
      description: [''],
    });

    this.blockForm = this.fb.group({
      reason: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.clientService.getClients().subscribe({
      next: (clients) => { this.clientsList = clients; },
      error: () => {}
    });
    this.clientService.getClientTypes().subscribe({
      next: (types) => { this.typesList = types; },
      error: () => {}
    });
  }

  // ── Filtre recherche ──────────────────────────────────────────────────────

  get filteredClients(): Client[] {
    if (!this.searchQuery.trim()) return this.clientsList;
    const q = this.searchQuery.toLowerCase();
    return this.clientsList.filter(c =>
      c.first_name?.toLowerCase().includes(q)  ||
      c.last_name?.toLowerCase().includes(q)   ||
      c.email?.toLowerCase().includes(q)        ||
      c.phone_number?.toLowerCase().includes(q)
    );
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  switchTab(tab: 'clients' | 'types'): void {
    this.activeTab = tab;
    this.showClientForm = false;
    this.showTypeForm   = false;
    this.cancelClientEdit();
    this.cancelTypeEdit();
  }

  // ── Patient principal ─────────────────────────────────────────────────────

  toggleClientForm(): void {
    this.showClientForm = !this.showClientForm;
    if (!this.showClientForm) this.cancelClientEdit();
  }

  editClient(client: Client): void {
    this.editingClientId = client.id ?? null;
    this.clientForm.patchValue({
      first_name:          client.first_name          ?? '',
      last_name:           client.last_name           ?? '',
      birth_date:          client.birth_date          ?? '',
      email:               client.email               ?? '',
      phone_number:        client.phone_number        ?? '',
      address:             client.address             ?? '',
      client_type_id:      client.client_type_id?.toString() ?? '',
      blood_type:          client.blood_type          ?? '',
      insurance_company:   client.insurance_company   ?? '',
      gender:              client.gender              ?? '',
      chronic_disease:     client.chronic_disease     ?? '',
      discount_percentage: client.discount_percentage ?? 0,
      spending_limit:      client.spending_limit      ?? null,
    });
    this.showClientForm = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelClientEdit(): void {
    this.editingClientId = null;
    this.clientForm.reset({ discount_percentage: 0 });
    this.showClientForm = false;
  }

  saveClient(): void {
    if (!this.clientForm.valid) { this.markTouched(this.clientForm); return; }

    const f = this.clientForm.value;
    const data: Partial<Client> = {
      first_name:          f.first_name?.trim(),
      last_name:           f.last_name?.trim(),
      birth_date:          f.birth_date          || undefined,
      email:               f.email?.trim()       || undefined,
      phone_number:        f.phone_number?.trim()|| undefined,
      address:             f.address?.trim()     || undefined,
      client_type_id:      parseInt(f.client_type_id),
      blood_type:          f.blood_type          || undefined,
      insurance_company:   f.insurance_company?.trim() || undefined,
      gender:              f.gender              || undefined,
      chronic_disease:     f.chronic_disease?.trim()   || undefined,
      discount_percentage: f.discount_percentage ?? 0,
      spending_limit:      f.spending_limit != null ? Number(f.spending_limit) : null,
    };

    const action$ = this.editingClientId
      ? this.clientService.updateClient(this.editingClientId, data)
      : this.clientService.createClient(data as any);

    action$.subscribe({
      next: () => { this.loadData(); this.cancelClientEdit(); },
      error: (err) => console.error('Erreur save client:', err),
    });
  }

  deleteClient(id: number): void {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce patient ?')) return;
    this.clientService.deleteClient(id).subscribe({
      next: () => this.loadData(),
      error: (err) => console.error('Erreur suppression:', err),
    });
  }

  // ── Famille / Sous-comptes ────────────────────────────────────────────────

  openFamilyModal(client: Client): void {
    const principalId = client.parent_client_id ?? client.id;
    if (!principalId) return;
    this.clientService.getClientFamily(principalId).subscribe({
      next: (family) => { this.selectedFamily.set(family); this.showFamilyModal.set(true); },
      error: (err)   => console.error('Erreur famille:', err),
    });
  }

  closeFamilyModal(): void {
    this.showFamilyModal.set(false);
    this.showSubAccountForm.set(false);
    this.selectedFamily.set(null);
    this.subAccountForm.reset({ relationship: 'enfant' });
  }

  openSubAccountForm(parent: Client): void {
    this.selectedClientForAction.set(parent);
    this.subAccountForm.reset({
      relationship:        'enfant',
      discount_percentage: parent.discount_percentage ?? 0,
      client_type_id:      parent.client_type_id?.toString() ?? '',
    });
    this.showSubAccountForm.set(true);
  }

  saveSubAccount(): void {
    if (!this.subAccountForm.valid) { this.markTouched(this.subAccountForm); return; }
    const parent = this.selectedClientForAction();
    if (!parent?.id) return;

    const f = this.subAccountForm.value;
    const data: Partial<Client> = {
      first_name:          f.first_name?.trim(),
      last_name:           f.last_name?.trim(),
      birth_date:          f.birth_date  || undefined,
      gender:              f.gender      || undefined,
      relationship:        f.relationship,
      parent_client_id:    parent.id,
      client_type_id:      parseInt(f.client_type_id),
      spending_limit:      f.spending_limit != null ? Number(f.spending_limit) : null,
      discount_percentage: f.discount_percentage ?? parent.discount_percentage ?? 0,
    };

    this.clientService.createClient(data as any).subscribe({
      next: () => {
        this.loadData();
        this.showSubAccountForm.set(false);
        this.subAccountForm.reset({ relationship: 'enfant' });
        if (parent.id) {
          this.clientService.getClientFamily(parent.id).subscribe({
            next: (fam) => this.selectedFamily.set(fam),
          });
        }
      },
      error: (err) => console.error('Erreur sous-compte:', err),
    });
  }

  // ── Blocage ───────────────────────────────────────────────────────────────

  openBlockModal(client: Client): void {
    this.selectedClientForAction.set(client);
    this.blockForm.reset();
    this.showBlockModal.set(true);
  }

  closeBlockModal(): void {
    this.showBlockModal.set(false);
    this.blockForm.reset();
  }

  confirmBlock(): void {
    if (!this.blockForm.valid) return;
    const client = this.selectedClientForAction();
    if (!client?.id) return;
    this.clientService.blockClient(client.id, this.blockForm.value.reason).subscribe({
      next: () => { this.loadData(); this.closeBlockModal(); },
      error: (err) => console.error('Erreur blocage:', err),
    });
  }

  unblockClient(client: Client): void {
    if (!client.id) return;
    if (!confirm(`Débloquer ${client.first_name} ${client.last_name} ?`)) return;
    this.clientService.unblockClient(client.id).subscribe({
      next: () => this.loadData(),
      error: (err) => console.error('Erreur déblocage:', err),
    });
  }

  resetSpending(client: Client): void {
    if (!client.id) return;
    if (!confirm(`Réinitialiser le plafond de ${client.first_name} ${client.last_name} ?`)) return;
    this.clientService.resetSpending(client.id).subscribe({
      next: () => this.loadData(),
      error: (err) => console.error('Erreur reset:', err),
    });
  }

  // ── Types ──────────────────────────────────────────────────────────────────

  toggleTypeForm(): void {
    this.showTypeForm = !this.showTypeForm;
    if (!this.showTypeForm) this.cancelTypeEdit();
  }

  editClientType(type: ClientType): void {
    this.editingTypeId = type.id ?? null;
    this.typeForm.patchValue({ name: type.name, description: type.description });
    this.showTypeForm = true;
  }

  cancelTypeEdit(): void {
    this.editingTypeId = null;
    this.typeForm.reset();
    this.showTypeForm = false;
  }

  saveClientType(): void {
    if (!this.typeForm.valid) { this.markTouched(this.typeForm); return; }
    const data = {
      name:        this.typeForm.value.name?.trim()        ?? '',
      description: this.typeForm.value.description?.trim() ?? '',
    };
    const action$ = this.editingTypeId
      ? this.clientService.updateClientType(this.editingTypeId, data as any)
      : this.clientService.createClientType(data as any);
    action$.subscribe({
      next: () => { this.loadData(); this.cancelTypeEdit(); },
      error: (err) => console.error('Erreur type:', err),
    });
  }

  deleteClientType(id: number): void {
    if (!confirm('Supprimer ce type ?')) return;
    this.clientService.deleteClientType(id).subscribe({
      next: () => this.loadData(),
      error: (err) => console.error('Erreur suppression type:', err),
    });
  }

  // ── Helpers visuels ───────────────────────────────────────────────────────

  getBloodTypeColor(bt?: string): string {
    return this.bloodTypes.find(b => b.value === bt)?.color ?? 'bg-gray-400';
  }

  hasDiscount(c: Client): boolean {
    return !!c.discount_percentage && c.discount_percentage > 0;
  }

  getInitials(f?: string, l?: string): string {
    return (f?.charAt(0)?.toUpperCase() ?? '') + (l?.charAt(0)?.toUpperCase() ?? '') || '?';
  }

  formatCurrency(n?: number | null): string {
    if (!n) return '0 FCFA';
    return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';
  }

  getSpendingPercent(c: Client): number {
    return this.clientService.getSpendingPercentage(c);
  }

  getSpendingBarColor(pct: number): string {
    if (pct >= 90) return 'bg-red-500';
    if (pct >= 70) return 'bg-amber-500';
    return 'bg-emerald-500';
  }

  isSubAccount(c: Client): boolean {
    return this.clientService.isSubAccount(c);
  }

  // ── Validation ────────────────────────────────────────────────────────────

  private markTouched(fg: FormGroup): void {
    Object.values(fg.controls).forEach(c => c.markAsTouched());
  }

  isFieldInvalid(fg: FormGroup, field: string): boolean {
    const c = fg.get(field);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }

  getFieldError(fg: FormGroup, field: string): string {
    const e = fg.get(field)?.errors;
    if (!e) return '';
    if (e['required'])  return 'Ce champ est requis';
    if (e['minlength']) return `Minimum ${e['minlength'].requiredLength} caractères`;
    if (e['email'])     return 'Email invalide';
    if (e['min'])       return `Valeur minimale : ${e['min'].min}`;
    if (e['max'])       return `Valeur maximale : ${e['max'].max}`;
    return 'Champ invalide';
  }
}