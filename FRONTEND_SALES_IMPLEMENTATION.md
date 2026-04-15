# 🚀 Refactorisation Frontend - Gestion des Ventes

**Date:** 5 février 2026  
**Status:** ✅ Complété

## 📋 Résumé des changements

Le frontend a été entièrement refactorisé pour supporter la nouvelle logique métier de vente implémentée au backend (statuts, items, payments).

## 🔄 Architecture Avant vs Après

### Avant (Simple)
```
Sale: simple, un montant total, un paiement
- id, total_amount, payment_method, status (completed/pending/cancelled)
- Création directe sans validation
- Aucune gestion d'articles ou paiements multiples
```

### Après (Complète)
```
Sale: machine d'état avec 6 statuts
├── DRAFT: créé, pas d'articles
├── VALIDATED: articles figés, prix gelés
├── PARTIALLY_PAID: au moins un paiement < total
├── PAID: payée intégralement
├── CLOSED: clôturée, stock décrémenté
└── CANCELLED: annulée non-payée

+-- SaleItem: articles avec quantité, prix, TVA
+-- SalePayment: paiements multiples traçables
```

## 📁 Fichiers Modifiés

### 1. **Sales Service** (`core/services/sales.service.ts`)

#### ✨ Nouvelles Interfaces
```typescript
enum SaleStatus {
  DRAFT, VALIDATED, PARTIALLY_PAID, PAID, CLOSED, CANCELLED
}

interface SaleItem {
  product_id: number;
  quantity: number;
  price_unit: number;
  discount?: number;
  tax_included: boolean;
  line_total?: number;
}

interface SalePayment {
  amount: number;
  payment_method: 'cash' | 'wave' | 'card' | 'check';
  reference?: string;
  notes?: string;
  paid_at?: string;
}

interface Sale {
  id?: number;
  client_id?: number;
  total_ht?: number;
  total_tax?: number;
  total_ttc?: number;
  status: SaleStatus;
  items?: SaleItem[];
  payments?: SalePayment[];
}
```

#### 🆕 Nouvelles Méthodes

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `createDraft()` | POST /api/sales/draft | Créer un brouillon |
| `addItem()` | POST /api/sales/{id}/items | Ajouter un article |
| `removeItem()` | DELETE /api/sales/{id}/items/{itemId} | Supprimer un article |
| `validateSale()` | POST /api/sales/{id}/validate | Valider la vente |
| `addPayment()` | POST /api/sales/{id}/payment | Enregistrer un paiement |
| `cancelSale()` | POST /api/sales/{id}/cancel | Annuler une vente |

### 2. **Sale Component** (`components/dashboard/sale/sale.ts`)

#### 📊 État du Composant (UI State)
```typescript
state: SaleUIState = {
  currentSale: null;          // Vente en cours de modification
  editingItem: null;          // Article en cours d'édition
  showItemForm: boolean;      // Affichage du formulaire articles
  showPaymentForm: boolean;   // Affichage du formulaire paiements
  sales: Sale[];              // Liste des ventes finalisées
}
```

#### 📋 Formulaires Réactifs
```typescript
draftForm: FormGroup;    // Client ID seulement
itemForm: FormGroup;     // Product, quantité, prix, remise, TVA
paymentForm: FormGroup;  // Montant, méthode, référence, notes
```

#### 🎯 Méthodes Métier

| Groupe | Méthodes |
|--------|----------|
| **Gestion de Ventes** | `createNewDraft()`, `selectSale()`, `closeSaleDetail()`, `loadSales()` |
| **Gestion d'Articles** | `openItemForm()`, `closeItemForm()`, `addItem()`, `removeItem()` |
| **Validation** | `validateSale()` |
| **Paiements** | `openPaymentForm()`, `closePaymentForm()`, `addPayment()` |
| **Annulation** | `cancelSale()` |
| **Sync** | `syncToCentral()`, `retryFailed()` |

#### ✅ Contrôles d'Accès
```typescript
canAddItem()     → Si statut DRAFT ou VALIDATED
canValidate()    → Si statut DRAFT ET items > 0
canAddPayment()  → Si statut VALIDATED ou PARTIALLY_PAID
canCancel()      → Si statut DRAFT ou VALIDATED
isEditable()     → Si statut ≠ PAID/CLOSED/CANCELLED
```

### 3. **Template HTML** (`components/dashboard/sale/sale.html`)

#### 🎨 Structure UI
```
┌─ Header (Brouillons / Payées)
├─ Sync Status Cards (4 statuts)
├─ Actions (Nouveau Brouillon, Synchroniser)
├─ Formulaire Brouillon (client_id)
├─ Détail Vente (si sélectionnée)
│  ├─ Formulaire Articles
│  ├─ Tableau Articles
│  ├─ Totaux (HT / TVA / TTC)
│  ├─ Formulaire Paiements
│  ├─ Tableau Paiements
│  └─ Actions (Valider, Annuler, Fermer)
└─ Table Ventes Finalisées
```

#### 📱 Formulaires Implémentés
1. **Brouillon:** Client ID
2. **Article:** Produit, Quantité, Prix, Réduction, TVA
3. **Paiement:** Montant, Méthode, Référence, Notes

#### 🔐 Validations
```
- Champs obligatoires marqués avec *
- Messages d'erreur contextuels (required, min, max)
- Boutons désactivés jusqu'à validité complète
- Montant max = solde restant
```

## 🔄 Flux Complet d'une Vente

