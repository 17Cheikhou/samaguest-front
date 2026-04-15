import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';

export interface Product {
  id?: number;
  name: string;
  description?: string;
  cip?: string;
  cost_price?: number;
  margin?: number;
  selling_price?: number;
  laboratory?: string;
  // Champs stock (alignés avec la DB)
  global_stock?: number;   // Stock entrepôt
  display_stock?: number;  // Stock armoire/comptoir
  reorder_level?: number;  // Seuil réapprovisionnement
  form?: string;
  schedule?: 'A' | 'B' | 'C' | null;
  has_tva?: boolean;
  expiry_date?: string;
  status?: 'active' | 'inactive';
  created_at?: string;
  updated_at?: string;
  // Alias frontend (calculé à partir de global_stock)
  stock?: number;
  minimum_stock?: number;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient);
  private API = 'http://127.0.0.1:8000/api';

  isLoading = signal(false);
  isSaving = signal(false);
  error = signal('');

  getProducts() {
    this.isLoading.set(true);
    this.error.set('');
    return this.http.get<Product[]>(`${this.API}/products`).pipe(
      tap(
        () => this.isLoading.set(false),
        (err) => {
          this.error.set(err?.error?.message || 'Erreur lors de la récupération des produits');
          this.isLoading.set(false);
        }
      )
    );
  }

  getProduct(id: number) {
    return this.http.get<Product>(`${this.API}/products/${id}`);
  }

  createProduct(product: Omit<Product, 'id'>) {
    this.isSaving.set(true);
    this.error.set('');
    return this.http.post<Product>(`${this.API}/products`, product).pipe(
      tap(
        () => this.isSaving.set(false),
        (err) => {
          this.error.set(err?.error?.message || "Erreur lors de la création du produit");
          this.isSaving.set(false);
        }
      )
    );
  }

  updateProduct(id: number, product: Partial<Product>) {
    this.isSaving.set(true);
    this.error.set('');
    return this.http.put<Product>(`${this.API}/products/${id}`, product).pipe(
      tap(
        () => this.isSaving.set(false),
        (err) => {
          this.error.set(err?.error?.message || "Erreur lors de la mise à jour");
          this.isSaving.set(false);
        }
      )
    );
  }

  deleteProduct(id: number) {
    return this.http.delete(`${this.API}/products/${id}`).pipe(
      tap(
        () => this.error.set(''),
        (err) => this.error.set(err?.error?.message || 'Erreur lors de la suppression')
      )
    );
  }
}
