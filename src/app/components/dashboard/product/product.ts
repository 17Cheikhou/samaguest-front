import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProductService, Product } from '../../../core/services/product.service';

@Component({
  selector: 'app-product',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './product.html',
  styleUrl: './product.css',
})
export class Products implements OnInit {
  private fb = inject(FormBuilder);
  public productService = inject(ProductService);

  products: Product[] = [];
  filteredProducts: Product[] = [];
  showForm = false;
  editingId: number | null = null;
  searchQuery = '';
  filterStatus: 'all' | 'active' | 'inactive' | 'low_stock' = 'all';

  // Form options
  statusOptions = [
    { value: 'active', label: 'Actif', color: 'emerald' },
    { value: 'inactive', label: 'Inactif', color: 'red' }
  ];

  formOptions = [
    'Comprimé', 'Gélule', 'Sirop', 'Injection', 'Pommade', 
    'Crème', 'Gouttes', 'Suppositoire', 'Suspension', 'Solution'
  ];

  productForm: FormGroup;

  constructor() {
    this.productForm = this.fb.group({
      name:          ['', [Validators.required, Validators.minLength(2)]],
      description:   [''],
      cip:           [''],
      cost_price:    [0, [Validators.required, Validators.min(0)]],
      margin:        [0, [Validators.required, Validators.min(0), Validators.max(100)]],
      selling_price: [0, [Validators.min(0)]],
      laboratory:    [''],
      global_stock:  [0, [Validators.min(0)]],
      display_stock: [0, [Validators.min(0)]],
      reorder_level: [0, [Validators.min(0)]],
      form:          [''],
      schedule:      [''],
      has_tva:       [false],
      expiry_date:   [''],
      status:        ['active']
    });

    // Auto-calculate selling price when cost price or margin changes
    this.productForm.get('cost_price')?.valueChanges.subscribe(() => this.calculateSellingPrice());
    this.productForm.get('margin')?.valueChanges.subscribe(() => this.calculateSellingPrice());
  }

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.productService.getProducts().subscribe({
      next: (res: any) => {
        const list = Array.isArray(res) ? res : (res?.data || []);
        this.products = list;
        this.applyFilters();
      },
      error: (err) => {
        console.error('Erreur chargement produits:', err);
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.products];

    // Search filter
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name?.toLowerCase().includes(query) ||
        p.cip?.toLowerCase().includes(query) ||
        p.laboratory?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (this.filterStatus === 'active') {
      filtered = filtered.filter(p => p.status === 'active');
    } else if (this.filterStatus === 'inactive') {
      filtered = filtered.filter(p => p.status === 'inactive');
    } else if (this.filterStatus === 'low_stock') {
      filtered = filtered.filter(p => (p.global_stock || 0) <= (p.reorder_level || 0));
    }

    this.filteredProducts = filtered;
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
    if (!this.showForm) {
      this.cancelEdit();
    }
  }

  editProduct(product: Product): void {
    this.editingId = product.id || null;
    this.productForm.patchValue({
      name:          product.name,
      description:   product.description,
      cip:           product.cip,
      cost_price:    product.cost_price,
      margin:        product.margin,
      selling_price: product.selling_price,
      laboratory:    product.laboratory,
      global_stock:  product.global_stock ?? product.stock ?? 0,
      display_stock: product.display_stock ?? 0,
      reorder_level: product.reorder_level ?? 0,
      form:          product.form,
      schedule:      product.schedule,
      has_tva:       product.has_tva,
      expiry_date:   product.expiry_date ? product.expiry_date.split('T')[0] : '',
      status:        product.status || 'active'
    });
    this.showForm = true;
  }

  cancelEdit(): void {
    this.editingId = null;
    this.productForm.reset({
      has_tva:       false,
      status:        'active',
      cost_price:    0,
      margin:        0,
      selling_price: 0,
      global_stock:  0,
      display_stock: 0,
      reorder_level: 0
    });
    this.showForm = false;
  }

  get isEditing(): boolean {
    return this.editingId !== null;
  }

  saveProduct(): void {
    if (!this.productForm.valid) {
      this.markFormGroupTouched(this.productForm);
      return;
    }

    const formValue = this.productForm.value;
    const payload: Partial<Product> = {
      name:          formValue.name?.trim() || '',
      description:   formValue.description?.trim() || undefined,
      cip:           formValue.cip?.trim() || undefined,
      cost_price:    Number(formValue.cost_price) || 0,
      margin:        Number(formValue.margin) || 0,
      laboratory:    formValue.laboratory?.trim() || undefined,
      reorder_level: Number(formValue.reorder_level) || 0,
      form:          formValue.form?.trim() || undefined,
      schedule:      formValue.schedule?.trim() || undefined,
      has_tva:       formValue.has_tva === true,
      expiry_date:   formValue.expiry_date || undefined,
      status:        formValue.status || 'active'
    };

    // Stock initial uniquement à la création
    if (!this.isEditing) {
      payload.global_stock  = Number(formValue.global_stock)  || 0;
      payload.display_stock = Number(formValue.display_stock) || 0;
    }

    const action$ = this.editingId
      ? this.productService.updateProduct(this.editingId, payload)
      : this.productService.createProduct(payload as Omit<Product, 'id'>);

    action$.subscribe({
      next: () => {
        this.loadProducts();
        this.cancelEdit();
      },
      error: (err) => {
        console.error('Erreur sauvegarde produit:', err);
      }
    });
  }

  deleteProduct(id: number): void {
    if (confirm('⚠️ Êtes-vous sûr de vouloir supprimer ce produit ?\n\nCette action est irréversible.')) {
      this.productService.deleteProduct(id).subscribe({
        next: () => {
          this.loadProducts();
        },
        error: (err) => {
          console.error('Erreur suppression produit:', err);
        }
      });
    }
  }

  // Utility methods
  calculateSellingPrice(): void {
    const costPrice = Number(this.productForm.get('cost_price')?.value) || 0;
    const margin = Number(this.productForm.get('margin')?.value) || 0;
    
    if (costPrice > 0 && margin > 0) {
      const sellingPrice = costPrice * (1 + margin / 100);
      this.productForm.get('selling_price')?.setValue(sellingPrice.toFixed(2), { emitEvent: false });
    }
  }

  isLowStock(product: Product): boolean {
    return (product.global_stock || 0) <= (product.reorder_level || 0);
  }

  isExpiringSoon(product: Product): boolean {
    if (!product.expiry_date) return false;
    const expiryDate = new Date(product.expiry_date);
    const today = new Date();
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
    return expiryDate >= today && expiryDate <= threeMonthsFromNow;
  }

  isExpired(product: Product): boolean {
    if (!product.expiry_date) return false;
    const expiryDate = new Date(product.expiry_date);
    return expiryDate < new Date();
  }

  getStockStatus(product: Product): 'low' | 'normal' | 'good' {
    const stock = product.global_stock || 0;
    const reorderLevel = product.reorder_level || 0;

    if (stock <= reorderLevel) return 'low';
    if (stock <= reorderLevel * 2) return 'normal';
    return 'good';
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      formGroup.get(key)?.markAsTouched();
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.productForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.productForm.get(fieldName);
    if (!field || !field.errors) return '';

    if (field.errors['required']) return 'Ce champ est requis';
    if (field.errors['minlength']) return `Minimum ${field.errors['minlength'].requiredLength} caractères`;
    if (field.errors['min']) return `Valeur minimale: ${field.errors['min'].min}`;
    if (field.errors['max']) return `Valeur maximale: ${field.errors['max'].max}`;

    return 'Champ invalide';
  }

  formatPrice(price?: number): string {
    return price ? `${price.toLocaleString('fr-FR')} FCFA` : '0 FCFA';
  }

  get lowStockCount(): number {
    return this.products.filter(p => this.isLowStock(p)).length;
  }

  get activeProductsCount(): number {
    return this.products.filter(p => p.status === 'active').length;
  }

  get totalValue(): number {
    return this.products.reduce((sum, p) => sum + ((p.global_stock || 0) * (p.selling_price || 0)), 0);
  }
}