### 1️⃣ Création Brouillon
```
User clic "Nouveau Brouillon"
  ↓
Fill client_id → Valider
  ↓
POST /api/sales/draft → Sale (status: DRAFT)
  ↓
state.currentSale = response.sale
  ↓
Afficher formulaire articles
```

### 2️⃣ Ajout d'Articles
```
User clic "+ Ajouter"
  ↓
Fill product_id, quantity, price, tax
  ↓
POST /api/sales/{id}/items
  ↓
Recharger state.currentSale avec items
  ↓
Recalculer totaux (HT/TVA/TTC)
```

### 3️⃣ Validation
```
User clic "✓ Valider" (visible si articles)
  ↓
POST /api/sales/{id}/validate
  ↓
status: DRAFT → VALIDATED
  ↓
Items figés, paiement possible
```

### 4️⃣ Paiement
```
User clic "+ Ajouter Paiement"
  ↓
Fill montant ≤ solde restant, méthode
  ↓
POST /api/sales/{id}/payment
  ↓
Status update automatique:
  VALIDATED → PARTIALLY_PAID (montant < total)
  PARTIALLY_PAID → PAID (montant = total)
  ↓
Si PAID: stock décrémenté, clôture auto
```

### 5️⃣ Affichage Finalisée
```
Sale apparaît en table "Ventes Finalisées"
User peut clic "Voir" → ouvre détail lecture seule
```

## 🎯 Statuts et Visibilité

```
┌─ DRAFT         → Edit items, Supprimer items, Valider, Annuler
├─ VALIDATED     → Edit items, Supprimer items, Ajouter paiement, Annuler
├─ PARTIALLY_PAID→ Ajouter paiement (lecture seule items)
├─ PAID          → Lecture seule (auto-closed)
├─ CLOSED        → Lecture seule (stock décrémenté)
└─ CANCELLED     → Lecture seule
```

## 💾 État Persistant

### Chargement Initial
```typescript
ngOnInit() {
  loadSales() // GET /api/sales → État finalisées
  startAutoSync() // Poll toutes les 30s
}
```

### Auto-Refresh Sync
```typescript
interval(30000).subscribe(() => {
  if (syncStatus().pending > 0) {
    syncToCentral() // Silent
  }
})
```

## 🧮 Calculs Locaux

```typescript
calculateItemTotal(item) {
  base = (qty * price) - discount
  return item.tax_included ? base * 1.19 : base
}

getTotalPaid(sale) → sum(payments)
getRemainingAmount(sale) → total_ttc - paid
```

## 🎨 Indicateurs Visuels

| Élément | Couleur | Signification |
|---------|---------|---------------|
| DRAFT | slate | En édition |
| VALIDATED | blue | Prête à payer |
| PARTIALLY_PAID | yellow | Partiellement payée |
| PAID | emerald | Payée |
| CLOSED | purple | Clôturée |
| CANCELLED | red | Annulée |

## ✨ Améliorations par rapport à l'ancienne version

| Aspect | Avant | Après |
|--------|-------|-------|
| **Articles** | 1 montant fixe | Items multiples avec prix individuels |
| **Paiements** | 1 paiement direct | Multiples paiements traçables |
| **TVA** | Pas de gestion | Calculée par item, configurable |
| **Statut** | 3 simples | 6 états machine (logique métier) |
| **Validation** | Aucune | À chaque transition d'état |
| **Éditabilité** | Pas de restriction | Contrôlée par statut |
| **Stock** | N/A | Décrémenté uniquement à la clôture |
| **Traçabilité** | Minime | Complète (items, paiements, timestamps) |

## 🧪 Tests Recommandés

```gherkin
Scénario: Flux complet vente à articles multiples
  Given Utilisateur connecté
  When Clic "Nouveau Brouillon"
  And Saisit client_id = 42
  And Clic "Créer Brouillon"
  Then Affiche formulaire articles
  
  When Ajoute article #1 (produit 10, qty 5, prix 1000, TVA oui)
  And Ajoute article #2 (produit 20, qty 2, prix 500, TVA non)
  Then Totaux recalculés:
    HT = 5*1000 + 2*500 = 6000
    TVA = 5000 * 0.19 = 950 (article 1 only)
    TTC = 6000 + 950 = 6950
  
  When Clic "Valider"
  Then Status → VALIDATED
  
  When Clic "+ Ajouter Paiement"
  And Saisit montant 3475 (50%), méthode WAVE
  Then Status → PARTIALLY_PAID
  
  When Ajoute paiement 2 (3475, CASH)
  Then Status → PAID
  And Sale apparaît en finalisées
```

## 📞 Support Integration Backend

Vérifiez que le backend a:
- ✅ POST /api/sales/draft
- ✅ POST /api/sales/{id}/items
- ✅ DELETE /api/sales/{id}/items/{itemId}
- ✅ POST /api/sales/{id}/validate
- ✅ POST /api/sales/{id}/payment
- ✅ POST /api/sales/{id}/cancel
- ✅ GET /api/sales/{id}
- ✅ GET /api/sales (status PAID/CLOSED)

## 🚀 Prochaines Itérations

1. **Détail complet:** Implémentation du détail avec tous les formulaires
2. **Édition articles:** Modifier items sans supprimer/recréer
3. **Impression:** Facture PDF
4. **Historique:** Voir tous les statuts passés
5. **Recherche:** Filter ventes par client, date, montant
6. **Export:** CSV/Excel des ventes
